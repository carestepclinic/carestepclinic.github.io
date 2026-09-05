/* CARESTEP eFriends Staging Loader v1.1
 * Normalizes eFriends weight precision/range before loading the staging importer.
 */
(() => {
  'use strict';

  const original = window.saasRequest;
  if (typeof original !== 'function') {
    alert('CARESTEP 병원 화면에 로그인한 상태에서 실행해주세요. saasRequest를 찾지 못했습니다.');
    return;
  }

  const normalizeWeight = (value) => {
    if (value === '' || value === null || value === undefined) return '';
    const n = Number(String(value).trim());
    if (!Number.isFinite(n) || n <= 0 || n > 200) return '';
    return String(Math.round(n * 100) / 100);
  };

  const wrapped = async function(path, opt = {}) {
    const next = { ...opt };
    try {
      if (typeof next.body === 'string' && next.body) {
        const body = JSON.parse(next.body);

        if (/^\/saas\/patients(?:\/[^/]+)?$/.test(path)) {
          body.latestWeightKg = normalizeWeight(body.latestWeightKg);
        }

        if (/\/timeline(?:\/|$)/.test(path)) {
          if (Object.prototype.hasOwnProperty.call(body, 'measuredWeightKg')) {
            body.measuredWeightKg = normalizeWeight(body.measuredWeightKg);
          }
          if (body.type === 'weight') {
            const w = normalizeWeight(body.value);
            if (!w) {
              console.warn('[eFriends staging] invalid weight skipped', body.value, body.eventDate);
              return { ok:true, skipped:true, deduped:true };
            }
            body.value = w;
          }
        }

        next.body = JSON.stringify(body);
      }
    } catch (e) {
      console.warn('[eFriends staging] weight normalization warning', e);
    }
    return original(path, next);
  };

  window.saasRequest = wrapped;
  const s = document.createElement('script');
  s.src = '/tools/efriends-staging-import.js?v=1.1.1';
  s.onload = () => {
    window.saasRequest = original;
    console.log('eFriends Staging Import v1.1 loaded with 2-decimal weight normalization');
  };
  s.onerror = () => {
    window.saasRequest = original;
    console.error('eFriends Staging Import loader failed');
  };
  document.head.appendChild(s);
})();
