import { number, delta, percentDelta, combatMetrics, normalizeCharacter, statRows, equipmentRows, itemOptions, decodeCharacterId, plainName } from './comparisonModel.js';
const $ = id => document.getElementById(id);
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
const fmt = (v, digits = 0) => number(v) === null ? '확인 불가' : Number(v).toLocaleString('ko-KR', { maximumFractionDigits: digits });
const signed = (v, unit = '') => v == null ? '비교 불가' : `${v > 0 ? '+' : ''}${fmt(v, 1)}${unit}`;
const clock = value => new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const routes = { servers: 'gameinfo/servers', search: 'search/character', info: 'character/info', equipment: 'character/equipment', item: 'character/equipment/item' };
async function api(endpoint, params = {}) {
  params = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]));
  if (window.__TAURI__?.core?.invoke) return window.__TAURI__.core.invoke('comparison_api', { endpoint, params });
  const response = await fetch(`/comparison-api/${routes[endpoint]}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`공식 정보실 조회 실패 (HTTP ${response.status}). 다시 시도해 주세요.`);
  return response.json();
}
function readSnapshot() {
  if (window.__COMPARISON__) { sessionStorage.setItem('a2-comparison', JSON.stringify(window.__COMPARISON__)); return window.__COMPARISON__; }
  const key = location.hash.slice(1);
  if (/^a2-comparison-[a-f0-9-]+$/.test(key)) {
    const raw = localStorage.getItem(key);
    if (raw) { sessionStorage.setItem('a2-comparison', raw); localStorage.removeItem(key); history.replaceState(null, '', location.pathname); return JSON.parse(raw); }
  }
  return JSON.parse(sessionStorage.getItem('a2-comparison') || 'null');
}
let snapshot;
try { snapshot = readSnapshot(); } catch { snapshot = null; }
const rows = Array.isArray(snapshot?.rows) ? snapshot.rows : [];
const sides = [
  { key: 'mine', title: '내 캐릭터', row: rows.find(r => String(r.id) === String(snapshot?.meId)), generation: 0 },
  { key: 'other', title: '비교 캐릭터', row: rows.find(r => String(r.id) === String(snapshot?.otherId)), generation: 0 },
];
let servers = [];
let onlyDifferences = false;
const optionCache = new Map();
const slotNames = { MainHand: '주무기', SubHand: '보조무기', Helmet: '머리', Shoulder: '어깨', Torso: '상의', Pants: '하의', Gloves: '장갑', Boots: '신발', Cape: '망토', Belt: '허리띠', Necklace: '목걸이', Earring1: '귀걸이 1', Earring2: '귀걸이 2', Ring1: '반지 1', Ring2: '반지 2', Bracelet1: '팔찌 1', Bracelet2: '팔찌 2', Wing: '날개', Pendant: '펜던트', Brooch1: '브로치 1', Brooch2: '브로치 2', Amulet: '아뮬렛', Rune1: '룬 1', Rune2: '룬 2', Seal1: '인장 1', Seal2: '인장 2', Arcana1: '아르카나 1', Arcana2: '아르카나 2', Arcana3: '아르카나 3', Arcana4: '아르카나 4', Arcana5: '아르카나 5', Arcana6: '아르카나 6', Arcana7: '아르카나 7', Arcana8: '아르카나 8', Arcana9: '아르카나 9', Arcana10: '아르카나 10' };

function renderCombat() {
  $('fightContext').textContent = snapshot ? `${snapshot.targetName || '선택한 전투'} · ${fmt((snapshot.details?.battleTime || snapshot.battleTime || 0) / 1000, 1)}초 · ${clock(snapshot.capturedAt)} 기록` : '미터기의 캐릭터 옆 ‘비교’ 링크에서 열면 해당 전투 기록이 표시됩니다.';
  const actors = $('combatActors'); actors.replaceChildren();
  [sides[1], sides[0]].forEach((side, i) => {
    if (i) actors.append(el('div', 'comparisonHeading', '차이 · 상대 − 나'));
    const label = el('label', side.key, side.title);
    const select = el('select'); select.setAttribute('aria-label', `${side.title} 전투 기록 선택`);
    const empty = el('option', '', rows.length ? '캐릭터 선택' : '전투 기록 없음'); empty.value = ''; select.append(empty);
    for (const row of rows) { const option = el('option', '', `${row.name}${row.job ? ` · ${row.job}` : ''}`); option.value = row.id; select.append(option); }
    select.value = side.row?.id || '';
    select.addEventListener('change', () => {
      side.row = rows.find(r => String(r.id) === select.value); side.generation++; side.data = null;
      renderCombat(); buildProfile(side); renderSetup();
      if (side.server.value && side.name.value) search(side);
    });
    label.append(select); actors.append(label);
  });
  const values = sides.map(s => combatMetrics(s.row, snapshot?.details));
  $('combatMetrics').replaceChildren();
  for (const [key, title, unit] of [['dps', 'DPS', ''], ['damage', '총 피해량', ''], ['smite', '강타율', '%'], ['crit', '치명타율', '%']]) {
    const row = el('div', 'comparisonRow');
    const scale = unit ? 100 : Math.max(values[0][key] || 0, values[1][key] || 0);
    const difference = delta(values[0][key], values[1][key]);
    for (const i of [1, 0]) {
      if (i === 0) {
        const center = el('div', 'comparisonDifference');
        center.append(el('div', 'metricTitle', title), el('strong', difference === null || difference === 0 ? 'neutral' : difference > 0 ? 'other' : 'mine', signed(difference, unit ? '%p' : '')));
        const percent = percentDelta(values[0][key], values[1][key]);
        center.append(el('span', 'differenceContext', difference === null ? '기록 부족' : difference === 0 ? '동일' : unit ? (difference > 0 ? '상대가 높음' : '내가 높음') : percent === null ? '내 수치가 0 · 증감률 없음' : `내 수치 대비 ${signed(percent, '%')}`));
        row.append(center);
      }
      const value = values[i][key];
      const cell = el('div', `comparisonValue ${sides[i].key}`);
      const formatted = `${fmt(value, unit ? 1 : 0)}${value !== null ? unit : ''}`;
      cell.append(el('strong', '', formatted));
      const track = el('div', 'comparisonTrack');
      track.setAttribute('role', 'img'); track.setAttribute('aria-label', `${sides[i].title} ${title}: ${formatted}`);
      if (value !== null) {
        const bar = el('div', 'comparisonFill');
        bar.style.width = `${scale > 0 ? Math.min(100, Math.max(0, value) / scale * 100) : 0}%`;
        track.append(bar);
      } else track.classList.add('unavailable');
      cell.append(track); row.append(cell);
    }
    $('combatMetrics').append(row);
  }
  const insight = $('combatInsight'); insight.replaceChildren(el('h3', '', '전투 지표 차이'));
  const p = percentDelta(values[0].dps, values[1].dps);
  let message = !sides[0].row || !sides[1].row ? '비교할 두 캐릭터의 전투 기록을 선택해 주세요.' : String(sides[0].row.id) === String(sides[1].row.id) ? '같은 캐릭터를 선택했습니다. 다른 캐릭터를 선택하면 차이를 확인할 수 있습니다.' : p === null ? 'DPS 증감률을 계산할 수 없습니다. 기록이 없거나 내 DPS가 0인 경우입니다.' : p === 0 ? '두 캐릭터의 DPS가 같습니다.' : `상대의 DPS가 내 캐릭터보다 ${fmt(Math.abs(p), 1)}% ${p > 0 ? '높습니다' : '낮습니다'}.`;
  insight.append(el('strong', '', message));
  for (const [key, title] of [['smite', '강타율'], ['crit', '치명타율']]) {
    const difference = delta(values[0][key], values[1][key]);
    insight.append(el('div', 'analysisDetail', difference === null ? `${title}: 비교할 타격 기록이 없습니다.` : difference === 0 ? `${title}은 두 캐릭터가 같습니다.` : `${title}은 상대가 ${fmt(Math.abs(difference), 1)}%p ${difference > 0 ? '높습니다' : '낮습니다'}.`));
  }
  if (sides.every(s => s.row?.job) && sides[0].row.job !== sides[1].row.job) insight.append(el('div', 'muted', '서로 다른 직업입니다. 역할과 스킬 구조를 함께 고려해 비교해 주세요.'));
  if (!snapshot?.details?.skills?.length) insight.append(el('div', 'muted', '상세 타격 기록이 없어 강타율·치명타율은 확인할 수 없습니다. 전체 타겟 모드에서는 단일 보스를 선택한 뒤 비교해 주세요.'));
}
function setStatus(side, message, error = false) { side.status.replaceChildren(el('span', '', message)); side.status.classList.toggle('error', error); }
function populateServers(side) {
  const previous = side.server.value || String(snapshot?.serversByName?.[side.row?.name] || '');
  side.server.replaceChildren(); const empty = el('option', '', '서버 선택'); empty.value = ''; side.server.append(empty);
  for (const server of servers) { const option = el('option', '', `${server.raceId === 1 ? '천족' : '마족'} · ${server.serverName}`); option.value = server.serverId; side.server.append(option); }
  side.server.value = servers.some(s => String(s.serverId) === previous) ? previous : '';
}
function buildProfile(side) {
  let card = $(`profile-${side.key}`);
  if (!card) { card = el('div', `profile ${side.key === 'other' ? 'otherProfile' : ''}`); card.id = `profile-${side.key}`; $('profiles').append(card); }
  card.replaceChildren(el('div', `profileLabel ${side.key}`, side.title));
  const form = el('form');
  side.name = el('input'); side.name.type = 'text'; side.name.placeholder = '캐릭터명'; side.name.maxLength = 40; side.name.setAttribute('aria-label', `${side.title} 이름`); side.name.value = side.row?.isIdentifying ? '' : side.row?.name || ''; side.name.readOnly = !!side.row && !side.row.isIdentifying;
  side.server = el('select'); side.server.setAttribute('aria-label', `${side.title} 서버`); populateServers(side);
  side.button = el('button', '', '조회'); side.button.type = 'submit';
  side.status = el('div', 'profileStatus'); side.status.setAttribute('role', 'status');
  side.results = el('div', 'results'); side.facts = el('div');
  const invalidate = () => { side.generation++; side.data = null; side.results.replaceChildren(); side.facts.replaceChildren(); side.button.disabled = false; setStatus(side, '서버와 캐릭터명을 확인한 뒤 조회해 주세요.'); renderSetup(); };
  side.name.addEventListener('input', invalidate); side.server.addEventListener('change', invalidate);
  form.addEventListener('submit', event => { event.preventDefault(); search(side); });
  form.append(side.name, side.server, side.button); card.append(form, side.status, side.results, side.facts);
  setStatus(side, side.row ? '서버를 선택하면 현재 장비와 스탯을 조회할 수 있습니다.' : '캐릭터명과 서버를 입력해 장비·스탯을 비교하세요.');
}
async function search(side, page = 1) {
  const name = side.name.value.trim(); const server = servers.find(s => String(s.serverId) === side.server.value);
  if (!name || !server) { setStatus(side, '캐릭터명과 서버를 모두 선택해 주세요.', true); return; }
  const generation = ++side.generation;
  side.data = null; side.results.replaceChildren(); side.facts.replaceChildren(); side.button.disabled = true; renderSetup(); setStatus(side, '공식 정보실에서 캐릭터를 찾고 있습니다…');
  try {
    const result = await api('search', { keyword: name, race: server.raceId, serverId: server.serverId, page, size: 40 });
    if (generation !== side.generation) return;
    if (!Array.isArray(result.list)) throw new Error('캐릭터 검색 응답을 읽을 수 없습니다.');
    const candidates = result.list.filter(c => Number(c.serverId) === Number(server.serverId));
    const exact = candidates.filter(c => plainName(c.name) === name);
    if (exact.length === 1) { await loadCharacter(side, exact[0], generation); return; }
    const options = side.row && !side.row.isIdentifying ? exact : candidates;
    setStatus(side, options.length ? '비교할 캐릭터를 선택해 주세요.' : '이 서버에서 일치하는 캐릭터를 찾지 못했습니다. 서버와 이름을 확인해 주세요.', !options.length);
    for (const c of options) {
      const button = el('button', '', `${plainName(c.name)} · ${c.serverName} · Lv.${c.level}`);
      button.addEventListener('click', () => loadCharacter(side, c, ++side.generation)); side.results.append(button);
    }
    if (result.pagination?.page < result.pagination?.endPage) { const more = el('button', '', '다음 검색 결과'); more.addEventListener('click', () => search(side, page + 1)); side.results.append(more); }
  } catch (error) { if (generation === side.generation) setStatus(side, String(error.message || error), true); }
  finally { if (generation === side.generation) side.button.disabled = false; }
}
async function loadCharacter(side, candidate, generation) {
  side.button.disabled = true; side.results.replaceChildren(); setStatus(side, '스탯과 장비를 불러오고 있습니다…');
  try {
    const params = { lang: 'ko', serverId: candidate.serverId, characterId: decodeCharacterId(candidate.characterId) };
    const [info, gear] = await Promise.allSettled([api('info', params), api('equipment', params)]);
    if (generation !== side.generation) return;
    if (info.status === 'rejected') throw info.reason;
    // Never attach a different character's profile to the captured combat actor.
    if (info.value.profile?.characterName !== plainName(candidate.name) || Number(info.value.profile?.serverId) !== Number(candidate.serverId)) throw new Error('검색한 캐릭터와 조회 결과가 일치하지 않습니다. 다시 조회해 주세요.');
    side.data = normalizeCharacter(info.value, gear.status === 'fulfilled' ? gear.value : null);
    side.data.params = params;
    setStatus(side, gear.status === 'fulfilled' ? `${side.data.profile.characterName} · ${side.data.profile.serverName} · ${side.data.profile.className}` : '스탯 조회 완료 · 장비 조회 실패. ‘조회’를 눌러 다시 시도해 주세요.', gear.status !== 'fulfilled');
    const facts = el('div', 'profileFacts'); facts.append(el('span', '', `Lv.${side.data.profile.characterLevel}`), el('strong', '', `전투력 ${fmt(side.data.profile.combatPower)}`));
    const link = el('a', '', '공식 프로필 ↗'); link.href = `https://aion2.plaync.com/ko-kr/characters/${Number(candidate.serverId)}/${encodeURIComponent(params.characterId)}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; facts.append(link);
    side.facts.replaceChildren(facts, el('div', 'timestamp', `${clock(side.data.fetchedAt)} 조회 · 전투 당시 세팅과 다를 수 있음`));
    renderSetup();
  } catch (error) { if (generation === side.generation) { side.data = null; setStatus(side, String(error.message || error), true); renderSetup(); } }
  finally { if (generation === side.generation) side.button.disabled = false; }
}
function table(headers) {
  const wrap = el('div', 'tableWrap'), t = el('table'), head = el('thead'), tr = el('tr'), body = el('tbody');
  headers.forEach((text, i) => { const th = el('th', i === 1 ? 'mine' : i === 2 ? 'other' : '', text); th.scope = 'col'; tr.append(th); });
  head.append(tr); t.append(head, body); wrap.append(t); return { wrap, body };
}
function renderSetup() {
  const [a, b] = sides.map(s => s.data);
  const stats = statRows(a, b), equipment = equipmentRows(a, b);
  const changedStats = stats.filter(s => s.difference !== null && s.difference !== 0);
  const changedGear = equipment.filter(s => s.changed);
  $('setupInsight').replaceChildren(el('h3', '', '장비·스탯 차이'));
  $('setupInsight').append(el('div', '', a && b ? `수치가 다른 스탯 ${changedStats.length}개 · 기본 구성이 다른 장비 ${changedGear.length}부위${a.items && b.items ? '' : ' (장비 일부 미조회)'}. 장비의 ‘옵션 비교’를 열어 추가 옵션과 마석·신석을 확인하세요.` : '03 장비 & 스탯에서 두 캐릭터를 조회하면 세팅 차이를 분석합니다.'));
  if (a && b) {
    const highlights = changedStats.filter(s => !['CombatPower', 'ItemLevel'].includes(s.key))
      .sort((x, y) => Math.abs(percentDelta(y.mine?.value, y.other?.value) ?? 0) - Math.abs(percentDelta(x.mine?.value, x.other?.value) ?? 0)).slice(0, 3);
    if (highlights.length) $('setupInsight').append(el('div', 'analysisDetail', `주요 스탯 차이 (상대 − 나): ${highlights.map(s => `${s.name} ${signed(s.difference)}`).join(' · ')}`));
    const link = el('a', 'analysisLink', '장비·스탯 상세 확인 ↓'); link.href = '#setupTitle'; $('setupInsight').append(link);
  }
  $('statsTable').replaceChildren();
  if (!stats.length) $('statsTable').append(el('div', 'empty', '캐릭터를 조회하면 스탯 수치와 적용 효과가 표시됩니다.'));
  else {
    const { wrap, body } = table(['스탯', '내 캐릭터', '비교 캐릭터', '상대 − 나']);
    for (const s of stats.filter(s => !onlyDifferences || s.difference !== 0 || JSON.stringify(s.mine?.effects) !== JSON.stringify(s.other?.effects))) {
      const tr = el('tr', s.difference ? 'statChanged' : ''); tr.append(el('td', '', s.name));
      for (const [i, value] of [s.mine, s.other].entries()) { const td = el('td'); td.append(el('div', `value ${sides[i].key}`, fmt(value?.value))); for (const effect of value?.effects || []) td.append(el('div', 'effect', effect)); tr.append(td); }
      tr.append(el('td', s.difference ? 'difference' : 'same', s.difference === 0 ? '동일' : signed(s.difference))); body.append(tr);
    }
    $('statsTable').append(body.children.length ? wrap : el('div', 'empty', '조회된 스탯과 적용 효과가 같습니다.'));
  }
  renderEquipment(equipment);
}
function cacheKey(side, item) { return `${side.data?.params?.serverId}:${side.data?.params?.characterId}:${side.data?.fetchedAt}:${item.key}`; }
function optionsEqual(row) {
  if (!row.mine || !row.other) return false;
  const x = optionCache.get(cacheKey(sides[0], row.mine)), y = optionCache.get(cacheKey(sides[1], row.other));
  return x && y && JSON.stringify(itemOptions(x)) === JSON.stringify(itemOptions(y));
}
function renderEquipment(equipment) {
  const root = $('equipmentTable'); root.replaceChildren();
  if (!equipment.length) { root.append(el('div', 'empty', '캐릭터를 조회하면 부위별 장비와 강화·돌파 차이가 표시됩니다.')); return; }
  const list = el('div', 'equipmentList'); const head = el('div', 'equipmentRow equipmentHeading');
  ['부위', '내 캐릭터', '비교 캐릭터', '차이 / 상세'].forEach((t, i) => head.append(el('span', i === 1 ? 'mine' : i === 2 ? 'other' : '', t))); list.append(head);
  let count = 0;
  for (const row of equipment) {
    if (onlyDifferences && !row.changed && row.known && optionsEqual(row)) continue;
    count++;
    const group = el('div'), line = el('div', 'equipmentRow');
    const slot = row.mine?.slotPosName || row.other?.slotPosName;
    line.append(el('div', 'slot', slotNames[slot] || slot || `부위 ${row.key}`));
    [row.mine, row.other].forEach((item, i) => {
      const cell = el('div'); cell.append(el('div', `itemName ${sides[i].key}`, item?.name || (Array.isArray(sides[i].data?.items) ? '장착 정보 없음' : '미조회')));
      if (item) cell.append(el('div', 'enhance', `강화 ${item.enchantLevel == null ? '미제공' : `+${item.enchantLevel}`} · 돌파 ${item.exceedLevel == null ? '미제공' : item.exceedLevel}`)); line.append(cell);
    });
    const summary = el('div', 'itemDelta');
    let text = !row.known ? '상대 정보 대기' : !row.mine || !row.other ? '장착 정보 차이' : row.mine.id !== row.other.id ? '장비 다름' : '같은 장비';
    summary.append(el('div', row.changed ? 'difference' : 'same', text));
    if (row.mine && row.other) {
      const enchant = delta(row.mine.enchantLevel, row.other.enchantLevel), exceed = delta(row.mine.exceedLevel, row.other.exceedLevel);
      if (enchant) summary.append(el('div', 'difference', `강화 ${signed(enchant)}`)); if (exceed) summary.append(el('div', 'difference', `돌파 ${signed(exceed)}`));
    }
    const panel = el('div', 'optionPanel'); panel.hidden = true;
    const button = el('button', 'optionsButton', optionsEqual(row) ? '옵션 동일 · 보기' : '옵션 비교'); button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => { panel.hidden = !panel.hidden; button.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) showOptions(row, panel, button); });
    summary.append(button); line.append(summary); group.append(line, panel); list.append(group);
  }
  root.append(count ? list : el('div', 'empty', '조회한 장비 구성과 상세 옵션이 모두 같습니다.'));
}
async function showOptions(row, panel, button) {
  const generations = sides.map(s => s.generation);
  panel.replaceChildren(el('p', 'optionNote', '부위별 상세 옵션을 불러오고 있습니다…')); button.disabled = true;
  try {
    const results = await Promise.allSettled([row.mine, row.other].map(async (item, i) => {
      if (!item || !sides[i].data) return null;
      if (item.slotPos == null) throw new Error('이 부위는 상세 옵션 조회가 제공되지 않습니다.');
      const side = sides[i], key = cacheKey(side, item);
      if (optionCache.has(key)) return optionCache.get(key);
      const params = { ...side.data.params, id: item.id, enchantLevel: item.enchantLevel || 0, slotPos: item.slotPos }; delete params.lang;
      const data = await api('item', params);
      if (!Array.isArray(data.mainStats) && !Array.isArray(data.subStats)) throw new Error('상세 옵션을 읽을 수 없습니다.');
      optionCache.set(key, data); return data;
    }));
    if (generations.some((v, i) => v !== sides[i].generation) || !panel.isConnected) return;
    panel.replaceChildren();
    results.forEach((result, i) => { if (result.status === 'rejected') panel.append(el('p', 'optionNote', `${sides[i].title}: ${result.reason.message || result.reason} 닫았다 다시 열면 재시도합니다.`)); });
    const opts = results.map(r => r.status === 'fulfilled' && r.value ? new Map(itemOptions(r.value).map(s => [s.key, s])) : null);
    const keys = [...new Set([...(opts[0]?.keys() || []), ...(opts[1]?.keys() || [])])];
    const { wrap, body } = table(['옵션', '내 캐릭터', '비교 캐릭터', '차이']);
    for (const key of keys) {
      const x = opts[0]?.get(key), y = opts[1]?.get(key); const same = !!x && !!y && x.value === y.value;
      if (onlyDifferences && same) continue;
      const tr = el('tr'); tr.append(el('td', '', x?.name || y?.name), el('td', 'mine', x?.value || (opts[0] ? '해당 옵션 없음' : '확인 불가')), el('td', 'other', y?.value || (opts[1] ? '해당 옵션 없음' : '확인 불가')), el('td', same ? 'same' : 'difference', !opts[0] || !opts[1] ? '비교 불가' : same ? '동일' : '다름')); body.append(tr);
    }
    panel.append(body.children.length ? wrap : el('p', 'optionNote', keys.length ? '조회된 상세 옵션이 같습니다.' : '표시할 상세 옵션이 없습니다.'));
    if (optionsEqual(row)) button.textContent = '옵션 동일 · 보기';
  } finally { button.disabled = false; }
}
async function loadServers() {
  try {
    const result = await api('servers', { lang: 'ko' });
    if (!Array.isArray(result.serverList)) throw new Error('서버 목록을 읽을 수 없습니다.');
    servers = result.serverList; sides.forEach(side => { populateServers(side); setStatus(side, '서버와 이름을 확인한 뒤 조회해 주세요.'); if (side.server.value && side.name.value) search(side); });
  } catch (error) {
    sides.forEach(side => { setStatus(side, `서버 목록 조회 실패: ${error.message || error}`, true); const retry = el('button', 'optionsButton', '서버 목록 다시 불러오기'); retry.addEventListener('click', loadServers); side.status.append(retry); });
  }
}
$('differencesOnly').addEventListener('change', event => { onlyDifferences = event.target.checked; renderSetup(); });
// External navigation uses the system browser in Tauri and an ordinary link on the web.
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="https://aion2.plaync.com/"]');
  if (link && window.__TAURI__?.opener?.openUrl) { event.preventDefault(); window.__TAURI__.opener.openUrl(link.href).catch(error => window.alert(String(error))); }
});
renderCombat(); sides.forEach(buildProfile); renderSetup(); loadServers();
