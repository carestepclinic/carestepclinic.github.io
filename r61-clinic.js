/* R61 integrated Clinic controls. All server actions require existing session. */
( () => {
    'use strict';
    const el = (tag, text) => {
        const n = document.createElement(tag);
        if (text)
            n.textContent = text;
        return n;
    }
    ;
    const api = (path, body, opt={}) => saasRequest('/saas/r61' + path, body === undefined ? opt : {
        ...opt,
        method: 'POST',
        body: JSON.stringify(body)
    });
    const selection = () => typeof window.crmMaterialContext==='function' ? (window.crmMaterialContext()||{}) : (window.crmWorkspaceSelection?.() || window.crmCurrentPatient?.() || {});
    window.r61TaskStillActive = async x => {
        await loadFollowupScheduleBoard(false);
        const buckets=workFirstBuckets();const item = [...buckets.all,...(buckets.backlog||[])].find(r => String(r.id) === x.taskId && r.patientId === x.patientId && r.guardianId === x.guardianId);
        return !!item && (!x.type || item.sourceType === x.type) && !['resolved', 'completed', 'canceled', 'deleted'].includes(item.action?.status || item.operationalStatus || item.status);
    }
    ;
    function dialog(title) {
        const d = el('dialog')
          , h = el('h2', title)
          , body = el('div')
          , close = el('button', '닫기');
        d.className='r61-dialog';body.className='r61-dialog-body';close.className='btn btn-secondary r61-dialog-close';
        h.id='r61-dialog-title-'+Math.random().toString(36).slice(2);d.setAttribute('aria-labelledby',h.id);
        const header=el('header');header.append(h,close);d.append(header,body);
        close.onclick = () => d.close();
        d.addEventListener('close', () => {d.remove();window.requestAnimationFrame?.(()=>{if(document.querySelector('dialog[open]'))return;window.scrollTo({top:returnY,behavior:'instant'});if(returnFocus?.isConnected)returnFocus.focus?.({preventScroll:true});});});
        document.body.append(d);
        d.showModal();
        return {
            d,
            body
        };
    }
    function button(parent, label, action) {
        const b = el('button', label);
        b.type = 'button';
        b.className = 'btn btn-secondary';
        parent.append(b);
        b.onclick = async () => {
            b.disabled = true;
            try {
                await action();
            } catch {
                alert('처리하지 못했습니다. 권한·선택 대상과 저장 상태를 확인해주세요. 자동 재시도하지 않습니다.');
            } finally {
                b.disabled = false;
            }
        }
        ;
        return b;
    }
    const materialScopeKeys = ['clinicId', 'userId', 'sessionId', 'patientId', 'guardianId', 'materialId', 'materialRevision', 'channel'];
    const materialReceiptKeys = ['deliveryId', 'clinicId', 'patientId', 'guardianId', 'materialId', 'materialRevision', 'channel', 'status', 'createdAt'];
    const materialKinds = [['advanced', '고급 보호자 자료'], ['medication', '복약 체크표'], ['discharge', '퇴원 안내'], ['disease', '질환 안내'], ['postoperative', '수술 후 관리'], ['results', '검사 결과 설명'], ['guardian', '기타 보호자 공개 자료']];
    const materialKindLabel = kind => materialKinds.find(([value]) => value === kind)?.[1] || '';
    const materialDraftSources = Object.freeze({advanced: 'pdf', medication: 'medcheck', discharge: 'summary'});
    const materialDraftError = code => ({
        PDF_PATIENT_CHANGED: '환자 선택이 달라졌습니다. 창을 닫고 대상 환자에서 다시 열어주세요.',
        PDF_MEDICATION_REQUIRED: '복약정보에 약 이름을 먼저 입력해주세요.',
        PDF_MEDICATION_DURATION_REQUIRED: '각 약의 투약 기간을 1~90일의 일수로 입력해주세요.',
        PDF_MEDICATION_START_DATE_REQUIRED: '환자 정보의 퇴원일/관리 시작일을 확인해주세요. 날짜를 임의로 지정하지 않습니다.',
        PDF_DRAFT_SOURCE_UNAVAILABLE: '이 유형은 자동 초안 생성기가 없습니다. 제목과 본문을 직접 작성한 뒤 공개 내용을 미리보기해주세요.'
    }[code] || '초안을 만들지 못했습니다. 선택 환자와 입력 내용을 확인해주세요.');
    function renderMaterialDraftPDF(kind, patientId) {
        const source = materialDraftSources[kind];
        if (!source)
            throw Error('PDF_DRAFT_SOURCE_UNAVAILABLE');
        const samePatient = () => {
            if (!patientId || selection().patientId !== patientId || window.crmCurrentPatient?.()?.patientId !== patientId)
                throw Error('PDF_PATIENT_CHANGED');
        };
        samePatient();
        if (typeof documentOutputDescriptor !== 'function')
            throw Error('PDF_GENERATOR_UNAVAILABLE');
        const desc = documentOutputDescriptor(source);
        const doc = document.getElementById('pdfDocument');
        if (!doc || typeof desc?.render !== 'function')
            throw Error('PDF_GENERATOR_UNAVAILABLE');
        // Never reuse the last visible PDF, including another patient's or kind's output.
        doc.replaceChildren();
        delete doc.dataset.r61Patient;
        delete doc.dataset.r61MaterialKind;
        try {
            if (kind === 'medication') {
                if (typeof readCaseInfoFromForm !== 'function' || typeof medicationCheckMeta !== 'function')
                    throw Error('PDF_GENERATOR_UNAVAILABLE');
                readCaseInfoFromForm();
                const meta = medicationCheckMeta();
                if (!meta.meds.length)
                    throw Error('PDF_MEDICATION_REQUIRED');
                if (!meta.valid)
                    throw Error('PDF_MEDICATION_DURATION_REQUIRED');
                const date = typeof caseInfo === 'undefined' ? '' : caseInfo.dischargeDate;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date)
                    throw Error('PDF_MEDICATION_START_DATE_REQUIRED');
            }
            desc.render();
            samePatient();
            if (doc.classList.contains('hidden') || !doc.querySelector('.pdf-page') || !doc.innerText.trim())
                throw Error('PDF_GENERATOR_UNAVAILABLE');
            doc.dataset.r61Patient = patientId;
            doc.dataset.r61MaterialKind = kind;
            return doc;
        } catch (e) {
            doc.replaceChildren();
            doc.classList.add('hidden');
            delete doc.dataset.r61Patient;
            delete doc.dataset.r61MaterialKind;
            throw e;
        }
    }
    const materialId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(x);
    const materialCanon = v => JSON.stringify(Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])));
    const materialHash = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), x => x.toString(16).padStart(2, '0')).join('');
    function materialScope(mid, revision) {
        const s = selection();
        if (typeof saasMode === 'undefined' || saasMode !== 'auth' || typeof saasToken !== 'string' || !saasToken || typeof saasMe === 'undefined' || typeof saasSessionMeta === 'undefined')
            throw Error('MATERIAL_LOGIN_REQUIRED');
        const q = {
            clinicId: saasMe?.clinic?.id,
            userId: saasMe?.user?.id,
            sessionId: saasSessionMeta?.id,
            patientId: s.patientId,
            guardianId: s.guardianId,
            materialId: mid,
            materialRevision: revision,
            channel: 'home'
        };
        for (const k of ['clinicId', 'userId', 'sessionId', 'patientId', 'guardianId', 'materialId'])
            if (!materialId(q[k]))
                throw Error('MATERIAL_SCOPE_MISSING');
        if (!Number.isSafeInteger(revision) || revision < 1)
            throw Error('MATERIAL_REVISION_INVALID');
        return q;
    }
    function materialSame(a, b) {
        if (!a || !b || materialScopeKeys.some(k => a[k] !== b[k]))
            throw Error('MATERIAL_SCOPE_CHANGED');
    }
    async function materialVerify(d, p) {
        if (d?.ok !== true || d.previewId !== p.previewId || !materialId(d.deliveryId) || !d.receipt || Object.keys(d.receipt).sort().join(',') !== [...materialReceiptKeys].sort().join(','))
            throw Error('MATERIAL_RECEIPT_UNCONFIRMED');
        materialSame(d.scope, p.scope);
        for (const k of ['clinicId', 'patientId', 'guardianId', 'materialId', 'materialRevision', 'channel'])
            if (d.receipt[k] !== p.scope[k])
                throw Error('MATERIAL_RECEIPT_SCOPE');
        if (d.receipt.deliveryId !== d.deliveryId || d.receipt.status !== 'sent' || typeof d.receipt.createdAt !== 'string' || !Number.isFinite(Date.parse(d.receipt.createdAt)) || d.receiptSHA256 !== await materialHash(materialCanon(d.receipt)))
            throw Error('MATERIAL_RECEIPT_UNCONFIRMED');
        return d;
    }
    async function materials() {
        const selected = selection();
        if (!materialId(selected.patientId) || !materialId(selected.guardianId)) {
            alert('환자 작업공간에서 연결된 환자·보호자를 먼저 선택해주세요.');
            return;
        }
        const {body} = dialog('보호자에게 보내기 · CARESTEP Home')
          , info = el('p')
          , select = el('select')
          , preview = el('pre');
        preview.style.whiteSpace = 'pre-wrap';
        body.append(info, select, preview);
        let p = null
          , busy = false
          , enabled = false
          , uncertain = null;
        const base = materialScope('scope-check', 1);
        const cfg = await api('/config');
        materialSame(materialScope('scope-check', 1), base);
        enabled = cfg?.ok === true && cfg.flags?.guardian_material_delivery === true;
        info.textContent = enabled ? 'CARESTEP Home 자료함에만 게시합니다. 문자·알림톡·푸시·외부 링크 안내는 보내지 않습니다.' : '보호자 자료 송부 준비 중 · 기능 OFF';
        const current = () => {
            const m = list.materials.find(x => x.id === select.value);
            if (!m)
                throw Error('MATERIAL_NOT_SELECTED');
            return materialScope(m.id, m.revision);
        }
        ;
        const key = q => 'carestep_r107_material_attempt:' + JSON.stringify(materialScopeKeys.map(k => q[k]));
        const readAttempt = q => {
            const raw = sessionStorage.getItem(key(q));
            if (!raw)
                return null;
            const x = JSON.parse(raw);
            if (!['pending', 'unconfirmed', 'sent'].includes(x.state) || !materialId(x.previewId))
                throw Error('MATERIAL_ATTEMPT_INVALID');
            return x;
        }
        ;
        const pendingKey = 'carestep_r107_material_unconfirmed';
        const readPending = () => {
            const raw = sessionStorage.getItem(pendingKey);
            if (!raw)
                return null;
            const x = JSON.parse(raw);
            if (!['pending', 'unconfirmed'].includes(x.state) || !materialId(x.previewId) || !x.scope || materialScopeKeys.some(k => !Object.hasOwn(x.scope, k)))
                throw Error('MATERIAL_ATTEMPT_INVALID');
            return x;
        }
        ;
        const reserve = (q, value) => {
            const raw = JSON.stringify(value);
            sessionStorage.setItem(key(q), raw);
            if (sessionStorage.getItem(key(q)) !== raw)
                throw Error('MATERIAL_RESERVATION_UNCONFIRMED');
            if (value.state === 'sent') {
                const pending = readPending();
                if (pending && pending.previewId !== value.previewId)
                    throw Error('MATERIAL_PENDING_SCOPE');
                sessionStorage.removeItem(pendingKey);
                if (sessionStorage.getItem(pendingKey) !== null)
                    throw Error('MATERIAL_RESERVATION_UNCONFIRMED');
            } else {
                const pending = JSON.stringify({
                    ...value,
                    scope: q
                });
                sessionStorage.setItem(pendingKey, pending);
                if (sessionStorage.getItem(pendingKey) !== pending)
                    throw Error('MATERIAL_RESERVATION_UNCONFIRMED');
            }
        }
        ;
        const send = el('button', '보호자에게 보내기')
          , make = el('button', '미리보기')
          , recover = el('button', '기존 송부 결과 확인')
          , historyButton = el('button', '발송·열람 이력');
        for (const b of [make, send, recover, historyButton]) {
            b.type = 'button';
            b.className = 'btn btn-secondary';
            body.append(b);
        }
        send.disabled = make.disabled = !enabled;
        const list = enabled ? await api('/materials?patientId=' + encodeURIComponent(base.patientId)) : {
            materials: []
        };
        materialSame(materialScope('scope-check', 1), base);
        if (!Array.isArray(list.materials))
            throw Error('MATERIAL_LIST_UNCONFIRMED');
        for (const m of list.materials) {
            if (!materialId(m.id) || !Number.isSafeInteger(m.revision) || m.revision < 1)
                throw Error('MATERIAL_LIST_INVALID');
            const o = el('option', m.title);
            o.value = m.id;
            select.append(o);
        }
        function controls() {
            send.disabled = !enabled || busy || !!uncertain || !p;
            make.disabled = !enabled || busy || !!uncertain;
            select.disabled = busy || !!uncertain;
            recover.disabled = busy || !uncertain;
        }
        function restore() {
            p = null;
            uncertain = readPending();
            if (uncertain && list.materials.some(m => m.id === uncertain.scope.materialId))
                select.value = uncertain.scope.materialId;
            if (!uncertain && list.materials.length) {
                const saved = readAttempt(current());
                if (saved && saved.state !== 'sent')
                    uncertain = {
                        ...saved,
                        scope: current()
                    };
            }
            if (uncertain)
                preview.textContent = '송부 결과 미확정입니다. 원래 환자·자료의 기존 결과만 확인하세요. 새 미리보기·재송부는 차단됩니다.';
            controls();
        }
        select.onchange = () => {
            if (busy || uncertain)
                return;
            restore();
        }
        ;
        restore();
        make.onclick = async () => {
            if (busy || uncertain || !enabled)
                return;
            busy = true;
            controls();
            try {
                const pending = readPending();
                if (pending) {
                    uncertain = pending;
                    throw Error('MATERIAL_ATTEMPT_UNCONFIRMED');
                }
                const q = current();
                const d = await api('/preview', {
                    patientId: q.patientId,
                    materialId: q.materialId,
                    channel: 'home',
                    scope: q
                });
                materialSame(current(), q);
                if (d?.ok !== true || !materialId(d.previewId) || d.homeOnly !== true)
                    throw Error('MATERIAL_PREVIEW_INVALID');
                materialSame(d.scope, q);
                p = d;
                preview.textContent = d.patientName + ' / 보호자 ' + d.guardianName + '\n자료: ' + d.title + '\nCARESTEP Home 게시\n\n' + d.text + (d.duplicateWarning ? '\n기존 송부가 있습니다. 다시 게시하려면 명시적 중복 확인이 필요합니다.' : '');
            } catch {
                p = null;
                alert('선택 대상과 미리보기를 확인하지 못했습니다. 송부하지 않습니다.');
            } finally {
                busy = false;
                controls();
            }
        }
        ;
        send.onclick = async () => {
            if (busy || uncertain || !enabled || !p)
                return;
            busy = true;
            controls();
            let reserved = false;
            const fixed = p;
            try {
                const pending = readPending();
                if (pending) {
                    uncertain = pending;
                    throw Error('MATERIAL_ATTEMPT_UNCONFIRMED');
                }
                materialSame(current(), fixed.scope);
                const warning = fixed.duplicateWarning ? '\n기존 송부가 있습니다. 같은 자료를 다시 게시하는 것을 승인합니까?' : '';
                if (!confirm('환자: ' + fixed.patientName + '\n보호자: ' + fixed.guardianName + '\n자료: ' + fixed.title + '\n채널: CARESTEP Home 게시' + warning))
                    return;
                materialSame(current(), fixed.scope);
                const old = readAttempt(fixed.scope);
                if (old && old.state !== 'sent')
                    throw Error('MATERIAL_ATTEMPT_UNCONFIRMED');
                reserve(fixed.scope, {
                    state: 'pending',
                    previewId: fixed.previewId
                });
                reserved = true;
                uncertain = {
                    state: 'pending',
                    previewId: fixed.previewId,
                    scope: fixed.scope
                };
                const d = await api('/deliver', {
                    previewId: fixed.previewId,
                    confirmed: true,
                    duplicateAcknowledged: fixed.duplicateWarning === true,
                    channel: 'home',
                    scope: fixed.scope
                }, {
                    redirect: 'error'
                });
                materialSame(current(), fixed.scope);
                await materialVerify(d, fixed);
                materialSame(current(), fixed.scope);
                reserve(fixed.scope, {
                    state: 'sent',
                    previewId: fixed.previewId,
                    deliveryId: d.deliveryId
                });
                uncertain = null;
                p = null;
                preview.textContent = '전송 완료 · CARESTEP Home 게시\nDelivery ID: ' + d.deliveryId;
            } catch {
                p = null;
                if (reserved) {
                    try {
                        reserve(fixed.scope, {
                            state: 'unconfirmed',
                            previewId: fixed.previewId
                        });
                    } catch {}
                    uncertain = {
                        state: 'unconfirmed',
                        previewId: fixed.previewId,
                        scope: fixed.scope
                    };
                    preview.textContent = '송부 결과 미확정 · 재송부 금지. 기존 결과 확인만 진행해주세요.';
                } else
                    alert('환자·보호자·병원·로그인 상태가 바뀌었거나 저장 증거를 준비하지 못했습니다. 송부하지 않습니다.');
            } finally {
                busy = false;
                controls();
            }
        }
        ;
        recover.onclick = async () => {
            if (busy || !uncertain)
                return;
            busy = true;
            controls();
            try {
                const q = current()
                  , saved = readAttempt(q);
                if (!saved || saved.state === 'sent')
                    throw Error('MATERIAL_NO_PENDING_ATTEMPT');
                materialSame(q, uncertain.scope || q);
                const expected = {
                    previewId: saved.previewId,
                    scope: q
                };
                const d = await api('/delivery-receipt?previewId=' + encodeURIComponent(saved.previewId), undefined, {
                    redirect: 'error'
                });
                materialSame(current(), q);
                await materialVerify(d, expected);
                materialSame(current(), q);
                reserve(q, {
                    state: 'sent',
                    previewId: saved.previewId,
                    deliveryId: d.deliveryId
                });
                uncertain = null;
                p = null;
                preview.textContent = '전송 완료 · 기존 CARESTEP Home 게시 확인\nDelivery ID: ' + d.deliveryId;
            } catch {
                preview.textContent = '기존 송부 결과를 확정하지 못했습니다. 재송부하지 말고 별도 판정을 요청해주세요.';
            } finally {
                busy = false;
                controls();
            }
        }
        ;
        historyButton.onclick = async () => {
            if (busy)
                return;
            try {
                const q = current();
                const d = await api('/deliveries?patientId=' + encodeURIComponent(q.patientId));
                materialSame(current(), q);
                if (d?.ok !== true || !Array.isArray(d.deliveries))
                    throw Error('HISTORY');
                preview.textContent = d.deliveries.map(x => [x.deliveryId || x.id, x.created_at, x.channel, x.status, x.viewed_at ? '열람 확인' : '열람 미확인'].join(' · ')).join('\n') || '발송 이력이 없습니다.';
            } catch {
                alert('송부 이력을 확인하지 못했습니다.');
            }
        }
        ;
    }
    const preventiveReasons = {
        GUARDIAN_OPTED_OUT: '보호자별 예방문자 해제', CLINIC_DEFAULT: '병원 기본 허용', EXPLICIT_CONSENT: '개별 동의 기록',
        DUE_TODAY: '예정일 당일', 'DUE_BEFORE-7': '접종 7일 전', 'DUE_BEFORE-3': '사상충 3일 전',
        FEATURE_OFF: '자동발송 꺼짐', ALREADY_CLAIMED_NO_REPEAT: '이미 처리한 일정 · 중복 발송 제외',
        PREVENTIVE_CONSENT_REQUIRED: '보호자 예방문자 동의 미등록', EXTERNAL_POLICY_DISABLED: '병원 외부 발송 허용 꺼짐',
        LMS_CHANNEL_DISABLED: 'LMS 채널 미선택', HOME_PUSH_UNAVAILABLE: 'Home 푸시 사용 불가',
        CLINIC_MESSAGING_DISABLED: '병원 문자 자동발송 설정 꺼짐', SENDER_NUMBER_REQUIRED: '발신번호 설정 필요',
        SOLAPI_CONNECTION_REQUIRED: 'SOLAPI 연결 필요', MESSAGING_FEATURE_UNAVAILABLE: '문자 발송 이용 권한 확인 필요',
        CLINIC_NOT_ACTIVE: '병원 활성·승인 상태 확인 필요', PREVENTIVE_MESSAGING_NOT_READY: '문자 발송 준비 상태 확인 필요',
        PREVENTIVE_LMS_POLICY_REQUIRED: '외부 발송 허용과 LMS 채널을 함께 선택해주세요.',
        PREVENTIVE_CHANNEL_INVALID: '예방관리 발송 방식을 다시 선택해주세요.',
        VACCINE_IDENTITY_REQUIRED: '접종 종류 확인 필요', PREVENTIVE_RECORD_REVIEW_REQUIRED: '예방 기록 날짜·일정 충돌 확인 필요'
    };
    const preventiveReason = code => preventiveReasons[code] || '발송 조건 확인 필요';
    function settingsSession() {
        if (typeof saasMode === 'undefined' || saasMode !== 'auth' || typeof saasMe === 'undefined' || typeof saasSessionMeta === 'undefined')
            throw Error('SESSION_CHANGED');
        const values = [saasMe?.clinic?.id, saasMe?.user?.id, saasSessionMeta?.id];
        if (values.some(x => !materialId(x))) throw Error('SESSION_CHANGED');
        return JSON.stringify(values);
    }
    async function preventivePreview() {
        const session = settingsSession();
        const {body} = dialog('예방관리 발송 예정 미리보기'), date = el('input');
        date.type = 'date';
        date.value = new Date(Date.now() + 32400000).toISOString().slice(0, 10);
        body.append(date, el('p', '접종은 7일 전·당일, 사상충은 3일 전·당일에 안내합니다. 날짜는 한국시간 기준입니다. 저장된 설정으로 조회하며 실제 문자는 보내지 않습니다.'));
        const rows = el('section');
        body.append(rows);
        button(body, '충돌 일정 확인·수정', preventiveReview);
        button(body, '실제 발송 결과', preventiveResults);
        button(body, '예정 대상 조회', async () => {
            try {
                if (settingsSession() !== session) throw Error('SESSION_CHANGED');
                const d = await api('/preventive/preview?date=' + encodeURIComponent(date.value), undefined, {redirect: 'error'});
                if (settingsSession() !== session) throw Error('SESSION_CHANGED');
                if (d?.ok !== true || !Array.isArray(d.targets)) throw Error('PREVIEW');
                rows.replaceChildren();
                rows.append(el('p', '발송 방식: ' + (d.mode === 'lms' ? '문자(LMS)' : 'Home 푸시 우선 · 불가 시 허용된 외부 채널')));
                for (const x of d.targets) {
                    const card = el('article');
                    card.style.cssText = 'border:1px solid #dbe3ed;border-radius:10px;padding:12px;margin:10px 0';
                    card.append(el('strong', x.patientName + ' · 보호자 ' + x.guardianName),
                        el('p', x.dueDate + ' · ' + (x.eligible ? '현재 조건상 발송 대상' : '현재 발송 제외')),
                        el('p', '채널: ' + (x.primaryChannel === 'lms' ? '문자(LMS)' : x.primaryChannel === 'home' ? 'Home 푸시' : x.externalCandidates?.join(', ') || '없음')),
                        el('p', (x.reason || []).map(preventiveReason).join(' · ')),
                        el('p', '외부 발송 기준: ' + preventiveReason(x.permissionBasis)));
                    if (x.message) {
                        const message = el('p', x.message);
                        message.style.cssText = 'white-space:pre-wrap;background:#f3f6fa;padding:12px;border-radius:8px';
                        card.append(message);
                    }
                    rows.append(card);
                }
                if (!d.targets.length) rows.append(el('p', '해당 날짜의 발송 예정 대상이 없습니다.'));
                if (d.excludedCount) rows.append(el('p', '접종 종류·날짜 등을 확인해야 하는 기록 ' + d.excludedCount + '건은 대상 계산에서 제외했습니다.'));
                rows.append(el('p', '실제 발송 직전에 일정·발송 허용·병원 설정을 다시 확인합니다. 발송 이력의 sent는 SOLAPI 접수를 뜻하며 보호자 수신 완료와 다릅니다.'));
            } catch (e) {
                rows.replaceChildren(el('p', e?.message === 'SESSION_CHANGED' ? '로그인 또는 병원이 바뀌었습니다. 창을 다시 열어주세요.' : '대상을 조회하지 못했습니다. 병원 설정과 예방 일정 기록을 확인해주세요.'));
            }
        });
    }
    async function preventivePreference() {
        const session = settingsSession(), selected = {...selection()};
        if (!selected.patientId || !selected.guardianId) throw Error('PATIENT');
        const guard = () => {
            if (settingsSession() !== session || selection().patientId !== selected.patientId || selection().guardianId !== selected.guardianId) throw Error('SESSION_CHANGED');
        };
        const {body} = dialog('선택 보호자 예방문자 허용·해제'), status = el('p');
        status.setAttribute('role', 'status'); body.append(status,
            el('p', '같은 보호자의 모든 환자에 적용됩니다. 해제 기록은 병원 기본 허용보다 우선합니다. 기본 설정 복원은 실제 동의 기록을 새로 만들지 않습니다.'));
        const render = d => {
            guard();
            if (d?.ok !== true || d.patientId !== selected.patientId || d.guardianId !== selected.guardianId || typeof d.allowed !== 'boolean' || !['GUARDIAN_OPTED_OUT','CLINIC_DEFAULT','EXPLICIT_CONSENT','PREVENTIVE_CONSENT_REQUIRED'].includes(d.basis)) throw Error('PREFERENCE_UNCONFIRMED');
            status.textContent = (d.allowed ? '예방문자 허용' : '예방문자 제외') + ' · ' + preventiveReason(d.basis);
        };
        try {
            guard();render(await api('/preventive/preference?patientId=' + encodeURIComponent(selected.patientId), undefined, {redirect: 'error'}));
        } catch (e) {status.textContent = '상태를 확인하지 못했습니다. 환자 선택을 확인하고 창을 다시 열어주세요.';return;}
        const save = async preference => {
            try {
                guard();
                if (!confirm(preference === 'blocked' ? '선택 보호자의 접종·사상충 예방문자를 해제하시겠습니까?' : '선택 보호자의 예방문자 해제를 취소하고 병원 기본 설정으로 복원하시겠습니까?')) return;
                guard();
                render(await api('/preventive/preference', {patientId:selected.patientId,guardianId:selected.guardianId,preference}, {redirect:'error'}));
            } catch (e) {status.textContent = '저장 결과를 확인하지 못했습니다. 창을 다시 열어 현재 상태를 조회해주세요.';}
        };
        button(body, '예방문자 해제', () => save('blocked'));
        button(body, '병원 기본 설정으로 복원', () => save('default'));
    }
    async function settings() {
        const session = settingsSession();
        const cfg = await api('/config');
        if (settingsSession() !== session) throw Error('SESSION_CHANGED');
        const {body} = dialog('후속 기능 설정')
          , inputs = {};
        const labels = {
            preventive_auto_delivery: '접종·사상충 자동 발송',
            followup_auto_completion: '최종확인 후 자동 완료·초기화',
            guardian_material_delivery: '보호자 자료 즉시 송부',
            efriends_home_visible_default: '공개 분류된 신규 eFriends 기록 Home 표시'
        };
        for (const [key,value] of Object.entries(cfg.flags)) {
            const l = el('label')
              , c = el('input');
            c.type = 'checkbox';
            c.checked = value;
            inputs[key] = c;
            l.append(c, document.createTextNode(labels[key]));
            l.style.display = 'block';
            body.append(l);
        }
        body.append(el('p', '접종·사상충 자동발송을 켜면 저장된 예정일과 보호자별 발송 허용 상태를 기준으로 정기 발송합니다. 먼저 대상과 문구를 확인해주세요.'));
        const preventiveMode = el('select');
        preventiveMode.id = 'r61PreventiveChannel';
        for (const [value,label] of [['home-first', 'Home 푸시 우선 · 불가 시 외부 채널'], ['lms', '문자(LMS)로 발송']]) {
            const option = el('option', label); option.value = value; preventiveMode.append(option);
        }
        preventiveMode.value = cfg.policy.preventiveChannel || 'home-first';
        const modeLabel = el('label', '접종·사상충 안내 방식 ');
        modeLabel.style.cssText = 'display:block;margin:14px 0';
        modeLabel.append(preventiveMode); body.append(modeLabel);
        body.append(el('p', '접종 7일 전·당일 / 사상충 3일 전·당일. 같은 환자의 같은 예정일·회차는 한 번만 처리하며, 지난 예정일을 소급 발송하지 않습니다.'));
        if (cfg.preventive?.reasons?.length)
            body.append(el('p', '문자 준비: ' + cfg.preventive.reasons.map(preventiveReason).join(' · ')));
        const defaultAllowed = el('input'); defaultAllowed.type = 'checkbox';
        defaultAllowed.checked = cfg.policy.preventiveDefaultAllowed === true;
        const defaultLabel = el('label', ' 기존·신규 보호자 예방문자 기본 허용');
        defaultLabel.prepend(defaultAllowed); defaultLabel.style.display = 'block'; body.append(defaultLabel,
            el('p', '한 번 저장하면 기존·신규 보호자에게 함께 적용됩니다. 기존 수신거부·개별 해제는 유지되며 실제 동의 완료 기록은 생성하지 않습니다. 보호자 자료 발송에는 적용되지 않습니다.'));
        button(body, '선택 보호자 예방문자 허용·해제', preventivePreference);
        const saveInfo = el('p'); saveInfo.setAttribute('role', 'status'); body.append(saveInfo);
        button(body, '선택 보호자의 예방문자 동의 기록', async () => {
            const selected = selection();
            if (!selected.patientId || !selected.guardianId) {saveInfo.textContent = '먼저 환자 작업공간에서 환자·보호자를 선택해주세요.'; return;}
            if (!confirm('선택한 보호자의 접종·사상충 예방 문자 수신 동의를 실제로 확인했습니까?')) return;
            if (settingsSession() !== session || selection().patientId !== selected.patientId || selection().guardianId !== selected.guardianId) throw Error('SESSION_CHANGED');
            const saved = await api('/consent', {patientId: selected.patientId, purpose: 'preventive', confirmed: true, explicitConsentRecorded: true}, {redirect: 'error'});
            if (settingsSession() !== session || saved?.ok !== true) throw Error('CONSENT_UNCONFIRMED');
            saveInfo.textContent = '선택한 보호자의 예방문자 동의를 저장했습니다. 예정 대상 조회에서 확인해주세요.';
        });
        if (cfg.flags.followup_auto_completion === true)
            button(body, '실제 후속관리 단계 확인', () => window.r83OpenRequiredStages());
        button(body, '예방관리 대상 먼저 확인', preventivePreview);
        const external = el('input');
        external.type = 'checkbox';
        external.checked = cfg.policy.enabled === true;
        const l = el('label', ' 병원 외부 발송 허용 (예방문자는 위 허용 기준 적용)');
        l.prepend(external);
        body.append(l);
        const channels = {};
        for (const [key,label] of [['lms', 'LMS'], ['kakao', '알림톡'], ['mms', 'MMS']]) {
            const c = el('input');
            c.type = 'checkbox';
            c.checked = (cfg.policy.channels || ['lms']).includes(key);
            channels[key] = c;
            const l = el('label', ' ' + label);
            l.prepend(c);
            body.append(l);
        }
        const bindings = {};
        for (const [key,label] of [['preventive', '예방관리 알림톡 템플릿 ID'], ['material', '보호자 자료 알림톡 템플릿 ID']]) {
            const l = el('label', label)
              , i = el('input');
            i.value = cfg.policy.templateBindings?.[key] || '';
            bindings[key] = i;
            l.append(i);
            body.append(l);
        }
        const image = el('input');
        image.value = cfg.policy.imageId || '';
        image.placeholder = '공개 승인 MMS 이미지 ID';
        body.append(image, el('p', '알림톡은 실제 승인 템플릿과 안내문구 변수 한 개를 서버에서 재확인합니다. MMS 이미지는 환자정보가 없는 보호자 공개용으로 검토해야 합니다.'));
        button(body, '설정 저장', async () => {
            try {
                if (settingsSession() !== session) throw Error('SESSION_CHANGED');
                const enabled = inputs.preventive_auto_delivery.checked;
                if (enabled && preventiveMode.value === 'lms' && (!external.checked || !channels.lms.checked)) {
                    saveInfo.textContent = '문자 자동발송에는 병원 외부 발송 허용과 LMS 채널을 모두 선택해주세요.';
                    return;
                }
                if (enabled && (!cfg.flags.preventive_auto_delivery || preventiveMode.value !== (cfg.policy.preventiveChannel || 'home-first')) &&
                    !confirm('접종 7일 전·당일, 사상충 3일 전·당일의 대상에게 정기 안내를 시작합니다. 문자 발송에는 SOLAPI 요금이 발생합니다. 저장하시겠습니까?')) return;
                if (defaultAllowed.checked && cfg.policy.preventiveDefaultAllowed !== true &&
                    !confirm('기존·신규 보호자를 예방문자 기본 허용 대상으로 설정합니다. 기존 수신거부는 유지됩니다. 자동발송이 켜져 있으면 다음 정기 발송부터 적용됩니다. 저장하시겠습니까?')) return;
                const changes = Object.fromEntries(Object.entries(inputs).filter(([k,v]) => v.checked !== cfg.flags[k]).map(([k,v]) => [k,v.checked]));
                const saved = await saasRequest('/saas/r61/config', {
                    method: 'PUT', redirect: 'error',
                    body: JSON.stringify({flags: changes, policy: {
                        ...cfg.policy, enabled: external.checked, preventiveChannel: preventiveMode.value, preventiveDefaultAllowed: defaultAllowed.checked,
                        channels: Object.keys(channels).filter(k => channels[k].checked),
                        templateBindings: Object.fromEntries(Object.entries(bindings).filter(([k,v]) => v.value.trim()).map(([k,v]) => [k,v.value.trim()])),
                        imageId: image.value.trim(),
                        imagePublicApproved: !!image.value.trim() && confirm('MMS 이미지가 개인정보 없는 보호자 공개용임을 확인했습니까?')
                    }})
                });
                if (settingsSession() !== session || saved?.ok !== true || !saved.flags || !saved.policy) throw Error('CONFIG_UNCONFIRMED');
                Object.assign(cfg, saved);
                saveInfo.textContent = saved.flags.preventive_auto_delivery ? '설정 저장 완료 · 자동발송 켜짐. 예정 대상 조회에서 확인해주세요.' : '설정 저장 완료 · 자동발송 꺼짐. 발송 없이 대상을 미리 확인할 수 있습니다.';
            } catch (e) {
                const code = Object.keys(preventiveReasons).find(k => String(e?.message || '').includes(k));
                saveInfo.textContent = code ? preventiveReason(code) : '설정 저장 결과를 확인하지 못했습니다. 창을 다시 열어 현재 설정을 확인해주세요.';
            }
        });
        button(body, '선택 보호자의 외부 발송 동의 기록', async () => {
            const s = selection();
            if (!s.patientId)
                throw Error('PATIENT');
            if (!confirm('해당 보호자의 예방관리·자료 외부 발송 동의를 실제로 확인했습니까?'))
                return;
            for (const purpose of ['preventive', 'material'])
                await api('/consent', {
                    patientId: s.patientId,
                    purpose,
                    confirmed: true,
                    explicitConsentRecorded: true
                });
            alert('동의 확인 기록을 저장했습니다.');
        }
        );
        button(body, '선택 보호자의 외부 발송 동의 철회', async () => {
            const s = selection();
            if (!s.patientId)
                throw Error('PATIENT');
            for (const purpose of ['preventive', 'material'])
                await api('/consent', {
                    patientId: s.patientId,
                    purpose,
                    confirmed: false,
                    explicitConsentRecorded: true
                });
            alert('동의 철회를 기록했습니다.');
        }
        );
        button(body, '기존 비공개 기록 공개 후보 미리보기', async () => {
            const s = selection();
            if (!s.patientId)
                throw Error('PATIENT');
            const from = prompt('시작일 YYYY-MM-DD')
              , to = prompt('종료일 YYYY-MM-DD');
            if (!from || !to)
                return;
            const d = await api('/visibility/preview', {
                patientId: s.patientId,
                from,
                to
            });
            const box = el('section')
              , chosen = new Map();
            for (const row of d.rows) {
                const line = el('label')
                  , c = el('input');
                c.type = 'checkbox';
                c.disabled = !row.eligible;
                chosen.set(row.id, c);
                line.style.display = 'block';
                line.append(c, document.createTextNode([row.date, row.type, row.eligible ? '구조화된 항목만 공개 검토' : '제외', row.reason].join(' · ')));
                box.append(line);
            }
            const approval = el('input');
            approval.placeholder = '별도 운영 승인 식별자';
            box.append(el('p', '최대 8개를 선택합니다. 내부 자유 메모는 공개하지 않습니다. 기능 플래그만으로는 실행되지 않으며 현재 별도 승인 기록은 없습니다.'), approval);
            const apply = button(box, '별도 승인 범위 확인 후 선택 공개', async () => {
                const ids = [...chosen].filter( ([id,c]) => c.checked).map( ([id]) => id);
                if (!ids.length || ids.length > 8) {
                    alert('1개부터 8개까지 선택해주세요.');
                    return;
                }
                if (!confirm('선택한 기록의 보호자 공개를 직접 검토했습니까? 내부 메모는 제외됩니다.'))
                    return;
                const result = await api('/visibility/apply', {
                    previewId: d.previewId,
                    ids,
                    approvalId: approval.value.trim(),
                    confirmed: true,
                    publicReviewConfirmed: true
                });
                alert(String(result.changed) + '개 기록을 공개했습니다.');
                apply.disabled = true;
            }
            );
            apply.disabled = true;
            approval.oninput = () => {
                apply.disabled = !approval.value.trim();
            }
            ;
            body.append(box);
        }
        );
    }
    async function approveMaterial() {
        const subject = {...selection()};
        const {body} = dialog('보호자 공개 자료 등록·승인')
          , kind = el('select')
          , title = el('input')
          , text = el('textarea');
        const existing = await api('/materials' + (subject.patientId ? '?patientId=' + encodeURIComponent(subject.patientId) : ''))
          , revokeChoice = el('select');
        for (const m of existing.materials) {
            const o = el('option', m.title);
            o.value = m.id;
            revokeChoice.append(o);
        }
        body.append(el('p', '기존 자료 폐기는 연결된 보호자 링크도 함께 취소합니다. 발송·열람 이력은 보존합니다.'), revokeChoice);
        button(body, '선택 자료와 링크 폐기', async () => {
            if (!revokeChoice.value)
                return;
            if (!confirm('선택 자료와 기존 링크를 폐기합니까? 이력은 삭제하지 않습니다.'))
                return;
            await api('/materials/revoke', {
                materialId: revokeChoice.value
            });
            revokeChoice.selectedOptions[0]?.remove();
            alert('자료와 링크를 폐기했습니다.');
        }
        );
        title.placeholder = '자료 제목';
        text.placeholder = '보호자에게 공개할 본문 (직원 메모·Secret·연락처 제외)';
        text.rows = 12;
        for (const [v,n] of materialKinds) {
            const o = el('option', n);
            o.value = v;
            kind.append(o);
        }
        body.append(kind, title, text, el('p', subject.patientId ? '이 자료는 현재 선택한 환자·보호자에게만 사용할 수 있습니다.' : '공통 자료 등록입니다. 특정 환자 정보는 포함하지 마세요.'));
        const sourceInfo = el('p'), preview = el('pre');
        body.append(sourceInfo);
        const drafts = new Map();
        let selectedKind = kind.value, reviewed = null;
        const draftValue = () => JSON.stringify([kind.value, title.value, text.value]);
        const sameSubject = () => {
            const active = selection();
            if (['patientId', 'guardianId'].some(k => active[k] !== subject[k]))
                throw Error('PDF_PATIENT_CHANGED');
        };
        const importDraft = button(body, '선택 유형으로 초안 새로 만들기', async () => {
            try {
                sameSubject();
                if (text.value.trim() && !confirm('현재 유형의 본문을 새로 생성한 초안으로 바꿀까요?'))
                    return;
                const doc = renderMaterialDraftPDF(kind.value, subject.patientId);
                sameSubject();
                title.value = title.value.trim() || materialKindLabel(kind.value);
                text.value = doc.innerText;
                reviewed = null;
                preview.textContent = '선택 유형의 새 초안입니다. 환자·처방·내용을 검토한 뒤 공개 내용 미리보기를 눌러주세요.';
            } catch (e) {
                reviewed = null;
                preview.textContent = materialDraftError(e.message) + ' [' + e.message + ']';
            }
        });
        const updateSource = () => {
            importDraft.disabled = !subject.patientId || !materialDraftSources[kind.value];
            sourceInfo.textContent = !subject.patientId ? '자동 초안은 환자를 선택한 뒤 사용할 수 있습니다.' : materialDraftSources[kind.value]
                ? (kind.value === 'medication' ? '현재 환자의 약·투약 기간·관리 시작일로 복약 체크표를 새로 생성합니다.' : materialKindLabel(kind.value) + ' 생성기를 실행해 새 초안을 가져옵니다.')
                : materialDraftError('PDF_DRAFT_SOURCE_UNAVAILABLE');
        };
        kind.onchange = () => {
            drafts.set(selectedKind, {title: title.value, text: text.value});
            selectedKind = kind.value;
            const draft = drafts.get(selectedKind);
            title.value = draft?.title || materialKindLabel(selectedKind);
            text.value = draft?.text || '';
            reviewed = null;
            preview.textContent = '';
            updateSource();
        };
        title.oninput = text.oninput = () => { reviewed = null; };
        updateSource();
        preview.style.whiteSpace = 'pre-wrap';
        body.append(preview);
        button(body, '공개 내용 미리보기', async () => {
            sameSubject();
            preview.textContent = title.value + '\n\n' + text.value;
            reviewed = draftValue();
        }
        );
        button(body, '관리자 공개 승인 후 등록', async () => {
            sameSubject();
            if (!title.value.trim() || !text.value.trim() || reviewed !== draftValue()) {
                alert('현재 내용을 미리보기해주세요.');
                return;
            }
            if (!confirm('내부 직원용 내용이 없으며 보호자 공개를 승인합니까?'))
                return;
            sameSubject();
            await api('/materials', {
                patientId: subject.patientId || undefined,
                kind: kind.value,
                title: title.value,
                text: text.value,
                audience: 'guardian',
                approved: true,
                finalPublicReview: true
            });
            alert('공개 승인 자료로 등록했습니다.');
        }
        );
    }

    // R113 PDF controller has no file-picker or arbitrary upload input.
    function pdfController({scope, request, storage, lookupScope=scope, selectMaterial}) {
        let busy = false
          , pending = storage.getItem('carestep_r113_pdf_pending') !== null
          , generated = null
          , asset = null
          , sent = false
          , verdict = null;
        const fixedScope = () => {
            const s = scope()
              , q = materialScopeKeys.reduce( (o, k) => (o[k] = s?.[k],
            o), {});
            for (const k of ['clinicId', 'userId', 'sessionId', 'patientId', 'guardianId', 'materialId'])
                if (!materialId(q[k]))
                    throw Error('PDF_SCOPE_MISSING');
            if (!Number.isSafeInteger(q.materialRevision) || q.materialRevision < 1 || q.channel !== 'home')
                throw Error('PDF_SCOPE_INVALID');
            return q;
        }
        ;
        const match = q => {
            materialSame(fixedScope(), q);
        }
        ;
        const subjectKeys = ['clinicId', 'userId', 'sessionId', 'patientId', 'guardianId', 'channel'];
        const subject = () => {
            const s = lookupScope()
              , q = Object.fromEntries(subjectKeys.map(k => [k, s?.[k]]));
            for (const k of subjectKeys.filter(k => k !== 'channel'))
                if (!materialId(q[k]))
                    throw Error('PDF_SCOPE_MISMATCH');
            if (q.channel !== 'home')
                throw Error('PDF_SCOPE_MISMATCH');
            return q;
        }
        ;
        const matchSubject = q => {
            const now = subject();
            if (subjectKeys.some(k => now[k] !== q[k]))
                throw Error('PDF_SCOPE_MISMATCH');
        }
        ;
        const verifyLookup = async (d, id, q) => {
            const r = d?.receipt;
            if (d?.ok !== true || r?.status !== 'ready' || r.assetId !== id || d.assetId !== id || r.channel !== 'home')
                throw Error('PDF_ASSET_RECEIPT');
            if (['clinicId', 'patientId', 'guardianId'].some(k => r[k] !== q[k]))
                throw Error('PDF_SCOPE_MISMATCH');
            if (d.receiptSHA256 !== await materialHash(materialCanon(r)))
                throw Error('PDF_RECEIPT_UNCONFIRMED');
            matchSubject(q);
            if (!materialId(r.materialId) || !Number.isSafeInteger(r.materialRevision) || r.materialRevision < 1)
                throw Error('PDF_MATERIAL_NOT_FOUND');
        }
        ;
        const verify = async (d, q, status) => {
            const r = d?.receipt;
            if (d?.ok !== true || !r || r.status !== status || !materialId(r.assetId) || r.channel !== 'home' || r.mimeType !== undefined && r.mimeType !== 'application/pdf' || r.sha256 !== generated.hash || r.byteSize !== generated.blob.size || r.clinicId !== q.clinicId || r.patientId !== q.patientId || r.guardianId !== q.guardianId || r.materialId !== q.materialId || r.materialRevision !== q.materialRevision || d.receiptSHA256 !== await materialHash(materialCanon(r)))
                throw Error('PDF_RECEIPT_UNCONFIRMED');
            if (status === 'ready' && (d.assetId !== r.assetId || r.mimeType !== 'application/pdf' || !Number.isSafeInteger(r.byteSize) || r.byteSize < 1 || r.byteSize > 10485760 || !/^([a-f0-9]{64})$/.test(r.sha256)))
                throw Error('PDF_ASSET_RECEIPT');
            if (status === 'sent' && (!materialId(d.deliveryId) || r.deliveryId !== d.deliveryId || r.assetId !== asset.assetId || typeof r.createdAt !== 'string' || !Number.isFinite(Date.parse(r.createdAt))))
                throw Error('PDF_DELIVERY_RECEIPT');
            return d;
        }
        ;
        const reserve = x => {
            const raw = JSON.stringify(x);
            storage.setItem('carestep_r113_pdf_pending', raw);
            if (storage.getItem('carestep_r113_pdf_pending') !== raw)
                throw Error('PDF_RESERVATION_UNCONFIRMED');
            pending = true;
            return raw;
        }
        ;
        const clear = () => {
            storage.removeItem('carestep_r113_pdf_pending');
            if (storage.getItem('carestep_r113_pdf_pending') !== null)
                throw Error('PDF_RESERVATION_UNCONFIRMED');
            pending = false;
        }
        ;
        const release = raw => {
            if (storage.getItem('carestep_r113_pdf_pending') !== raw)
                throw Error('PDF_RESERVATION_CHANGED');
            clear();
        }
        ;
        const rejectAttempt = (e, raw) => {
            if (raw && e.noMutationConfirmed === true) {
                release(raw);
                verdict = 'BLOCKED';
            }
            throw e;
        }
        ;
        const remember = async q => {
            const raw = JSON.stringify({
                assetId: asset.assetId,
                scopeDigest: await materialHash(materialCanon(q))
            });
            storage.setItem('carestep_r113_pdf_current', raw);
            if (storage.getItem('carestep_r113_pdf_current') !== raw)
                throw Error('PDF_RESERVATION_UNCONFIRMED');
        }
        ;
        const readAsset = async (id, q, response) => {
            if (!materialId(id))
                throw Error('PDF_ASSET_ID_INVALID');
            const d = response === undefined ? await request('/saas/r113/pdf-assets/' + encodeURIComponent(id), {
                method: 'GET',
                redirect: 'error'
            }) : response;
            match(q);
            if (d?.assetId !== id)
                throw Error('PDF_ASSET_ID_MISMATCH');
            if (!generated)
                generated = {
                    q,
                    hash: d?.receipt?.sha256,
                    blob: {
                        size: d?.receipt?.byteSize
                    }
                };
            const ready = await verify(d, q, 'ready');
            match(q);
            asset = ready;
            if (d.delivery === null && d.deliveryReceipt === null)
                return {
                    state: 'READY_UNSENT',
                    asset: ready,
                    delivery: null
                };
            if (d.delivery?.status !== 'attached' || !materialId(d.delivery.delivery_id) || d.deliveryReceipt?.deliveryId !== d.delivery.delivery_id)
                throw Error('PDF_DELIVERY_UNCONFIRMED');
            const delivery = await verify(d.deliveryReceipt, q, 'sent');
            match(q);
            return {
                state: 'SENT',
                asset: ready,
                delivery
            };
        }
        ;
        const adoptPosted = async (d, q) => {
            await verifyLookup(d, d?.assetId, q);
            match(q);
            generated = null;
            const result = await readAsset(d.assetId, q, d);
            match(q);
            if (!result.delivery)
                throw Error('PDF_DELIVERY_UNCONFIRMED');
            sent = true;
            verdict = 'SENT';
            await remember(q);
            return result.delivery;
        }
        ;
        const preflight = async q => {
            const params = new URLSearchParams({
                patientId: q.patientId,
                guardianId: q.guardianId,
                materialId: q.materialId,
                materialRevision: String(q.materialRevision)
            });
            const d = await request('/saas/r113/pdf-preflight?' + params, {
                method: 'GET',
                redirect: 'error'
            });
            match(q);
            if (d?.ok !== true || d.homeLinked !== true || typeof d.alreadySent !== 'boolean')
                throw Error('PDF_PREFLIGHT_UNCONFIRMED');
            materialSame(d.scope, q);
            return d.alreadySent ? adoptPosted(d, q) : null;
        }
        ;
        const lookup = async (id, recovery=false) => {
            if (busy)
                return null;
            busy = true;
            const reserved = storage.getItem('carestep_r113_pdf_pending');
            try {
                const base = subject()
                  , saved = reserved === null ? null : JSON.parse(reserved);
                verdict = 'UNCONFIRMED';
                sent = false;
                asset = null;
                if (saved) {
                    if (!['upload', 'attach'].includes(saved.kind))
                        throw Error('PDF_SCOPE_MISMATCH');
                    if (saved.kind === 'attach') {
                        if (id && id !== saved.assetId)
                            throw Error('PDF_PENDING_OTHER_ASSET');
                        id = saved.assetId;
                    } else if (!recovery)
                        throw Error('PDF_PENDING_OTHER_ASSET');
                    if (saved.kind === 'upload') {
                        const d = await request('/saas/r113/pdf-assets?idempotencyKey=' + encodeURIComponent(saved.attempt), {
                            method: 'GET',
                            redirect: 'error'
                        });
                        matchSubject(base);
                        if (!materialId(d?.assetId))
                            throw Error('PDF_ASSET_ID_INVALID');
                        await verifyLookup(d, d.assetId, base);
                        id = d.assetId;
                    }
                }
                if (!materialId(id))
                    throw Error('PDF_ASSET_ID_INVALID');
                const d = await request('/saas/r113/pdf-assets/' + encodeURIComponent(id), {
                    method: 'GET',
                    redirect: 'error'
                });
                matchSubject(base);
                await verifyLookup(d, id, base);
                if (selectMaterial)
                    selectMaterial(d.receipt);
                matchSubject(base);
                const q = fixedScope();
                if (subjectKeys.some(k => q[k] !== base[k]))
                    throw Error('PDF_SCOPE_MISMATCH');
                if (q.materialId !== d.receipt.materialId || q.materialRevision !== d.receipt.materialRevision)
                    throw Error('PDF_MATERIAL_NOT_FOUND');
                if (saved && await materialHash(materialCanon(q)) !== saved.scopeDigest)
                    throw Error('PDF_SCOPE_MISMATCH');
                match(q);
                generated = saved ? {
                    q,
                    hash: saved.pdfSHA256,
                    blob: {
                        size: saved.byteSize
                    }
                } : null;
                const result = await readAsset(id, q, d);
                match(q);
                // Clear only the exact pending record tied to this verified asset/scope.
                if (storage.getItem('carestep_r113_pdf_pending') !== reserved)
                    throw Error('PDF_RESERVATION_CHANGED');
                if (saved)
                    release(reserved);
                pending = false;
                verdict = result.state;
                sent = result.state === 'SENT';
                await remember(q);
                return result.delivery || result.asset;
            } catch (e) {
                asset = null;
                sent = false;
                verdict = 'UNCONFIRMED';
                pending = storage.getItem('carestep_r113_pdf_pending') !== null;
                throw e;
            } finally {
                busy = false;
            }
        }
        ;
        return {
            state: () => ({
                busy,
                pending,
                sent,
                status: sent ? 'SENT' : verdict,
                assetId: asset?.assetId || null,
                deliveryId: asset?.deliveryReceipt?.deliveryId || null,
                previewed: generated?.blob instanceof Blob,
                hasRecovery: pending || !!asset || storage.getItem('carestep_r113_pdf_current') !== null
            }),
            load: async id => lookup(id),
            invalidate: () => {
                if (busy || pending)
                    throw Error('PDF_ATTEMPT_LOCKED');
                generated = null;
                asset = null;
                sent = false;
                verdict = null;
            }
            ,
            prepare: async (makeBlob, kind) => {
                if (busy || pending || sent)
                    throw Error('PDF_ATTEMPT_LOCKED');
                busy = true;
                try {
                    const q = fixedScope();
                    if (await preflight(q))
                        return null;
                    const blob = await makeBlob();
                    match(q);
                    if (!(blob instanceof Blob) || blob.type !== 'application/pdf' || !blob.size || blob.size > 10485760 || new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer()) !== '%PDF-')
                        throw Error('PDF_GENERATION_INVALID');
                    generated = {
                        blob,
                        hash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), x => x.toString(16).padStart(2, '0')).join(''),
                        q,
                        kind
                    };
                    return blob;
                } finally {
                    busy = false;
                }
            }
            ,
            upload: async confirmed => {
                if (busy || pending || sent || !generated || asset)
                    return null;
                if (confirmed !== true)
                    throw Error('PDF_HOME_CONFIRMATION_REQUIRED');
                busy = true;
                let reservation = null;
                try {
                    const q = generated.q;
                    match(q);
                    if (await preflight(q))
                        return asset;
                    const attempt = crypto.randomUUID();
                    reservation = reserve({
                        kind: 'upload',
                        attempt,
                        scopeDigest: await materialHash(materialCanon(q)),
                        pdfSHA256: generated.hash,
                        byteSize: generated.blob.size
                    });
                    const form = new FormData();
                    form.append('metadata', JSON.stringify({
                        scope: q,
                        idempotencyKey: attempt,
                        generatedBy: generated.kind
                    }));
                    form.append('pdf', generated.blob, 'carestep-material.pdf');
                    const d = await request('/saas/r113/pdf-assets', {
                        method: 'POST',
                        body: form,
                        redirect: 'error'
                    });
                    match(q);
                    if (d.alreadySent === true) {
                        await adoptPosted(d, q);
                        release(reservation);
                        return asset;
                    }
                    asset = await verify(d, q, 'ready');
                    match(q);
                    release(reservation);
                    verdict = 'READY_UNSENT';
                    await remember(q);
                    return asset;
                } catch (e) {
                    rejectAttempt(e, reservation);
                } finally {
                    busy = false;
                }
            }
            ,
            attach: async confirmed => {
                if (busy || pending || sent || !asset)
                    return null;
                if (confirmed !== true)
                    throw Error('PDF_HOME_CONFIRMATION_REQUIRED');
                busy = true;
                let reservation = null;
                try {
                    const q = generated.q;
                    match(q);
                    const posted = await preflight(q);
                    if (posted)
                        return posted;
                    const before = await readAsset(asset.assetId, q);
                    match(q);
                    if (before.delivery) {
                        sent = true;
                        return before.delivery;
                    }
                    const attempt = crypto.randomUUID();
                    reservation = reserve({
                        kind: 'attach',
                        assetId: asset.assetId,
                        attempt,
                        scopeDigest: await materialHash(materialCanon(q)),
                        pdfSHA256: generated.hash,
                        byteSize: generated.blob.size
                    });
                    const d = await request('/saas/r113/pdf-assets/' + encodeURIComponent(asset.assetId) + '/attach', {
                        method: 'POST',
                        body: JSON.stringify({
                            scope: q,
                            idempotencyKey: attempt,
                            channel: 'home',
                            confirmed: true
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        redirect: 'error'
                    });
                    match(q);
                    const result = await verify(d, q, 'sent');
                    match(q);
                    const after = await readAsset(asset.assetId, q);
                    match(q);
                    if (!after.delivery || after.delivery.deliveryId !== result.deliveryId || after.delivery.receiptSHA256 !== result.receiptSHA256 || materialCanon(after.delivery.receipt) !== materialCanon(result.receipt))
                        throw Error('PDF_DELIVERY_UNCONFIRMED');
                    release(reservation);
                    sent = true;
                    await remember(q);
                    return result;
                } catch (e) {
                    rejectAttempt(e, reservation);
                } finally {
                    busy = false;
                }
            }
            ,
            recover: async () => {
                const raw = storage.getItem('carestep_r113_pdf_pending');
                if (raw) {
                    const saved = JSON.parse(raw);
                    return lookup(saved.assetId, true);
                }
                const last = storage.getItem('carestep_r113_pdf_current');
                return lookup(asset?.assetId || (last ? JSON.parse(last).assetId : null), true);
            }
            ,
            revoke: async confirmed => {
                if (busy || pending || !asset || confirmed !== true)
                    return null;
                busy = true;
                try {
                    match(generated.q);
                    reserve({
                        kind: 'revoke',
                        assetId: asset.assetId
                    });
                    const d = await request('/saas/r113/pdf-assets/' + encodeURIComponent(asset.assetId), {
                        method: 'DELETE',
                        redirect: 'error'
                    });
                    match(generated.q);
                    if (d?.ok !== true || d.assetId !== asset.assetId || d.accessRevoked !== true || !['deleted', 'delete_pending'].includes(d.status))
                        throw Error('PDF_REVOKE_UNCONFIRMED');
                    clear();
                    asset = null;
                    sent = true;
                    return d;
                } finally {
                    busy = false;
                }
            }
        };
    }
    const pdfNoMutationErrors = new Set(['HOME_GUARDIAN_NOT_LINKED', 'PDF_ALREADY_POSTED', 'PDF_DIFFERENT_ASSET_ALREADY_ATTACHED', 'PDF_FEATURE_OFF', 'PDF_SCOPE_CHANGED', 'PDF_HOME_LINK_CHANGED', 'PDF_IDEMPOTENCY_CONFLICT', 'PDF_NOT_READY', 'PDF_HOME_CONFIRMATION_REQUIRED', 'PDF_GUARDIAN_SCOPE', 'PDF_AUTHORIZATION_CHANGED', 'PDF_FILE_INVALID', 'PDF_MAGIC_INVALID', 'PDF_GENERATOR_INVALID', 'PDF_GENERATOR_MATERIAL_MISMATCH', 'PDF_METADATA_INVALID', 'PDF_FORM_INVALID', 'PDF_BODY_MISSING', 'PDF_REQUEST_TOO_LARGE', 'PDF_STORAGE_UNAVAILABLE']);
    const pdfErrorCode = e => /^(PDF|HOME|MATERIAL|CLINIC|PATIENT|GUARDIAN|SESSION|FEATURE|IDENTIFIER)_[A-Z0-9_]{1,70}$/.test(e?.code || e?.message || '') ? (e.code || e.message) : 'PDF_RESPONSE_UNCONFIRMED';
    async function pdfRequest(path, opt={}) {
        if (opt.redirect !== 'error')
            throw Error('PDF_REDIRECT_GUARD');
        const endpoint = saasEndpoint() + path;
        if (typeof saasMode === 'undefined' || saasMode !== 'auth' || !saasToken)
            throw Error('PDF_LOGIN_REQUIRED');
        const response = await fetch(endpoint, {
            ...opt,
            headers: {
                ...(opt.headers || {}),
                Authorization: 'Bearer ' + saasToken
            },
            cache: 'no-store'
        });
        let d;
        try {
            d = await response.json();
        } catch {
            throw Error('PDF_RESPONSE_UNCONFIRMED');
        }
        if (response.redirected || response.url !== endpoint)
            throw Error('PDF_RESPONSE_UNCONFIRMED');
        if (!response.ok) {
            const code = pdfErrorCode({
                code: d?.error
            });
            throw Object.assign(Error(code), {
                code,
                httpStatus: response.status,
                noMutationConfirmed: response.status === 409 && d?.ok === false && pdfNoMutationErrors.has(code)
            });
        }
        if (opt.method === 'GET' && response.status !== 200 || d?.ok !== true)
            throw Error('PDF_RESPONSE_UNCONFIRMED');
        return d;
    }
    function renderApprovedMaterialPDF(material, patientId) {
        if (!material || !materialKinds.some(([kind]) => kind === material.kind) || typeof material.title !== 'string' || !material.title.trim() || typeof material.text !== 'string' || !material.text.trim())
            throw Error('PDF_MATERIAL_CONTENT_INVALID');
        const doc = document.getElementById('pdfDocument');
        if (!doc)
            throw Error('PDF_GENERATOR_UNAVAILABLE');
        doc.replaceChildren();
        doc.classList.remove('hidden');
        doc.dataset.r61Patient = patientId;
        doc.dataset.r61MaterialKind = material.kind;
        const page = el('section')
          , type = el('p', materialKindLabel(material.kind))
          , title = el('h2', material.title)
          , content = el('div', material.text);
        page.className = 'pdf-page';
        type.style.cssText = 'margin:0 0 8px;color:#52616b;font-size:13px;font-weight:700';
        title.style.cssText = 'margin:0 0 20px;font-size:24px;line-height:1.35';
        content.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;font-size:14px';
        page.append(type, title, content);
        doc.append(page);
        return doc;
    }
    async function privatePDF() {
        const {body, d} = dialog('PDF 원본 · 비공개 CARESTEP Home')
          , info = el('p');
        body.append(info);
        let cfg, list, q0;
        try {
            cfg = await pdfRequest('/saas/r113/pdf-config', {
                method: 'GET',
                redirect: 'error'
            });
            if (cfg.pdfEnabled !== true || cfg.guardianMaterialEnabled !== true) {
                info.textContent = 'PDF 첨부 준비 중 · 기능 OFF. 기존 텍스트 자료 송부는 그대로 이용할 수 있습니다.';
                return;
            }
            q0 = materialScope('scope-check', 1);
            list = await pdfRequest('/saas/r61/materials?patientId=' + encodeURIComponent(q0.patientId), {
                method: 'GET',
                redirect: 'error'
            });
            materialSame(q0, materialScope('scope-check', 1));
            if (!Array.isArray(list.materials))
                throw Error('PDF_MATERIAL_NOT_FOUND');
        } catch (e) {
            info.textContent = '처리 중단 · ' + pdfErrorCode(e) + ' · 자동 재시도하지 않습니다.';
            return;
        }
        const pick = el('select')
          , kind = el('select')
          , viewer = el('iframe');
        for (const m of list.materials) {
            if (!materialKinds.some(([kind]) => kind === m.kind) || !materialId(m.id) || !Number.isSafeInteger(m.revision) || m.revision < 1 || typeof m.title !== 'string' || typeof m.text !== 'string')
                continue;
            const o = el('option', m.title);
            o.value = m.id;
            o.dataset.r113Revision = String(m.revision);
            pick.append(o);
        }
        for (const [v,n] of materialKinds) {
            const o = el('option', n);
            o.value = v;
            kind.append(o);
        }
        body.append(pick, kind, viewer);
        const current = () => {
            const revision = Number(pick.selectedOptions[0]?.dataset.r113Revision)
              , matches = list.materials.filter(x => x.id === pick.value && x.revision === revision);
            if (matches.length !== 1)
                throw Error(matches.length ? 'PDF_MATERIAL_AMBIGUOUS' : 'PDF_MATERIAL_NOT_FOUND');
            return materialScope(matches[0].id, matches[0].revision);
        }
        ;
        const selectMaterial = r => {
            const matches = list.materials.filter(x => x.id === r.materialId && x.revision === r.materialRevision)
              , options = [...pick.options].filter(x => x.value === r.materialId && x.dataset.r113Revision === String(r.materialRevision));
            if (matches.length !== 1 || options.length !== 1)
                throw Error(matches.length > 1 || options.length > 1 ? 'PDF_MATERIAL_AMBIGUOUS' : 'PDF_MATERIAL_NOT_FOUND');
            pick.value = r.materialId;
            pick.selectedIndex = options[0].index;
            kind.value = matches[0].kind;
        }
        ;
        const control = pdfController({
            scope: current,
            lookupScope: () => materialScope('scope-check', 1),
            selectMaterial,
            request: pdfRequest,
            storage: sessionStorage
        });
        let blobURL = null
          , uiBusy = false;
        const buttons = {};
        const controls = () => {
            const s = control.state()
              , empty = pick.options.length === 0
              , locked = uiBusy || s.busy || s.pending;
            pick.disabled = empty || locked;
            kind.disabled = true;
            buttons.preview.disabled = empty || locked || s.sent || !!s.assetId;
            buttons.save.disabled = empty || locked || s.sent || !s.previewed || !!s.assetId;
            buttons.send.disabled = empty || locked || s.sent || s.status !== 'READY_UNSENT';
            buttons.lookup.disabled = buttons.recover.disabled = empty || uiBusy || s.busy || !s.hasRecovery;
            buttons.revoke.disabled = empty || locked || !s.assetId;
        }
        ;
        const showError = e => {
            const code = pdfErrorCode(e);
            info.textContent = code === 'HOME_GUARDIAN_NOT_LINKED' ? 'HOME_GUARDIAN_NOT_LINKED · 보호자를 CARESTEP Home에 먼저 연결해주세요. PDF는 저장하지 않았습니다.' : (control.state().pending ? '결과 미확정 · ' : '처리 중단 · ') + code + ' · 자동 재시도하지 않습니다.';
        }
        ;
        const show = result => {
            if (control.state().sent)
                info.textContent = '이미 전송 완료 · CARESTEP Home · Delivery ID: ' + (result?.deliveryId || result?.deliveryReceipt?.deliveryId || control.state().deliveryId || '');
            else if (result)
                info.textContent = 'PDF 저장 완료 · CARESTEP Home 미송부';
        }
        ;
        const action = (key, label, fn) => {
            const b = el('button', label);
            b.type = 'button';
            b.className = 'btn btn-secondary';
            body.append(b);
            buttons[key] = b;
            b.onclick = async () => {
                if (b.disabled || uiBusy)
                    return;
                uiBusy = true;
                controls();
                try {
                    await fn();
                } catch (e) {
                    showError(e);
                } finally {
                    uiBusy = false;
                    controls();
                }
            }
            ;
        }
        ;
        d.addEventListener('close', () => {
            if (blobURL)
                URL.revokeObjectURL(blobURL);
        }
        );
        action('preview', '앱 PDF 생성·미리보기', async () => {
            const blob = await control.prepare(async () => {
                if (typeof html2pdf === 'undefined')
                    throw Error('PDF_GENERATOR_UNAVAILABLE');
                const m = list.materials.find(x => x.id === current().materialId && x.revision === current().materialRevision);
                if (m?.kind !== kind.value)
                    throw Error('PDF_GENERATOR_MATERIAL_MISMATCH');
                if (kind.value === 'advanced' || kind.value === 'medication') {
                    renderMaterialDraftPDF(kind.value, current().patientId);
                } else
                    renderApprovedMaterialPDF(m, current().patientId);
                if (document.getElementById('pdfDocument')?.dataset.r61Patient !== current().patientId)
                    throw Error('PDF_PATIENT_CHANGED');
                return exportPdfElement('carestep-material.pdf', {
                    save: false,
                    silent: true
                });
            }
            , kind.value);
            if (!blob) {
                show();
                return;
            }
            if (blobURL)
                URL.revokeObjectURL(blobURL);
            blobURL = URL.createObjectURL(blob);
            viewer.src = blobURL;
            info.textContent = 'PDF 미리보기 완료 · 아직 서버에 저장하지 않았습니다.';
        }
        );
        action('save', 'Home 송부 확인 후 PDF 저장', async () => {
            if (!confirm('현재 환자·연결 보호자·자료의 PDF 원본을 비공개 저장합니까? 외부 메시지는 보내지 않습니다.'))
                return;
            show(await control.upload(true));
        }
        );
        action('send', '보호자에게 PDF 보내기 · Home', async () => {
            if (!confirm('현재 환자·연결 보호자·자료를 CARESTEP Home에 게시합니까?'))
                return;
            const result = await control.attach(true);
            if (result)
                info.textContent = (result.replayed ? '이미 전송 완료' : '전송 완료') + ' · CARESTEP Home · Delivery ID: ' + result.deliveryId;
        }
        );
        action('lookup', '기존 PDF 저장 결과 확인', async () => show(await control.recover()));
        action('recover', '미확정 저장·송부 결과 조회', async () => show(await control.recover()));
        action('revoke', '해당 PDF 송부 철회', async () => {
            const result = await control.revoke(confirm('PDF 접근을 철회합니까? 기존 텍스트·후속관리 기록은 보존합니다.'));
            if (result)
                info.textContent = '접근 철회 완료 · ' + result.status;
        }
        );
        pick.onchange = () => {
            control.invalidate();
            if (blobURL)
                URL.revokeObjectURL(blobURL);
            blobURL = null;
            viewer.removeAttribute('src');
            kind.value = list.materials.find(x => x.id === current().materialId && x.revision === current().materialRevision).kind;
            info.textContent = '선택 자료를 미리보기해주세요.';
            controls();
        }
        ;
        if (!pick.options.length)
            info.textContent = '먼저 보호자 공개 자료를 등록해주세요';
        else
            kind.value = list.materials.find(x => x.id === current().materialId && x.revision === current().materialRevision).kind;
        controls();
    }
    window.r113PDFController = pdfController;

    // One user confirmation; existing server endpoints and PDF receipts remain authoritative.
    function materialDeliveryFlow({scope, request, storage, canApprove, onMaterial=()=>{}, onProgress=()=>{}, controllerFactory=pdfController}) {
        const base = {...scope()}, key = 'carestep_material_registration_pending';
        let busy = false, selected = null;
        const guard = () => materialSame(base, scope());
        const read = path => request(path, {method: 'GET', redirect: 'error'});
        const list = async () => {
            guard();
            const d = await read('/saas/r61/materials?patientId=' + encodeURIComponent(base.patientId));
            guard();
            if (d?.ok !== true || !Array.isArray(d.materials)) throw Error('MATERIAL_LIST_UNCONFIRMED');
            return d.materials;
        };
        const content = m => JSON.stringify([m.kind, m.title, m.text]);
        const bind = m => {
            if (!materialId(m?.id) || !Number.isSafeInteger(m.revision) || m.revision < 1 || !materialKinds.some(([k]) => k === m.kind) || typeof m.title !== 'string' || typeof m.text !== 'string') throw Error('MATERIAL_RESPONSE_UNCONFIRMED');
            selected = {...m};
            onMaterial(selected);
        };
        let recoveryList = [];
        const control = controllerFactory({
            scope: () => { guard(); if (!selected) throw Error('MATERIAL_SELECTION_REQUIRED'); return {...base, materialId: selected.id, materialRevision: selected.revision}; },
            lookupScope: () => { guard(); return base; }, request, storage,
            selectMaterial: r => {
                const matches = recoveryList.filter(m => m.id === r.materialId && m.revision === r.materialRevision);
                if (matches.length !== 1) throw Error('MATERIAL_SELECTION_REQUIRED');
                bind(matches[0]);
            }
        });
        const recoverRegistration = async () => {
            const raw = storage.getItem(key);
            if (raw === null) return false;
            const p = JSON.parse(raw);
            guard();
            if (p.scopeDigest !== await materialHash(materialCanon(base)) || !Array.isArray(p.beforeIds)) throw Error('MATERIAL_SCOPE_CHANGED');
            const rows = await list(), matches = [];
            for (const m of rows) if (!p.beforeIds.includes(m.id) && (!p.id || p.id === m.id) && await materialHash(content(m)) === p.contentHash) matches.push(m);
            guard();
            if (matches.length !== 1) throw Error('MATERIAL_REGISTRATION_UNCONFIRMED');
            if (storage.getItem(key) !== raw) throw Error('MATERIAL_REGISTRATION_UNCONFIRMED');
            bind(matches[0]);
            storage.removeItem(key);
            if (storage.getItem(key) !== null) throw Error('MATERIAL_REGISTRATION_UNCONFIRMED');
            return true;
        };
        return {
            state: () => ({...control.state(), busy: busy || control.state().busy, registrationPending: storage.getItem(key) !== null, hasMaterial: !!selected}),
            reset: () => {
                if (busy || storage.getItem(key) !== null) throw Error('MATERIAL_ATTEMPT_LOCKED');
                control.invalidate(); selected = null;
            },
            recover: async () => {
                if (busy) return;
                busy = true;
                try {
                    guard();
                    if (await recoverRegistration()) return {registrationRecovered: true};
                    recoveryList = await list();
                    return await control.recover();
                } finally { busy = false; }
            },
            send: async ({draft, blob, existing, confirmed}) => {
                if (busy) return;
                busy = true;
                // Snapshot caller values before any asynchronous boundary.
                draft = {...draft}; existing = existing ? {...existing} : null;
                try {
                    guard();
                    if (confirmed !== true) throw Error('MATERIAL_PUBLIC_REVIEW_REQUIRED');
                    if (storage.getItem(key) !== null || control.state().pending) throw Error('MATERIAL_ATTEMPT_LOCKED');
                    if (selected && content(selected) !== content(draft)) throw Error('MATERIAL_SCOPE_CHANGED');
                    if (control.state().sent) return {alreadySent: true};
                    if (!control.state().assetId && (!(blob instanceof Blob) || blob.type !== 'application/pdf' || !blob.size || blob.size > 10485760 || new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer()) !== '%PDF-')) throw Error('PDF_GENERATION_INVALID');
                    guard();
                    onProgress('보호자 연결 확인 중…');
                    const home = await read('/saas/guardians/' + encodeURIComponent(base.guardianId));
                    guard();
                    if (home?.ok !== true || home.guardian?.id !== base.guardianId || home.guardian.homeStatus !== 'linked' || !home.patients?.some(p => p.id === base.patientId && p.guardianId === base.guardianId && p.active === true)) throw Error('HOME_GUARDIAN_NOT_LINKED');
                    if (!selected) {
                        const rows = await list();
                        if (existing) {
                            const matches = rows.filter(m => m.id === existing.id && m.revision === existing.revision && content(m) === content(draft));
                            if (matches.length !== 1) throw Error('MATERIAL_REVISION_CHANGED');
                            bind(matches[0]);
                        } else {
                            if (!canApprove()) throw Error('MATERIAL_ADMIN_REQUIRED');
                            if (!materialKinds.some(([k]) => k === draft.kind) || !draft.title?.trim() || draft.title.length > 120 || !draft.text?.trim() || draft.text.length > 20000) throw Error('MATERIAL_PUBLIC_REVIEW_REQUIRED');
                            const p = {scopeDigest: await materialHash(materialCanon(base)), contentHash: await materialHash(content(draft)), beforeIds: rows.map(m => m.id)};
                            guard();
                            const raw = JSON.stringify(p);
                            storage.setItem(key, raw);
                            if (storage.getItem(key) !== raw) throw Error('MATERIAL_REGISTRATION_UNCONFIRMED');
                            onProgress('공개 자료 등록 중…');
                            // No retry: a lost response is resolved using a read-only material lookup.
                            const d = await request('/saas/r61/materials', {method: 'POST', redirect: 'error', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...draft, patientId: base.patientId, audience: 'guardian', approved: true, finalPublicReview: true})});
                            guard();
                            if (d?.ok !== true || !materialId(d.id) || storage.getItem(key) !== raw) throw Error('MATERIAL_REGISTRATION_UNCONFIRMED');
                            storage.setItem(key, JSON.stringify({...p, id: d.id}));
                            await recoverRegistration();
                        }
                    }
                    if (!control.state().assetId) {
                        onProgress('PDF 저장·기존 송부 확인 중…');
                        await control.prepare(() => blob, draft.kind);
                        guard();
                        if (!control.state().sent) await control.upload(true);
                    }
                    guard();
                    if (!control.state().sent) {
                        if (control.state().status !== 'READY_UNSENT') throw Error('PDF_RESPONSE_UNCONFIRMED');
                        onProgress('CARESTEP Home에 보내는 중…');
                        await control.attach(true);
                    }
                    guard();
                    if (!control.state().sent) throw Error('PDF_DELIVERY_UNCONFIRMED');
                    return {sent: true, deliveryId: control.state().deliveryId};
                } finally { busy = false; }
            }
        };
    }
    // Drafts are tab-scoped and isolated by authenticated session, patient and kind.
    const composerDrafts=new Map(),draftPrefix='carestep_material_draft_v2:';
    let draftSession='';
    function currentDraftSession(){try{const s=settingsSession();return typeof saasMode!=='undefined'&&saasMode==='auth'?s:'';}catch{return '';}}
    function syncDraftSession(){const next=currentDraftSession();if(next!==draftSession){composerDrafts.clear();builderMaterialQueue=null;try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith(draftPrefix)){const v=JSON.parse(sessionStorage.getItem(k));if(!next||v.session!==next)sessionStorage.removeItem(k);}}}catch{}draftSession=next;}return next;}
    function draftKey(base,kind){return draftPrefix+JSON.stringify([base.clinicId,base.userId,base.sessionId,base.patientId,base.guardianId,kind]);}
    function saveComposerDraft(base,value,rich=null){const session=syncDraftSession();if(!session||session!==JSON.stringify([base.clinicId,base.userId,base.sessionId]))return;const kind=value.kind;if(!materialKinds.some(([k])=>k===kind))return;const key=draftKey(base,kind),context=window.crmMaterialContext?.()||{};
        const row={session,base:{...base},kind,sourceTemplateId:value.sourceTemplateId||'',sourceTemplateTitle:value.sourceTemplateTitle||'',title:String(value.title||'').slice(0,120),text:String(value.text||'').slice(0,20000),patientName:context.patient?.name||'환자',guardianName:context.guardian?.name||'보호자',updatedAt:new Date().toISOString()};
        composerDrafts.set(key,{...row,rich});let stored=false;try{sessionStorage.setItem(key,JSON.stringify(row));stored=true;}catch{}draftChanged();return {...row,stored};
    }
    function readComposerDraft(base,kind){const session=syncDraftSession(),key=draftKey(base,kind);let row=composerDrafts.get(key);if(!row){try{row=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}}
        if(!session||row?.session!==session||row?.kind!==kind||row.base?.patientId!==base.patientId||row.base?.guardianId!==base.guardianId||row.base?.clinicId!==base.clinicId||row.base?.userId!==base.userId||row.base?.sessionId!==base.sessionId)return null;
        if(typeof row.title!=='string'||row.title.length>120||typeof row.text!=='string'||row.text.length>20000)return null;return row;
    }
    function deleteComposerDraft(base,kind){const key=draftKey(base,kind);composerDrafts.delete(key);try{sessionStorage.removeItem(key);}catch{}draftChanged();}
    function allComposerDrafts(){const session=syncDraftSession(),rows=new Map();try{for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i);if(!key?.startsWith(draftPrefix))continue;const row=JSON.parse(sessionStorage.getItem(key));if(row?.session===session&&(row.text?.trim()||row.title!==materialKindLabel(row.kind)))rows.set(key,row);}}catch{}for(const [key,row] of composerDrafts)if(row.session===session&&(row.text?.trim()||row.title!==materialKindLabel(row.kind)))rows.set(key,row);return [...rows.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
    function materialHelp(code){return ({HOME_GUARDIAN_NOT_LINKED:'보호자 Home 연결이 필요합니다.',PDF_ALREADY_POSTED:'이 자료는 이미 Home에 게시되어 있습니다. 기존 자료 이력을 확인해주세요.',PDF_PENDING_OTHER_ASSET:'앞서 저장한 PDF의 결과 확인이 필요합니다.',PDF_ASSET_UNAVAILABLE:'저장된 PDF를 확인하지 못했습니다. 자료 이력과 중단된 결과를 조회해주세요.',MATERIAL_TEMPLATE_REQUIRED:'이번 진료에 맞는 질환·시술 교육자료를 선택하거나 확인해주세요.',MATERIAL_SOURCE_CHANGED:'교육자료 또는 진단·처방 입력이 바뀌었습니다. 현재 내용을 확인하고 PDF 미리보기를 다시 만들어주세요.',MATERIAL_SCOPE_CHANGED:'선택한 환자 또는 보호자가 바뀌었습니다. 현재 창을 닫고 다시 열어주세요.',PDF_PATIENT_CHANGED:'자료 생성 화면의 환자가 다릅니다. 선택 환자의 자료 생성 화면에서 내용을 확인해주세요.',PDF_FEATURE_OFF:'PDF 송부 기능이 꺼져 있습니다. 관리자 설정을 확인해주세요.',MATERIAL_LOGIN_REQUIRED:'로그인 후 환자를 선택해주세요.',PDF_MEDICATION_REQUIRED:'약 이름과 복약 정보를 입력한 뒤 미리보기를 눌러주세요.',PDF_MEDICATION_DURATION_REQUIRED:'각 약의 투약 기간을 확인해주세요.',MATERIAL_ORIGINAL_SOURCE_CHANGED:'등록 자료와 현재 입력 내용이 다릅니다. 새 자료 작성 또는 기존 자료 이력을 선택해주세요.'})[code]||'처리 결과를 확인하지 못했습니다. 결과 조회 후 이어서 진행해주세요.';}
    async function showHomeConnection(){const c=selection();if(!materialId(c.patientId)||!materialId(c.guardianId))return choosePatient();await window.crmOpenPatientRecord?.(c.guardianId,c.patientId);const target=document.querySelector('[data-crm-home-invite]');target?.scrollIntoView({block:'center'});target?.focus();}
    function choosePatient(){if(typeof go==='function')go('patients');document.getElementById('patientCrmSearch')?.focus();}
    async function openWorkspaceComposer(){
        if(window.crmPrepareMaterialPatient&&!await window.crmPrepareMaterialPatient())return;
        if(typeof go==='function')go('builder');
        if(typeof setWizardStep==='function')setWizardStep(typeof currentWizardStep==='number'?currentWizardStep:1);
    }
    const builderMaterialKinds=Object.freeze({pdf:'advanced',summary:'discharge',medcheck:'medication'});
    function builderMaterialTitle(kind,source){
        const topic=String(source.title||'').replace(/\s+/g,' ').trim();
        const prefix=materialKindLabel(kind)+(topic?' · ':''),suffix=/^\d{4}-\d{2}-\d{2}$/.test(source.dischargeDate)?'_'+source.dischargeDate:'';
        const limit=120-prefix.length-suffix.length;
        // Keep the source education identifiable without dropping the material kind or date.
        const label=topic.length>limit?topic.slice(0,limit-1).replace(/[\uD800-\uDBFF]$/,'')+'…':topic;
        return prefix+label+suffix;
    }
    let builderMaterialQueue=null;
    function renderBuilderQueue(summary,list,queue,current,state={}){
        const done=queue.items.filter(row=>row.sent).length,total=queue.items.length;
        const text='총 '+total+'개 중 '+done+'개 게시 완료'+(done<total?' · 남은 '+(total-done)+'개':'');
        if(summary.textContent!==text)summary.textContent=text;
        list.replaceChildren();
        for(const row of queue.items){
            const pending=row===current&&(state.pending||state.registrationPending),active=row===current&&!row.sent;
            const status=row.sent?'Home 게시 완료':pending?'결과 확인 필요':active?(state.busy?'처리 중':'현재 확인 중'):'확인 대기';
            const li=el('li',materialKindLabel(row.kind)+' · '+status);li.dataset.state=row.sent?'done':pending?'pending':active?'current':'waiting';li.setAttribute('aria-current',active?'step':'false');list.append(li);
        }
    }
    function builderMaterialGuard(queue){
        materialSame(queue.base,materialScope('scope-check',1));
        const patient=window.crmCurrentPatient?.();
        if(patient?.patientId!==queue.base.patientId||patient?.guardianId!==queue.base.guardianId)throw Error('PDF_PATIENT_CHANGED');
        if(queue.source.signature!==materialSourceContext().signature)throw Error('MATERIAL_SOURCE_CHANGED');
    }
    async function sendBuilderMaterials(){
        if(materialComposerOpen)return;
        let base;try{base=materialScope('scope-check',1);}catch{choosePatient();return;}
        if(typeof currentWizardStep!=='undefined'&&currentWizardStep!==5){if(typeof go==='function')go('builder');setWizardStep(5);return;}
        const selected=typeof selectedOutputTypes==='function'?selectedOutputTypes():[],kinds=[...new Set(selected.map(type=>builderMaterialKinds[type]).filter(Boolean))];
        if(!kinds.length){const {body,d}=dialog('Home에 보낼 자료 선택');body.append(el('p','⑤ 출력에서 고급 보호자 자료·퇴원 1P 요약·복약 체크표 중 보낼 항목을 체크해주세요. 다른 출력물은 다운로드로 이용할 수 있습니다.'));button(body,'출력 선택으로 돌아가기',()=>d.close());return;}
        syncDraftSession();const source=materialSourceContext(),key=JSON.stringify([base,source.signature]);
        if(!builderMaterialQueue||builderMaterialQueue.key!==key)builderMaterialQueue={base,source,key,pool:new Map()};
        const queue=builderMaterialQueue;queue.items=kinds.map(kind=>{if(!queue.pool.has(kind))queue.pool.set(kind,{kind,sent:false});return queue.pool.get(kind);});queue.excluded=selected.filter(type=>!builderMaterialKinds[type]).map(type=>typeof outputLabel==='function'?outputLabel(type):type);
        try{builderMaterialGuard(queue);}catch(e){const {body}=dialog('작성 환자 확인');body.append(el('p',materialHelp(pdfErrorCode(e))));button(body,'환자 선택 확인',choosePatient);return;}
        const item=queue.items.find(row=>!row.sent);
        if(!item){const {body,d}=dialog('선택 자료 Home 게시 완료'),summary=el('p'),list=el('ol');summary.className='r61-queue-summary';list.className='r61-output-queue';renderBuilderQueue(summary,list,queue);body.append(summary,list,el('p','선택한 자료는 이미 Home에 게시했습니다. 문자는 발송하지 않았습니다. 새 자료 푸시는 알림이 켜진 연결 기기에 전달을 시도합니다.'));button(body,'Home 복약 일정 등록',async()=>{materialSame(queue.base,materialScope('scope-check',1));d.close();await window.carestepOpenMedicationPlans?.();});button(body,'게시 이력 확인',materialHistory);button(body,'출력으로 돌아가기',()=>d.close());return;}
        await sendMaterial(item.kind,{queue,item});
    }
    function mountPatientContext(){
        if(document.getElementById('r61-patient-context'))return;
        const root=el('section'),who=el('strong'),hint=el('span');root.id='r61-patient-context';root.setAttribute('aria-label','현재 선택 환자');const topic=el('span');topic.className='r61-context-topic';root.append(who,hint,topic);
        const send=button(root,'자료 만들기',()=>openWorkspaceComposer()),history=button(root,'자료 이력',materialHistory);send.className='btn btn-primary';button(root,'환자 선택·변경',choosePatient);
        (document.querySelector('main')||document.body).prepend(root);let last='';
        const paint=()=>{syncDraftSession();const c=window.crmMaterialContext?.()||selection(),session=currentDraftSession(),procedure=document.getElementById('caseProcedure')?.value??(typeof caseInfo==='undefined'?'':caseInfo.procedure),education=(typeof templates==='undefined'?[]:templates).find(t=>t.id===(typeof currentTemplateId==='undefined'?'':currentTemplateId))?.title||'',key=JSON.stringify([session,c?.patientId,c?.guardianId,c?.patient?.name,c?.guardian?.name,c?.homeStatus,patientDraft(c)?.updatedAt,procedure,education]);const label='자료 만들기';for(const b of document.querySelectorAll('[data-workspace-material]'))if(b.textContent!==label)b.textContent=label;if(key===last)return;last=key;send.textContent=label;
            root.hidden=!session;const ready=!!session&&materialId(c?.patientId)&&materialId(c?.guardianId);send.disabled=history.disabled=!ready;
            who.textContent=ready?(c.patient?.name||'선택 환자')+' · 보호자 '+(c.guardian?.name||'선택 보호자'):'환자 선택 필요';
            hint.textContent=ready?(({dog:'강아지',cat:'고양이',other:'반려동물'})[c.patient?.species]||'')+' · '+(c.homeStatus==='linked'?'Home 연결됨':c.homeStatus==='invited'?'Home 연결 대기':'Home 연결 확인 필요'):'자료 생성·송부·이력 확인은 환자를 선택하면 사용할 수 있습니다.';
            const bound=window.crmCurrentPatient?.();topic.textContent=ready&&bound?.patientId===c.patientId&&bound?.guardianId===c.guardianId?'교육자료 · '+(education||'선택 필요')+' / 진단·시술 · '+(procedure||'입력 필요'):'작성 자료 · 환자에 맞는 질환·시술을 선택해주세요.';
            document.querySelectorAll('[data-r61-needs-patient]').forEach(b=>b.disabled=!ready);
        };
        new MutationObserver(paint).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});document.addEventListener('input',paint);document.addEventListener('change',paint);window.addEventListener('r61-auth-ready',paint);window.addEventListener('carestep:material-draft-changed',paint);paint();
    }
    function patientDraft(context=selection()){
        return allComposerDrafts().find(row=>row.base?.patientId===context?.patientId&&row.base?.guardianId===context?.guardianId)||null;
    }
    function draftChanged(){window.dispatchEvent?.(new CustomEvent('carestep:material-draft-changed'));}
    function mountTodayOverview(){
        const dashboard=document.getElementById('dashboard'),host=document.getElementById('workFirstDashboard');
        if(!dashboard||!host||document.getElementById('r61-today-overview'))return;
        const box=el('section'),chips=el('div'),rows=el('div'),note=el('small');box.id='r61-today-overview';box.setAttribute('aria-label','발송·자료·연동 상태');chips.className='r61-status-chips';rows.className='r61-overview-grid';note.className='r61-overview-note';box.append(chips,rows,note);
        const metrics=host.querySelector('.work-first-kpis');if(metrics)host.insertBefore(box,metrics);else host.append(box);
        let cached=null,loaded='',generation=0,pendingKey='',renderKey='';const active=()=>dashboard.classList.contains('active-view');
        function render(){
            const session=currentDraftSession();if(!session){chips.replaceChildren();rows.replaceChildren();note.textContent='';renderKey='';return;}
            const drafts=allComposerDrafts(),key=JSON.stringify([session,cached,drafts.map(x=>[x.base.patientId,x.kind,x.updatedAt])]);if(key===renderKey)return;renderKey=key;chips.replaceChildren();rows.replaceChildren();
            const chip=(label,action)=>{const b=button(chips,label,action);b.className='r61-status-chip';return b;};
            const card=(title,detail,label,action,tone='attention')=>{const c=workCard(rows);c.className+=' r61-'+tone;c.append(el('strong',title),el('p',detail));if(action)button(c,label,action);return c;};
            if(cached?.session===session){
                const {results,sync,google}=cached;
                if(!results)card('발송 결과 조회 필요','오늘 예방 안내 결과를 아직 확인하지 못했습니다.','결과 조회',()=>preventiveResults());
                else{
                    const n=key=>Math.max(0,Number(results.counts?.[key])||0),uncertain=n('unconfirmed')+n('claimed');
                    if(n('failed'))card('발송 실패 '+n('failed')+'건','실패 사유를 확인한 뒤 해당 건을 처리해주세요.','실패 내역 확인',()=>preventiveResults('failed'),'failure');
                    if(uncertain)card('발송 결과 확인 필요 '+uncertain+'건','접수 여부가 확정되지 않은 항목입니다. 결과부터 조회해주세요.','결과 조회',()=>preventiveResults('pending'));
                    if(n('blocked'))card('발송 조건 확인 '+n('blocked')+'건','연결·수신 설정 등 발송이 차단된 사유를 확인해주세요.','차단 내역 확인',()=>preventiveResults('blocked'));
                    chip('예방 안내 · 사업자 접수 '+n('accepted')+'건',()=>preventiveResults());
                    if(results.excludedCount>0)card('확인이 필요한 예방 이력 '+Number(results.excludedCount)+'건','기록과 예정일을 확인해주세요.','충돌 일정 확인·수정',preventiveReview);
                    else chip('예방 이력 충돌 없음',preventiveReview);
                }
                const h=sync?.heartbeat,age=Date.now()-Date.parse(h?.last_seen_at),healthy=!!h&&Number.isFinite(age)&&age<=Math.max(35,(Number(h.interval_minutes)||15)*2+5)*60000&&h.status!=='failed',googleOK=google?.connected&&google.calendarId;
                const googleText=google?(google.connected?(google.calendarId?'Google 정상':'Google 캘린더 선택 필요'):'Google 연결 확인 필요'):'Google 조회 미확인',syncText=sync?(healthy?'eFriends 응답 정상':'eFriends 서버 PC 확인 필요'):'eFriends 조회 미확인';
                if(googleOK&&healthy)chip('Google · eFriends 정상',integrationStatus);
                else card('연동 확인 필요',googleText+' · '+syncText,'연동 상태 확인',integrationStatus);
                note.textContent='확인 시각 '+workTime(cached.at)+' · 자동 재발송 없음';
            }else if(['owner','admin'].includes(saasMe?.role)){chips.append(el('span','업무 상태 확인 중…'));}
            else{chip('병원 운영 현황은 관리자에게 문의',()=>{});note.textContent='선택 환자의 자료와 오늘 업무를 확인하세요.';}
            if(drafts.length){const c=card('작성 중인 자료 '+drafts.length+'건','이 탭에 저장된 초안을 이어서 작성하세요.','','','draft');for(const row of drafts.slice(0,8))button(c,(row.patientName||'환자')+' · '+row.title,async()=>{const ok=await window.crmOpenPatientRecord?.(row.base.guardianId,row.base.patientId);if(ok&&(!window.crmPrepareMaterialPatient||await window.crmPrepareMaterialPatient()))await sendMaterial(row.kind);});}
            else chip('작성 중인 자료 없음',()=>{if(selection().patientId)return openWorkspaceComposer();choosePatient();});
        }
        async function load(force=false){
            const session=currentDraftSession(),day=new Date(Date.now()+32400000).toISOString().slice(0,10),key=session+':'+day;
            if(!session){generation++;cached=null;loaded='';pendingKey='';render();return;}
            if(!active())return;
            if(!['owner','admin'].includes(saasMe?.role)){cached=null;render();return;}
            if(pendingKey===key)return;if(!force&&loaded===key){render();return;}
            const revision=++generation;pendingKey=key;render();
            try{const out=await Promise.allSettled([api('/preventive/results?date='+day),api('/operations/integrations'),saasRequest('/saas/google-calendar/status',{method:'GET',redirect:'error'})]);if(revision!==generation||currentDraftSession()!==session)return;
                const value=i=>out[i].status==='fulfilled'&&out[i].value?.ok===true?out[i].value:null;
                cached={session,results:value(0),sync:value(1),google:value(2),at:new Date().toISOString()};loaded=key;render();
            }finally{if(revision===generation)pendingKey='';}
        }
        document.getElementById('refreshWorkFirst')?.addEventListener('click',()=>{void load(true);});
        new MutationObserver(()=>{void load();}).observe(dashboard,{attributes:true,attributeFilter:['class']});
        window.addEventListener('r61-auth-ready',()=>{generation++;loaded='';pendingKey='';cached=null;renderKey='';void load();});
        window.addEventListener('carestep:material-draft-changed',()=>{if(active())render();});void load();
    }


    // Bind cached pages and final publication to the actual education source and clinical inputs.
    function materialSourceContext(){
        if(typeof readCaseInfoFromForm==='function')readCaseInfoFromForm();
        const rows=typeof templates==='undefined'?[]:templates,id=typeof currentTemplateId==='undefined'?'':currentTemplateId;
        const template=rows.find(t=>t.id===id),data=typeof caseInfo==='undefined'?{}:caseInfo;
        return {id:template?.id||'',title:template?.title||'',dischargeDate:String(data.dischargeDate||''),procedure:String(data.procedure||''),topic:JSON.stringify([template?.id||'',data.procedure||'']),
            signature:JSON.stringify([template||null,data,typeof medications==='undefined'?[]:medications,typeof activePatientJourney==='undefined'?null:activePatientJourney,typeof activeJourneyStageSelection==='undefined'?[]:activeJourneyStageSelection,typeof hospital==='undefined'?null:hospital])};
    }
    function materialTemplateMatches(query){
        if(!query.trim())return [];
        if(typeof templateSearchMatches==='function')return templateSearchMatches(query,{limit:12});
        const q=query.trim().toLowerCase();return (typeof templates==='undefined'?[]:templates).filter(t=>String(t.title||'').toLowerCase().includes(q)).slice(0,12);
    }

    let materialComposerOpen = false;
    async function sendMaterial(initialKind, builder=null) {
        if (materialComposerOpen) return;
        let base;
        try { base = materialScope('scope-check', 1); }
        catch { alert('환자를 선택하면 자료 생성·송부를 진행할 수 있습니다.'); choosePatient(); return; }
        materialComposerOpen = true;
        const {body, d} = dialog(builder?'보호자 Home에 게시':'이전 작성창 초안');d.className+=' r61-composer'+(builder?' r61-builder-send':'');
        const info = el('p', '자료와 보호자 연결을 확인하고 있습니다.');
        info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite'); body.append(info);
        let blobURL = null, uiBusy = false, previewSourceSignature=null, builderRecoveryInvalid=false;
        const guard = () => { if (!d.isConnected) throw Error('MATERIAL_DIALOG_CLOSED'); materialSame(base, materialScope('scope-check', 1));if(builder)builderMaterialGuard(builder.queue);if(previewSourceSignature&&previewSourceSignature!==materialSourceContext().signature)throw Error('MATERIAL_SOURCE_CHANGED'); return base; };
        d.addEventListener('close', () => { materialComposerOpen = false; if (blobURL) URL.revokeObjectURL(blobURL);if(builder&&typeof renderCurrentOutput==='function')renderCurrentOutput(); });
        // Keep the current operation visible until its result has been recorded.
        d.addEventListener('cancel', e => { if (uiBusy) e.preventDefault(); });
        const close = d.lastElementChild;
        let list, home;
        try {
            const cfg = await pdfRequest('/saas/r113/pdf-config', {method:'GET', redirect:'error'}); guard();
            if (cfg.pdfEnabled !== true || cfg.guardianMaterialEnabled !== true) throw Error('PDF_FEATURE_OFF');
            list = await pdfRequest('/saas/r61/materials?patientId=' + encodeURIComponent(base.patientId), {method:'GET', redirect:'error'}); guard();
            home = await pdfRequest('/saas/guardians/' + encodeURIComponent(base.guardianId), {method:'GET', redirect:'error'}); guard();
            if (!Array.isArray(list.materials) || home.guardian?.id !== base.guardianId || !home.patients?.some(p => p.id === base.patientId && p.guardianId === base.guardianId)) throw Error('MATERIAL_SCOPE_CHANGED');
        } catch (e) { info.textContent = materialHelp(pdfErrorCode(e)); button(body,'환자 선택 확인',choosePatient); if(!builder)button(body, '기존 텍스트 자료 보내기', materials); return; }
        const patient = home.patients.find(p => p.id === base.patientId);
        body.prepend(el('p', patient.name + ' · 보호자 ' + home.guardian.name));
        if(builder&&home.guardian.homeStatus!=='linked')body.append(el('p','보호자 Home 연결이 필요합니다. 아래 Home 연결하기에서 연결한 뒤 게시해주세요.'));
        const stepper=el('ol'),draftStatus=el('p'),writePanel=el('section'),previewPanel=el('section'),publishPanel=el('section');stepper.className='r61-stepper';stepper.setAttribute('aria-label','자료 게시 단계');const steps=(builder?['① PDF 확인','② Home 게시']:['① 내용 작성','② 미리보기','③ Home 게시']).map(label=>{const n=el('li',label);stepper.append(n);return n;});draftStatus.className='r61-draft-status';draftStatus.setAttribute('role','status');writePanel.className=previewPanel.className=publishPanel.className='r61-composer-panel';body.append(stepper,draftStatus,writePanel,previewPanel,publishPanel);let stage=builder?2:1;
        const queueList=el('ol'),queueSummary=el('p'),sourceSummary=el('p');queueList.className='r61-output-queue';queueSummary.className='r61-queue-summary';queueSummary.setAttribute('role','status');sourceSummary.className='r61-output-context';
        if(builder){body.insertBefore(queueSummary,stepper);body.insertBefore(queueList,stepper);body.insertBefore(sourceSummary,stepper);sourceSummary.textContent='교육자료: '+builder.queue.source.title+' · 진단/수술: '+(builder.queue.source.procedure||'미입력')+' · 작성한 환자·복약·일정을 그대로 사용합니다.';if(builder.queue.excluded.length)body.append(el('p','이번 Home 전송에서 제외: '+builder.queue.excluded.join(' · ')+' — 출력 화면의 다운로드를 이용해주세요.'));}
        const helpActions=el('details');helpActions.className='r61-composer-help';helpActions.append(el('summary','환자·처방·Home 연결 확인'));if(builder)helpActions.open=home.guardian.homeStatus!=='linked';body.append(helpActions);const helpNavigation=[button(helpActions,'Home 연결 확인',async()=>{d.close();await showHomeConnection();}),button(helpActions,'환자·처방 입력 화면',()=>{d.close();if(typeof go==='function')go('builder');})];

        publishPanel.append(el('h3','Home에 게시할 자료를 확인하세요.'),el('p', '자료 등록과 PDF 저장 후 CARESTEP Home 자료함에 게시합니다. 문자는 발송하지 않습니다. 게시 후 알림이 켜진 연결 기기에 새 자료 푸시를 시도합니다.'));const publishSummary=el('section');publishSummary.className='care-publish-review';publishSummary.setAttribute('aria-label','Home 게시 전 최종 확인');publishPanel.append(publishSummary);let medicationReview='조회 중';pdfRequest('/saas/patients/'+encodeURIComponent(base.patientId)+'/medications',{method:'GET',redirect:'error'}).then(result=>{guard();medicationReview=Array.isArray(result.plans)?result.plans.filter(p=>p.active&&p.homeVisible!==false&&p.endDate>=new Date(Date.now()+32400000).toISOString().slice(0,10)).length+'개 진행 일정 · 처방 대조 필요':'조회 필요';controls();}).catch(()=>{if(d.isConnected){medicationReview='조회 실패 · 게시 후 별도 확인 필요';controls();}});
        const pick = el('select'), kind = el('select'), title = el('input'), text = el('textarea'), reviewed = el('input'), viewer = el('iframe'), previewLink=el('a','PDF 새 창에서 보기');previewLink.className='btn btn-secondary';previewLink.target='_blank';previewLink.rel='noopener';previewLink.hidden=true;
        const admin = () => ['owner', 'admin'].includes(saasMe?.role);
        const field = (label, node) => { const l = el('label', label); l.style.cssText='display:block;margin:12px 0'; node.style.cssText='display:block;width:100%;box-sizing:border-box;margin-top:4px'; l.append(node); writePanel.append(l); };
        const newOption = el('option', admin() ? '새 자료 작성' : '기존 승인 자료를 선택해주세요'); newOption.value = ''; pick.append(newOption);
        for (const m of list.materials) { const o = el('option', m.title); o.value = m.id; pick.append(o); }
        for (const [value, label] of materialKinds) { const o = el('option', label); o.value=value; kind.append(o); }
        field('작성 방식 · 기존 등록 자료', pick); field('자료 종류', kind); field('자료 목록에 표시할 제목', title);
        const topicPanel=el('section'),topicCurrent=el('strong'),topicProcedure=el('p'),topicHint=el('p'),topicSearch=el('input'),topicResults=el('div');
        topicPanel.className='r61-topic-panel';topicPanel.setAttribute('aria-label','질환·시술 교육자료 선택');topicSearch.type='search';topicSearch.placeholder='질환·시술 검색 · 예: 스케일링, 방광염';topicSearch.setAttribute('aria-label','질환·시술 교육자료 검색');topicResults.className='r61-topic-results';
        topicPanel.append(topicCurrent,topicProcedure,topicHint,topicSearch,topicResults);writePanel.append(topicPanel);let confirmedTopic=builder?builder.queue.source.topic:'';
        const confirmTopic=button(topicPanel,'현재 교육자료 확인',()=>{guard();const source=materialSourceContext();if(!source.id)return;confirmedTopic=source.topic;controls();});
        const topicReady=()=>{if(!materialDraftSources[kind.value])return true;const source=materialSourceContext();return !!source.id&&confirmedTopic===source.topic;};
        const searchTopics=()=>{topicResults.replaceChildren();const q=topicSearch.value.trim();if(!q)return;const matches=materialTemplateMatches(q);if(!matches.length)topicResults.append(el('p','검색 결과가 없습니다. 다른 질환명이나 시술명으로 검색해주세요.'));for(const template of matches){const b=button(topicResults,template.title,async()=>{
            guard();const state=flow.state();if(uiBusy||state.busy||state.pending||state.hasMaterial||existing)return;
            const before=materialSourceContext();
            if(template.id!==before.id){
                if(!confirm('교육자료를 “'+template.title+'”로 변경할까요? 환자명·보호자명·관리 시작일과 입력한 진단/수술은 유지합니다. 이전 자료의 개별지시·복약·후속관리 설정은 초기화되므로 다시 확인해주세요.'))return;
                guard();if(typeof switchCaseTemplate!=='function'||!switchCaseTemplate(template.id,{preserveIdentity:true,notify:false}))throw Error('MATERIAL_TEMPLATE_REQUIRED');
                const procedureField=document.getElementById('caseProcedure');if(procedureField)procedureField.value=before.procedure;if(typeof caseInfo!=='undefined')caseInfo.procedure=before.procedure;
                if(typeof readCaseInfoFromForm==='function')readCaseInfoFromForm();
            }
            revokePreview();flow.reset();richDraft=null;text.value='';confirmedTopic=materialSourceContext().topic;topicSearch.value='';topicResults.replaceChildren();persistDraft();info.textContent='교육자료를 선택했습니다. 개별지시·복약을 확인한 뒤 새 PDF를 미리보기해주세요.';controls();
        });b.dataset.materialTopic=template.id;}};
        topicSearch.oninput=searchTopics;

        field('보호자에게 보여줄 내용', text);
        const formatInfo=el('p');writePanel.append(formatInfo);
        title.maxLength=120; text.maxLength=20000; text.rows=10;
        const draft = () => ({kind:kind.value,title:title.value,text:text.value});
        const signature = () => JSON.stringify(draft());
        const recentDraft=allComposerDrafts().find(x=>x.base?.patientId===base.patientId&&x.base?.guardianId===base.guardianId);
        let existing = builder?.item.existing||null, previewBlob = null, previewSignature = null, richDraft = null, draftKind=materialKinds.some(([k])=>k===initialKind)?initialKind:(recentDraft?.kind||'advanced');
        kind.value=draftKind;
        const persistDraft=()=>{if(builder)return;if(!existing&&title.value.trim()){const saved=saveComposerDraft(base,{kind:draftKind,title:title.value,text:text.value,sourceTemplateId:materialDraftSources[draftKind]?materialSourceContext().id:'',sourceTemplateTitle:materialDraftSources[draftKind]?materialSourceContext().title:''},richDraft);if(saved)draftStatus.textContent=saved.stored?'이 탭에 초안 저장됨 · '+workTime(saved.updatedAt):'현재 화면에 임시보관 중 · 브라우저 저장 공간을 확인해주세요.';}};
        const restoreDraft=()=>{if(builder){title.value=builder.item.draft?.title||builderMaterialTitle(draftKind,builder.queue.source);text.value=builder.item.draft?.text||'';return;}const saved=readComposerDraft(base,draftKind);title.value=saved?.title||materialKindLabel(draftKind);text.value=saved?.text||'';richDraft=saved?.rich||null;if(materialDraftSources[draftKind]&&(!saved?.sourceTemplateId||saved.sourceTemplateId!==materialSourceContext().id)){richDraft=null;text.value='';}draftStatus.textContent=saved?'저장된 초안을 불러왔습니다.':'초안은 입력할 때 이 탭에 자동 저장됩니다.';};
        d.addEventListener('close',()=>{if(!flow.state().sent)persistDraft();});
        const buttons = {}, extraButtons = [...helpNavigation];
        const flow = materialDeliveryFlow({scope:guard,request:pdfRequest,storage:sessionStorage,canApprove:admin,
            onMaterial: m => { if(builder&&(!builder.item.draft||['kind','title','text'].some(key=>m[key]!==builder.item.draft[key])))throw Error('MATERIAL_ORIGINAL_SOURCE_CHANGED');existing=m;if(builder)builder.item.existing={...m}; if (![...pick.options].some(o=>o.value===m.id)) { const o=el('option',m.title);o.value=m.id;pick.append(o); } pick.value=m.id;kind.value=m.kind; title.value=m.title; text.value=m.text; },
            onProgress: message => { info.textContent=message; controls(); }
        });
        const revokePreview = () => { if (blobURL) URL.revokeObjectURL(blobURL); blobURL=null; viewer.removeAttribute('src'); viewer.hidden=true;previewLink.removeAttribute('href');previewLink.hidden=true; previewBlob=null; previewSignature=null;previewSourceSignature=null; reviewed.checked=false;stage=builder?2:1; };
        const controls = () => {
            const s=flow.state(), locked=uiBusy||s.busy||s.pending||s.registrationPending;
            const source=materialSourceContext();if(previewSourceSignature&&previewSourceSignature!==source.signature){revokePreview();richDraft=null;confirmedTopic='';info.textContent=materialHelp('MATERIAL_SOURCE_CHANGED');}
            topicPanel.hidden=!!builder||!materialDraftSources[kind.value];topicCurrent.textContent='현재 교육자료 · '+(source.title||'선택 필요');topicProcedure.textContent='입력한 진단/수술 · '+(source.procedure||'미입력');topicHint.textContent=topicReady()?'교육자료를 확인했습니다. 제목·본문·회복 일정은 이 교육자료를 기준으로 생성합니다.':'진단/수술을 입력해도 교육자료는 자동으로 바뀌지 않습니다. 이번 진료에 맞는 교육자료를 검색하거나 현재 자료를 확인해주세요.';topicSearch.disabled=locked||s.hasMaterial||!!existing;confirmTopic.disabled=locked||!source.id;confirmTopic.textContent=topicReady()?'교육자료 확인됨':'현재 교육자료 확인';for(const b of topicResults.children)b.disabled=locked||s.hasMaterial||!!existing;
            close.disabled=uiBusy;
            for (const b of extraButtons) b.disabled=uiBusy||s.busy;
            pick.disabled=locked||s.hasMaterial;
            kind.disabled=title.disabled=text.disabled=locked||s.hasMaterial||!!existing||!admin();
            text.readOnly=!!materialDraftSources[kind.value];
            formatInfo.textContent=text.readOnly?'원래 자료 서식으로 생성합니다. 본문 수정은 자료 생성 화면의 환자·처방·개별지시에서 해주세요. 목록 제목을 바꿔도 PDF 서식은 유지됩니다.':'제목과 본문을 직접 작성할 수 있습니다.';
            buttons.draft.disabled=!topicReady()||locked||s.hasMaterial||!!existing||!admin()||!materialDraftSources[kind.value];
            buttons.preview.disabled=!topicReady()||locked||s.sent||!!s.assetId||!title.value.trim()||(!materialDraftSources[kind.value]&&!text.value.trim())||(!admin()&&!existing);
            reviewed.disabled=locked||s.sent;
            buttons.send.disabled=(!s.assetId&&!topicReady())||locked||s.sent||stage!==3||!reviewed.checked||(!s.assetId && (!previewBlob||previewSignature!==signature()));
            if(builderRecoveryInvalid)buttons.send.disabled=true;
            buttons.send.textContent=s.sent?'Home 게시 완료':s.assetId?'저장된 PDF Home에 게시':'Home에 게시하기';
            buttons.recover.disabled=uiBusy||s.busy||!(s.registrationPending||s.hasRecovery);
            if(s.assetId&&stage===1)stage=2;writePanel.hidden=!!builder||s.sent||stage!==1;previewPanel.hidden=s.sent||stage!==2;publishPanel.hidden=s.sent||stage!==3;steps.forEach((n,i)=>n.setAttribute('aria-current',!s.sent&&i===stage-(builder?2:1)?'step':'false'));nextStep.disabled=locked||!reviewed.checked||(!previewBlob&&!s.assetId);previousStep.disabled=locked||s.sent;editStep.disabled=locked||s.sent||s.hasMaterial||!!s.assetId;buttons.draft.hidden=!materialDraftSources[kind.value]||!!existing;publishSummary.replaceChildren();for(const [label,value] of [['환자',patient.name],['보호자',home.guardian.name],['질환·시술 교육자료',source.title||'직접 작성 · 원문 확인'],['진단/수술',source.procedure||'미입력'],['자료 종류',materialKindLabel(kind.value)],['제목',title.value],['PDF',s.assetId?'저장된 원본 · 현재 입력 변경 반영 안 됨':previewBlob?'미리보기 확인한 원본':'미리보기 필요'],['Home 복약 일정',medicationReview]]){const row=el('div'),term=el('b',label),valueNode=el('span',value);row.append(term,valueNode);publishSummary.append(row);};draftStatus.hidden=!!builder||s.sent;buttons.preview.hidden=!!builder&&!!previewBlob;buttons.preview.className='btn btn-primary r61-primary';buttons.send.className='btn btn-primary r61-primary';
            if(builder){renderBuilderQueue(queueSummary,queueList,builder.queue,builder.item,{...s,busy:uiBusy||s.busy});const remaining=builder.queue.items.filter(row=>!row.sent).length;nextMaterial.hidden=!s.sent||!remaining;nextMaterial.textContent='남은 자료 확인 ('+remaining+'개)';for(const b of editButtons)b.disabled=locked||s.sent||s.hasMaterial||!!s.assetId;}
            if(builderRecoveryInvalid)nextStep.disabled=true;
            previewLink.hidden=!blobURL; if(blobURL)previewLink.href=blobURL;
        };
        const show = () => {
            const s=flow.state();
            if(s.sent){if(builder){builder.item.sent=true;builder.item.deliveryId=s.deliveryId;}else deleteComposerDraft(base,kind.value);info.textContent=title.value+' · Home 게시 완료 · 문자는 발송하지 않았습니다. 새 자료 푸시는 알림이 켜진 연결 기기에 전달을 시도합니다. · Delivery ID: '+s.deliveryId;afterSend.hidden=false;steps.forEach(n=>n.setAttribute('aria-current','false'));}
            else if(s.status==='READY_UNSENT') info.textContent='저장된 PDF는 현재 교육자료·입력값을 바꿔도 변경되지 않습니다. 기존 PDF 조회에서 원본을 확인한 뒤 게시해주세요.';
            else if(s.hasMaterial) info.textContent='등록된 자료를 확인했습니다. PDF 미리보기 후 보내기를 누르면 이어서 처리합니다.';
        };
        const action = (key,label,fn,parent=writePanel) => {
            const b=el('button',label); b.type='button'; b.className='btn btn-secondary'; parent.append(b); buttons[key]=b;
            b.onclick=async()=>{if(b.disabled||uiBusy)return;uiBusy=true;try{if(key==='recover'&&!builder)revokePreview();guard();controls();await fn();guard();}catch(e){
                const s=flow.state(), code=pdfErrorCode(e);
                info.textContent=materialHelp(code)+' '+(s.pending||s.registrationPending?'중단된 결과 조회 버튼으로 확인해주세요. ':'')+'('+code+')';
                if(s.pending||s.registrationPending||code==='PDF_PENDING_OTHER_ASSET')more.open=true;helpActions.open=true;if(builder&&code==='MATERIAL_ORIGINAL_SOURCE_CHANGED'){builderRecoveryInvalid=true;more.open=true;}if(builder&&(code==='MATERIAL_SOURCE_CHANGED'||code==='PDF_PATIENT_CHANGED'||code==='MATERIAL_SCOPE_CHANGED')){reviewed.checked=false;revokePreview();}
            }finally{uiBusy=false;controls();}};
        };
        action('draft','선택 유형의 초안 불러오기',async()=>{
            if(!topicReady())throw Error('MATERIAL_TEMPLATE_REQUIRED');
            if(text.value.trim()&&!confirm('현재 내용을 새 초안으로 바꿀까요?'))return;
            const doc=renderMaterialDraftPDF(kind.value,base.patientId);guard();
            if(!title.value.trim())title.value=materialKindLabel(kind.value);text.value=doc.innerText;revokePreview();
            richDraft={kind:kind.value,text:text.value,sourceSignature:materialSourceContext().signature,node:doc.cloneNode(true)};persistDraft();
            info.textContent='원래 서식의 초안을 불러왔습니다. PDF 미리보기에서 내용을 확인해주세요.';
        });
        action('preview','PDF 미리보기',async()=>{
            revokePreview();
            const m=draft();if(!topicReady())throw Error('MATERIAL_TEMPLATE_REQUIRED');const sourceBefore=materialDraftSources[m.kind]?materialSourceContext().signature:null;
            if(typeof exportPdfElement!=='function'||!window.html2pdf)throw Error('PDF_GENERATOR_UNAVAILABLE');
            let doc, refreshed=false;
            if(materialDraftSources[m.kind]){
                // Rich output must never fall back to the plain-text template.
                // A display-title edit does not invalidate the original page markup.
                if(richDraft?.kind===m.kind && richDraft.text===m.text && richDraft.sourceSignature===sourceBefore){
                    doc=document.getElementById('pdfDocument');
                    doc.replaceChildren(...[...richDraft.node.childNodes].map(n=>n.cloneNode(true)));
                    doc.classList.remove('hidden');doc.dataset.r61Patient=base.patientId;doc.dataset.r61MaterialKind=m.kind;
                }else{
                    doc=renderMaterialDraftPDF(m.kind,base.patientId);guard();
                    const generatedText=doc.innerText;
                    if(existing && generatedText!==existing.text){
                        if(flow.state().hasMaterial||!admin())throw Error('MATERIAL_ORIGINAL_SOURCE_CHANGED');
                        if(!confirm('현재 입력으로 만든 PDF 내용이 기존 등록 자료와 다릅니다. 기존 자료는 유지하고 새 자료로 준비할까요?'))return;
                        flow.reset();existing=null;pick.value='';refreshed=true;
                    }
                    text.value=generatedText;
                    richDraft={kind:m.kind,text:generatedText,sourceSignature:materialSourceContext().signature,node:doc.cloneNode(true)};
                }
            }else doc=renderApprovedMaterialPDF(m,base.patientId);
            const before=signature();
            const blob=await exportPdfElement('carestep-material.pdf',{save:false,silent:true});guard();
            if(before!==signature()||!(blob instanceof Blob)||blob.type!=='application/pdf'||!blob.size||blob.size>10485760||new TextDecoder().decode(await blob.slice(0,5).arrayBuffer())!=='%PDF-')throw Error('PDF_GENERATION_INVALID');
            guard();if(sourceBefore&&sourceBefore!==materialSourceContext().signature)throw Error('MATERIAL_SOURCE_CHANGED');previewSourceSignature=sourceBefore;if(builder){builder.item.draft={...draft()};builder.item.preview={blob,signature:before,sourceSignature:sourceBefore};}persistDraft();previewBlob=blob;previewSignature=before;blobURL=URL.createObjectURL(blob);viewer.src=blobURL;viewer.hidden=false;stage=2;
            info.textContent=(refreshed?'현재 입력으로 새 자료를 준비했습니다. ':'')+'이 PDF가 보호자에게 전달됩니다. 아직 등록·저장·송부하지 않았습니다.';
        },builder?previewPanel:writePanel);
        viewer.title='보호자에게 보낼 PDF 미리보기';viewer.style.cssText='width:100%;height:360px;border:1px solid #ddd;margin-top:12px';viewer.hidden=true;previewPanel.append(viewer,previewLink);
        const reviewLabel=el('label');reviewed.type='checkbox';reviewLabel.style.cssText='display:block;margin:16px 0';reviewLabel.append(reviewed,document.createTextNode(builder?' 환자·보호자·교육자료·복약 내용과 이 PDF를 확인했습니다.':' 환자·보호자와 공개할 내용을 확인했습니다.'));previewPanel.append(reviewLabel);
        const editButtons=[],editActions=el('details');editActions.className='r61-edit-actions';editActions.append(el('summary','수정할 항목 선택'));editActions.hidden=!builder;previewPanel.append(editActions);
        const editBuilder=(target,step)=>{guard();d.close();if(typeof beginBuilderEdit==='function')beginBuilderEdit(target);else{if(typeof go==='function')go('builder');setWizardStep(step);}};
        if(builder)for(const [target,label,step] of [['patient','환자정보 수정',1],['education','교육자료 변경',1],['instructions','개별지시 수정',2],['medication','복약 수정',3],['recheck','재진 일정 수정',4]])editButtons.push(button(editActions,label,()=>editBuilder(target,step)));
        reviewed.onchange=controls;const editStep=button(previewPanel,'내용 수정',()=>{revokePreview();controls();title.focus?.();}),nextStep=button(previewPanel,'확인 후 게시 단계로',()=>{try{guard();}catch(e){revokePreview();confirmedTopic='';info.textContent=materialHelp(pdfErrorCode(e));controls();return;}if(!reviewed.checked||(!previewBlob&&!flow.state().assetId))return;stage=3;controls();body.scrollTop=0;previousStep.focus?.({preventScroll:true});});editStep.hidden=!!builder;nextStep.className='btn btn-primary r61-primary';const previousStep=button(publishPanel,'미리보기로 돌아가기',()=>{stage=2;controls();body.scrollTop=0;reviewed.focus?.({preventScroll:true});});
        action('send','Home에 게시하기',async()=>{
            if(!reviewed.checked)throw Error('MATERIAL_PUBLIC_REVIEW_REQUIRED');
            guard();const s=flow.state();if(!s.assetId&&previewSignature!==signature())throw Error('MATERIAL_PUBLIC_REVIEW_REQUIRED');
            await flow.send({draft:draft(),blob:previewBlob,existing,confirmed:true});show();
        },publishPanel);
        const afterSend=el('div');afterSend.className='r61-after-send';afterSend.hidden=true;body.append(afterSend);let nextMaterial;if(builder){nextMaterial=button(afterSend,'남은 자료 확인',async()=>{guard();d.close();await sendBuilderMaterials();});nextMaterial.className='btn btn-primary r61-primary';nextMaterial.hidden=true;}button(afterSend,'Home 복약 일정 등록',async()=>{guard();d.close();await window.carestepOpenMedicationPlans?.();});button(afterSend,'게시 이력 확인',materialHistory);button(afterSend,'출력 화면으로 돌아가기',()=>{d.close();if(typeof go==='function')go('builder');if(typeof setWizardStep==='function')setWizardStep(5);});button(afterSend,'다른 환자 선택',()=>{d.close();choosePatient();});
        const more=el('details');more.className='r61-composer-help';more.append(el('summary','기존 자료·결과 조회·관리'));body.append(more);
        action('recover','중단된 저장·송부 결과 조회',async()=>{if(builder){reviewed.checked=false;stage=2;if(!previewBlob||!builder.item.draft)throw Error('MATERIAL_ORIGINAL_SOURCE_CHANGED');}else revokePreview();const result=await flow.recover();if(builder&&result?.receipt?.sha256&&result.receipt.sha256!==Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await previewBlob.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('')){revokePreview();throw Error('MATERIAL_ORIGINAL_SOURCE_CHANGED');}show();},more);
        extraButtons.push(button(more,'기존 PDF 조회·철회',privatePDF));
        if(!builder)extraButtons.push(button(more,'텍스트만 보내기·발송 이력',materials));
        if(!builder&&admin())extraButtons.push(button(more,'공개 자료 관리',approveMaterial));
        const changed=()=>{revokePreview();flow.reset();stage=1;info.textContent='내용을 확인한 뒤 PDF 미리보기를 눌러주세요.';controls();};
        title.oninput=text.oninput=()=>{persistDraft();changed();};
        kind.onchange=()=>{persistDraft();draftKind=kind.value;restoreDraft();changed();};
        pick.onchange=()=>{persistDraft();existing=list.materials.find(m=>m.id===pick.value)||null;kind.value=existing?.kind||draftKind;draftKind=kind.value;richDraft=null;if(existing){title.value=existing.title;text.value=existing.text;}else restoreDraft();changed();};
        restoreDraft();
        if(!builder)body.append(el('small','초안은 같은 로그인·같은 브라우저 탭에서 환자와 자료 종류별로 보존됩니다. 미리보기와 송부 전에는 내용을 다시 확인해주세요.'));
        info.textContent=home.guardian.homeStatus==='linked'?'자료 종류를 선택해 내용을 준비해주세요.':'보호자의 Home 연결이 필요합니다. 연결 후 이 화면에서 보낼 수 있습니다.';
        if(flow.state().registrationPending||flow.state().pending){more.open=true;info.textContent='이전에 중단된 요청이 있습니다. 결과 조회로 먼저 확인해주세요.';}
        topicSearch.value=materialSourceContext().procedure;if(!builder)searchTopics();
        if(builder){
            extraButtons.push(button(helpActions,'③ 복약 입력으로',()=>editBuilder('medication',3)));
            extraButtons.push(button(helpActions,'① 환자·교육자료 확인으로',()=>editBuilder('patient',1)));
            extraButtons.push(button(helpActions,'Home 연결하기',async()=>{d.close();await showHomeConnection();}));
            if(!flow.state().pending&&!flow.state().registrationPending)info.textContent=admin()?'작성한 자료의 PDF를 준비하고 있습니다.':'새 자료의 Home 게시에는 병원 관리자 권한이 필요합니다.';
        }
        controls();
        if(builder?.item.preview){guard();const saved=builder.item.preview;previewBlob=saved.blob;previewSignature=saved.signature;previewSourceSignature=saved.sourceSignature;blobURL=URL.createObjectURL(previewBlob);viewer.src=blobURL;viewer.hidden=false;stage=2;if(!flow.state().pending&&!flow.state().registrationPending)info.textContent='이 PDF가 보호자에게 전달됩니다. 공개할 내용을 확인해주세요.';controls();}
        else if(builder&&!flow.state().pending&&!flow.state().registrationPending)await buttons.preview.onclick();
    }

    const workTime = value => {const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'기록 없음';};
    const deliveryLabel = x => x.superseded_by?'이전 안내 · 새 자료 연결됨':Number(x.accessRevoked)===1?'공개 철회됨':x.status==='sent'?(x.channel==='home'?'Home 게시 완료':x.provider_id?'발송 사업자 접수 완료':'결과 미확정'):({failed:'발송 실패',blocked:'조건 불충족 · 발송 차단',unconfirmed:'결과 미확정',claimed:'처리 중 · 결과 확인 필요',canceled:'발송 취소'})[x.status]||'상태 확인 필요';
    const resultLabels={accepted:'문자·외부 채널 접수',home:'Home 알림 접수',failed:'실패',blocked:'차단',unconfirmed:'결과 미확정',canceled:'취소',claimed:'처리 중'};
    const workErrorCode=e=>/^[A-Z][A-Z0-9_]{1,80}$/.test(e?.code||e?.message||'')?(e.code||e.message):'RESULT_UNCONFIRMED';
    const resultReason=code=>({PROVIDER_RESULT_UNCONFIRMED:'사업자 접수 여부를 확인하지 못했습니다.',RECORD_CHANGED_REFRESH:'다른 작업에서 기록이 변경됐습니다. 목록을 다시 조회해주세요.',DUE_BEFORE_RECORD:'예정일은 해당 진료 기록일보다 빠를 수 없습니다.',DATE_INVALID:'올바른 날짜를 선택해주세요.',RECORD_NOT_EDITABLE:'종류나 원본 기록 확인이 필요합니다.'})[code]||preventiveReasons[code]||code||'별도 사유 없음';
    function workCard(parent){const card=el('article');card.className='r61-work-card';parent.append(card);return card;}
    const workAdmin=()=>{if(!['owner','admin'].includes(saasMe?.role)){alert('관리자 계정에서 확인·설정할 수 있습니다.');return false;}return true;};
    function preventiveDiagnostic(d){
        const labels={RECIPIENT_DECRYPT_FAILED:'보호자 연락처를 읽지 못했습니다. 병원에 저장된 연락처와 서버 암호화 설정을 확인해야 합니다.',INPUT_INVALID:'발송 입력 설정을 확인해주세요. 번호·문자 종류·이미지 첨부 조건에서 중단됐습니다.',AUTH_PREPARATION_FAILED:'SOLAPI 인증 준비에 실패했습니다. 연동 상태를 확인해주세요.',SOLAPI_HTTP_ERROR:'SOLAPI가 요청에 오류를 반환했습니다.',SOLAPI_MESSAGE_REJECTED:'SOLAPI가 문자 접수를 거절했습니다. 발신번호·수신번호와 사업자 이력을 확인해주세요.',SOLAPI_RECEIPT_MISSING:'응답에 접수번호가 없어 접수 여부를 확인하지 못했습니다. SOLAPI 이력과 대조해주세요.',REQUEST_OR_RESPONSE_ERROR:'SOLAPI 통신 또는 응답 확인 중 문제가 발생했습니다. 사업자 이력과 대조해주세요.',PROVIDER_RESULT_UNCONFIRMED:'사업자 결과를 확인하지 못했습니다. SOLAPI 이력과 대조해주세요.'};
        const stages={RECIPIENT_DECRYPT:'연락처 확인',SEND_VALIDATION:'발송 입력 확인',AUTH_SELECTION:'인증 방식 확인',TOKEN_ACCESS:'연결 인증 확인',AUTH_HEADER:'연결 인증 준비',PROVIDER_REQUEST:'사업자 요청',PROVIDER_RESPONSE:'사업자 응답',PROVIDER_RESULT:'접수번호 확인'};
        if(!d||!Object.hasOwn(labels,d.code)||!Object.hasOwn(stages,d.stage))return '상세 진단 기록이 없습니다. 이 건은 SOLAPI 발송 이력과 대조해주세요.';
        const http=Number.isInteger(d.httpStatus)&&d.httpStatus>=100&&d.httpStatus<=599?d.httpStatus:null;
        const advice=http===401||http===403?' 인증·권한을 확인해주세요.':http===429?' 사업자 요청 한도에 도달했습니다.':http===400?' 발신번호·수신번호·문자 설정을 확인해주세요.':'';
        return labels[d.code]+advice+' · 확인 단계: '+stages[d.stage]+(http?' · HTTP '+http:'')+(/^\d{4}$/.test(d.providerCode||'')?' · 사업자 코드 '+d.providerCode:'');
    }
    async function preventiveReadinessPanel(parent,session){
        const card=workCard(parent);card.className+=' r61-readiness';card.append(el('strong','발송 전 준비 상태'));const text=el('p','확인 중…');card.append(text);
        button(card,'문자 설정 확인',()=>{if(settingsSession()===session)settings();});
        try{const d=await api('/preventive/readiness');if(settingsSession()!==session)return;const labels=[d.enabled?'자동 안내 켜짐':'자동 안내 꺼짐',d.senderConfigured?'발신번호 설정됨':'발신번호 필요',d.connected?'SOLAPI 연결됨':d.legacyConfigured?'기존 문자 연결 사용':'SOLAPI 연결 필요',d.channel==='lms'?'장문 문자(LMS)':'Home 우선 안내'];if(d.recipientCheck)labels.push('오늘 대상 연락처 '+d.recipientCheck.valid+'건 정상'+(d.recipientCheck.invalid?' · '+d.recipientCheck.invalid+'건 확인 필요':''));text.textContent=labels.join(' · ');card.dataset.ready=d.ready?'true':'false';}catch{if(settingsSession()===session)text.textContent='준비 상태를 조회하지 못했습니다. 문자 설정을 확인해주세요.';}
    }
    async function preventiveRecovery(ids){
        if(!workAdmin())return;const session=settingsSession(),{body}=dialog('예방문자 복구 발송 검토'),note=el('p','사업자 요청 전 중단 여부와 현재 수신 조건을 확인하고 있습니다.');body.append(note);
        try{const d=await api('/preventive/recovery-preview',{deliveryIds:ids},{redirect:'error'});if(settingsSession()!==session)return;if(d.ok!==true||!Array.isArray(d.items)||!d.items.length)throw Error('RECOVERY_PREVIEW_INVALID');note.textContent='검토 대상 '+d.count+'건 · 장문 문자(LMS) · 검토 유효시간 5분';
            for(const x of d.items){const card=workCard(body);card.append(el('strong',x.patientName+' · '+x.guardianName),el('p','수신번호 '+x.recipientHint+' · 예정일 '+x.dueDate));const pre=el('pre',x.message);pre.className='r61-recovery-message';card.append(pre);}
            body.append(el('p','예상 비용: '+(d.estimatedCost?.note||'병원 SOLAPI 계약요금이 적용됩니다. 총액은 SOLAPI에서 확인해주세요.')));
            const label=el('label'),check=el('input');check.type='checkbox';label.className='r61-confirm-row';label.append(check,el('span','대상·문구와 문자 비용 발생을 확인했습니다.'));body.append(label);const status=el('p');status.setAttribute('role','status');body.append(status);
            const send=el('button',d.count+'건 복구 발송 확인');send.type='button';body.append(send);send.onclick=async()=>{if(send.disabled)return;if(settingsSession()!==session){status.textContent='로그인이 변경됐습니다. 검토 화면을 다시 열어주세요.';send.disabled=true;return;}if(!check.checked){status.textContent='대상·문구와 비용 안내를 먼저 확인해주세요.';return;}if(!confirm('검토한 예방문자 '+d.count+'건을 실제로 발송할까요? 문자 비용이 발생합니다.'))return;send.disabled=true;check.disabled=true;try{const out=await api('/preventive/recover',{previewId:d.previewId,confirmed:true},{redirect:'error'});if(settingsSession()!==session)return;const n=key=>(out.items||[]).filter(x=>x.category===key).length;status.textContent='사업자 접수 '+n('accepted')+'건 · 결과 확인 필요 '+(n('unconfirmed')+n('claimed'))+'건 · 발송되지 않은 항목 '+(out.items||[]).filter(x=>!['accepted','unconfirmed','claimed'].includes(x.category)).length+'건. 접수는 수신 완료를 뜻하지 않습니다.';button(body,'현재 발송 결과 확인',()=>preventiveResults());}catch{if(settingsSession()===session){status.textContent='처리 결과를 확인하지 못했습니다. 다시 누르지 말고 발송 결과를 조회해주세요.';button(body,'발송 결과 조회',()=>preventiveResults());}}};send.className='btn btn-primary r61-primary';
        }catch(e){const labels={RECOVERY_NOT_SAFE:'이 건은 자동 복구 대상이 아닙니다. 사업자 발송 이력을 확인해주세요.',RECOVERY_PROVIDER_CHECK_REQUIRED:'접수 여부가 불확실합니다. SOLAPI 발송 이력을 먼저 확인해주세요.',RECOVERY_SCHEDULE_CHANGED:'일정이 변경됐거나 오늘의 안내 대상이 아닙니다.',RECOVERY_NOT_READY:'문자 발송 설정을 먼저 확인해주세요.',RECOVERY_RECIPIENT_INVALID:'보호자 연락처를 먼저 수정해주세요.',RECOVERY_POLICY_CHANGED:'발송 설정이 바뀌었습니다. 현재 설정을 확인해주세요.',RECOVERY_PERMISSION_CHANGED:'수신 동의 또는 환자 연결을 다시 확인해주세요.'};if(settingsSession()===session){note.textContent=labels[e.message]||'복구 검토를 완료하지 못했습니다. 발송 결과를 새로고침하고 현재 조건을 확인해주세요.';button(body,'문자 설정 확인',settings);}}
    }
    const preDispatchFailure=x=>x.category==='unconfirmed'&&x.channel==='lms'&&['RECIPIENT_DECRYPT','SEND_VALIDATION'].includes(x.diagnostic?.stage);

    async function preventiveResults(initialFilter='all'){
        if(!workAdmin())return;
        const session=settingsSession(),{body}=dialog('예방문자 발송 결과'),date=el('input'),rows=el('section');date.type='date';date.value=new Date(Date.now()+32400000).toISOString().slice(0,10);
        const readinessMount=el('section');body.append(readinessMount,el('p','선택한 한국시간 날짜의 실제 발송 시도입니다. 작업 정상 종료와 문자 접수 성공은 다릅니다.'),date);void preventiveReadinessPanel(readinessMount,session);
        const load=async()=>{rows.replaceChildren(el('p','결과 확인 중…'));try{
            if(settingsSession()!==session)throw Error('SESSION_CHANGED');const d=await api('/preventive/results?date='+encodeURIComponent(date.value),undefined,{redirect:'error'});if(settingsSession()!==session)throw Error('SESSION_CHANGED');
            if(d?.ok!==true||!d.counts||!Array.isArray(d.deliveries))throw Error('RESULT_INVALID');rows.replaceChildren();
            const cron=d.cron;rows.append(el('p',cron?'공통 자동작업: '+(({ok:'정상 종료',running:'실행 중',failed:'실패'})[cron.status]||'상태 확인 필요')+' · 시작 '+workTime(cron.startedAt)+(cron.status==='running'?'':' · 종료 '+workTime(cron.completedAt)):'공통 자동작업 실행 기록 없음'));
            rows.append(el('strong',Object.entries(resultLabels).map(([k,v])=>v+' '+Number(d.counts[k]||0)+'건').join(' · ')));
            rows.append(el('p','현재 저장 기록으로 계산한 제외 이력 '+Number(d.excludedCount||0)+'건'+(Object.entries(d.excludedReasons||{}).length?' · '+Object.entries(d.excludedReasons).map(([k,v])=>preventiveReason(k)+' '+v+'건').join(' · '):'')+' (당시 실행 시점의 제외 이력 스냅샷은 아닙니다.)'));
            rows.append(el('p','접수는 수신 완료를 뜻하지 않습니다. 요청 전 중단 건은 복구 검토할 수 있습니다. 사업자 결과가 불확실한 건은 SOLAPI 이력을 먼저 확인해주세요.'));
            const filter=el('select');for(const [key,label] of [['all','전체'],['pending','결과 확인 필요'],...Object.entries(resultLabels)]){const o=el('option',label);o.value=key;filter.append(o);}filter.value=['all','pending',...Object.keys(resultLabels)].includes(initialFilter)?initialFilter:'all';rows.append(filter);const list=el('section');rows.append(list);
            const safe=d.deliveries.filter(preDispatchFailure);if(safe.length)button(rows,'발송 전 중단 '+safe.length+'건 복구 검토'+(safe.length>20?' (최대 20건)':''),()=>preventiveRecovery(safe.slice(0,20).map(x=>x.deliveryId)));const provider=button(rows,'SOLAPI 이력 확인',()=>window.open('https://console.solapi.com/','_blank','noopener'));provider.className='btn btn-secondary';const render=()=>{list.replaceChildren();for(const x of d.deliveries.filter(x=>filter.value==='all'||(filter.value==='pending'?['unconfirmed','claimed'].includes(x.category):x.category===filter.value))){const card=workCard(list);card.append(el('strong',x.patientName+' · 보호자 '+x.guardianName),el('p',(preDispatchFailure(x)?'발송 전 중단':resultLabels[x.category]||'결과 확인 필요')+' · '+(x.channel||'채널 미정')+' · '+workTime(x.attemptedAt)),el('p','예정일 '+x.dueDate+' · '+resultReason(x.reason)));if(x.category==='unconfirmed'||x.diagnostic)card.append(el('p',preventiveDiagnostic(x.diagnostic)));if(preDispatchFailure(x))button(card,'이 건 복구 검토',()=>preventiveRecovery([x.deliveryId]));else if(['unconfirmed','failed','blocked'].includes(x.category))button(card,'문자 설정 확인',settings);}if(!list.children.length)list.append(el('p','표시할 발송 기록이 없습니다.'));};filter.onchange=render;render();
            if(d.total>d.deliveries.length)rows.append(el('p','집계는 전체 '+d.total+'건이며 상세는 최근 '+d.deliveries.length+'건입니다.'));
        }catch(e){rows.replaceChildren(el('p',e.message==='SESSION_CHANGED'?'로그인 또는 병원이 바뀌었습니다. 창을 다시 열어주세요.':'발송 결과를 조회하지 못했습니다. 새로고침으로 다시 확인해주세요.'));}};
        button(body,'결과 새로고침',async()=>{readinessMount.replaceChildren();void preventiveReadinessPanel(readinessMount,session);await load();});button(body,'예정·제외 대상 확인',preventivePreview);button(body,'충돌 일정 확인·수정',preventiveReview);body.append(rows);await load();
    }
    async function preventiveReview(){
        if(!workAdmin())return;
        const session=settingsSession(),{body}=dialog('예방 일정 확인·수정'),rows=el('section');let page=0;
        body.append(el('p','환자·보호자와 원본 기록을 확인한 뒤 잘못된 예정일만 수정하세요. 다른 기록은 유지되며 문자는 발송하지 않습니다.'),el('p','eFriends 원본이 변경되면 다음 동기화에 반영될 수 있으므로 원본 차트의 잘못된 날짜도 함께 정정해주세요.'));
        const load=async()=>{rows.replaceChildren(el('p','확인할 일정 조회 중…'));try{
            if(settingsSession()!==session)throw Error('SESSION_CHANGED');const d=await api('/preventive/review?page='+page,undefined,{redirect:'error'});if(settingsSession()!==session)throw Error('SESSION_CHANGED');if(d?.ok!==true||!Array.isArray(d.groups))throw Error('REVIEW_INVALID');rows.replaceChildren();
            rows.append(el('p','확인할 항목 '+d.totalGroups+'개 · 제외된 이력 '+d.excludedCount+'건. 최신 충돌 기록과 날짜 오류 기록을 표시합니다.'));
            for(const g of d.groups){const card=workCard(rows);card.append(el('strong',g.patientName+' · 보호자 '+g.guardianName),el('p',(g.type==='heartworm'?'심장사상충':g.identity||'접종 종류 확인 필요')+' · 최신 기록 '+g.latestDate+' · 제외 이력 '+g.excludedRecords+'건'));
                for(const r of g.records){const line=el('div'),info=el('p'),input=el('input');input.type='date';input.setAttribute('aria-label',g.patientName+' '+r.eventDate+' 기록의 새 예정일');input.value=r.nextDueDate;input.disabled=!r.canEdit;line.append(el('p','기록일 '+r.eventDate+' · 기존 예정일 '+(r.nextDueDate||'없음')),el('small','원본: '+(r.sourceRef||'직접 입력 / 출처 미기록')),input,info);card.append(line);
                    const save=button(line,'이 기록의 예정일 저장',async()=>{
                        if(settingsSession()!==session){info.textContent='로그인이 바뀌었습니다. 다시 조회해주세요.';return;}
                        if(!input.value){info.textContent='예정일을 선택해주세요.';return;}
                        if(input.value===r.nextDueDate){info.textContent='변경 사항이 없습니다.';return;}
                        if(!confirm(g.patientName+' · 보호자 '+g.guardianName+'\n기록일 '+r.eventDate+'\n예정일 '+(r.nextDueDate||'없음')+' → '+input.value+'\n이 기록만 수정할까요?'))return;
                        input.disabled=true;
                        try{if(settingsSession()!==session)throw Error('SESSION_CHANGED');const out=await api('/preventive/correct-date',{patientId:g.patientId,guardianId:g.guardianId,eventId:r.eventId,version:r.version,nextDueDate:input.value,confirmed:true},{redirect:'error'});if(settingsSession()!==session)throw Error('SESSION_CHANGED');if(out?.ok!==true||out.eventId!==r.eventId||out.nextDueDate!==input.value)throw Error('RESULT_UNCONFIRMED');await load();}
                        catch(e){info.textContent='저장 결과 확인 필요 · '+resultReason(workErrorCode(e))+' 목록을 새로 조회한 뒤 확인해주세요. 자동 재시도하지 않습니다.';line.dataset.unconfirmed='1';}
                    });save.disabled=!r.canEdit;const original=save.onclick;save.onclick=async()=>{await original();if(line.dataset.unconfirmed==='1')save.disabled=true;};
                    if(!r.canEdit)info.textContent='종류 또는 기록일이 불명확합니다. 원본 차트에서 확인해주세요.';
                }
            }
            if(!d.groups.length)rows.append(el('p','확인할 충돌 일정이 없습니다.'));
            if(page>0)button(rows,'이전 항목',async()=>{page--;await load();});if(d.hasMore)button(rows,'다음 항목',async()=>{page++;await load();});
        }catch(e){rows.replaceChildren(el('p',e.message==='SESSION_CHANGED'?'로그인이 바뀌었습니다. 창을 다시 열어주세요.':'일정을 조회하지 못했습니다. 다시 조회해주세요.'));}};
        button(body,'목록 새로고침',load);body.append(rows);await load();
    }
    function renderMaterialHistoryRows(parent,rows,options={}){
        for(const x of rows.filter(x=>['material','pdf-material'].includes(x.kind))){const card=workCard(parent);card.append(el('strong',x.title||'제목 확인 필요'),el('p',(materialKindLabel(x.materialKind)||'보호자 자료')+' · '+deliveryLabel(x)),el('p','게시/접수 '+workTime(x.sent_at||x.created_at)),el('p','열기 요청 '+workTime(x.lastViewAt||x.viewed_at)+' · 다운로드 요청 '+workTime(x.lastDownloadAt)));
            const more=el('details');more.append(el('summary','상세 정보'),el('p','송부 ID: '+(x.deliveryId||x.id)),el('p',resultReason(x.failure_code)));card.append(more);
            if(options.withdraw&&x.channel==='home'&&x.status==='sent'&&Number(x.accessRevoked)!==1)options.withdraw(card,x);
        }
        if(!parent.children.length)parent.append(el('p','자료 송부 이력이 없습니다.'));
    }
    async function materialHistory(){
        let base;try{base=materialScope('scope-check',1);}catch{alert('환자 작업공간에서 환자·보호자를 먼저 선택해주세요.');return;}const {d,body}=dialog('선택 환자 자료 송부 이력'),rows=el('section');
        const guard=()=>{materialSame(base,materialScope('scope-check',1));};
        body.append(el('p','최근 송부 기록 100건 중 자료 이력입니다. 자료별 게시 상태와 열기·다운로드 요청 기록입니다. 실제로 내용을 읽었거나 파일 저장을 마쳤다는 확인은 아닙니다.'));
        button(body,'자료 만들기',async()=>{guard();d.close();await openWorkspaceComposer();});
        const load=async()=>{rows.replaceChildren(el('p','자료 이력 확인 중…'));try{guard();const out=await api('/deliveries?patientId='+encodeURIComponent(base.patientId),undefined,{redirect:'error'});guard();if(out?.ok!==true||!Array.isArray(out.deliveries))throw Error('HISTORY_INVALID');rows.replaceChildren();renderMaterialHistoryRows(rows,out.deliveries,{withdraw:['owner','admin'].includes(saasMe?.role)?(card,x)=>{
            const note=el('p');card.append(note);const replacement=el('select');replacement.setAttribute('aria-label','새 안내자료 선택');const empty=el('option','새 안내자료 선택');empty.value='';replacement.append(empty);for(const n of out.deliveries.filter(n=>n.channel==='home'&&n.status==='sent'&&Number(n.accessRevoked)!==1&&n.kind===x.kind&&!n.superseded_by&&n.created_at>x.created_at)){const option=el('option',n.title||n.created_at);option.value=n.deliveryId||n.id;replacement.append(option);}card.append(replacement);const replace=button(card,x.superseded_by?'이전 안내 표시 해제':'이전 안내로 표시',async()=>{guard();const replacementId=x.superseded_by?'':replacement.value;if(!x.superseded_by&&!replacementId){note.textContent='새 안내자료를 선택해주세요.';return;}if(!confirm(x.superseded_by?'이전 안내 표시를 해제할까요?':'이 자료를 이전 안내로 표시하고 선택한 새 자료를 연결할까요? 기존 자료와 복약 일정은 보존됩니다.'))return;replace.disabled=true;try{const r=await api('/deliveries/supersede',{patientId:base.patientId,guardianId:base.guardianId,deliveryId:x.deliveryId||x.id,replacementId,expectedReplacementId:x.superseded_by||'',confirmed:true},{redirect:'error'});guard();if(r?.ok!==true||r.replacementId!==replacementId)throw Error('UNCONFIRMED');await load();}catch{note.textContent='표시 변경 결과를 확인하지 못했습니다. 이력을 새로고침해주세요.';}});const b=button(card,'Home 공개 철회',async()=>{guard();if(!confirm((x.title||'선택 자료')+'의 Home 공개를 철회할까요?\n이 송부 건의 접근만 차단하며 송부 이력은 보존합니다. 보호자가 이미 다운로드한 파일은 회수되지 않습니다.'))return;
                try{guard();const r=await api('/deliveries/withdraw',{patientId:base.patientId,guardianId:base.guardianId,deliveryId:x.deliveryId||x.id,confirmed:true},{redirect:'error'});guard();if(r?.ok!==true||r.deliveryId!==(x.deliveryId||x.id)||r.accessRevoked!==true)throw Error('WITHDRAW_UNCONFIRMED');await load();}
                catch{note.textContent='철회 결과 확인 필요 · 이력 새로고침으로 상태를 확인해주세요.';card.dataset.withdrawPending='1';}});
            b.className='btn btn-danger';const action=b.onclick;b.onclick=async()=>{if(card.dataset.withdrawPending==='1')return;await action();if(card.dataset.withdrawPending==='1')b.disabled=true;};
        }:null});}catch{rows.replaceChildren(el('p','선택 환자 또는 로그인을 확인한 뒤 다시 조회해주세요.'));}};
        button(body,'이력 새로고침',load);body.append(rows);await load();
    }
    async function integrationStatus(){
        if(!workAdmin())return;
        const session=settingsSession(),{body}=dialog('Google · eFriends 연동 상태'),rows=el('section');
        const load=async()=>{if(settingsSession()!==session){rows.replaceChildren(el('p','로그인이 바뀌었습니다. 다시 열어주세요.'));return;}rows.replaceChildren(el('p','연동 상태 확인 중…'));const responses=await Promise.allSettled([saasRequest('/saas/google-calendar/status',{method:'GET',redirect:'error'}),api('/operations/integrations',undefined,{redirect:'error'}),saasRequest('/saas/r65/manual-sync',{method:'GET',redirect:'error'})]);
            if(settingsSession()!==session){rows.replaceChildren(el('p','로그인이 바뀌었습니다. 다시 열어주세요.'));return;}rows.replaceChildren();
            const google=responses[0].status==='fulfilled'?responses[0].value:null,g=workCard(rows);g.append(el('strong','Google Calendar'));
            g.append(el('p',google?.ok===true?(google.connected===true?'계정 연결됨 · '+(google.calendarId?'캘린더 선택됨: '+(google.calendarName||'CARESTEP 후속관리'):'캘린더 선택 필요'):({reconnect_required:'재인증 필요',disconnected:'계정 연결 필요'})[google.status]||'연결 상태 확인 필요'):'연결 상태를 조회하지 못했습니다.'));
            button(g,'캘린더 설정 위치 보기',()=>{const node=document.getElementById('googleCalendarStatus');if(node){node.scrollIntoView({block:'center'});body.closest('dialog')?.close();}else g.append(el('p','후속관리 설정의 캘린더 단계에서 연결·선택할 수 있습니다.'));});
            const sync=responses[1].status==='fulfilled'?responses[1].value:null,manual=responses[2].status==='fulfilled'?responses[2].value:null,e=workCard(rows);e.append(el('strong','eFriends 동기화'));
            if(sync?.ok===true){const h=sync.heartbeat,last=sync.lastSuccess,age=h?Date.now()-Date.parse(h.last_seen_at):Infinity,late=!Number.isFinite(age)||age>Math.max(35,(Number(h?.interval_minutes)||15)*2+5)*60000;e.append(el('p',!h?'서버 PC 연결 기록 없음':h.status==='failed'?'서버 PC 동기화 오류':late?'서버 PC 응답 지연 · 연결 확인 필요':h.status==='syncing'?'동기화 처리 중':'서버 PC 응답 확인'),el('p','마지막 응답 '+workTime(h?.last_seen_at)+' · 다음 예정 '+workTime(h?.next_expected_at)),el('p','최근 반영 완료 '+workTime(last?.finished_at)+(last?.status==='completed_with_errors'?' · 일부 오류 있음':'')),el('p',last?'최근 반영: 신규 '+Number(last.events_created||0)+'건 · 수정 '+Number(last.events_updated||0)+'건 · 오류 '+Number(last.errors||0)+'건':'반영 완료 기록 없음'));}else e.append(el('p','동기화 상태를 조회하지 못했습니다.'));
            e.append(el('p',manual?.ok===true?(manual.enabled&&manual.agentVerified?'수동 최신 백업 반영 사용 가능 · 15분 자동 동기화 유지':'수동 반영 비활성 · 설치/승인 상태 확인 필요'):'수동 반영 상태 미확인'));
            button(e,'수동 반영 위치 보기',async()=>{await window.R65ManualSync?.refresh(true);const management=document.getElementById('r61-management');if(management)management.open=true;document.getElementById('r65-manual-controls')?.scrollIntoView({block:'center'});body.closest('dialog')?.close();});
        };button(body,'연동 상태 새로고침',load);body.append(rows);await load();
    }

    function mount() {
        if (document.getElementById('r61-controls'))
            return;
        const bar = el('section');
        bar.id = 'r61-controls';

        bar.setAttribute('aria-label', '후속 기능');
        const management=el('details'),tools=el('div'),syncSlot=el('div');management.id='r61-management';management.append(el('summary','관리 · 발송 이력 · 연동'));tools.className='r61-management-tools';syncSlot.id='r61-sync-slot';management.append(tools,syncSlot);bar.append(management);
        button(tools,'예방문자 발송 결과',()=>preventiveResults());button(tools,'예방 일정 확인·수정',preventiveReview);button(tools,'연동 상태',integrationStatus);button(tools,'보호자 공개 자료 관리',approveMaterial);button(tools,'후속 기능 설정',settings);button(tools,'예방관리 발송 예정 미리보기',preventivePreview);
        (document.querySelector('main')||document.body).append(bar);
        mountPatientContext();mountTodayOverview();
        window.r61RenderTimeline = async (mount, patientId) => {
            const rev = String(patientId);
            mount.dataset.r61Patient = rev;
            const panel = el('section');
            panel.setAttribute('aria-label', '자료 발송 및 열람 이력');
            panel.append(el('h4', '자료 발송·열람 이력'));
            mount.append(panel);
            try {
                const d = await api('/deliveries?patientId=' + encodeURIComponent(patientId));
                if (!panel.isConnected || mount.dataset.r61Patient !== rev)
                    return;
                const list=el('section');panel.append(list);renderMaterialHistoryRows(list,d.deliveries);
                panel.append(el('p','열기·다운로드 요청 기록이며 실제 읽기 완료를 뜻하지 않습니다.'));
                button(panel,'전체 자료 이력·새 자료 보내기',materialHistory);
            } catch {
                if (panel.isConnected)
                    panel.append(el('p', '발송 이력을 확인하지 못했습니다.'));
            }
        }
        ;
        window.r61OpenMaterials = openWorkspaceComposer;
        window.r61OpenPreventiveResults=preventiveResults;window.r61OpenPreventiveReview=preventiveReview;
        window.r61OpenPatientPreview=async()=>{if(window.crmPrepareMaterialPatient&&!await window.crmPrepareMaterialPatient())return;if(typeof go==='function')go('builder');if(typeof setWizardStep==='function')setWizardStep(5);};
        window.r61SendBuilderMaterials = sendBuilderMaterials;
        document.getElementById('sendBuilderMaterialsBtn')?.addEventListener('click',sendBuilderMaterials);
        window.r61OpenMaterialHistory = materialHistory;
        window.r61ApproveMaterial = approveMaterial;

    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', mount);
    else
        mount();
}
)();
