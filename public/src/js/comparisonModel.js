// Shared pure calculations: missing data remains missing, never an inferred zero.
export const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export function delta(mine, other) {
  const a = number(mine), b = number(other);
  return a === null || b === null ? null : b - a;
}
export function percentDelta(mine, other) {
  const a = number(mine), b = number(other);
  return a === null || b === null || a === 0 ? null : (b - a) / Math.abs(a) * 100;
}
export function combatMetrics(row, details) {
  if (!row) return { dps: null, damage: null, crit: null, smite: null };
  const skills = Array.isArray(details?.skills) ? details.skills.filter(s => String(s.actorId) === String(row.id)) : [];
  if (!skills.length) return details?.skills?.length
    ? { dps: null, damage: null, crit: null, smite: null }
    : { dps: number(row.dps), damage: number(row.totalDamage), crit: null, smite: null };
  const damage = skills.reduce((sum, s) => sum + (number(s.dmg) || 0), 0);
  // DOT ticks have damage but are not eligible direct hits for these rates.
  const hits = skills.filter(s => !s.isDot);
  const count = hits.reduce((sum, s) => sum + (number(s.time) || 0), 0);
  const rate = key => count > 0 && hits.every(s => number(s[key]) !== null)
    ? hits.reduce((sum, s) => sum + number(s[key]), 0) / count * 100 : null;
  const ms = number(details.battleTime);
  return { damage, dps: ms !== null && ms > 0 ? damage / Math.max(ms / 1000, 1) : null, crit: rate('crit'), smite: rate('smite') };
}
export function normalizeCharacter(info, equipment) {
  if (!info?.profile?.characterName || !Array.isArray(info?.stat?.statList)) throw new Error('캐릭터 스탯 응답 형식이 변경되었거나 비공개 상태입니다.');
  const stats = info.stat.statList.map(s => ({ key: s.type || s.name, name: s.name, value: number(s.value), effects: s.statSecondList || [] }));
  stats.unshift({ key: 'CombatPower', name: '전투력', value: number(info.profile.combatPower), effects: [] });
  let items = null;
  if (equipment != null) {
    if (!Array.isArray(equipment?.equipment?.equipmentList)) throw new Error('장비 응답 형식이 변경되었거나 비공개 상태입니다.');
    items = equipment.equipment.equipmentList.map(item => ({ ...item, key: String(item.slotPos) }));
    if (equipment.petwing?.wing) items.push({ ...equipment.petwing.wing, key: 'wing', slotPosName: 'Wing' });
  }
  const skills = Array.isArray(equipment?.skill?.skillList)
    ? equipment.skill.skillList.filter(skill => number(skill.acquired) === 1 && (number(skill.skillLevel) || 0) > 0)
      .map(skill => ({ ...skill, key: String(skill.id) }))
    : equipment == null ? null : [];
  return { profile: info.profile, stats, items, skills, fetchedAt: new Date().toISOString() };
}
export function statRows(a, b) {
  const mine = new Map((a?.stats || []).map(s => [s.key, s]));
  const other = new Map((b?.stats || []).map(s => [s.key, s]));
  return [...new Set([...mine.keys(), ...other.keys()])].map(key => ({
    key, name: mine.get(key)?.name || other.get(key)?.name,
    mine: mine.get(key), other: other.get(key), difference: delta(mine.get(key)?.value, other.get(key)?.value),
  }));
}
export function equipmentRows(a, b) {
  const mine = new Map((a?.items || []).map(s => [s.key, s]));
  const other = new Map((b?.items || []).map(s => [s.key, s]));
  return [...new Set([...mine.keys(), ...other.keys()])].sort((a, b) => (number(a) ?? 100) - (number(b) ?? 100)).map(key => {
    const x = mine.get(key), y = other.get(key);
    const known = Array.isArray(a?.items) && Array.isArray(b?.items);
    return { key, mine: x, other: y, known, changed: known && (!x || !y || ['id', 'enchantLevel', 'exceedLevel'].some(k => (x[k] ?? 0) !== (y[k] ?? 0))) };
  });
}
const accessorySlotPattern = /^(Belt|Necklace|Earring|Ring|Bracelet|Pendant|Brooch|Amulet|Rune|Seal|Arcana)/;
export function equipmentCategory(item) {
  return accessorySlotPattern.test(String(item?.slotPosName || '')) ? 'accessory' : 'gear';
}
const statLabels = { WeaponFixingDamage: '공격력' };
export function itemOptions(item) {
  if (!item) return [];
  const result = [];
  for (const [group, title] of [['mainStats', '기본'], ['subStats', '추가'], ['magicStoneStat', '마석'], ['godStoneStat', '신석']]) {
    const counts = new Map();
    for (const s of item[group] || []) {
      const id = s.id || s.name || 'option';
      const occurrence = counts.get(id) || 0; counts.set(id, occurrence + 1);
      const value = s.desc ?? `${s.minValue != null ? `${s.minValue} ~ ` : ''}${s.value ?? '—'}${s.extra && s.extra !== '0' ? ` (+${s.extra})` : ''}`;
      result.push({ key: `${group}:${id}:${occurrence}`, name: `${title} · ${s.name || statLabels[id] || id}`, value });
    }
  }
  if (item.soulBindRate != null) result.push({ key: 'soulBindRate', name: '영혼 각인율', value: `${item.soulBindRate}%` });
  return result;
}
export function additionalOptions(item) {
  if (!item) return [];
  const result = [];
  for (const [group, values] of [['subStats', item.subStats], ['subSkills', item.subSkills]]) {
    const counts = new Map();
    for (const option of values || []) {
      const id = option.id || option.name || 'option';
      const occurrence = counts.get(id) || 0; counts.set(id, occurrence + 1);
      const value = option.desc ?? `${option.minValue != null && String(option.minValue) !== String(option.value) ? `${option.minValue} ~ ` : ''}${option.value ?? option.level ?? '—'}`;
      result.push({ key: `${group}:${id}:${occurrence}`, name: option.name || statLabels[id] || id, value });
    }
  }
  return result;
}
export function decodeCharacterId(id) {
  try { return decodeURIComponent(String(id)); } catch { throw new Error('캐릭터 ID를 읽을 수 없습니다.'); }
}
export function plainName(value) { return String(value || '').replace(/<[^>]*>/g, ''); }
