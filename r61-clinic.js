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
    const selection = () => window.crmWorkspaceSelection?.() || window.crmCurrentPatient?.() || {};
    window.r61TaskStillActive = async x => {
        await loadFollowupScheduleBoard(false);
        const item = workFirstBuckets().all.find(r => String(r.id) === x.taskId && r.patientId === x.patientId && r.guardianId === x.guardianId);
        return !!item && (!x.type || item.sourceType === x.type) && !['resolved', 'completed', 'canceled', 'deleted'].includes(item.action?.status || item.operationalStatus || item.status);
    }
    ;
    function dialog(title) {
        const d = el('dialog')
          , h = el('h2', title)
          , body = el('div')
          , close = el('button', '닫기');
        d.append(h, body, close);
        close.onclick = () => d.close();
        d.addEventListener('close', () => d.remove());
        document.body.append(d);
        d.style.cssText = 'max-width:720px;width:90%;max-height:85vh;overflow:auto;padding:24px;border-radius:14px';
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
    let materialComposerOpen = false;
    async function sendMaterial() {
        if (materialComposerOpen) return;
        let base;
        try { base = materialScope('scope-check', 1); }
        catch { alert('환자 작업공간에서 환자·보호자를 먼저 선택해주세요.'); return; }
        materialComposerOpen = true;
        const {body, d} = dialog('보호자 자료 보내기');
        const info = el('p', '자료와 보호자 연결을 확인하고 있습니다.');
        info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite'); body.append(info);
        let blobURL = null, uiBusy = false;
        const guard = () => { if (!d.isConnected) throw Error('MATERIAL_DIALOG_CLOSED'); materialSame(base, materialScope('scope-check', 1)); return base; };
        d.addEventListener('close', () => { materialComposerOpen = false; if (blobURL) URL.revokeObjectURL(blobURL); });
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
        } catch (e) { info.textContent = '자료를 열지 못했습니다 · ' + pdfErrorCode(e); button(body, '기존 텍스트 자료 보내기', materials); return; }
        const patient = home.patients.find(p => p.id === base.patientId);
        body.prepend(el('p', patient.name + ' · 보호자 ' + home.guardian.name));
        button(body,'이 환자의 자료 송부 이력',materialHistory);
        body.append(el('p','① 자료 종류·제목 → ② PDF 미리보기 → ③ 내용 확인 후 보내기 · 제목 뒤에 게시일이 자동 표시됩니다.'));
        body.append(el('p', '내용 확인 후 한 번 보내면 자료 등록과 PDF 저장을 함께 처리합니다. CARESTEP Home 자료함에 게시하며 문자·알림톡은 발송하지 않습니다.'));
        const pick = el('select'), kind = el('select'), title = el('input'), text = el('textarea'), reviewed = el('input'), viewer = el('iframe');
        const admin = () => ['owner', 'admin'].includes(saasMe?.role);
        const field = (label, node) => { const l = el('label', label); l.style.cssText='display:block;margin:12px 0'; node.style.cssText='display:block;width:100%;box-sizing:border-box;margin-top:4px'; l.append(node); body.append(l); };
        const newOption = el('option', admin() ? '새 자료 작성' : '기존 승인 자료를 선택해주세요'); newOption.value = ''; pick.append(newOption);
        for (const m of list.materials) { const o = el('option', m.title); o.value = m.id; pick.append(o); }
        for (const [value, label] of materialKinds) { const o = el('option', label); o.value=value; kind.append(o); }
        field('자료', pick); field('자료 종류', kind); field('자료 목록에 표시할 제목', title); field('보호자에게 보여줄 내용', text);
        const formatInfo=el('p');body.append(formatInfo);
        title.maxLength=120; text.maxLength=20000; text.rows=10;
        const draft = () => ({kind:kind.value,title:title.value,text:text.value});
        const signature = () => JSON.stringify(draft());
        let existing = null, previewBlob = null, previewSignature = null, richDraft = null;
        const buttons = {}, extraButtons = [];
        const flow = materialDeliveryFlow({scope:guard,request:pdfRequest,storage:sessionStorage,canApprove:admin,
            onMaterial: m => { existing=m; if (![...pick.options].some(o=>o.value===m.id)) { const o=el('option',m.title);o.value=m.id;pick.append(o); } pick.value=m.id;kind.value=m.kind; title.value=m.title; text.value=m.text; },
            onProgress: message => { info.textContent=message; controls(); }
        });
        const revokePreview = () => { if (blobURL) URL.revokeObjectURL(blobURL); blobURL=null; viewer.removeAttribute('src'); viewer.hidden=true; previewBlob=null; previewSignature=null; reviewed.checked=false; };
        const controls = () => {
            const s=flow.state(), locked=uiBusy||s.busy||s.pending||s.registrationPending;
            close.disabled=uiBusy;
            for (const b of extraButtons) b.disabled=uiBusy||s.busy;
            pick.disabled=locked||s.hasMaterial;
            kind.disabled=title.disabled=text.disabled=locked||s.hasMaterial||!!existing||!admin();
            text.readOnly=!!materialDraftSources[kind.value];
            formatInfo.textContent=text.readOnly?'원래 자료 서식으로 생성합니다. 본문 수정은 자료 생성 화면의 환자·처방·개별지시에서 해주세요. 목록 제목을 바꿔도 PDF 서식은 유지됩니다.':'제목과 본문을 직접 작성할 수 있습니다.';
            buttons.draft.disabled=locked||s.hasMaterial||!!existing||!admin()||!materialDraftSources[kind.value];
            buttons.preview.disabled=locked||s.sent||!!s.assetId||!title.value.trim()||(!materialDraftSources[kind.value]&&!text.value.trim())||(!admin()&&!existing);
            reviewed.disabled=locked||s.sent;
            buttons.send.disabled=locked||s.sent||!reviewed.checked||(!s.assetId && (!previewBlob||previewSignature!==signature()));
            buttons.send.textContent=s.sent?'전송 완료':s.assetId?'저장된 PDF 보내기':'보호자에게 보내기';
            buttons.recover.disabled=uiBusy||s.busy||!(s.registrationPending||s.hasRecovery);
        };
        const show = () => {
            const s=flow.state();
            if(s.sent) info.textContent='Home 게시 완료 · 자료 송부 이력에서 확인할 수 있습니다. · Delivery ID: '+s.deliveryId;
            else if(s.status==='READY_UNSENT') info.textContent='저장된 PDF를 확인했습니다. 공개 내용을 확인한 뒤 보내기를 누르면 이어서 송부합니다.';
            else if(s.hasMaterial) info.textContent='등록된 자료를 확인했습니다. PDF 미리보기 후 보내기를 누르면 이어서 처리합니다.';
        };
        const action = (key,label,fn,parent=body) => {
            const b=el('button',label); b.type='button'; b.className='btn btn-secondary'; parent.append(b); buttons[key]=b;
            b.onclick=async()=>{if(b.disabled||uiBusy)return;uiBusy=true;controls();try{guard();await fn();guard();}catch(e){
                const s=flow.state(), code=pdfErrorCode(e);
                info.textContent=code==='MATERIAL_ORIGINAL_SOURCE_CHANGED'?'기존 자료와 현재 입력 내용이 다릅니다. 관리자가 새 자료를 작성하거나 기존 PDF 결과를 조회해주세요.':code==='HOME_GUARDIAN_NOT_LINKED'?'보호자를 CARESTEP Home에 먼저 연결해주세요. 자료는 다시 등록하지 않고 이어서 보낼 수 있습니다.':
                    (s.pending||s.registrationPending?'결과 확인이 필요합니다. 아래 결과 조회를 눌러주세요. ':'처리를 완료하지 못했습니다. ')+code;
            }finally{uiBusy=false;controls();}};
        };
        action('draft','선택 유형의 초안 불러오기',async()=>{
            if(text.value.trim()&&!confirm('현재 내용을 새 초안으로 바꿀까요?'))return;
            const doc=renderMaterialDraftPDF(kind.value,base.patientId);guard();
            title.value=materialKindLabel(kind.value);text.value=doc.innerText;revokePreview();
            richDraft={kind:kind.value,text:text.value,node:doc.cloneNode(true)};
            info.textContent='원래 서식의 초안을 불러왔습니다. PDF 미리보기에서 내용을 확인해주세요.';
        });
        action('preview','PDF 미리보기',async()=>{
            revokePreview();
            const m=draft();
            if(typeof exportPdfElement!=='function'||!window.html2pdf)throw Error('PDF_GENERATOR_UNAVAILABLE');
            let doc, refreshed=false;
            if(materialDraftSources[m.kind]){
                // Rich output must never fall back to the plain-text template.
                // A display-title edit does not invalidate the original page markup.
                if(richDraft?.kind===m.kind && richDraft.text===m.text){
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
                    richDraft={kind:m.kind,text:generatedText,node:doc.cloneNode(true)};
                }
            }else doc=renderApprovedMaterialPDF(m,base.patientId);
            const before=signature();
            const blob=await exportPdfElement('carestep-material.pdf',{save:false,silent:true});guard();
            if(before!==signature()||!(blob instanceof Blob)||blob.type!=='application/pdf'||!blob.size||blob.size>10485760||new TextDecoder().decode(await blob.slice(0,5).arrayBuffer())!=='%PDF-')throw Error('PDF_GENERATION_INVALID');
            guard();previewBlob=blob;previewSignature=before;blobURL=URL.createObjectURL(blob);viewer.src=blobURL;viewer.hidden=false;
            info.textContent=(refreshed?'현재 입력으로 새 자료를 준비했습니다. ':'')+'이 PDF가 보호자에게 전달됩니다. 아직 등록·저장·송부하지 않았습니다.';
        });
        viewer.title='보호자에게 보낼 PDF 미리보기';viewer.style.cssText='width:100%;height:360px;border:1px solid #ddd;margin-top:12px';viewer.hidden=true;body.append(viewer);
        const reviewLabel=el('label');reviewed.type='checkbox';reviewLabel.style.cssText='display:block;margin:16px 0';reviewLabel.append(reviewed,document.createTextNode(' 환자·보호자와 공개할 내용을 확인했습니다.'));body.append(reviewLabel);
        reviewed.onchange=controls;
        action('send','보호자에게 보내기',async()=>{
            if(!reviewed.checked)throw Error('MATERIAL_PUBLIC_REVIEW_REQUIRED');
            const s=flow.state();if(!s.assetId&&previewSignature!==signature())throw Error('MATERIAL_PUBLIC_REVIEW_REQUIRED');
            await flow.send({draft:draft(),blob:previewBlob,existing,confirmed:true});show();
        });
        const more=el('details');more.append(el('summary','기존 자료·결과 조회·관리'));body.append(more);
        action('recover','중단된 저장·송부 결과 조회',async()=>{revokePreview();await flow.recover();show();},more);
        extraButtons.push(button(more,'기존 PDF 조회·철회',privatePDF));
        extraButtons.push(button(more,'텍스트만 보내기·발송 이력',materials));
        if(admin())extraButtons.push(button(more,'공개 자료 관리',approveMaterial));
        const changed=()=>{revokePreview();flow.reset();info.textContent='내용을 확인한 뒤 PDF 미리보기를 눌러주세요.';controls();};
        title.oninput=text.oninput=changed;
        kind.onchange=()=>{title.value=materialKindLabel(kind.value);text.value='';richDraft=null;changed();};
        pick.onchange=()=>{existing=list.materials.find(m=>m.id===pick.value)||null;kind.value=existing?.kind||'advanced';title.value=existing?.title||materialKindLabel(kind.value);text.value=existing?.text||'';richDraft=null;changed();};
        title.value=materialKindLabel(kind.value);
        info.textContent=home.guardian.homeStatus==='linked'?'자료 종류를 선택해 내용을 준비해주세요.':'보호자의 Home 연결이 필요합니다. 연결 후 이 화면에서 보낼 수 있습니다.';
        if(flow.state().registrationPending||flow.state().pending){more.open=true;info.textContent='이전에 중단된 요청이 있습니다. 결과 조회로 먼저 확인해주세요.';}
        controls();
    }

    const workTime = value => {const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'기록 없음';};
    const deliveryLabel = x => x.status==='sent'?(x.channel==='home'?'Home 게시 완료':x.provider_id?'발송 사업자 접수 완료':'결과 미확정'):({failed:'발송 실패',blocked:'조건 불충족 · 발송 차단',unconfirmed:'결과 미확정',claimed:'처리 중 · 결과 확인 필요',canceled:'발송 취소'})[x.status]||'상태 확인 필요';
    const resultLabels={accepted:'문자·외부 채널 접수',home:'Home 알림 접수',failed:'실패',blocked:'차단',unconfirmed:'결과 미확정',canceled:'취소',claimed:'처리 중'};
    const workErrorCode=e=>/^[A-Z][A-Z0-9_]{1,80}$/.test(e?.code||e?.message||'')?(e.code||e.message):'RESULT_UNCONFIRMED';
    const resultReason=code=>({PROVIDER_RESULT_UNCONFIRMED:'사업자 접수 여부를 확인하지 못했습니다.',RECORD_CHANGED_REFRESH:'다른 작업에서 기록이 변경됐습니다. 목록을 다시 조회해주세요.',DUE_BEFORE_RECORD:'예정일은 해당 진료 기록일보다 빠를 수 없습니다.',DATE_INVALID:'올바른 날짜를 선택해주세요.',RECORD_NOT_EDITABLE:'종류나 원본 기록 확인이 필요합니다.'})[code]||preventiveReasons[code]||code||'별도 사유 없음';
    function workCard(parent){const card=el('article');card.style.cssText='border:1px solid #dbe3ed;border-radius:10px;padding:12px;margin:10px 0';parent.append(card);return card;}
    const workAdmin=()=>{if(!['owner','admin'].includes(saasMe?.role)){alert('관리자 계정에서 확인·설정할 수 있습니다.');return false;}return true;};
    async function preventiveResults(){
        if(!workAdmin())return;
        const session=settingsSession(),{body}=dialog('예방문자 발송 결과'),date=el('input'),rows=el('section');date.type='date';date.value=new Date(Date.now()+32400000).toISOString().slice(0,10);
        body.append(el('p','선택한 한국시간 날짜의 실제 발송 시도입니다. 작업 정상 종료와 문자 접수 성공은 다릅니다.'),date);
        const load=async()=>{rows.replaceChildren(el('p','결과 확인 중…'));try{
            if(settingsSession()!==session)throw Error('SESSION_CHANGED');const d=await api('/preventive/results?date='+encodeURIComponent(date.value),undefined,{redirect:'error'});if(settingsSession()!==session)throw Error('SESSION_CHANGED');
            if(d?.ok!==true||!d.counts||!Array.isArray(d.deliveries))throw Error('RESULT_INVALID');rows.replaceChildren();
            const cron=d.cron;rows.append(el('p',cron?'공통 자동작업: '+(({ok:'정상 종료',running:'실행 중',failed:'실패'})[cron.status]||'상태 확인 필요')+' · 시작 '+workTime(cron.startedAt)+(cron.status==='running'?'':' · 종료 '+workTime(cron.completedAt)):'공통 자동작업 실행 기록 없음'));
            rows.append(el('strong',Object.entries(resultLabels).map(([k,v])=>v+' '+Number(d.counts[k]||0)+'건').join(' · ')));
            rows.append(el('p','현재 저장 기록으로 계산한 제외 이력 '+Number(d.excludedCount||0)+'건'+(Object.entries(d.excludedReasons||{}).length?' · '+Object.entries(d.excludedReasons).map(([k,v])=>preventiveReason(k)+' '+v+'건').join(' · '):'')+' (당시 실행 시점의 제외 이력 스냅샷은 아닙니다.)'));
            rows.append(el('p','접수는 보호자의 수신 완료를 뜻하지 않습니다. 결과 미확정 건은 재발송하지 말고 사업자 이력과 대조해주세요.'));
            const filter=el('select');for(const [key,label] of [['all','전체'],...Object.entries(resultLabels)]){const o=el('option',label);o.value=key;filter.append(o);}filter.value='all';rows.append(filter);const list=el('section');rows.append(list);
            const render=()=>{list.replaceChildren();for(const x of d.deliveries.filter(x=>filter.value==='all'||x.category===filter.value)){const card=workCard(list);card.append(el('strong',x.patientName+' · 보호자 '+x.guardianName),el('p',(resultLabels[x.category]||'결과 확인 필요')+' · '+(x.channel||'채널 미정')+' · '+workTime(x.attemptedAt)),el('p','예정일 '+x.dueDate+' · '+resultReason(x.reason)));}if(!list.children.length)list.append(el('p','표시할 발송 기록이 없습니다.'));};filter.onchange=render;render();
            if(d.total>d.deliveries.length)rows.append(el('p','집계는 전체 '+d.total+'건이며 상세는 최근 '+d.deliveries.length+'건입니다.'));
        }catch(e){rows.replaceChildren(el('p',e.message==='SESSION_CHANGED'?'로그인 또는 병원이 바뀌었습니다. 창을 다시 열어주세요.':'발송 결과를 조회하지 못했습니다. 새로고침으로 다시 확인해주세요.'));}};
        button(body,'결과 새로고침',load);button(body,'예정·제외 대상 확인',preventivePreview);button(body,'충돌 일정 확인·수정',preventiveReview);body.append(rows);await load();
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
    function renderMaterialHistoryRows(parent,rows){
        for(const x of rows.filter(x=>['material','pdf-material'].includes(x.kind))){const card=workCard(parent);card.append(el('strong',x.title||'제목 확인 필요'),el('p',(materialKindLabel(x.materialKind)||'보호자 자료')+' · '+deliveryLabel(x)),el('p','게시/접수 '+workTime(x.sent_at||x.created_at)),el('p','열기 요청 '+workTime(x.lastViewAt||x.viewed_at)+' · 다운로드 요청 '+workTime(x.lastDownloadAt)));
            const more=el('details');more.append(el('summary','상세 정보'),el('p','송부 ID: '+(x.deliveryId||x.id)),el('p',resultReason(x.failure_code)));card.append(more);
        }
        if(!parent.children.length)parent.append(el('p','자료 송부 이력이 없습니다.'));
    }
    async function materialHistory(){
        let base;try{base=materialScope('scope-check',1);}catch{alert('환자 작업공간에서 환자·보호자를 먼저 선택해주세요.');return;}const {d,body}=dialog('선택 환자 자료 송부 이력'),rows=el('section');
        const guard=()=>{materialSame(base,materialScope('scope-check',1));};
        body.append(el('p','최근 송부 기록 100건 중 자료 이력입니다. 자료별 게시 상태와 열기·다운로드 요청 기록입니다. 실제로 내용을 읽었거나 파일 저장을 마쳤다는 확인은 아닙니다.'));
        button(body,'새 자료 보내기',async()=>{guard();d.close();await sendMaterial();});
        const load=async()=>{rows.replaceChildren(el('p','자료 이력 확인 중…'));try{guard();const out=await api('/deliveries?patientId='+encodeURIComponent(base.patientId),undefined,{redirect:'error'});guard();if(out?.ok!==true||!Array.isArray(out.deliveries))throw Error('HISTORY_INVALID');rows.replaceChildren();renderMaterialHistoryRows(rows,out.deliveries);}catch{rows.replaceChildren(el('p','선택 환자 또는 로그인을 확인한 뒤 다시 조회해주세요.'));}};
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
            button(e,'수동 반영 위치 보기',async()=>{await window.R65ManualSync?.refresh(true);document.getElementById('r65-manual-controls')?.scrollIntoView({block:'center'});body.closest('dialog')?.close();});
        };button(body,'연동 상태 새로고침',load);body.append(rows);await load();
    }

    function mount() {
        if (document.getElementById('r61-controls'))
            return;
        const bar = el('section');
        bar.id = 'r61-controls';
        bar.style.cssText = 'padding:12px;display:flex;gap:8px;flex-wrap:wrap';
        bar.setAttribute('aria-label', '후속 기능');
        button(bar, '보호자 자료 보내기', sendMaterial);
        button(bar, '자료 송부 이력', materialHistory);
        button(bar, '예방문자 발송 결과', preventiveResults);
        button(bar, '예방 일정 확인·수정', preventiveReview);
        button(bar, '연동 상태', integrationStatus);
        const management=el('details');management.append(el('summary','관리·설정'));bar.append(management);
        button(management, '보호자 공개 자료 관리', approveMaterial);
        button(management, '후속 기능 설정', settings);
        button(bar, '예방관리 발송 예정 미리보기', preventivePreview);
        (document.querySelector('main') || document.body).append(bar);
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
        window.r61OpenMaterials = sendMaterial;
        window.r61OpenMaterialHistory = materialHistory;
        window.r61ApproveMaterial = approveMaterial;
        const observer = new MutationObserver( () => {
            for (const panel of document.querySelectorAll('.patient-workspace-head'))
                if (!panel.querySelector('[data-r61-material]')) {
                    const b = button(panel, '보호자 자료 보내기 · 이력', sendMaterial);
                    b.dataset.r61Material = '1';
                }
        }
        );
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', mount);
    else
        mount();
}
)();
