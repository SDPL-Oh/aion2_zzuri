import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { delta, percentDelta, combatMetrics, normalizeCharacter, statRows, equipmentRows, equipmentCategory, itemOptions, additionalOptions, decodeCharacterId, plainName } from '../public/src/js/comparisonModel.js';

test('missing values are not zero and zero baselines have no percentage', () => {
  assert.equal(delta(null, 100), null); assert.equal(delta('', 100), null); assert.equal(delta(0, 100), 100);
  assert.equal(percentDelta(0, 100), null); assert.equal(percentDelta(100, 125), 25); assert.equal(percentDelta(100, 75), -25);
});
test('damage includes DOT, rate denominators exclude DOT and other actors', () => {
  const result = combatMetrics({ id: '1' }, { battleTime: 10000, skills: [
    { actorId: 1, dmg: 1000, time: 10, crit: 4, smite: 2 },
    { actorId: 1, dmg: 500, time: 50, crit: 0, smite: 40, isDot: true },
    { actorId: 2, dmg: 9000, time: 100, crit: 100, smite: 100 },
  ] });
  assert.deepEqual(result, { dps: 150, damage: 1500, crit: 40, smite: 20 });
});
test('empty, DOT-only and mismatched detail snapshots do not manufacture rates', () => {
  assert.equal(combatMetrics(null, null).dps, null);
  assert.equal(combatMetrics({ id: 1, dps: 100 }, null).crit, null);
  assert.equal(combatMetrics({ id: 1, dps: 100 }, { skills: [{ actorId: 2, dmg: 1 }] }).dps, null);
  assert.equal(combatMetrics({ id: 1 }, { battleTime: 0, skills: [{ actorId: 1, dmg: 50, isDot: true }] }).dps, null);
  assert.equal(combatMetrics({ id: 1 }, { battleTime: 1000, skills: [{ actorId: 1, dmg: 50, time: 3, isDot: true }] }).crit, null);
});
const info = { profile: { characterName: '테스트', combatPower: 100 }, stat: { statList: [{ type: 'STR', name: '위력', value: 10, statSecondList: ['공격력 증가 +1%'] }] } };
const gear = equipmentList => ({ equipment: { equipmentList } });
test('partial profile keeps stats but equipment unknown', () => {
  const a = normalizeCharacter(info, null);
  assert.equal(a.items, null); assert.equal(a.stats[1].value, 10);
  assert.throws(() => normalizeCharacter({}, null)); assert.throws(() => normalizeCharacter(info, {}));
  assert.equal(statRows(a, null)[0].difference, null);
});
test('equipment matches slot, preserving separate rings and missing sides', () => {
  const a = normalizeCharacter(info, gear([{ slotPos: 13, id: 9, name: '반지', enchantLevel: 10 }, { slotPos: 14, id: 9, name: '반지', enchantLevel: 8 }]));
  const b = normalizeCharacter(info, gear([{ slotPos: 14, id: 9, name: '반지', enchantLevel: 8 }, { slotPos: 13, id: 9, name: '반지', enchantLevel: 12 }]));
  assert.deepEqual(equipmentRows(a, b).map(r => r.changed), [true, false]);
  assert.equal(equipmentRows(a, null)[0].known, false);
  assert.equal(equipmentRows(a, normalizeCharacter(info, gear([])))[0].changed, true);
});
test('equipment categories separate accessories from weapons, armor, and wings', () => {
  for (const slotPosName of ['Belt', 'Necklace', 'Earring1', 'Ring2', 'Bracelet1', 'Pendant', 'Brooch2', 'Amulet', 'Rune1', 'Seal2', 'Arcana10']) {
    assert.equal(equipmentCategory({ slotPosName }), 'accessory');
  }
  for (const slotPosName of ['MainHand', 'Helmet', 'Torso', 'Wing']) assert.equal(equipmentCategory({ slotPosName }), 'gear');
});
test('item options preserve ranges, bonuses, duplicate stones and effect text', () => {
  const options = itemOptions({ mainStats: [{ id: 'WeaponFixingDamage', minValue: '100', value: '200', extra: '30' }], magicStoneStat: [{ id: 'STR', name: '위력', value: '+5' }, { id: 'STR', name: '위력', value: '+6' }], godStoneStat: [{ name: '신석', desc: '효과\n설명' }] });
  assert.equal(options[0].value, '100 ~ 200 (+30)'); assert.notEqual(options[1].key, options[2].key); assert.equal(options[3].value, '효과\n설명');
});
test('character normalization keeps acquired skill levels and additional options stay focused', () => {
  const data = normalizeCharacter(info, { ...gear([]), skill: { skillList: [
    { id: 1, name: '습득', acquired: 1, skillLevel: 7, icon: 'skill.png' },
    { id: 2, name: '미습득', acquired: 0, skillLevel: 0 },
  ] } });
  assert.deepEqual(data.skills.map(skill => [skill.name, skill.skillLevel]), [['습득', 7]]);
  const details = { mainStats: [{ id: 'STR', name: '기본', value: 1 }], subStats: [{ id: 'DEX', name: '민첩', value: 5 }], magicStoneStat: [{ name: '마석', value: 9 }], subSkills: [{ id: 3, name: '스킬 효과', desc: '피해 증가' }] };
  assert.deepEqual(additionalOptions(details).map(option => [option.name, option.value]), [['민첩', '5'], ['스킬 효과', '피해 증가']]);
});
test('official encoded character IDs decode once and highlighted names are text', () => {
  assert.equal(decodeCharacterId('abc%3D'), 'abc='); assert.equal(plainName('<strong>캐릭터</strong>'), '캐릭터');
});
test('launcher passes selected actor and local ID without relying on rendered row limits', async () => {
  let payload;
  const raw = { map: { 1: {}, 2: {} }, targetId: 99, localPlayerId: 1, targetName: '보스', battleTime: 5000 };
  const window = { __TAURI__: { core: { invoke: async (_command, args) => { payload = args.payload; } } }, dpsData: { getDpsData: () => JSON.stringify(raw), getTargetDetails: async () => JSON.stringify({ targetId: 99, skills: [] }) }, alert: message => { throw new Error(message); } };
  vm.runInNewContext(fs.readFileSync(new URL('../public/src/js/compareLauncher.js', import.meta.url), 'utf8'), { window });
  await window.openCharacterComparison({ buildRowsFromMapObject: map => { assert.deepEqual(Object.keys(map), ['1', '2']); return [{ id: '1', name: '나' }, { id: '2', name: '상대' }]; } }, { id: '2' });
  assert.equal(payload.meId, '1'); assert.equal(payload.otherId, '2'); assert.equal(payload.details.targetId, 99);
});
test('launcher keeps a configured local character selectable without a damage row', async () => {
  let payload;
  const raw = { map: { 2: {} }, targetId: 0, localPlayerId: null };
  const window = { __TAURI__: { core: { invoke: async (_command, args) => { payload = args.payload; } } }, dpsData: { getDpsData: () => JSON.stringify(raw) }, alert: message => { throw new Error(message); } };
  vm.runInNewContext(fs.readFileSync(new URL('../public/src/js/compareLauncher.js', import.meta.url), 'utf8'), { window });
  await window.openCharacterComparison({ USER_NAME: '나의캐릭터', lastSnapshot: [], buildRowsFromMapObject: () => [{ id: '2', name: '상대' }] }, { id: '2' });
  assert.equal(payload.meId, 'me:나의캐릭터');
  assert.equal(payload.rows.find(row => row.id === payload.meId).name, '나의캐릭터');
});

test('browser reserves a blank tab so slow detail requests cannot lose snapshot navigation', async () => {
  let destination, saved; const calls = [];
  const tab = { location: { replace: url => { destination = url; } }, close() {} };
  const window = { open: (url, target) => { calls.push([url, target]); return tab; }, dpsData: { getDpsData: () => JSON.stringify({map:{},targetId:1}), getTargetDetails: async () => { await new Promise(resolve => setTimeout(resolve, 10)); return null; } }, alert: message => { throw new Error(message); } };
  vm.runInNewContext(fs.readFileSync(new URL('../public/src/js/compareLauncher.js', import.meta.url), 'utf8'), {window, crypto:{randomUUID:()=> 'abc-123'}, localStorage:{setItem:(key,value)=>{saved={key,value};}}});
  await window.openCharacterComparison({buildRowsFromMapObject:()=>[]}, {id:'2'});
  assert.equal(calls[0][0], 'about:blank'); assert.equal(destination, '/compare.html#a2-comparison-abc-123'); assert.equal(JSON.parse(saved.value).meId, null);
});


test('smite rate distinguishes absent fields from measured zero', () => {
  const details = {battleTime: 1000, skills: [{actorId: 1, dmg: 100, time: 10, crit: 0}]};
  assert.equal(combatMetrics({id: 1}, details).smite, null);
  details.skills[0].smite = 0;
  assert.equal(combatMetrics({id: 1}, details).smite, 0);
  details.skills[0].smite = 3;
  assert.equal(combatMetrics({id: 1}, details).smite, 30);
});
