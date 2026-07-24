import { CLASSES, EQUIP_SLOTS, ITEMS, LEVEL_XP, MONSTERS, RARITIES } from './config.js';
import { uid, clamp, randInt } from './utils.js';

export class Effect {
  constructor(x, y, r, color, t = 0.35, kind = 'burst') {
    this.x = x; this.y = y; this.r = r; this.color = color;
    this.t = t; this.maxT = t; this.kind = kind;
  }
}

export class FloatingText {
  constructor(x, y, text, color = '#fff') {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.t = 0.9; this.maxT = 0.9;
  }
}

export class Drop {
  constructor(x, y, itemId, gold = 0) {
    this.id = uid();
    this.x = x; this.y = y;
    this.itemId = itemId;
    this.gold = gold;
    this.alive = true;
    this.t = 90;
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
    this.anim = 'idle';
    this.animT = 0;
    this.animFrame = 0;
    this.stun = 0;
    this.jumpT = 0;
    this.jumpMax = 0;
    this.jumpY = 0;
    this.running = false;
    this.attacking = false;
  }
}

export class Player extends Actor {
  constructor(classId, name, x, y) {
    const def = CLASSES[classId];
    super({ x, y, r: 18, hp: def.base.hp, mp: def.base.mp, name, color: def.color });
    this.type = 'player';
    this.classId = classId;
    this.def = def;
    this.level = 1;
    this.xp = 0;
    this.gold = 150;
    this.bag = [
      { id: 'hp_pot', qty: 10 },
      { id: 'mp_pot', qty: 8 },
      { id: 'recall', qty: 3 },
      { id: 'wood_sword', qty: 1 },
    ];
    this.bagSize = 30;
    this.warehouse = [];
    this.warehouseSize = 40;
    this.equip = { weapon: null, armor: null, ring: null, necklace: null, helmet: null };
    this.enhance = { weapon: 0, armor: 0, ring: 0, necklace: 0, helmet: 0 };
    this.selectedBag = -1;
    this.skillCd = [0, 0, 0, 0];
    this.boost = null;
    this.shieldT = 0;
    this.killCounts = {};
    this.questId = 'q_intro';
    this.questProgress = {};
    this.completedQuests = [];
    this.achievements = [];
    this.claimedAchievements = [];
    this.totalKills = 0;
    this.playTime = 0;
    this.blessingT = 0;
    this.bestCombo = 0;
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
      const itemId = typeof this.equip[slotName] === 'string' ? this.equip[slotName] : this.equip[slotName]?.id;
      if (!itemId) continue;
      const it = ITEMS[itemId];
      if (!it?.stats) continue;
      const rarityPower = RARITIES[it.rarity || 'common']?.power || 1;
      const enhancePower = 1 + (this.enhance[slotName] || 0) * 0.075;
      for (const [k, v] of Object.entries(it.stats)) {
        const scaled = ['atk', 'mag', 'def', 'magDef', 'hp', 'mp'].includes(k) ? v * rarityPower * enhancePower : v;
        bonus[k] = (bonus[k] || 0) + scaled;
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
    if (this.bag.length >= this.bagSize) return false;
    this.bag.push({ id: itemId, qty });
    return true;
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
      completedQuests: this.completedQuests,
      achievements: this.achievements,
      claimedAchievements: this.claimedAchievements,
      totalKills: this.totalKills,
      enhance: this.enhance,
      playTime: this.playTime,
      blessingT: this.blessingT,
      bestCombo: this.bestCombo,
      hp: this.hp,
      mp: this.mp,
    };
  }

  static fromSave(data, x, y) {
    const p = new Player(data.classId, data.name, x, y);
    Object.assign(p, {
      level: data.level,
      xp: data.xp,
      gold: data.gold,
      bag: data.bag || [],
      warehouse: data.warehouse || [],
      equip: { weapon: null, armor: null, ring: null, necklace: null, helmet: null, ...data.equip },
      killCounts: data.killCounts || {},
      questId: data.questId || 'q_intro',
      questProgress: data.questProgress || {},
      completedQuests: data.completedQuests || [],
      achievements: data.achievements || [],
      claimedAchievements: data.claimedAchievements || [],
      totalKills: data.totalKills ?? Object.values(data.killCounts || {}).reduce((sum, n) => sum + n, 0),
      enhance: { weapon: 0, armor: 0, ring: 0, necklace: 0, helmet: 0, ...(data.enhance || {}) },
      playTime: data.playTime || 0,
      blessingT: data.blessingT || 0,
      bestCombo: data.bestCombo || 0,
    });
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
    this.defense = def.def;
    this.magDef = def.magDef || 0;
    this.ms = def.ms;
    this.range = def.range;
    this.aggro = def.aggro;
    this.home = { x, y };
    this.respawnAt = 0;
    this.wanderT = Math.random() * 3;
    this.poison = null;
    this.elite = !!def.elite;
    this.boss = !!def.boss;
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
    this.ttl = 45;
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
  }
}
