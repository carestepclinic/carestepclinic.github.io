"""Rebuild public ingredient strengths from complete official MFDS list/detail JSON. Merge the reviewed name-only supplement; no handbook text or dosing input.
Example: python tools/build-strength-catalog.py --raw /path/to/raw --output practice-strength-catalog.json --audit /tmp/audit.json
Source/license: https://www.data.go.kr/data/15095677/openapi.do
"""
import json,re,math,hashlib,argparse
from pathlib import Path
from collections import Counter
from strength_reference_catalog import merge_references
parser=argparse.ArgumentParser()
parser.add_argument('--raw',required=True);parser.add_argument('--output',required=True);parser.add_argument('--audit',required=True)
args=parser.parse_args()
ROOT=Path(args.raw).parent
CHECKED='2026-10-23'
def number(s):
    s=str(s or '').strip()
    if not re.fullmatch(r'\d+(?:\.\d+)?',s): return None
    v=float(s)
    return v if math.isfinite(v) and v>0 else None

def unit(s):
    s=(s or '').strip().lower().replace('μ','u').replace('µ','u')
    return {'밀리그램':'mg','밀리그람':'mg','mg':'mg','마이크로그램':'mcg','마이크로그람':'mcg','ug':'mcg','mcg':'mcg','그램':'g','그람':'g','g':'g','gm':'g','mg(역가)':'mg'}.get(s)

def denominator(text):
    # Never treat total tablet weight, pack count, vial count, or percent as mg/mL.
    text=(text or '').replace(',','')
    boundary=r'(?=$|[^가-힣a-z]|중)'
    patterns=[('tablet',r'(\d+(?:\.\d+)?)\s*정'),('capsule',r'(\d+(?:\.\d+)?)\s*(?:캡슐|캅셀)'),('mL',r'(\d+(?:\.\d+)?)\s*(?:밀리리터|밀리리트|ml)'+boundary),('L',r'(\d+(?:\.\d+)?)\s*(?:리터|l)'+boundary),('g',r'(\d+(?:\.\d+)?)\s*(?:그램|그람|g)'+boundary)]
    for kind,pat in patterns:
        vals={float(v) for v in re.findall(pat,text,re.I)}
        if len(vals)>1:return None
        if len(vals)==1:
            val=next(iter(vals))
            if val<=0:return None
            return {'quantity':val*1000 if kind=='L' else val,'unit':'mL' if kind=='L' else kind}
    return None

def normalize_component(c):
    raw=c.get('분량',''); rawunit=c.get('단위',''); basis=c.get('총량','')
    out={'ingredient':c.get('성분명',''),'amountRaw':raw,'unitRaw':rawunit,'basisRaw':basis,'equivalenceRaw':c.get('성분정보',''),'noteRaw':c.get('비고',''),'normalization':'review_required','valueMg':None,'per':None,'strengthBasis':c.get('성분명',''),'issues':[]}
    amt=number(raw);u=unit(rawunit);d=denominator(basis)
    equivalence=c.get('성분정보','').strip()
    if equivalence:
        m=re.fullmatch(r'(.+?)(?:으로서|로서)\s*(\d+(?:\.\d+)?)\s*(mg|mcg|μg|µg|마이크로그램|밀리그램|밀리그람|그램)\s*',equivalence,re.I)
        if m:
            out['strengthBasis']=m[1].strip();amt=number(m[2]);u=unit(m[3])
            raw_n=number(raw);raw_u=unit(rawunit)
            if raw_n and raw_u and amt and u and amt*{'mg':1,'mcg':.001,'g':1000}[u]>raw_n*{'mg':1,'mcg':.001,'g':1000}[raw_u]*1.01:
                out['issues'].append('원료 질량보다 큰 환산량: 원문 수치 대조 필요')
        elif equivalence not in ('역가','역가로서'):
            out['issues'].append('성분정보의 환산 기준 확인')
    if amt is None:out['issues'].append('수치 확인')
    if not u:out['issues'].append('질량 단위 확인')
    if not d:out['issues'].append('1정·1mL 등 기준량 확인')
    if re.search(r'용해|현탁시|조제|희석|물.*가|녹',basis+c.get('비고','')):out['issues'].append('조제 후 기준량 확인')
    if not out['issues']:
        out['valueMg']=amt*{'mg':1,'mcg':.001,'g':1000}[u]/d['quantity'];out['per']=d['unit'];out['normalization']='structured';out['denominator']=d
    return out

def material_components(raw):
    parts=re.split(r';\s*(?=총량\s*:)',raw or '')
    result=[]
    for text in parts:
        row={}
        for field in text.split('|'):
            k,sep,v=field.partition(':')
            if sep:row[k.strip()]=v.strip()
        if row.get('성분명'):result.append(normalize_component(row))
    return result

def product_from_mfds(p,detail):
    comps=material_components(detail.get('MATERIAL_NAME',''))
    english=sorted(set(x.strip() for x in (p.get('ITEM_INGR_NAME') or detail.get('MAIN_INGR_ENG') or '').split('/') if x.strip()))
    issues=[]
    name=p['ITEM_NAME'];chart=detail.get('CHART') or ''
    if not comps:issues.append('원료약품 분량 미확인')
    if any(c['normalization']!='structured' for c in comps):issues.append('함량 기준 추가 확인')
    if len(english)>1:issues.append('복합제·다성분')
    if p.get('CANCEL_NAME')!='정상':issues.append('허가 상태 확인')
    if '수출용' in name:issues.append('수출용 표시')
    if detail.get('MAKE_MATERIAL_FLAG')!='완제의약품':issues.append('완제의약품 여부 확인')
    if re.search(r'서방|장용|지속|방출조절',name+chart):issues.append('분할·분쇄 및 방출 특성 확인')
    if re.search(r'주사|수액|점안|안연고|점이|외용|연고|크림|겔|패취|패치|좌제|흡입',name+chart):issues.append('경구 계산 외 제형·경로')
    unique={(c['strengthBasis'],c['valueMg'],c['per']) for c in comps if c['normalization']=='structured'}
    if len(unique)>1:issues.append('성분별·규격별 함량 구분 필요')
    if any(c['per']=='capsule' for c in comps):issues.append('캡슐 분할·조제 가능 여부 확인')
    return {'id':'mfds:'+p['ITEM_SEQ'],'source':'MFDS','sourceId':p['ITEM_SEQ'],'name':name,'englishName':p.get('ITEM_ENG_NAME') or '', 'manufacturer':p.get('ENTP_NAME') or '', 'ingredientEnglish':english,'permitStatus':p.get('CANCEL_NAME') or '미확인','permitDate':p.get('ITEM_PERMIT_DATE') or '', 'sourceUpdatedAt':detail.get('CHANGE_DATE') or '', 'sourceUrl':'https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq='+p['ITEM_SEQ'],'checkedAt':CHECKED,'supplyStatus':'미확인','chart':chart,'pack':detail.get('PACK_UNIT') or '', 'finishedProduct':detail.get('MAKE_MATERIAL_FLAG') or '', 'components':comps,'issues':list(dict.fromkeys(issues)), 'reviewStatus':'unreviewed','autoApply':False}

def read_pages(kind):
    rows=[]; pages=[]; total=None; size=None
    for f in sorted((Path(args.raw)/kind).glob('[0-9][0-9][0-9][0-9][0-9].json')):
        d=json.loads(f.read_text(encoding='utf-8-sig'))
        b=d['body'];rows.extend(b['items']);pages.append(b['pageNo']);total=b['totalCount'];size=b['numOfRows']
    expected=math.ceil(total/size) if total and size else 0
    complete=pages==list(range(1,expected+1)) and len(rows)==total
    return rows,{'rows':len(rows),'expectedRows':total,'pages':len(pages),'expectedPages':expected,'complete':complete}

def build():
    listing, ls=read_pages('list'); details, ds=read_pages('detail')
    assert ls['complete'] and ds['complete']
    dm={p['ITEM_SEQ']:p for p in details}
    assert len(dm)==len(details) and set(dm)=={p['ITEM_SEQ'] for p in listing}
    groups={}; excluded=Counter(); included=0
    for item in listing:
        p=product_from_mfds(item,dm[item['ITEM_SEQ']])
        reason=''
        if p['permitStatus']!='정상' or p['finishedProduct']!='완제의약품' or '수출' in p['name']:reason='inactive_or_export_or_raw'
        elif len(p['ingredientEnglish'])!=1 or len(p['components'])!=1:reason='combination_or_multiple_components'
        else:
            c=p['components'][0]
            if c['normalization']!='structured' or c['issues'] or c['per'] not in ('tablet','capsule','mL'):reason='unresolved_strength'
            elif re.search(r'점안|점이|외용|안연고|연고|크림|겔|패취|패치|좌제|흡입|가글|관류|투석|복막|안구|치과|스프레이|비강',p['name']+' '+p['chart']):reason='unsupported_route'
        if reason:excluded[reason]+=1;continue
        c=p['components'][0]; name=p['ingredientEnglish'][0].strip(); basis=c['strengthBasis'].strip()
        route='injection' if re.search(r'주사|수액',p['name']+' '+p['chart']) else 'oral'
        kind={'tablet':'tablet','capsule':'capsule','mL':'liquid'}[c['per']]
        if route=='injection' and kind!='liquid':excluded['unresolved_injection']+=1;continue
        if kind=='liquid' and route=='oral' and not re.search(r'경구|시럽|내복|현탁',p['name']+' '+p['chart']):excluded['unresolved_liquid_route']+=1;continue
        if kind in ('tablet','capsule'):
            shown=re.findall(r'(\d+(?:\.\d+)?)\s*(밀리그램|밀리그람|마이크로그램|마이크로그람|mg|mcg|μg|µg)(?!/)',p['name'],re.I)
            values={float(n)*(.001 if u.lower() in ('마이크로그램','마이크로그람','mcg','μg','µg') else 1) for n,u in shown}
            if values and (len(values)!=1 or abs(next(iter(values))-c['valueMg'])>max(1e-8,c['valueMg']*.001)):excluded['name_strength_conflict']+=1;continue
        release='extended' if re.search(r'서방|지속|방출조절',p['name']+' '+p['chart']) else 'enteric' if re.search(r'장용',p['name']+' '+p['chart']) else 'standard'
        key=name.casefold()+'|'+basis
        ident='mfds-'+hashlib.sha256(key.encode()).hexdigest()[:20]
        g=groups.setdefault(ident,{'id':ident,'name':basis,'english':name,'aliases':sorted(set([name,basis,c['ingredient'].strip()])), 'options':{}})
        # Exact English and Korean official names are retained. Salt stripping is NOT mass conversion.
        val=c['valueMg'];unit='mg'
        if val<1:val=round(val*1000,10);unit='mcg'
        elif val==int(val):val=int(val)
        k=(kind,route,release,val,unit)
        o=g['options'].setdefault(k,{'kind':kind,'route':route,'release':release,'value':val,'unit':unit,'sources':[],'count':0})
        o['count']+=1;included+=1
        if len(o['sources'])<2:o['sources'].append({'id':p['id'],'name':p['name'],'url':p['sourceUrl']})
    rows=[]
    for g in groups.values():
        g['options']=sorted(g['options'].values(),key=lambda x:(x['route'],x['kind'],x['release'],x['value']))
        for i,o in enumerate(g['options']):o['id']=g['id']+'-'+str(i+1)
        rows.append(g)
    rows.sort(key=lambda x:x['english'].casefold())
    doc={'format':'carestep-ingredient-strengths/v1','version':'20261024-1','checkedAt':'2026-10-23','source':{'name':'식품의약품안전처 의약품 제품 허가정보','url':'https://www.data.go.kr/data/15095677/openapi.do','license':'이용허락범위 제한 없음'},'notice':'허가정보의 함량 후보입니다. 현재 유통·재고 및 개·고양이 사용 적합성을 뜻하지 않습니다. 병원에서 실제 사용하는 제형·함량을 확인한 뒤 저장하세요.','ingredients':rows}
    doc=merge_references(doc)
    target=Path(args.output)
    target.write_text(json.dumps(doc,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    summary={'sourceProducts':len(listing),'includedProducts':included,'ingredients':len(doc['ingredients']),'officialIngredients':len(rows),'referenceNames':doc['nameSupplement']['addedItems'],'options':sum(len(g['options']) for g in rows),'excluded':dict(excluded),'bytes':target.stat().st_size,'source':'complete MFDS list/detail feed plus reviewed drug names; no handbook doses or clinic records'}
    Path(args.audit).write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(summary,ensure_ascii=False))
if __name__=='__main__':build()
