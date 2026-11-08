/* HOME request coordination and explicit, draft-safe app updates. */
(() => {
  'use strict';
  const reads = new Map(), edited = new Map();
  let writes = 0, updateRequested = false, reloadPending = false;
  const value = el => ['checkbox', 'radio'].includes(el.type) ? el.checked : el.value;
  function remember(event) {
    const el = event.target;
    if (el?.matches?.('input, textarea, select') && !edited.has(el)) edited.set(el, value(el));
  }
  document.addEventListener('focusin', remember, true);
  document.addEventListener('beforeinput', remember, true);
  function hasDraft() {
    if (writes || document.querySelector('dialog[open]')) return true;
    for (const [el, original] of edited) {
      if (!el.isConnected) { edited.delete(el); continue; }
      // A draft in another HOME tab is still a draft. Closed dialogs are dismissed.
      if (el.closest('dialog:not([open])') || el.closest('#loginView, #inviteView')) continue;
      if (value(el) !== original) return true;
    }
    return false;
  }
  async function coordinate(key, read, run) {
    if (!read) {
      reads.clear(); writes++;
      try { return await run(); } finally { writes--; reads.clear(); }
    }
    if (!key) return run();
    if (reads.has(key)) return reads.get(key);
    const promise = Promise.resolve().then(run);
    reads.set(key, promise);
    try { return await promise; } finally { if (reads.get(key) === promise) reads.delete(key); }
  }
  function updateNotice(message, available = true) {
    let banner = document.getElementById('homeUpdateNotice');
    if (!banner) {
      banner = document.createElement('aside'); banner.id = 'homeUpdateNotice';
      banner.className = 'home-update-notice'; banner.setAttribute('aria-label', '앱 업데이트');
      const note = document.createElement('p'); note.setAttribute('role', 'status'); banner.append(note);
      const button = document.getElementById('homeApplyUpdate'); if (button) banner.append(button);
      document.querySelector('.home-header')?.after(banner);
    }
    banner.hidden = !available;
    banner.querySelector('p').textContent = message;
    const button = document.getElementById('homeApplyUpdate');
    if (button) { button.hidden = !available; button.disabled = false; button.textContent = '새 버전 열기'; }
  }
  window.CarestepHomeRuntime = {
    coordinate, hasDraft, needsReload: () => reloadPending,
    requestUpdate() {
      if (hasDraft()) { updateNotice('작성 중인 내용을 저장하거나 닫은 뒤 새 버전을 열어주세요. 현재 화면은 유지됩니다.'); return false; }
      updateRequested = true; return true;
    },
    controllerChanged() {
      reloadPending = true;
      if (updateRequested && !hasDraft()) location.reload();
      else updateNotice('새 버전이 준비됐어요. 작성 중인 화면은 그대로 유지됩니다.');
    },
    updateNotice,
    cancelUpdate() { updateRequested = false; },
    clear() { edited.clear(); reads.clear(); updateRequested = false; }
  };
})();
