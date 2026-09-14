import { number, delta, percentDelta, combatMetrics, normalizeCharacter, statRows, equipmentRows, equipmentCategory, additionalOptions, decodeCharacterId, plainName } from './comparisonModel.js';
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
const displaySides = () => [sides[1], sides[0]];
let servers = [];
let onlyDifferences = true;
let equipmentView = 'gear';
const optionCache = new Map();
const optionErrors = new Map();
const slotNames = { MainHand: '주무기', SubHand: '보조무기', Helmet: '머리', Shoulder: '어깨', Torso: '상의', Pants: '하의', Gloves: '장갑', Boots: '신발', Cape: '망토', Belt: '허리띠', Necklace: '목걸이', Earring1: '귀걸이 1', Earring2: '귀걸이 2', Ring1: '반지 1', Ring2: '반지 2', Bracelet1: '팔찌 1', Bracelet2: '팔찌 2', Wing: '날개', Pendant: '펜던트', Brooch1: '브로치 1', Brooch2: '브로치 2', Amulet: '아뮬렛', Rune1: '룬 1', Rune2: '룬 2', Seal1: '인장 1', Seal2: '인장 2', Arcana1: '아르카나 1', Arcana2: '아르카나 2', Arcana3: '아르카나 3', Arcana4: '아르카나 4', Arcana5: '아르카나 5', Arcana6: '아르카나 6', Arcana7: '아르카나 7', Arcana8: '아르카나 8', Arcana9: '아르카나 9', Arcana10: '아르카나 10' };

function renderCombat() {
  $('fightContext').textContent = snapshot ? `${snapshot.targetName || '선택한 전투'} · ${fmt((snapshot.details?.battleTime || snapshot.battleTime || 0) / 1000, 1)}초 · ${clock(snapshot.capturedAt)} 기록` : '미터기의 캐릭터 옆 ‘비교’ 링크에서 열면 해당 전투 기록이 표시됩니다.';
  const actors = $('combatActors'); actors.replaceChildren();
  [sides[1], sides[0]].forEach((side, i) => {
    if (i) actors.append(el('div', 'comparisonHeading', '차이 · 나 − 상대'));
    const label = el('label', side.key, side.title);
    const select = el('select'); select.setAttribute('aria-label', `${side.title} 전투 기록 선택`);
    const empty = el('option', '', rows.length ? '캐릭터 선택' : '전투 기록 없음'); empty.value = ''; select.append(empty);
    for (const row of rows) { const option = el('option', '', `${row.name}${row.isUser ? ' · 나' : ''}${row.job ? ` · ${row.job}` : ''}`); option.value = row.id; select.append(option); }
    select.value = side.row?.id || '';
    select.addEventListener('change', () => {
      side.row = rows.find(r => String(r.id) === select.value); side.generation++; side.data = null;
      renderCombat(); buildProfile(side); renderSetup();
      if (side.server.value && side.name.value) search(side);
    });
    const facts = el('div', 'combatActorFacts');
    if (number(side.row?.characterLevel) > 0) facts.append(el('span', '', `Lv.${fmt(side.row.characterLevel)}`));
    facts.append(el('span', '', `장비 Lv. ${number(side.row?.equipmentLevel) > 0 ? fmt(side.row.equipmentLevel) : '확인 불가'}`));
    facts.append(el('strong', '', `전투력 ${number(side.row?.combatPower) > 0 ? fmt(side.row.combatPower) : '확인 불가'}`));
    label.append(select, facts); actors.append(label);
  });
  const values = sides.map(s => combatMetrics(s.row, snapshot?.details));
  $('combatMetrics').replaceChildren();
  for (const [key, title, unit] of [['dps', 'DPS', ''], ['damage', '총 피해량', ''], ['crit', '치명타율', '%']]) {
    const row = el('div', 'comparisonRow');
    const scale = unit ? 100 : Math.max(values[0][key] || 0, values[1][key] || 0);
    const difference = delta(values[0][key], values[1][key]);
    for (const i of [1, 0]) {
      if (i === 0) {
        const center = el('div', 'comparisonDifference');
        center.append(el('div', 'metricTitle', title), el('strong', difference === null || difference === 0 ? 'neutral' : difference > 0 ? 'mine' : 'other', signed(difference, unit ? '%p' : '')));
        const percent = percentDelta(values[0][key], values[1][key]);
        center.append(el('span', 'differenceContext', difference === null ? '기록 부족' : difference === 0 ? '동일' : unit ? (difference > 0 ? '내가 높음' : '상대가 높음') : percent === null ? '상대 수치가 0 · 증감률 없음' : `상대 수치 대비 ${signed(percent, '%')}`));
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
    if (side.row) {
      side.row.characterLevel = number(side.data.profile.characterLevel) || side.row.characterLevel || 0;
      side.row.equipmentLevel = number(side.data.stats.find(stat => stat.key === 'ItemLevel')?.value) || side.row.equipmentLevel || 0;
      side.row.combatPower = number(side.data.profile.combatPower) || side.row.combatPower || 0;
      renderCombat();
    }
    setStatus(side, gear.status === 'fulfilled' ? `${side.data.profile.characterName} · ${side.data.profile.serverName} · ${side.data.profile.className}` : '스탯 조회 완료 · 장비 조회 실패. ‘조회’를 눌러 다시 시도해 주세요.', gear.status !== 'fulfilled');
    const facts = el('div', 'profileFacts'); facts.append(el('span', '', `Lv.${side.data.profile.characterLevel}`), el('strong', '', `전투력 ${fmt(side.data.profile.combatPower)}`));
    const link = el('a', '', '공식 프로필 ↗'); link.href = `https://aion2.plaync.com/ko-kr/characters/${Number(candidate.serverId)}/${encodeURIComponent(params.characterId)}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; facts.append(link);
    side.facts.replaceChildren(facts, el('div', 'timestamp', `${clock(side.data.fetchedAt)} 조회 · 전투 당시 세팅과 다를 수 있음`));
    renderSetup();
    prefetchAdditionalOptions(side, generation);
  } catch (error) { if (generation === side.generation) { side.data = null; setStatus(side, String(error.message || error), true); renderSetup(); } }
  finally { if (generation === side.generation) side.button.disabled = false; }
}
function table(headers) {
  const wrap = el('div', 'tableWrap'), t = el('table'), head = el('thead'), tr = el('tr'), body = el('tbody');
  headers.forEach((text, i) => { const th = el('th', i === 1 ? 'other' : i === 2 ? 'mine' : '', text); th.scope = 'col'; tr.append(th); });
  head.append(tr); t.append(head, body); wrap.append(t); return { wrap, body };
}
function renderSetup() {
  const [a, b] = sides.map(s => s.data);
  const stats = statRows(a, b), equipment = equipmentRows(a, b);
  $('statsTable').replaceChildren();
  if (!stats.length) $('statsTable').append(el('div', 'empty', '캐릭터를 조회하면 스탯 수치와 적용 효과가 표시됩니다.'));
  else {
    const { wrap, body } = table(['스탯', '비교 캐릭터', '내 캐릭터', '나 − 상대']);
    for (const s of stats.filter(s => !onlyDifferences || s.difference !== 0 || JSON.stringify(s.mine?.effects) !== JSON.stringify(s.other?.effects))) {
      const tr = el('tr', s.difference ? 'statChanged' : ''); tr.append(el('td', '', s.name));
      for (const [side, value] of [[sides[1], s.other], [sides[0], s.mine]]) { const td = el('td'); td.append(el('div', `value ${side.key}`, fmt(value?.value))); for (const effect of value?.effects || []) td.append(el('div', 'effect', effect)); tr.append(td); }
      tr.append(el('td', s.difference ? 'difference' : 'same', s.difference === 0 ? '동일' : signed(s.difference))); body.append(tr);
    }
    $('statsTable').append(body.children.length ? wrap : el('div', 'empty', '조회된 스탯과 적용 효과가 같습니다.'));
  }
  renderEquipment(equipment);
  renderSkills(a, b);
}
function cacheKey(side, item) { return `${side.data?.params?.serverId}:${side.data?.params?.characterId}:${side.data?.fetchedAt}:${item.key}`; }
function optionsEqual(row) {
  if (!row.mine || !row.other) return false;
  const x = optionCache.get(cacheKey(sides[0], row.mine)), y = optionCache.get(cacheKey(sides[1], row.other));
  return x && y && JSON.stringify(additionalOptions(x)) === JSON.stringify(additionalOptions(y));
}
function renderEquipment(equipment) {
  const root = $('equipmentTable'); root.replaceChildren();
  if (!equipment.length) { root.append(el('div', 'empty', '캐릭터를 조회하면 부위별 장비와 강화·돌파 차이가 표시됩니다.')); return; }
  const list = el('div', 'equipmentList'); const head = el('div', 'equipmentRow equipmentHeading');
  ['부위', '비교 캐릭터', '내 캐릭터', '차이'].forEach((t, i) => head.append(el('span', i === 1 ? 'other' : i === 2 ? 'mine' : '', t))); list.append(head);
  let count = 0;
  for (const row of equipment) {
    const category = equipmentCategory(row.mine || row.other);
    if (equipmentView !== 'all' && category !== equipmentView) continue;
    if (onlyDifferences && !row.changed && row.known && optionsEqual(row)) continue;
    count++;
    const group = el('div'), line = el('div', 'equipmentRow');
    const slot = row.mine?.slotPosName || row.other?.slotPosName;
    line.append(el('div', 'slot', slotNames[slot] || slot || `부위 ${row.key}`));
    [[sides[1], row.other], [sides[0], row.mine]].forEach(([side, item]) => {
      const cell = el('div', 'equipmentCell');
      const title = el('div', 'itemTitle');
      if (item) {
        const icon = el('img', 'equipmentIcon'); icon.alt = ''; icon.loading = 'lazy';
        if (String(item.icon || '').startsWith('https://assets.playnccdn.com/')) icon.src = item.icon;
        else icon.classList.add('unavailable');
        icon.addEventListener('error', () => icon.classList.add('unavailable'));
        title.append(icon);
      }
      title.append(el('span', `itemName ${side.key}`, item?.name || (Array.isArray(side.data?.items) ? '장착 정보 없음' : '미조회')));
      if (item) {
        title.append(el('span', 'enchantBadge', item.enchantLevel == null ? '+?' : `+${item.enchantLevel}`));
        const breakthrough = el('span', 'breakthroughBadge', item.exceedLevel == null ? '?' : String(item.exceedLevel));
        breakthrough.title = `돌파 ${item.exceedLevel == null ? '미제공' : item.exceedLevel}`;
        breakthrough.setAttribute('aria-label', breakthrough.title);
        const breakthroughLevel = number(item.exceedLevel);
        if (breakthroughLevel !== null) breakthrough.style.setProperty('--breakthrough-hue', String(Math.max(0, 52 - Math.max(0, breakthroughLevel) * 8)));
        title.append(breakthrough);
      }
      cell.append(title);
      if (item) cell.append(renderAdditionalOptions(side, item));
      line.append(cell);
    });
    const summary = el('div', 'itemDelta');
    let text = !row.known ? '상대 정보 대기' : !row.mine || !row.other ? '장착 정보 차이' : row.mine.id !== row.other.id ? '장비 다름' : '같은 장비';
    summary.append(el('div', row.changed ? 'difference' : 'same', text));
    if (row.mine && row.other) {
      const enchant = delta(row.mine.enchantLevel, row.other.enchantLevel), exceed = delta(row.mine.exceedLevel, row.other.exceedLevel);
      if (enchant) summary.append(el('div', 'difference', `강화 ${signed(enchant)}`)); if (exceed) summary.append(el('div', 'difference', `돌파 ${signed(exceed)}`));
    }
    line.append(summary); group.append(line); list.append(group);
  }
  const emptyText = equipmentView === 'accessory' ? '표시할 장신구가 없습니다.' : equipmentView === 'gear' ? '표시할 무기·방어구가 없습니다.' : '조회한 장비 구성과 추가 옵션이 모두 같습니다.';
  root.append(count ? list : el('div', 'empty', emptyText));
}
function renderAdditionalOptions(side, item) {
  const root = el('div', 'additionalOptions');
  if (item.slotPos == null) { root.append(el('span', 'optionNote', '추가 옵션 미제공')); return root; }
  const key = cacheKey(side, item), data = optionCache.get(key);
  if (!data) { root.append(el('span', optionErrors.has(key) ? 'optionError' : 'optionNote', optionErrors.get(key) || '추가 옵션 불러오는 중…')); return root; }
  const options = additionalOptions(data);
  if (!options.length) { root.append(el('span', 'optionNote', '추가 옵션 없음')); return root; }
  for (const option of options) root.append(el('span', 'additionalOption', `${option.name} ${option.value}`));
  return root;
}
async function fetchItemDetails(side, item) {
  const key = cacheKey(side, item);
  if (optionCache.has(key)) return optionCache.get(key);
  const params = { ...side.data.params, id: item.id, enchantLevel: item.enchantLevel || 0, slotPos: item.slotPos }; delete params.lang;
  try {
    const data = await api('item', params);
    if (!data || typeof data !== 'object' || (!Array.isArray(data.mainStats) && !Array.isArray(data.subStats) && !Array.isArray(data.subSkills))) throw new Error('추가 옵션을 읽을 수 없습니다.');
    optionCache.set(key, data); optionErrors.delete(key); return data;
  } catch (error) {
    optionErrors.set(key, `추가 옵션 확인 불가`); throw error;
  }
}
async function prefetchAdditionalOptions(side, generation) {
  const queue = (side.data?.items || []).filter(item => item.slotPos != null);
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length && generation === side.generation) {
      const item = queue.shift();
      try { await fetchItemDetails(side, item); } catch { /* each item shows its own failure */ }
    }
  });
  await Promise.all(workers);
  if (generation === side.generation) renderSetup();
}
const skillCategoryNames = { Active: '액티브', Passive: '패시브', Stigma: '스티그마', Dp: 'DP' };
function renderSkills(a, b) {
  const root = $('skillsTable'); root.replaceChildren();
  const mine = new Map((a?.skills || []).map(skill => [skill.key, skill]));
  const other = new Map((b?.skills || []).map(skill => [skill.key, skill]));
  const rows = [...new Set([...mine.keys(), ...other.keys()])].map(key => {
    const x = mine.get(key), y = other.get(key);
    return { key, mine: x, other: y, skill: x || y, difference: delta(x?.skillLevel, y?.skillLevel), changed: !x || !y || number(x.skillLevel) !== number(y.skillLevel) };
  }).sort((x, y) => String(x.skill.category).localeCompare(String(y.skill.category), 'ko') || String(x.skill.name).localeCompare(String(y.skill.name), 'ko'));
  if (!rows.length) { root.append(el('div', 'empty', a || b ? '표시할 습득 스킬이 없습니다.' : '캐릭터를 조회하면 스킬 이미지와 레벨이 표시됩니다.')); return; }
  const { wrap, body } = table(['스킬', '비교 캐릭터', '내 캐릭터', '나 − 상대']);
  for (const row of rows.filter(row => !onlyDifferences || row.changed)) {
    const tr = el('tr', row.changed ? 'statChanged' : '');
    const identity = el('td'); const skill = el('div', 'skillIdentity');
    const icon = el('img', 'comparisonSkillIcon'); icon.alt = ''; icon.loading = 'lazy';
    if (String(row.skill.icon || '').startsWith('https://assets.playnccdn.com/')) icon.src = row.skill.icon;
    else window.skillIcons?.applyIconToImage?.(icon, { code: row.skill.id, job: a?.profile?.className || b?.profile?.className });
    icon.addEventListener('error', () => window.skillIcons?.applyIconToImage?.(icon, { code: row.skill.id, job: a?.profile?.className || b?.profile?.className }));
    const text = el('div'); text.append(el('strong', '', row.skill.name), el('span', 'skillCategory', skillCategoryNames[row.skill.category] || row.skill.category || '스킬'));
    skill.append(icon, text); identity.append(skill); tr.append(identity);
    for (const [side, value] of [[sides[1], row.other], [sides[0], row.mine]]) {
      const td = el('td', side.key); td.append(el('strong', 'skillLevel', value ? `Lv. ${fmt(value.skillLevel)}` : '미습득'));
      if (value?.category === 'Stigma') td.append(el('div', 'skillEquipped', number(value.equip) === 1 ? '장착' : '미장착'));
      tr.append(td);
    }
    const difference = !row.mine || !row.other ? '습득 차이' : row.difference === 0 ? '동일' : signed(row.difference);
    tr.append(el('td', row.changed ? 'difference' : 'same', difference)); body.append(tr);
  }
  root.append(body.children.length ? wrap : el('div', 'empty', '조회된 스킬 레벨이 같습니다.'));
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
document.querySelectorAll('[data-equipment-view]').forEach(button => button.addEventListener('click', () => {
  equipmentView = button.dataset.equipmentView;
  document.querySelectorAll('[data-equipment-view]').forEach(candidate => {
    const active = candidate.dataset.equipmentView === equipmentView;
    candidate.classList.toggle('active', active); candidate.setAttribute('aria-pressed', String(active));
  });
  renderSetup();
}));
// External navigation uses the system browser in Tauri and an ordinary link on the web.
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="https://aion2.plaync.com/"]');
  if (link && window.__TAURI__?.opener?.openUrl) { event.preventDefault(); window.__TAURI__.opener.openUrl(link.href).catch(error => window.alert(String(error))); }
});
renderCombat(); displaySides().forEach(buildProfile); renderSetup(); loadServers();
