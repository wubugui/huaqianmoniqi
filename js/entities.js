import {
  CLASSES, ENHANCE_MAX, EQUIP_SLOTS, ITEMS, LEVEL_XP, MONSTERS, RARITIES, SKILL_LEVEL_XP, SKILL_MAX_LEVEL,
  SLOT_TYPES,
} from './config.js?v=0.9.20';
import { uid, clamp, randInt } from './utils.js';

function createCharacterId() {
  return globalThis.crypto?.randomUUID?.()
    || `character-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const EQUIP_AFFIXES = {
  weapon: ['atk', 'mag', 'crit'],
  armor: ['def', 'magDef', 'hp'],
  helmet: ['def', 'magDef', 'mp'],
  necklace: ['hp', 'mp', 'magDef'],
  bracelet: ['atk', 'mag', 'def'],
  ring: ['atk', 'mag', 'crit'],
};

const AFFIX_ROLLS = {
  atk: [1, 3],
  mag: [1, 3],
  def: [1, 2],
  magDef: [1, 2],
  hp: [8, 24],
  mp: [6, 18],
  crit: [0.005, 0.015],
};

export function createItemEntry(itemId, options = {}) {
  const item = ITEMS[itemId];
  if (!item) return { id: itemId, qty: 1 };
  if (!item.slot) return { id: itemId, qty: 1 };
  const maxDurability = item.durability || 8;
  const entry = {
    id: itemId,
    qty: 1,
    uid: uid(),
    durability: maxDurability,
    maxDurability,
    enhance: clamp(Number(options.enhance) || 0, 0, ENHANCE_MAX),
    bonus: {},
    luck: 0,
    curse: 0,
  };
  if (options.rollAffix !== false && Math.random() < (options.affixChance ?? 0.035)) {
    const pool = EQUIP_AFFIXES[item.slot] || ['hp'];
    const stat = pool[randInt(0, pool.length - 1)];
    const [min, max] = AFFIX_ROLLS[stat];
    entry.bonus[stat] = stat === 'crit'
      ? Math.round((min + Math.random() * (max - min)) * 1000) / 1000
      : randInt(min, max);
  }
  return entry;
}

export function normalizeItemEntry(entry, options = {}) {
  if (typeof entry === 'string') return createItemEntry(entry, { rollAffix: false });
  if (!entry?.id) return null;
  const item = ITEMS[entry.id];
  if (!item?.slot) return { id: entry.id, qty: Math.max(1, Number(entry.qty) || 1) };
  const maxDurability = Number(entry.maxDurability) || item.durability || 8;
  return {
    id: entry.id,
    qty: 1,
    uid: entry.uid || uid(),
    durability: clamp(Number(entry.durability ?? maxDurability), 0, maxDurability),
    maxDurability,
    enhance: clamp(Number(entry.enhance ?? options.enhance) || 0, 0, ENHANCE_MAX),
    bonus: { ...(entry.bonus || {}) },
    luck: clamp(Number(entry.luck) || 0, 0, 7),
    curse: clamp(Number(entry.curse) || 0, 0, 7),
  };
}

export class Effect {
  constructor(x, y, r, color, t = 0.35, kind = 'burst') {
    this.x = x; this.y = y; this.r = r; this.color = color;
    this.t = t; this.maxT = t; this.kind = kind;
    this.seed = Math.random() * 1000;
  }
}

export class FloatingText {
  constructor(x, y, text, color = '#fff') {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.t = 0.9; this.maxT = 0.9;
  }
}

export class Drop {
  constructor(x, y, itemId, gold = 0, options = {}) {
    this.id = uid();
    this.x = x; this.y = y;
    this.itemId = itemId;
    this.gold = gold;
    this.entry = options.entry || (itemId ? createItemEntry(itemId, options) : null);
    this.ownerId = options.ownerId ?? null;
    this.protectedUntil = options.protectedUntil || 0;
    this.droppedBy = options.droppedBy || null;
    this.alive = true;
    this.t = options.ttl || 120;
  }
}

export class Projectile {
  constructor(opts) {
    Object.assign(this, opts);
    this.id = uid();
    this.alive = true;
  }
}

export class Actor {
  constructor(opts) {
    this.id = uid();
    this.x = opts.x;
    this.y = opts.y;
    this.r = opts.r ?? 16;
    this.hp = opts.hp;
    this.maxHp = opts.hp;
    this.mp = opts.mp ?? 0;
    this.maxMp = opts.mp ?? 0;
    this.alive = true;
    this.target = null;
    this.moveGoal = null;
    this.attackCd = 0;
    this.name = opts.name;
    this.color = opts.color || '#fff';
    this.facing = 1;
    this.direction = 's';
    this.anim = 'idle';
    this.animT = 0;
    this.animFrame = 0;
    this.stun = 0;
    this.jumpT = 0;
    this.jumpMax = 0;
    this.jumpY = 0;
    this.running = false;
    this.attacking = false;
    this.combatAction = null;
  }
}

export class Player extends Actor {
  constructor(classId, name, x, y) {
    const def = CLASSES[classId];
    super({ x, y, r: 18, hp: def.base.hp, mp: def.base.mp, name, color: def.color });
    this.type = 'player';
    this.characterId = createCharacterId();
    this.classId = classId;
    this.def = def;
    this.level = 1;
    this.xp = 0;
    this.gold = 150;
    this.bag = [
      { id: 'hp_pot', qty: 10 },
      { id: 'mp_pot', qty: 8 },
      { id: 'recall', qty: 3 },
      createItemEntry('wood_sword', { rollAffix: false }),
    ];
    this.bagSize = 30;
    this.warehouse = [];
    this.warehouseSize = 40;
    this.equip = Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, null]));
    this.enhance = Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, 0]));
    this.selectedBag = -1;
    this.skillCd = [0, 0, 0, 0];
    this.skills = Object.fromEntries(def.skills.map((skill) => [
      skill.id,
      { learned: false, level: 0, exp: 0 },
    ]));
    this.boost = null;
    this.shieldT = 0;
    this.killCounts = {};
    this.questId = 'q_intro';
    this.questProgress = {};
    this.questReady = false;
    this.completedQuests = [];
    this.achievements = [];
    this.claimedAchievements = [];
    this.totalKills = 0;
    this.bounty = null;
    this.bountyCompletions = 0;
    this.sabacWins = 0;
    this.playTime = 0;
    this.blessingT = 0;
    this.bestCombo = 0;
    this.pkMode = 'peace';
    this.pkPoints = 0;
    this.crimeT = 0;
    this.playerKills = 0;
    this.deaths = 0;
    this.gatheringLevel = 1;
    this.gatheringExp = 0;
    this.gatheringCount = 0;
    this.pet = null;
    this.recalc();
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }

  recalc() {
    const b = this.def.base;
    const g = this.def.gain;
    const lv = this.level - 1;
    const bonus = { hp: 0, mp: 0, atk: 0, mag: 0, def: 0, magDef: 0, crit: 0, dodge: 0, lifesteal: 0 };
    for (const slotName of EQUIP_SLOTS) {
      const equipped = this.equip[slotName];
      const itemId = typeof equipped === 'string' ? equipped : equipped?.id;
      if (!itemId) continue;
      const it = ITEMS[itemId];
      if (!it?.stats) continue;
      if (typeof equipped === 'object' && equipped.durability <= 0) continue;
      const rarityPower = RARITIES[it.rarity || 'common']?.power || 1;
      const enhanceLevel = typeof equipped === 'object'
        ? (equipped.enhance || 0)
        : (this.enhance[slotName] || 0);
      const enhancePower = 1 + enhanceLevel * 0.075;
      for (const [k, v] of Object.entries(it.stats)) {
        const scaled = ['atk', 'mag', 'def', 'magDef', 'hp', 'mp'].includes(k) ? v * rarityPower * enhancePower : v;
        bonus[k] = (bonus[k] || 0) + scaled;
      }
      if (typeof equipped === 'object') {
        for (const [k, v] of Object.entries(equipped.bonus || {})) bonus[k] = (bonus[k] || 0) + v * enhancePower;
      }
    }
    this.maxHp = b.hp + g.hp * lv + (bonus.hp || 0);
    this.maxMp = b.mp + g.mp * lv + (bonus.mp || 0);
    this.atk = b.atk + g.atk * lv + (bonus.atk || 0);
    this.mag = b.mag + g.mag * lv + (bonus.mag || 0);
    this.defense = b.def + g.def * lv + (bonus.def || 0);
    this.magDef = b.magDef + g.magDef * lv + (bonus.magDef || 0);
    this.crit = clamp((b.crit || 0) + (g.crit || 0) * lv + (bonus.crit || 0) + (this.blessingT > 0 ? 0.05 : 0), 0, 0.65);
    this.dodge = clamp((b.dodge || 0) + (g.dodge || 0) * lv + (bonus.dodge || 0), 0, 0.4);
    this.lifesteal = clamp((b.lifesteal || 0) + (bonus.lifesteal || 0), 0, 0.3);
    this.weaponLuck = clamp(Number(this.equip.weapon?.luck) || 0, 0, 7);
    this.weaponCurse = clamp(Number(this.equip.weapon?.curse) || 0, 0, 7);
    this.range = b.range;
    this.ms = b.ms;
    this.as = b.as;
    this.hp = clamp(this.hp ?? this.maxHp, 0, this.maxHp);
    this.mp = clamp(this.mp ?? this.maxMp, 0, this.maxMp);
  }

  combatPower() {
    return Math.floor(
      this.maxHp * 0.35 + this.maxMp * 0.12 + this.atk * 12 + this.mag * 12
      + this.defense * 18 + this.magDef * 14 + this.crit * 1000 + this.dodge * 800 + this.lifesteal * 600,
    );
  }

  xpNeed() {
    return LEVEL_XP[this.level] || 999999;
  }

  skillDef(skillId) {
    return this.def.skills.find((skill) => skill.id === skillId) || null;
  }

  skillState(skillId) {
    return this.skills[skillId] || { learned: false, level: 0, exp: 0 };
  }

  skillLevel(skillId) {
    return this.skillState(skillId).level || 0;
  }

  canLearnSkill(skillId) {
    const skill = this.skillDef(skillId);
    if (!skill) return { ok: false, reason: 'class' };
    if (this.level < (skill.reqLevel || 1)) return { ok: false, reason: 'level', reqLevel: skill.reqLevel || 1 };
    if (this.skillState(skillId).learned) return { ok: false, reason: 'learned' };
    return { ok: true, skill };
  }

  learnSkill(skillId) {
    const result = this.canLearnSkill(skillId);
    if (!result.ok) return result;
    this.skills[skillId] = { learned: true, level: 1, exp: 0 };
    return { ok: true, skill: result.skill, level: 1 };
  }

  gainSkillExp(skillId, amount = 1) {
    const state = this.skills[skillId];
    if (!state?.learned || state.level >= SKILL_MAX_LEVEL) return { leveled: false, level: state?.level || 0 };
    state.exp += Math.max(0, amount);
    let leveled = false;
    while (state.level < SKILL_MAX_LEVEL && state.exp >= SKILL_LEVEL_XP[state.level + 1]) {
      state.level += 1;
      leveled = true;
    }
    return { leveled, level: state.level, exp: state.exp };
  }

  gatheringXpNeed() {
    return 12 + (this.gatheringLevel - 1) * 16;
  }

  gainGatheringExp(amount = 1) {
    this.gatheringExp += Math.max(0, amount);
    let leveled = false;
    while (this.gatheringLevel < 10 && this.gatheringExp >= this.gatheringXpNeed()) {
      this.gatheringExp -= this.gatheringXpNeed();
      this.gatheringLevel += 1;
      leveled = true;
    }
    this.gatheringCount += 1;
    return { leveled, level: this.gatheringLevel, exp: this.gatheringExp };
  }

  addXp(n) {
    if (this.level >= 50) return [];
    const leveled = [];
    this.xp += n;
    while (this.level < 50 && this.xp >= this.xpNeed()) {
      this.xp -= this.xpNeed();
      this.level += 1;
      const r = this.hp / this.maxHp;
      const m = this.mp / Math.max(1, this.maxMp);
      this.recalc();
      this.hp = this.maxHp * r;
      this.mp = this.maxMp * m;
      leveled.push(this.level);
    }
    return leveled;
  }

  addItem(itemId, qty = 1) {
    const stackable = ['consumable', 'quest', 'material'].includes(ITEMS[itemId]?.type);
    if (stackable) {
      const exist = this.bag.find((b) => b.id === itemId);
      if (exist) { exist.qty += qty; return true; }
    }
    for (let i = 0; i < qty; i++) {
      if (this.bag.length >= this.bagSize) return false;
      this.bag.push(createItemEntry(itemId));
    }
    return true;
  }

  addEntry(entry) {
    const normalized = normalizeItemEntry(entry);
    if (!normalized) return false;
    const item = ITEMS[normalized.id];
    const stackable = ['consumable', 'quest', 'material'].includes(item?.type);
    if (stackable) {
      const exist = this.bag.find((bagEntry) => bagEntry.id === normalized.id);
      if (exist) {
        exist.qty += normalized.qty;
        return true;
      }
    }
    if (this.bag.length >= this.bagSize) return false;
    this.bag.push(normalized);
    return true;
  }

  equipSlotFor(itemSlot) {
    const matches = EQUIP_SLOTS.filter((slot) => SLOT_TYPES[slot] === itemSlot);
    return matches.find((slot) => !this.equip[slot]) || matches[0] || null;
  }

  countItem(itemId) {
    return this.bag.filter((b) => b.id === itemId).reduce((s, b) => s + b.qty, 0);
  }

  removeItemId(itemId, qty = 1) {
    let left = qty;
    for (let i = this.bag.length - 1; i >= 0 && left > 0; i--) {
      if (this.bag[i].id !== itemId) continue;
      const take = Math.min(left, this.bag[i].qty);
      this.bag[i].qty -= take;
      left -= take;
      if (this.bag[i].qty <= 0) this.bag.splice(i, 1);
    }
    return left === 0;
  }

  removeBag(index, qty = 1) {
    const it = this.bag[index];
    if (!it) return null;
    it.qty -= qty;
    const id = it.id;
    if (it.qty <= 0) this.bag.splice(index, 1);
    return id;
  }

  serialize() {
    return {
      characterId: this.characterId,
      classId: this.classId,
      name: this.name,
      level: this.level,
      xp: this.xp,
      gold: this.gold,
      bag: this.bag,
      warehouse: this.warehouse,
      equip: this.equip,
      killCounts: this.killCounts,
      questId: this.questId,
      questProgress: this.questProgress,
      questReady: this.questReady,
      completedQuests: this.completedQuests,
      achievements: this.achievements,
      claimedAchievements: this.claimedAchievements,
      totalKills: this.totalKills,
      bounty: this.bounty,
      bountyCompletions: this.bountyCompletions,
      sabacWins: this.sabacWins,
      enhance: this.enhance,
      playTime: this.playTime,
      blessingT: this.blessingT,
      bestCombo: this.bestCombo,
      pkMode: this.pkMode,
      pkPoints: this.pkPoints,
      crimeT: this.crimeT,
      playerKills: this.playerKills,
      deaths: this.deaths,
      gatheringLevel: this.gatheringLevel,
      gatheringExp: this.gatheringExp,
      gatheringCount: this.gatheringCount,
      skills: this.skills,
      hp: this.hp,
      mp: this.mp,
    };
  }

  static fromSave(data, x, y) {
    const p = new Player(data.classId, data.name, x, y);
    Object.assign(p, {
      characterId: data.characterId || p.characterId,
      level: data.level,
      xp: data.xp,
      gold: data.gold,
      bag: (data.bag || []).map((entry) => normalizeItemEntry(entry)).filter(Boolean),
      warehouse: (data.warehouse || []).map((entry) => normalizeItemEntry(entry)).filter(Boolean),
      equip: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, normalizeItemEntry(data.equip?.[slot])])),
      killCounts: data.killCounts || {},
      questId: Object.hasOwn(data, 'questId') ? data.questId : 'q_intro',
      questProgress: data.questProgress || {},
      questReady: !!data.questReady,
      completedQuests: data.completedQuests || [],
      achievements: data.achievements || [],
      claimedAchievements: data.claimedAchievements || [],
      totalKills: data.totalKills ?? Object.values(data.killCounts || {}).reduce((sum, n) => sum + n, 0),
      bounty: data.bounty || null,
      bountyCompletions: Math.max(0, Number(data.bountyCompletions) || 0),
      sabacWins: Math.max(0, Number(data.sabacWins) || 0),
      enhance: Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, Number(data.enhance?.[slot]) || 0])),
      playTime: data.playTime || 0,
      blessingT: data.blessingT || 0,
      bestCombo: data.bestCombo || 0,
      pkMode: ['peace', 'team', 'guild', 'all'].includes(data.pkMode) ? data.pkMode : 'peace',
      pkPoints: Math.max(0, Number(data.pkPoints) || 0),
      crimeT: Math.max(0, Number(data.crimeT) || 0),
      playerKills: Math.max(0, Number(data.playerKills) || 0),
      deaths: Math.max(0, Number(data.deaths) || 0),
      gatheringLevel: Math.max(1, Math.min(10, Number(data.gatheringLevel) || 1)),
      gatheringExp: Math.max(0, Number(data.gatheringExp) || 0),
      gatheringCount: Math.max(0, Number(data.gatheringCount) || 0),
      skills: data.skills || Object.fromEntries(
        p.def.skills.map((skill) => [
          skill.id,
          data.level >= (skill.reqLevel || 1)
            ? { learned: true, level: 1, exp: 0 }
            : { learned: false, level: 0, exp: 0 },
        ]),
      ),
    });
    if (data.equip?.ring && !p.equip.ringLeft) {
      p.equip.ringLeft = normalizeItemEntry(data.equip.ring, {
        enhance: Number(data.enhance?.ring) || 0,
      });
      p.equip.ringLeft.enhance = Number(data.enhance?.ring) || p.equip.ringLeft.enhance || 0;
    }
    for (const slot of EQUIP_SLOTS) {
      const entry = p.equip[slot];
      if (entry && !entry.enhance && data.enhance?.[slot]) entry.enhance = Number(data.enhance[slot]) || 0;
      p.enhance[slot] = entry?.enhance || 0;
    }
    for (const skill of p.def.skills) {
      const state = p.skills[skill.id] || {};
      p.skills[skill.id] = {
        learned: !!state.learned,
        level: Math.max(0, Math.min(SKILL_MAX_LEVEL, Number(state.level) || (state.learned ? 1 : 0))),
        exp: Math.max(0, Number(state.exp) || 0),
      };
    }
    p.recalc();
    p.hp = data.hp ?? p.maxHp;
    p.mp = data.mp ?? p.maxMp;
    return p;
  }
}

export class Monster extends Actor {
  constructor(kind, x, y) {
    const def = MONSTERS[kind];
    super({ x, y, r: def.elite ? 22 : 16, hp: def.hp, name: def.name, color: '#c0392b' });
    this.type = 'monster';
    this.kind = kind;
    this.def = def;
    this.atk = def.atk;
    this.mag = def.mag || 0;
    this.defense = def.def;
    this.magDef = def.magDef || 0;
    this.ms = def.ms;
    this.range = def.range;
    this.aggro = def.aggro;
    this.home = { x, y };
    this.respawnAt = 0;
    this.deathUntil = 0;
    this.wanderT = Math.random() * 3;
    this.poison = null;
    this.elite = !!def.elite;
    this.boss = !!def.boss;
    this.behavior = def.behavior || 'soldier';
    this.abilityCd = this.boss ? 4 : 0;
    this.enraged = false;
  }

  rollDrop() {
    const gold = randInt(this.def.gold[0], this.def.gold[1]);
    const items = [];
    for (const d of this.def.drops) {
      if (Math.random() < d.rate) items.push(d.id);
    }
    return { gold, items };
  }
}

export class Pet extends Actor {
  constructor(owner) {
    super({
      x: owner.x - 30, y: owner.y, r: 14, hp: 80 + owner.level * 12,
      name: '召唤骷髅', color: '#bbb',
    });
    this.type = 'pet';
    this.ownerId = owner.id;
    this.atk = 8 + owner.level * 1.5 + owner.mag * 0.4;
    this.defense = 3;
    this.ms = 150;
    this.range = 48;
    this.as = 1.1;
    this.kind = 'skeleton';
    this.skillLevel = Math.max(1, owner.skillLevel?.('summon') || 1);
    this.atk *= 1 + (this.skillLevel - 1) * 0.22;
    this.maxHp *= 1 + (this.skillLevel - 1) * 0.2;
    this.hp = this.maxHp;
    this.ttl = 35 + this.skillLevel * 15;
  }
}

export class Npc {
  constructor(cfg) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.x = cfg.x;
    this.y = cfg.y;
    this.action = cfg.action;
    this.sprite = cfg.sprite || 'healer';
    this.r = 18;
    this.animOffset = [...this.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) * 0.07;
  }
}
