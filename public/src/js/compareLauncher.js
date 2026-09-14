(() => {
  let opening = false;
  window.openCharacterComparison = async (app, row) => {
    if (!row || opening) return;
    opening = true;
    app.hideHoverTooltip?.();
    // Reserve the browser tab during the click, before awaiting the snapshot.
    const native = window.__TAURI__?.core?.invoke;
    const tab = native ? null : window.open('about:blank', '_blank');
    try {
      if (!native && !tab) throw new Error('팝업이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요.');
      const raw = window.dpsData?.getDpsData?.();
      const snapshot = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const rows = snapshot ? app.buildRowsFromMapObject(snapshot.map) : app.lastSnapshot || [];
      const localId = snapshot?.localPlayerId ?? app.localPlayerId;
      const me = rows.find(r => localId != null && String(r.id) === String(localId))
        || rows.find(r => r.isUser);
      const targetId = snapshot?.targetId ?? app.lastTargetId;
      let details = null;
      if (Number(targetId) > 0) {
        const result = await window.dpsData?.getTargetDetails?.(targetId, null);
        details = typeof result === 'string' ? JSON.parse(result) : result;
      }
      const payload = {
        version: 1, capturedAt: new Date().toISOString(), rows,
        meId: me?.id || null, otherId: row.id,
        targetName: snapshot?.targetName || app.lastTargetName || '선택한 전투',
        targetId, battleTime: snapshot?.battleTime ?? app._lastBattleTimeMs,
        details: details?.targetId === Number(targetId) ? details : null,
      };
      if (native) await native('open_comparison_window', { payload });
      else {
        const key = `a2-comparison-${crypto.randomUUID()}`;
        localStorage.setItem(key, JSON.stringify(payload));
        tab.location.replace(`/compare.html#${key}`);
      }
    } catch (error) {
      tab?.close();
      window.alert(`비교 페이지를 열지 못했습니다. ${error.message || error}`);
    } finally { opening = false; }
  };
})();
