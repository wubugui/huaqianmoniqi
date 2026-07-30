import {
  CLASSES, ENHANCE_MAX, EQUIP_SLOTS, ITEMS, LEVEL_XP, RARITIES, SKILL_LEVEL_XP, SKILL_MAX_LEVEL,
} from './config.js';

const STACKABLE_TYPES = new Set(['consumable', 'quest', 'material']);
const BONUS_LIMITS = {
  hp: [-500, 5000],
  mp: [-500, 5000],
  atk: [-50, 500],
  mag: [-50, 500],
  def: [-50, 500],
  magDef: [-50, 500],
  crit: [-0.2, 0.2],
  dodge: [-0.2, 0.2],
  lifesteal: [-0.2, 0.2],
};
const DROP_AFFIXES = {
  weapon: ['atk', 'mag', 'crit'],
  armor: ['def', 'magDef', 'hp'],
  helmet: ['def', 'magDef', 'mp'],
  necklace: ['hp', 'mp', 'magDef'],
  bracelet: ['atk', 'mag', 'def'],
  ring: ['atk', 'mag', 'crit'],
};
const DROP_AFFIX_RANGES = {
  atk: [1, 4],
  mag: [1, 4],
  def: [1, 3],
  magDef: [1, 3],
  hp: [8, 32],
  mp: [6, 24],
  crit: [0.005, 0.018],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function itemUid() {
  return globalThis.crypto?.randomUUID?.()
    || `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createServerItem(itemId, overrides = {}) {
  const item = ITEMS[itemId];
  if (!item) return null;
  if (!item.slot) {
    return {
      id: itemId,
      qty: clamp(Math.floor(number(overrides.qty, 1)), 1, 999),
    };
  }
  const maxDurability = Math.max(1, Math.floor(number(overrides.maxDurability, item.durability || 8)));
  return {
    id: itemId,
    qty: 1,
    uid: String(overrides.uid || itemUid()).slice(0, 128),
    durability: clamp(Math.floor(number(overrides.durability, maxDurability)), 0, maxDurability),
    maxDurability,
    enhance: clamp(Math.floor(number(overrides.enhance, 0)), 0, ENHANCE_MAX),
    luck: clamp(Math.floor(number(overrides.luck, 0)), 0, 7),
    curse: clamp(Math.floor(number(overrides.curse, 0)), 0, 7),
    bonus: sanitizeBonus(overrides.bonus),
  };
}

export function createServerDropItem(itemId, {
  elite = false,
  boss = false,
  random = Math.random,
} = {}) {
  const entry = createServerItem(itemId);
  const item = ITEMS[itemId];
  if (!entry || !item?.slot) return entry;
  const chance = boss ? 0.32 : elite ? 0.16 : 0.035;
  if (random() >= chance) return entry;
  const available = [...(DROP_AFFIXES[item.slot] || ['hp'])];
  const affixCount = boss && random() < 0.4 ? 2 : 1;
  for (let index = 0; index < affixCount && available.length; index += 1) {
    const pick = Math.min(available.length - 1, Math.floor(random() * available.length));
    const stat = available.splice(pick, 1)[0];
    const [min, max] = DROP_AFFIX_RANGES[stat];
    const rolled = min + random() * (max - min);
    entry.bonus[stat] = stat === 'crit'
      ? Math.round(rolled * 1000) / 1000
      : Math.max(min, Math.round(rolled));
  }
  return entry;
}

function sanitizeBonus(bonus) {
  if (!bonus || typeof bonus !== 'object') return {};
  const clean = {};
  for (const [key, limits] of Object.entries(BONUS_LIMITS)) {
    if (!Object.hasOwn(bonus, key)) continue;
    clean[key] = clamp(number(bonus[key]), limits[0], limits[1]);
  }
  return clean;
}

export function sanitizeServerBag(bag) {
  if (!Array.isArray(bag)) return [];
  const clean = [];
  for (const raw of bag.slice(0, 60)) {
    const item = ITEMS[raw?.id];
    if (!item) continue;
    const entry = createServerItem(raw.id, raw);
    if (!entry) continue;
    if (STACKABLE_TYPES.has(item.type)) {
      const existing = clean.find((candidate) => candidate.id === entry.id);
      if (existing) {
        existing.qty = clamp(existing.qty + entry.qty, 1, 999);
        continue;
      }
    }
    clean.push(entry);
  }
  return clean;
}

export function createServerCharacter(classId = 'warrior') {
  const resolvedClass = CLASSES[classId] ? classId : 'warrior';
  const character = {
    classId: resolvedClass,
    level: 1,
    xp: 0,
    gold: 150,
    bag: sanitizeServerBag([
      { id: 'hp_pot', qty: 10 },
      { id: 'mp_pot', qty: 8 },
      { id: 'recall', qty: 3 },
      { id: 'wood_sword', qty: 1 },
    ]),
    bagSize: 30,
    warehouse: [],
    warehouseSize: 40,
    equip: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null])),
    enhance: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, 0])),
    skills: Object.fromEntries(CLASSES[resolvedClass].skills.map((skill) => [
      skill.id,
      { learned: false, level: 0, exp: 0 },
    ])),
    skillCooldowns: {},
    activeBoost: null,
    shieldUntil: 0,
    pet: null,
    questId: 'q_intro',
    questProgress: {},
    completedQuests: [],
    killCounts: {},
    achievements: [],
    claimedAchievements: [],
    totalKills: 0,
    sabacWins: 0,
    bounty: null,
    bountyCompletions: 0,
    gatheringLevel: 1,
    gatheringExp: 0,
    gatheringCount: 0,
    authorityVersion: 1,
  };
  refreshServerStats(character, { fill: true });
  return character;
}

export function normalizeServerCharacter(player) {
  const fresh = createServerCharacter(player?.classId);
  const normalized = {
    ...fresh,
    ...player,
    classId: CLASSES[player?.classId] ? player.classId : fresh.classId,
    level: clamp(Math.floor(number(player?.level, 1)), 1, 50),
    xp: Math.max(0, Math.floor(number(player?.xp, 0))),
    gold: clamp(Math.floor(number(player?.gold, fresh.gold)), 0, 1_000_000_000),
    bag: sanitizeServerBag(player?.bag?.length ? player.bag : fresh.bag),
    warehouse: sanitizeServerBag(player?.warehouse),
    equip: Object.fromEntries(EQUIP_SLOTS.map((slot) => [
      slot,
      player?.equip?.[slot] ? createServerItem(player.equip[slot].id, player.equip[slot]) : null,
    ])),
    enhance: Object.fromEntries(EQUIP_SLOTS.map((slot) => [
      slot,
      clamp(Math.floor(number(player?.equip?.[slot]?.enhance ?? player?.enhance?.[slot], 0)), 0, ENHANCE_MAX),
    ])),
    skills: Object.fromEntries(CLASSES[player?.classId]?.skills?.map((skill) => {
      const state = player?.skills?.[skill.id] || {};
      return [skill.id, {
        learned: !!state.learned,
        level: clamp(Math.floor(number(state.level, state.learned ? 1 : 0)), 0, SKILL_MAX_LEVEL),
        exp: Math.max(0, Math.floor(number(state.exp, 0))),
      }];
    }) || Object.entries(fresh.skills)),
    skillCooldowns: Object.fromEntries(
      Object.entries(player?.skillCooldowns || {})
        .filter(([skillId, expiresAt]) => CLASSES[player?.classId]?.skills?.some((skill) => skill.id === skillId)
          && Number.isFinite(Number(expiresAt)))
        .map(([skillId, expiresAt]) => [skillId, Math.max(0, Number(expiresAt))]),
    ),
    activeBoost: ['thrust', 'fire_sword'].includes(player?.activeBoost?.id)
      ? { id: player.activeBoost.id, expiresAt: Math.max(0, number(player.activeBoost.expiresAt)) }
      : null,
    shieldUntil: Math.max(0, number(player?.shieldUntil)),
    pet: player?.pet && typeof player.pet === 'object'
      ? {
        ...player.pet,
        id: String(player.pet.id || `pet:${player.id || 'owner'}`).slice(0, 128),
        hp: Math.max(0, number(player.pet.hp)),
        maxHp: Math.max(1, number(player.pet.maxHp, 1)),
        expiresAt: Math.max(0, number(player.pet.expiresAt)),
      }
      : null,
    questProgress: { ...(player?.questProgress || {}) },
    completedQuests: Array.isArray(player?.completedQuests) ? [...new Set(player.completedQuests)].slice(0, 200) : [],
    killCounts: { ...(player?.killCounts || {}) },
    achievements: Array.isArray(player?.achievements) ? [...new Set(player.achievements)].slice(0, 200) : [],
    claimedAchievements: Array.isArray(player?.claimedAchievements)
      ? [...new Set(player.claimedAchievements)].slice(0, 200)
      : [],
    authorityVersion: Math.max(1, Math.floor(number(player?.authorityVersion, 1))),
    bounty: player?.bounty && typeof player.bounty === 'object'
      ? {
        id: String(player.bounty.id || '').slice(0, 64),
        progress: Math.max(0, Math.floor(number(player.bounty.progress, 0))),
      }
      : null,
    bountyCompletions: Math.max(0, Math.floor(number(player?.bountyCompletions, 0))),
    sabacWins: Math.max(0, Math.floor(number(player?.sabacWins, 0))),
  };
  for (const slot of EQUIP_SLOTS) {
    if (normalized.equip[slot]) normalized.equip[slot].enhance = normalized.enhance[slot];
  }
  refreshServerStats(normalized);
  normalized.hp = clamp(number(player?.hp, normalized.maxHp), 0, normalized.maxHp);
  normalized.mp = clamp(number(player?.mp, normalized.maxMp), 0, normalized.maxMp);
  return normalized;
}

export function refreshServerStats(player, { fill = false } = {}) {
  const definition = CLASSES[player.classId] || CLASSES.warrior;
  const levelOffset = Math.max(0, player.level - 1);
  const bonus = {
    hp: 0, mp: 0, atk: 0, mag: 0, def: 0, magDef: 0,
    crit: 0, dodge: 0, lifesteal: 0,
  };
  for (const slot of EQUIP_SLOTS) {
    const entry = player.equip?.[slot];
    const item = ITEMS[entry?.id];
    if (!entry || !item?.stats || entry.durability <= 0) continue;
    const rarityPower = RARITIES[item.rarity || 'common']?.power || 1;
    const enhancePower = 1 + clamp(number(entry.enhance), 0, ENHANCE_MAX) * 0.075;
    for (const [key, value] of Object.entries(item.stats)) {
      const scaled = ['atk', 'mag', 'def', 'magDef', 'hp', 'mp'].includes(key)
        ? value * rarityPower * enhancePower
        : value;
      bonus[key] = (bonus[key] || 0) + scaled;
    }
    for (const [key, value] of Object.entries(entry.bonus || {})) {
      bonus[key] = (bonus[key] || 0) + value * enhancePower;
    }
  }
  player.maxHp = Math.max(1, definition.base.hp + definition.gain.hp * levelOffset + bonus.hp);
  player.maxMp = Math.max(0, definition.base.mp + definition.gain.mp * levelOffset + bonus.mp);
  player.atk = definition.base.atk + definition.gain.atk * levelOffset + bonus.atk;
  player.mag = definition.base.mag + definition.gain.mag * levelOffset + bonus.mag;
  player.defense = definition.base.def + definition.gain.def * levelOffset + bonus.def;
  player.magDef = definition.base.magDef + definition.gain.magDef * levelOffset + bonus.magDef;
  player.crit = clamp(definition.base.crit + definition.gain.crit * levelOffset + bonus.crit, 0, 0.65);
  player.dodge = clamp(definition.base.dodge + definition.gain.dodge * levelOffset + bonus.dodge, 0, 0.4);
  player.lifesteal = clamp(definition.base.lifesteal + bonus.lifesteal, 0, 0.3);
  player.weaponLuck = clamp(number(player.equip?.weapon?.luck), 0, 7);
  player.weaponCurse = clamp(number(player.equip?.weapon?.curse), 0, 7);
  player.range = definition.base.range;
  player.ms = definition.base.ms;
  player.as = definition.base.as;
  if (fill) {
    player.hp = player.maxHp;
    player.mp = player.maxMp;
  } else {
    player.hp = clamp(number(player.hp, player.maxHp), 0, player.maxHp);
    player.mp = clamp(number(player.mp, player.maxMp), 0, player.maxMp);
  }
  return player;
}

export function addServerItem(player, rawEntry) {
  const entry = createServerItem(rawEntry?.id, rawEntry);
  const item = ITEMS[entry?.id];
  if (!entry || !item) return false;
  if (STACKABLE_TYPES.has(item.type)) {
    const existing = player.bag.find((candidate) => candidate.id === entry.id);
    if (existing) {
      existing.qty = clamp(existing.qty + entry.qty, 1, 999);
      player.authorityVersion += 1;
      return true;
    }
  }
  if (player.bag.length >= (player.bagSize || 30)) return false;
  player.bag.push(entry);
  player.authorityVersion += 1;
  return true;
}

export function xpNeed(player) {
  return LEVEL_XP[player.level] || Number.POSITIVE_INFINITY;
}

export function addServerExperience(player, amount) {
  const gained = Math.max(0, Math.floor(number(amount, 0)));
  if (!gained || player.level >= 50) return [];
  const levels = [];
  player.xp += gained;
  while (player.level < 50 && player.xp >= xpNeed(player)) {
    player.xp -= xpNeed(player);
    player.level += 1;
    levels.push(player.level);
  }
  if (levels.length) refreshServerStats(player, { fill: true });
  player.authorityVersion += 1;
  return levels;
}

export function loseDeathExperience(player, ratio = 0.1) {
  const lost = Math.min(player.xp, Math.floor(xpNeed(player) * ratio));
  player.xp -= lost;
  if (lost > 0) player.authorityVersion += 1;
  return lost;
}

export function gainServerSkillExperience(player, skillId, amount = 1) {
  const state = player.skills?.[skillId];
  if (!state?.learned || state.level >= SKILL_MAX_LEVEL) return false;
  state.exp = Math.max(0, Math.floor(number(state.exp) + Math.max(0, number(amount))));
  let leveled = false;
  while (state.level < SKILL_MAX_LEVEL && state.exp >= (SKILL_LEVEL_XP[state.level + 1] || Number.POSITIVE_INFINITY)) {
    state.level += 1;
    leveled = true;
  }
  player.authorityVersion += 1;
  return leveled;
}

export function rollDeathLoss(player, random = Math.random) {
  const red = (player.pkPoints || 0) >= 100;
  const yellow = !red && (player.crimeT || 0) > 0;
  const bagAttempts = red ? 3 : yellow ? 2 : 1;
  const bagChance = red ? 0.85 : 0.42;
  const losses = [];
  const candidates = player.bag
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => ITEMS[entry.id]?.type !== 'quest');
  for (let attempt = 0; attempt < bagAttempts && candidates.length; attempt += 1) {
    if (random() > bagChance) continue;
    const pick = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
    const selected = candidates.splice(pick, 1)[0];
    const currentIndex = player.bag.indexOf(selected.entry);
    if (currentIndex < 0) continue;
    losses.push({ entry: player.bag.splice(currentIndex, 1)[0], source: 'bag' });
  }
  const equippedSlots = EQUIP_SLOTS.filter((slot) => player.equip?.[slot]);
  const equipChance = red ? 0.52 : yellow ? 0.22 : 0.08;
  if (equippedSlots.length && random() < equipChance) {
    const slot = equippedSlots[Math.min(equippedSlots.length - 1, Math.floor(random() * equippedSlots.length))];
    losses.push({ entry: player.equip[slot], source: 'equip', slot });
    player.equip[slot] = null;
    player.enhance[slot] = 0;
  }
  const goldRate = red ? 0.12 : 0.05;
  const gold = Math.floor(player.gold * goldRate);
  if (gold > 0) player.gold -= gold;
  if (losses.length || gold > 0) {
    player.authorityVersion += 1;
    refreshServerStats(player);
  }
  return { entries: losses, gold };
}

export function serverAttackDamage(attacker, defender, { magical = false, multiplier = 1 } = {}) {
  const attack = magical ? Math.max(1, attacker.mag) : Math.max(1, attacker.atk);
  const defense = magical ? Math.max(0, defender.magDef || 0) : Math.max(0, defender.defense || 0);
  const luck = magical ? 0 : clamp(number(attacker.weaponLuck), 0, 7);
  const curse = magical ? 0 : clamp(number(attacker.weaponCurse), 0, 7);
  const fate = Math.random();
  let rolledAttack;
  let highRoll = false;
  if (luck > 0 && fate < luck / 7) {
    rolledAttack = attack;
    highRoll = true;
  } else if (curse > 0 && fate > 1 - curse / 7) {
    rolledAttack = attack * 0.68;
  } else {
    rolledAttack = attack * (0.68 + Math.random() * 0.32);
  }
  const critical = Math.random() < (attacker.crit || 0);
  const raw = rolledAttack * multiplier * (critical ? 1.75 : 1);
  const damage = Math.max(1, Math.floor(raw - defense * (magical ? 0.65 : 0.7)));
  return { damage, critical, highRoll };
}

export function privateServerCharacter(player) {
  return {
    authorityVersion: player.authorityVersion,
    level: player.level,
    xp: player.xp,
    hp: player.hp,
    maxHp: player.maxHp,
    mp: player.mp,
    maxMp: player.maxMp,
    atk: player.atk,
    mag: player.mag,
    defense: player.defense,
    magDef: player.magDef,
    crit: player.crit,
    dodge: player.dodge,
    lifesteal: player.lifesteal,
    gold: player.gold,
    bag: player.bag,
    bagSize: player.bagSize,
    warehouse: player.warehouse,
    warehouseSize: player.warehouseSize,
    equip: player.equip,
    enhance: player.enhance,
    skills: player.skills,
    skillCooldowns: player.skillCooldowns,
    activeBoost: player.activeBoost,
    shieldUntil: player.shieldUntil,
    pet: player.pet,
    questId: player.questId,
    questProgress: player.questProgress,
    completedQuests: player.completedQuests,
    killCounts: player.killCounts,
    achievements: player.achievements,
    claimedAchievements: player.claimedAchievements,
    totalKills: player.totalKills,
    sabacWins: player.sabacWins || 0,
    bounty: player.bounty || null,
    bountyCompletions: player.bountyCompletions || 0,
    gatheringLevel: player.gatheringLevel,
    gatheringExp: player.gatheringExp,
    gatheringCount: player.gatheringCount,
  };
}
