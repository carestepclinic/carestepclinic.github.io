"""Merge reviewed drug names into strength candidates without inventing strengths.

The name manifest contains identifiers/classifications only, not handbook text or
doses. Search names are deliberately separate from prescription matching aliases.
"""
import argparse
import copy
import json
from pathlib import Path

VERSION = '20261024-2'


def merge_references(document, manifest_path=None):
    manifest_path = Path(manifest_path or Path(__file__).with_name('strength-reference-names.json'))
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    result = copy.deepcopy(document)
    # Rebuilding is idempotent. Official IDs, aliases and option values are kept.
    items = [x for x in result['ingredients'] if x.get('sourceType') != 'reference-name']
    by_id = {x['id']: x for x in items}
    if len(by_id) != len(items):
        raise ValueError('Duplicate ingredient IDs in base catalog')
    for item in items:
        item.pop('referenceNames', None)
    for definition in manifest['additions']:
        if definition['id'] in by_id:
            raise ValueError('Reference ID collides with an existing ingredient')
        item = copy.deepcopy(definition)
        item.update(sourceType='reference-name', options=[])
        items.append(item)
        by_id[item['id']] = item
    for entry in manifest['coverage']:
        if not entry['targets']:
            raise ValueError('Unmapped reference name: ' + entry['name'])
        for ident in entry['targets']:
            if ident not in by_id:
                raise ValueError('Recheck reference mapping after official rebuild: ' + entry['name'])
            target = by_id[ident]
            names = target.setdefault('referenceNames', [])
            if entry['name'] not in names:
                names.append(entry['name'])
    result.update(version=VERSION, ingredients=items)
    result['nameSupplement'] = {
        'checkedAt': manifest['checkedAt'], 'source': manifest['source'],
        'referenceEntries': len(manifest['coverage']),
        'addedItems': len(manifest['additions']),
        'ingredientNames': sum(x['entryType'] == 'ingredient' for x in manifest['additions']),
        'complexEntries': sum(x['entryType'] != 'ingredient' for x in manifest['additions']),
    }
    result['notice'] = ('공식 허가정보의 함량 후보와 추가 약물명을 함께 제공합니다. '
        '추가 약물명은 허가·유통·동물종별 적합성이나 함량 검증을 뜻하지 않습니다. '
        '함량 후보가 없으면 실제 제품을 확인해 병원 기본값을 저장하세요.')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', required=True)
    args = parser.parse_args()
    path = Path(args.catalog)
    result = merge_references(json.loads(path.read_text(encoding='utf-8')))
    path.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'ingredients':len(result['ingredients']), **result['nameSupplement']}, ensure_ascii=False))
