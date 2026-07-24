import {
  ACHIEVEMENTS, CLASSES, ENHANCE_MAX, ITEMS, MAPS, MONSTERS, QUESTS, RARITIES,
  SCENERY, SHOP_TOWN, TILES, WORLD, enhanceCost,
} from './config.js';
import { clamp, dist, dist2, moveToward, loadImage, randInt } from './utils.js';
import { Player, Monster, Npc, Drop, Projectile, Effect, FloatingText, Pet } from './entities.js';
import { saveGame, loadGame } from './save.js';
import { pickPlayerAnim, animFps, ANIM_ACTIONS } from './anim.js';

const T = WORLD.tile;

export { pickPlayerAnim, animFps, ANIM_ACTIONS };

export class Game {
  constructor(canvas, assets, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assets = assets;
    this.onHint = opts.onHint || (() => {});
    this.onDeath = opts.onDeath || (() => {});
    this.onQuest = opts.onQuest || (() => {});
    this.onHud = opts.onHud || (() => {});
    this.onLog = opts.onLog || (() => {});
    this.onSfx = opts.onSfx || (() => {});
    this.onAchievement = opts.onAchievement || (() => {});

    this.mapId = 'bich';
    this.monsters = [];
    this.npcs = [];
    this.drops = [];
    this.projectiles = [];
    this.effects = [];
    this.floats = [];
    this.hazards = [];
    this.portals = [];
    this.cam = { x: 0, y: 0 };
    this.time = 0;
    this.paused = false;
    this.saveTimer = 0;
    this.combo = 0;
    this.comboT = 0;
    this.shake = 0;
    /** @type {{ run: boolean, moveX: number, moveY: number }} */
    this.input = { run: false, moveX: 0, moveY: 0 };

    const start = MAPS.bich.playerStart;
    if (opts.save) {
      this.player = Player.fromSave(opts.save.player, start.x * T, start.y * T);
      this.mapId = opts.save.mapId || 'bich';
      this.loadMap(this.mapId, opts.save.px / T, opts.save.py / T);
    } else {
      this.player = new Player(opts.classId, opts.name || '英雄', start.x * T, start.y * T);
      this.loadMap('bich');
    }
    this.resize();
    this.checkAchievements();
    this.onQuest?.();
  }

  get map() { return MAPS[this.mapId]; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(innerWidth * dpr);
    this.canvas.height = Math.floor(innerHeight * dpr);
    this.canvas.style.width = `${innerWidth}px`;
    this.canvas.style.height = `${innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = innerWidth;
    this.viewH = innerHeight;
  }

  worldToScreen(x, y) {
    return { x: x - this.cam.x + this.viewW / 2, y: y - this.cam.y + this.viewH / 2 };
  }

  screenToWorld(sx, sy) {
    return { x: sx + this.cam.x - this.viewW / 2, y: sy + this.cam.y - this.viewH / 2 };
  }

  blocked(x, y) {
    const col = Math.floor(x / T);
    const row = Math.floor(y / T);
    const g = this.walkGrid || this.map.grid;
    if (row < 0 || col < 0 || row >= WORLD.rows || col >= WORLD.cols) return true;
    return g[row][col] === 1;
  }

  /** 按目标点更新左右朝向（仅水平位移足够时） */
  faceToward(ent, tx) {
    const dx = tx - ent.x;
    if (Math.abs(dx) > 0.8) ent.facing = dx > 0 ? 1 : -1;
  }

  tryMove(ent, nx, ny) {
    const ox = ent.x;
    const r = ent.r * 0.6;
    let moved = false;
    if (!this.blocked(nx, ny) && !this.blocked(nx + r, ny) && !this.blocked(nx - r, ny)
      && !this.blocked(nx, ny + r) && !this.blocked(nx, ny - r)) {
      ent.x = nx; ent.y = ny;
      moved = true;
    } else if (!this.blocked(nx, ent.y) && !this.blocked(nx + r, ent.y) && !this.blocked(nx - r, ent.y)) {
      ent.x = nx;
      moved = true;
    } else if (!this.blocked(ent.x, ny) && !this.blocked(ent.x, ny + r) && !this.blocked(ent.x, ny - r)) {
      ent.y = ny;
      moved = true;
    }
    // 以真实水平位移决定朝向，贴墙滑行也正确
    if (Math.abs(ent.x - ox) > 0.05) ent.facing = ent.x > ox ? 1 : -1;
    return moved;
  }

  loadMap(id, tx, ty) {
    this.mapId = id;
    const m = MAPS[id];
    // 深拷贝格子，避免装饰占格污染原配置
    this.walkGrid = m.grid.map((row) => row.slice());
    this.roadSet = new Set((m.roads || []).map((r) => `${r.x},${r.y}`));
    this.decors = (m.decors || []).map((d) => {
      const def = SCENERY[d.id] || {};
      return {
        id: d.id,
        x: d.x * T,
        y: d.y * T,
        h: d.h || def.h || 64,
        anchor: def.anchor ?? 0.94,
        block: !!def.block,
      };
    });
    // 阻挡型装饰占一格（不挡主路）
    for (const d of this.decors) {
      if (!d.block) continue;
      const col = Math.floor(d.x / T);
      const row = Math.floor(d.y / T);
      if (row <= 0 || col <= 0 || row >= WORLD.rows - 1 || col >= WORLD.cols - 1) continue;
      if (this.roadSet.has(`${col},${row}`)) continue;
      this.walkGrid[row][col] = 1;
    }

    this.npcs = m.npcs.map((n) => new Npc({ ...n, x: n.x * T, y: n.y * T }));
    this.portals = m.portals.map((p) => ({ ...p, x: p.x * T, y: p.y * T }));
    this.monsters = [];
    this.drops = [];
    this.projectiles = [];
    this.effects = [];
    this.hazards = [];
    if (this.player.pet) this.player.pet = null;

    for (const sp of m.spawns) {
      for (let i = 0; i < sp.count; i++) {
        let x, y, tries = 0;
        do {
          const ang = Math.random() * Math.PI * 2;
          const rr = Math.random() * sp.r * T;
          x = sp.x * T + Math.cos(ang) * rr;
          y = sp.y * T + Math.sin(ang) * rr;
          tries++;
        } while (this.blocked(x, y) && tries < 20);
        if (!this.blocked(x, y)) this.monsters.push(new Monster(sp.monster, x, y));
      }
    }
    if (tx != null) {
      this.player.x = tx * T;
      this.player.y = ty * T;
    } else {
      this.player.x = m.playerStart.x * T;
      this.player.y = m.playerStart.y * T;
    }
    this.player.moveGoal = null;
    this.player.target = null;
    this.onHint?.(m.name);
    this.log(`进入 ${m.name}`, 'zone');
    this.onSfx?.('portal');
    this.persist();
  }

  log(message, type = 'system') {
    this.onLog?.({ message, type, time: this.time });
  }

  spawnEffect(x, y, r, color, t, kind) {
    this.effects.push(new Effect(x, y, r, color, t, kind));
  }

  float(x, y, text, color) {
    this.floats.push(new FloatingText(x, y, text, color));
  }

  applyDamage(attacker, target, amount, magical = false) {
    if (!target.alive || amount <= 0) return 0;
    if (target.type === 'player' && Math.random() < (target.dodge || 0)) {
      this.float(target.x, target.y - 30, '闪避', '#8ff0ff');
      this.onSfx?.('dodge');
      return 0;
    }
    let dmg = amount;
    if (target.type === 'player' && target.shieldT > 0) dmg *= 0.45;
    if (magical) dmg = Math.max(1, dmg - (target.magDef || 0) * 0.65);
    else dmg = Math.max(1, dmg - (target.defense || 0) * 0.7);

    if (attacker?.boost?.id === 'thrust' && !magical) dmg += 10 + (attacker.level || 1) * 2;
    if (attacker?.boost?.id === 'fire_sword' && !magical) dmg *= 2.5;
    if (attacker?.boost && (attacker.boost.id === 'thrust' || attacker.boost.id === 'fire_sword')) {
      attacker.boost = null;
    }
    if (attacker?.classId === 'warrior' && !magical) dmg *= 1.08;
    const crit = attacker?.type === 'player' && Math.random() < (attacker.crit || 0);
    if (crit) dmg *= 1.75;

    dmg = Math.round(dmg);
    target.hp -= dmg;
    target.hitT = 0.16;
    this.shake = Math.min(12, this.shake + (crit ? 6 : target.elite ? 3 : 1.5));
    this.spawnEffect(target.x, target.y - 10, 16, magical ? '#5dade2' : '#e74c3c', 0.2);
    this.float(target.x, target.y - 30, `${crit ? '暴击 ' : ''}-${dmg}`, crit ? '#ffd866' : magical ? '#5dade2' : '#ff6b6b');
    if (attacker?.type === 'player' && attacker.lifesteal > 0) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + dmg * attacker.lifesteal);
    }
    this.onSfx?.(crit ? 'crit' : 'hit');
    if (target.hp <= 0) {
      target.hp = 0;
      this.kill(attacker, target);
    }
    return dmg;
  }

  onKillQuest(kind) {
    const p = this.player;
    p.killCounts[kind] = (p.killCounts[kind] || 0) + 1;
    const q = QUESTS.find((x) => x.id === p.questId);
    if (!q) return;
    for (const step of q.steps) {
      if (step.type === 'kill' && step.monster === kind) {
        p.questProgress[kind] = (p.questProgress[kind] || 0) + 1;
        this.onHint?.(`任务进度 ${MONSTERS[kind].name} ${p.questProgress[kind]}/${step.count}`);
      }
    }
    this.checkQuestComplete();
  }

  checkQuestComplete() {
    const p = this.player;
    const q = QUESTS.find((x) => x.id === p.questId);
    if (!q || q.steps.some((s) => s.type === 'talk')) return;
    let done = true;
    for (const step of q.steps) {
      if (step.type === 'kill' && (p.questProgress[step.monster] || 0) < step.count) done = false;
      if (step.type === 'collect' && p.countItem(step.item) < step.count) done = false;
    }
    if (done) {
      this.completeQuest(q);
    }
  }

  completeQuest(q) {
    const p = this.player;
    if (p.completedQuests.includes(q.id)) return;
    // take collect items
    for (const step of q.steps) {
      if (step.type === 'collect') p.removeItemId(step.item, step.count);
    }
    p.completedQuests.push(q.id);
    const r = q.reward;
    const leveled = p.addXp(r.xp);
    p.gold += r.gold;
    for (const it of r.items || []) p.addItem(it.id, it.qty);
    this.onHint?.(`任务完成：${q.name}  +${r.xp}经验 +${r.gold}金`);
    this.float(p.x, p.y - 40, '任务完成!', '#f1c40f');
    this.log(`完成任务「${q.name}」 · +${r.xp} 经验 · +${r.gold} 金币`, 'quest');
    this.onSfx?.('quest');
    if (leveled.length) this.onSfx?.('level');
    if (q.next) {
      p.questId = q.next;
      p.questProgress = {};
      const nq = QUESTS.find((x) => x.id === q.next);
      this.onHint?.(`新任务：${nq.name}`);
    } else {
      p.questId = null;
      this.onHint?.('你已完成主线任务！继续刷装挑战寺庙吧。');
    }
    this.onQuest?.();
    this.checkAchievements();
    this.persist();
  }

  checkAchievements() {
    const p = this.player;
    for (const a of ACHIEVEMENTS) {
      if (p.achievements.includes(a.id) || !a.check(p)) continue;
      p.achievements.push(a.id);
      this.onAchievement?.(a);
      this.onHint?.(`成就解锁：${a.name}`);
      this.log(`成就解锁「${a.name}」`, 'achievement');
      this.onSfx?.('achievement');
    }
  }

  claimAchievement(id) {
    const p = this.player;
    const a = ACHIEVEMENTS.find((entry) => entry.id === id);
    if (!a || !p.achievements.includes(id) || p.claimedAchievements.includes(id)) return false;
    p.claimedAchievements.push(id);
    p.gold += a.reward;
    this.onHint?.(`领取成就奖励 +${a.reward} 金币`);
    this.log(`领取「${a.name}」奖励 ${a.reward} 金币`, 'loot');
    this.persist();
    return true;
  }

  talkQuest(npcId) {
    const p = this.player;
    const q = QUESTS.find((x) => x.id === p.questId);
    if (!q) {
      this.onHint?.('卫士队长：继续变强，玛法需要你。');
      return;
    }
    if (q.giver !== npcId && !q.steps.some((s) => s.type === 'talk' && s.npc === npcId)) {
      this.onHint?.(`${q.name}：${q.desc}`);
      return;
    }
    const talkStep = q.steps.find((s) => s.type === 'talk');
    if (talkStep) {
      this.onHint?.(talkStep.text);
      this.completeQuest(q);
      return;
    }
    // hand-in check for kill/collect
    let done = true;
    for (const step of q.steps) {
      if (step.type === 'kill' && (p.questProgress[step.monster] || 0) < step.count) done = false;
      if (step.type === 'collect' && p.countItem(step.item) < step.count) done = false;
    }
    if (done) this.completeQuest(q);
    else this.onHint?.(`${q.name}：${q.desc}`);
    this.onQuest?.();
  }

  kill(killer, victim) {
    if (!victim.alive) return;
    victim.alive = false;
    if (victim.type === 'monster') {
      const loot = victim.rollDrop();
      if (loot.gold > 0) this.drops.push(new Drop(victim.x, victim.y, null, loot.gold));
      for (const id of loot.items) {
        this.drops.push(new Drop(victim.x + randInt(-14, 14), victim.y + randInt(-14, 14), id, 0));
      }
      if (killer?.type === 'player' || killer?.type === 'pet') {
        const p = this.player;
        p.totalKills += 1;
        const lvDiff = (victim.def.level || 1) - p.level;
        let xp = victim.def.xp;
        if (lvDiff < -8) xp = Math.floor(xp * 0.25);
        else if (lvDiff < -4) xp = Math.floor(xp * 0.55);
        const leveled = p.addXp(xp);
        this.combo = this.comboT > 0 ? this.combo + 1 : 1;
        this.comboT = 5;
        p.bestCombo = Math.max(p.bestCombo, this.combo);
        this.onHint?.(`${victim.name} 被击杀 +${xp}经验`);
        this.log(`击败 ${victim.name} · +${xp} 经验${this.combo >= 3 ? ` · ${this.combo} 连斩` : ''}`, 'combat');
        if (leveled.length) {
          this.onHint?.(`升级！当前 ${p.level} 级`);
          this.spawnEffect(p.x, p.y, 72, '#ffd866', 0.9, 'ring');
          this.onSfx?.('level');
        }
        this.onKillQuest(victim.kind);
        this.checkAchievements();
      }
      const delay = victim.elite ? 60 : 14 + Math.random() * 10;
      victim.respawnAt = this.time + delay;
      this.onSfx?.(victim.boss ? 'bossDown' : 'kill');
    }
    if (victim.type === 'pet') {
      this.player.pet = null;
    }
    if (victim.type === 'player') {
      victim.xp = Math.max(0, victim.xp - Math.floor(victim.xpNeed() * 0.1));
      this.onDeath?.();
      this.persist();
    }
  }

  tryAttack(attacker, target) {
    if (!attacker.alive || !target?.alive) return;
    if (attacker.stun > 0) return;
    if (attacker.attackCd > 0) return;
    const range = (attacker.range || 50) + target.r;
    if (dist(attacker, target) > range + 8) return;
    attacker.attackCd = 1 / Math.max(0.5, attacker.as || 1);
    if (attacker.x !== target.x) attacker.facing = target.x > attacker.x ? 1 : -1;
    attacker.anim = 'attack';
    attacker.animT = 0.4;
    attacker.animFrame = 0;
    if (attacker.type === 'player') attacker.attacking = true;

    if (attacker.type === 'player' && attacker.classId !== 'warrior' && attacker.range > 80) {
      this.projectiles.push(new Projectile({
        x: attacker.x, y: attacker.y, targetId: target.id,
        speed: 440, damage: Math.max(5, attacker.mag * 0.6 + attacker.atk * 0.25),
        magical: true, color: attacker.color, sourceId: attacker.id,
      }));
      return;
    }
    const dmg = (attacker.atk || 5) + randInt(0, 4);
    this.applyDamage(attacker, target, dmg, false);
  }

  castSkill(slot) {
    const p = this.player;
    if (!p.alive || this.paused) return;
    const sk = p.def.skills[slot];
    if (!sk || sk.type === 'passive') return;
    if (p.skillCd[slot] > 0) return;
    if (p.mp < sk.mana) { this.onHint?.('魔法不足'); return; }
    this.onSfx?.('skill');

    if (sk.type === 'boost') {
      p.mp -= sk.mana; p.skillCd[slot] = sk.cd;
      p.boost = { id: sk.id, t: 5 };
      this.onHint?.(`${sk.name} 就绪`);
      return;
    }
    if (sk.type === 'heal') {
      p.mp -= sk.mana; p.skillCd[slot] = sk.cd;
      const heal = 50 + p.mag * 2.4 + p.level * 4;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.spawnEffect(p.x, p.y, 44, '#2ecc71', 0.5);
      this.float(p.x, p.y - 28, `+${Math.floor(heal)}`, '#2ecc71');
      return;
    }
    if (sk.type === 'buff') {
      p.mp -= sk.mana; p.skillCd[slot] = sk.cd;
      p.shieldT = 8;
      this.spawnEffect(p.x, p.y, 50, '#8e44ad', 0.6, 'ring');
      this.onHint?.('魔法盾开启');
      return;
    }
    if (sk.type === 'summon') {
      p.mp -= sk.mana; p.skillCd[slot] = sk.cd;
      p.pet = new Pet(p);
      this.onHint?.('召唤骷髅！');
      return;
    }
    if (sk.type === 'dash') {
      let target = p.target && p.target.alive ? p.target : this.nearestMonster(p, sk.range);
      if (!target) { this.onHint?.('需要目标'); return; }
      p.mp -= sk.mana; p.skillCd[slot] = sk.cd;
      this.faceToward(p, target.x);
      const ang = Math.atan2(target.y - p.y, target.x - p.x);
      const distTo = Math.min(sk.range, dist(p, target) - target.r - 4);
      const nx = p.x + Math.cos(ang) * distTo;
      const ny = p.y + Math.sin(ang) * distTo;
      this.tryMove(p, nx, ny);
      this.applyDamage(p, target, 12 + p.atk * 0.8, false);
      target.stun = 1.2;
      this.spawnEffect(target.x, target.y, 40, '#e67e22', 0.35, 'ring');
      p.anim = 'attack'; p.animT = 0.45; p.attacking = true; p.animFrame = 0;
      return;
    }

    let target = p.target;
    if ((!target || !target.alive) && (sk.type === 'missile' || sk.type === 'target' || sk.type === 'aoe')) {
      target = this.nearestMonster(p, sk.range || p.range);
      p.target = target;
    }
    if ((sk.type === 'missile' || sk.type === 'target') && (!target || !target.alive)) {
      this.onHint?.('需要目标');
      return;
    }
    if (sk.range && target && dist(p, target) > sk.range + target.r) {
      this.onHint?.('距离不够');
      p.moveGoal = { x: target.x, y: target.y };
      return;
    }

    p.mp -= sk.mana;
    p.skillCd[slot] = sk.cd;
    p.anim = 'attack';
    p.animT = 0.45;
    p.attacking = true;
    p.animFrame = 0;

    if (sk.type === 'missile') {
      const dmg = sk.id === 'talisman' ? 14 + p.mag * 1.5 + p.level : 12 + p.mag * 1.7 + p.level * 1.3;
      this.projectiles.push(new Projectile({
        x: p.x, y: p.y, targetId: target.id, speed: 480,
        damage: dmg, magical: true, color: sk.id === 'talisman' ? '#f1c40f' : '#e67e22',
        sourceId: p.id,
      }));
    } else if (sk.type === 'target') {
      if (sk.id === 'lightning') {
        this.applyDamage(p, target, 26 + p.mag * 2.4 + p.level * 2.2, true);
        this.spawnEffect(target.x, target.y, 55, '#5dade2', 0.45, 'ring');
      } else if (sk.id === 'poison') {
        target.poison = { dps: 10 + p.mag * 0.5, t: 7 };
        this.applyDamage(p, target, 8 + p.mag * 0.6, true);
        this.spawnEffect(target.x, target.y, 32, '#27ae60', 0.4);
      }
    } else if (sk.type === 'aoe') {
      const pt = target || p;
      const dmg = 22 + p.mag * 2.0 + p.level;
      this.spawnEffect(pt.x, pt.y, sk.radius, '#5dade2', 0.55, 'ring');
      for (const m of this.monsters) {
        if (!m.alive) continue;
        if (dist(m, pt) <= sk.radius + m.r) this.applyDamage(p, m, dmg, true);
      }
    }
  }

  nearestMonster(from, range) {
    let best = null; let bestD = range * range;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const d = dist2(from, m);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  useHotPotion(kind) {
    const p = this.player;
    const order = kind === 'hp' ? ['hp_pot_b', 'hp_pot'] : ['mp_pot_b', 'mp_pot'];
    for (const id of order) {
      const idx = p.bag.findIndex((b) => b.id === id);
      if (idx >= 0) {
        p.selectedBag = idx;
        this.useSelectedItem();
        return;
      }
    }
    this.onHint?.(kind === 'hp' ? '没有金创药' : '没有魔法药');
  }

  useSelectedItem() {
    const p = this.player;
    const idx = p.selectedBag;
    if (idx < 0 || idx >= p.bag.length) return;
    const entry = p.bag[idx];
    const it = ITEMS[entry.id];
    if (!it) return;
    if (it.type === 'quest') { this.onHint?.('任务物品不可使用'); return; }
    if (it.type === 'consumable') {
      if (it.use.hp) { p.hp = Math.min(p.maxHp, p.hp + it.use.hp); this.float(p.x, p.y - 24, `+${it.use.hp}`, '#e74c3c'); }
      if (it.use.mp) { p.mp = Math.min(p.maxMp, p.mp + it.use.mp); this.float(p.x, p.y - 24, `+${it.use.mp}`, '#3498db'); }
      if (it.use.blessing) {
        p.blessingT = Math.max(p.blessingT, it.use.blessing);
        p.recalc();
        this.spawnEffect(p.x, p.y, 54, '#ffd866', 0.7, 'ring');
      }
      if (it.use.town) this.loadMap('bich');
      p.removeBag(idx, 1);
      p.selectedBag = -1;
      this.onHint?.(`使用 ${it.name}`);
      this.onSfx?.('potion');
      this.persist();
      return;
    }
    if (it.slot) {
      if (it.reqLevel && p.level < it.reqLevel) { this.onHint?.(`需要 ${it.reqLevel} 级`); return; }
      if (it.classes && !it.classes.includes(p.classId)) { this.onHint?.(`${p.def.name}无法装备 ${it.name}`); return; }
      const prev = p.equip[it.slot];
      p.equip[it.slot] = entry.id;
      p.removeBag(idx, 1);
      if (prev) p.addItem(prev, 1);
      p.recalc();
      p.selectedBag = -1;
      this.onHint?.(`装备 ${it.name}`);
      this.log(`装备 ${it.name}`, 'gear');
      this.onSfx?.('equip');
      this.checkAchievements();
      this.persist();
    }
  }

  enhanceSlot(slot) {
    const p = this.player;
    const id = p.equip[slot];
    if (!this.map.safe) { this.onHint?.('请回到比奇城强化'); return { ok: false, reason: 'unsafe' }; }
    if (!id) { this.onHint?.('该部位没有装备'); return { ok: false, reason: 'empty' }; }
    const level = p.enhance[slot] || 0;
    if (level >= ENHANCE_MAX) { this.onHint?.('已达到最高强化'); return { ok: false, reason: 'max' }; }
    const cost = enhanceCost(level);
    if (p.gold < cost.gold) { this.onHint?.('强化金币不足'); return { ok: false, reason: 'gold' }; }
    if (p.countItem('black_iron') < cost.ore) { this.onHint?.(`需要黑铁矿石 x${cost.ore}`); return { ok: false, reason: 'ore' }; }
    p.gold -= cost.gold;
    if (cost.ore) p.removeItemId('black_iron', cost.ore);
    const success = Math.random() <= cost.rate;
    if (success) {
      p.enhance[slot] = level + 1;
      p.recalc();
      this.onHint?.(`强化成功！${ITEMS[id].name} +${level + 1}`);
      this.log(`${ITEMS[id].name} 强化至 +${level + 1}`, 'forge');
      this.onSfx?.('forge');
      this.checkAchievements();
    } else {
      if (level >= 7) p.enhance[slot] = Math.max(5, level - 1);
      p.recalc();
      this.onHint?.(level >= 7 ? `强化失败，降至 +${p.enhance[slot]}` : '强化失败，等级不变');
      this.onSfx?.('forgeFail');
    }
    this.persist();
    return { ok: success, level: p.enhance[slot], cost };
  }

  unequip(slot) {
    const p = this.player;
    const id = p.equip[slot];
    if (!id) return;
    if (!p.addItem(id, 1)) { this.onHint?.('背包已满'); return; }
    p.equip[slot] = null;
    p.recalc();
    this.persist();
  }

  sellSelected() {
    const p = this.player;
    if (!this.map.safe) { this.onHint?.('请回城出售'); return; }
    const idx = p.selectedBag;
    if (idx < 0) return;
    const entry = p.bag[idx];
    const it = ITEMS[entry.id];
    if (!it || it.type === 'quest') { this.onHint?.('不可出售'); return; }
    const gain = it.sell * entry.qty;
    p.gold += gain;
    p.bag.splice(idx, 1);
    p.selectedBag = -1;
    this.onHint?.(`出售获得 ${gain} 金`);
    this.persist();
  }

  buyItem(itemId) {
    const p = this.player;
    if (!this.map.safe) return;
    const it = ITEMS[itemId];
    if (!it || p.gold < it.price) { this.onHint?.('金币不足'); return; }
    if (!p.addItem(itemId, 1)) { this.onHint?.('背包已满'); return; }
    p.gold -= it.price;
    this.onHint?.(`购买 ${it.name}`);
    this.onSfx?.('buy');
    this.persist();
  }

  depositSelected() {
    const p = this.player;
    if (!this.map.safe) return;
    const idx = p.selectedBag;
    if (idx < 0) return;
    if (p.warehouse.length >= p.warehouseSize) { this.onHint?.('仓库已满'); return; }
    const entry = p.bag.splice(idx, 1)[0];
    p.warehouse.push(entry);
    p.selectedBag = -1;
    this.onHint?.('已存入仓库');
    this.persist();
  }

  withdrawWarehouse(i) {
    const p = this.player;
    if (!this.map.safe) return;
    const entry = p.warehouse[i];
    if (!entry) return;
    if (!p.addItem(entry.id, entry.qty)) { this.onHint?.('背包已满'); return; }
    // addItem may stack differently — remove and re-add carefully
    p.warehouse.splice(i, 1);
    // if addItem stacked consumable into existing, we already added qty; if new, ok
    // Wait - addItem always adds. So we duplicated if we didn't remove first. We removed first. Good.
    // Actually: we splice then addItem - correct.
    this.persist();
  }

  healFull() {
    if (!this.map.safe) return;
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this.onHint?.('伤势已痊愈（免费）');
  }

  revive() {
    this.player.alive = true;
    this.loadMap('bich');
    this.player.hp = this.player.maxHp * 0.55;
    this.player.mp = this.player.maxMp * 0.55;
    this.paused = false;
    this.persist();
  }

  persist() {
    const p = this.player;
    saveGame({
      player: p.serialize(),
      mapId: this.mapId,
      px: p.x,
      py: p.y,
    });
  }

  setRun(on) {
    this.input.run = !!on;
    this.player.running = !!on;
  }

  setMoveVector(x, y) {
    const len = Math.hypot(x, y);
    this.input.moveX = len > 1 ? x / len : x;
    this.input.moveY = len > 1 ? y / len : y;
    if (len > 0.05) {
      this.player.target = null;
      this.player.moveGoal = null;
    }
  }

  /** Trigger short hop + jump anim (not full platformer). */
  tryJump() {
    const p = this.player;
    if (!p.alive || this.paused) return false;
    if (p.jumpT > 0) return false;
    p.jumpT = 0.55;
    p.jumpMax = 0.55;
    p.jumpY = 0;
    p.anim = 'jump';
    p.animFrame = 0;
    p.animT = 0.55;
    return true;
  }

  onClick(sx, sy) {
    if (!this.player.alive || this.paused) return;
    const w = this.screenToWorld(sx, sy);
    const p = this.player;

    for (const n of this.npcs) {
      if (dist(w, n) < 32) {
        if (n.action === 'heal') this.healFull();
        if (n.action === 'shop') this.onHint?.('__SHOP__');
        if (n.action === 'warehouse') this.onHint?.('__WAREHOUSE__');
        if (n.action === 'quest') this.talkQuest(n.id);
        return;
      }
    }
    for (const portal of this.portals) {
      if (dist(w, portal) < 40) {
        if (portal.reqLevel && p.level < portal.reqLevel) {
          this.onHint?.(`需要 ${portal.reqLevel} 级才能进入 ${portal.label}`);
          return;
        }
        this.loadMap(portal.to, portal.tx, portal.ty);
        return;
      }
    }
    let hit = null; let best = 36 * 36;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const d = dist2(w, m);
      if (d < best) { best = d; hit = m; }
    }
    if (hit) {
      p.target = hit;
      p.moveGoal = null;
      return;
    }
    p.target = null;
    const gx = clamp(w.x, 24, WORLD.cols * T - 24);
    const gy = clamp(w.y, 24, WORLD.rows * T - 24);
    if (!this.blocked(gx, gy)) p.moveGoal = { x: gx, y: gy };
  }

  update(dt) {
    if (this.paused) return;
    this.time += dt;
    this.player.playTime += dt;
    this.saveTimer += dt;
    if (this.saveTimer > 12) { this.saveTimer = 0; this.persist(); }

    const p = this.player;
    if (!p.alive) return;
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    this.shake = Math.max(0, this.shake - 18 * dt);
    p.hitT = Math.max(0, (p.hitT || 0) - dt);
    if (p.blessingT > 0) {
      const wasBlessed = p.blessingT > 0;
      p.blessingT = Math.max(0, p.blessingT - dt);
      if (wasBlessed && p.blessingT === 0) p.recalc();
    }

    p.attackCd = Math.max(0, p.attackCd - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.shieldT = Math.max(0, p.shieldT - dt);
    for (let i = 0; i < p.skillCd.length; i++) p.skillCd[i] = Math.max(0, p.skillCd[i] - dt);
    if (p.boost) {
      p.boost.t -= dt;
      if (p.boost.t <= 0) p.boost = null;
    }
    if (p.animT > 0) {
      p.animT -= dt;
      if (p.animT <= 0) {
        p.attacking = false;
        if (p.jumpT <= 0) p.animT = 0;
      }
    }

    // jump arc (visual hop)
    if (p.jumpT > 0) {
      p.jumpT = Math.max(0, p.jumpT - dt);
      const u = 1 - p.jumpT / Math.max(0.001, p.jumpMax);
      p.jumpY = Math.sin(Math.min(1, u) * Math.PI) * 42;
      if (p.jumpT <= 0) p.jumpY = 0;
    }

    const regen = this.map.safe ? 10 : 1.5;
    p.hp = Math.min(p.maxHp, p.hp + regen * dt);
    p.mp = Math.min(p.maxMp, p.mp + regen * 0.85 * dt);

    p.running = !!this.input.run;
    const moveSpeed = p.ms * (p.running ? 1.65 : 1);
    let moving = false;

    // movement
    const manualMoving = Math.hypot(this.input.moveX, this.input.moveY) > 0.05;
    if (p.stun <= 0 && p.jumpT <= 0) {
      if (manualMoving) {
        moving = true;
        const nx = p.x + this.input.moveX * moveSpeed * dt;
        const ny = p.y + this.input.moveY * moveSpeed * dt;
        this.tryMove(p, nx, ny);
      } else if (p.target && p.target.alive) {
        const range = p.range + p.target.r;
        if (dist(p, p.target) <= range) {
          p.moveGoal = null;
          this.faceToward(p, p.target.x);
          this.tryAttack(p, p.target);
        } else {
          moving = true;
          this.faceToward(p, p.target.x);
          const m = moveToward(p, p.target, moveSpeed, dt);
          this.tryMove(p, m.x, m.y);
        }
      } else if (p.moveGoal) {
        moving = true;
        this.faceToward(p, p.moveGoal.x);
        const m = moveToward(p, p.moveGoal, moveSpeed, dt);
        this.tryMove(p, m.x, m.y);
        if (m.arrived || dist(p, p.moveGoal) < 4) p.moveGoal = null;
      }
    } else if (p.jumpT > 0 && (p.moveGoal || manualMoving)) {
      // slight air control
      moving = true;
      if (manualMoving) {
        this.tryMove(p, p.x + this.input.moveX * moveSpeed * 0.85 * dt, p.y + this.input.moveY * moveSpeed * 0.85 * dt);
      } else {
        this.faceToward(p, p.moveGoal.x);
        const m = moveToward(p, p.moveGoal, moveSpeed * 0.85, dt);
        this.tryMove(p, m.x, m.y);
      }
    }

    if (p.attacking && p.animT <= 0) p.attacking = false;

    const nextAnim = pickPlayerAnim({
      jumping: p.jumpT > 0,
      attacking: p.attacking,
      moving,
      running: p.running,
    });
    if (nextAnim !== p.anim) {
      // don't interrupt attack/jump mid-oneshot unless priority higher
      if (!(p.attacking && nextAnim !== 'jump' && nextAnim !== 'attack') || nextAnim === 'jump') {
        if (!(p.jumpT > 0 && nextAnim !== 'jump')) {
          p.anim = nextAnim;
          if (nextAnim === 'attack' || nextAnim === 'jump') p.animFrame = 0;
        } else {
          p.anim = 'jump';
        }
      } else if (!p.attacking) {
        p.anim = nextAnim;
      }
    }
    // simplify: force pick result when not in exclusive oneshot
    if (p.jumpT > 0) p.anim = 'jump';
    else if (p.attacking) p.anim = 'attack';
    else p.anim = pickPlayerAnim({ jumping: false, attacking: false, moving, running: p.running });

    p.animFrame += dt * animFps(p.anim);

    // auto pickup
    for (const d of this.drops) {
      if (!d.alive) continue;
      d.t -= dt;
      if (d.t <= 0) { d.alive = false; continue; }
      if (dist(p, d) < 40) {
        if (d.gold) {
          p.gold += d.gold;
          this.onHint?.(`拾取 ${d.gold} 金币`);
          this.log(`拾取 ${d.gold} 金币`, 'loot');
        }
        if (d.itemId) {
          if (p.addItem(d.itemId, 1)) {
            this.onHint?.(`获得 ${ITEMS[d.itemId].name}`);
            this.log(`获得 ${ITEMS[d.itemId].name}`, 'loot');
            if (ITEMS[d.itemId]?.type === 'quest') this.checkQuestComplete();
          } else { this.onHint?.('背包已满'); continue; }
        }
        d.alive = false;
        this.onSfx?.('loot');
        this.checkAchievements();
      }
    }
    this.drops = this.drops.filter((d) => d.alive);

    // pet
    if (p.pet) {
      const pet = p.pet;
      pet.ttl -= dt;
      if (pet.ttl <= 0 || !pet.alive) { p.pet = null; }
      else {
        pet.attackCd = Math.max(0, pet.attackCd - dt);
        let t = p.target && p.target.alive ? p.target : this.nearestMonster(pet, 220);
        if (t) {
          this.faceToward(pet, t.x);
          if (dist(pet, t) <= pet.range + t.r) this.tryAttack(pet, t);
          else {
            const mv = moveToward(pet, t, pet.ms, dt);
            this.tryMove(pet, mv.x, mv.y);
          }
        } else if (dist(pet, p) > 70) {
          this.faceToward(pet, p.x);
          const mv = moveToward(pet, p, pet.ms, dt);
          this.tryMove(pet, mv.x, mv.y);
        }
      }
    }

    // monsters
    for (const m of this.monsters) {
      m.hitT = Math.max(0, (m.hitT || 0) - dt);
      if (!m.alive) {
        if (m.respawnAt && this.time >= m.respawnAt) {
          m.alive = true;
          m.hp = m.maxHp;
          m.x = m.home.x; m.y = m.home.y;
          m.target = null;
          m.respawnAt = 0;
          m.poison = null;
        }
        continue;
      }
      m.attackCd = Math.max(0, m.attackCd - dt);
      m.stun = Math.max(0, m.stun - dt);
      m.animFrame = (m.animFrame || 0) + dt * 4;
      if (m.boss) {
        m.enraged = m.hp / m.maxHp < 0.35;
        m.atk = m.def.atk * (m.enraged ? 1.45 : 1);
        m.ms = m.def.ms * (m.enraged ? 1.25 : 1);
        m.abilityCd -= dt;
        if (m.abilityCd <= 0 && dist(m, p) < m.aggro + 120) {
          m.abilityCd = m.enraged ? 4.5 : 7;
          this.hazards.push({ x: p.x, y: p.y, r: m.enraged ? 128 : 105, t: 1.25, maxT: 1.25, damage: m.atk * 1.15, source: m, fired: false });
          this.onHint?.(m.enraged ? '教主狂暴！躲开赤焰法阵！' : '危险！教主正在召唤赤焰');
          this.onSfx?.('warning');
        }
      }
      if (m.poison) {
        m.poison.t -= dt;
        m.hp -= m.poison.dps * dt;
        if (m.poison.t <= 0) m.poison = null;
        if (m.hp <= 0) this.kill(p, m);
        if (!m.alive) continue;
      }
      if (m.stun > 0) continue;

      const aggroTarget = (!this.map.safe && dist(m, p) < m.aggro) ? p : null;
      if (aggroTarget) m.target = aggroTarget;
      if (m.target && m.target.alive) {
        this.faceToward(m, m.target.x);
        if (dist(m, m.target) <= m.range + m.target.r) this.tryAttack(m, m.target);
        else {
          const mv = moveToward(m, m.target, m.ms, dt);
          this.tryMove(m, mv.x, mv.y);
        }
        if (dist(m, m.home) > 480) { m.target = null; m.moveGoal = { ...m.home }; }
      } else {
        m.wanderT -= dt;
        if (m.wanderT <= 0) {
          m.wanderT = 2 + Math.random() * 3;
          m.moveGoal = {
            x: clamp(m.home.x + randInt(-90, 90), 24, WORLD.cols * T - 24),
            y: clamp(m.home.y + randInt(-90, 90), 24, WORLD.rows * T - 24),
          };
        }
        if (m.moveGoal) {
          this.faceToward(m, m.moveGoal.x);
          const mv = moveToward(m, m.moveGoal, m.ms * 0.55, dt);
          this.tryMove(m, mv.x, mv.y);
          if (mv.arrived) m.moveGoal = null;
        }
      }
    }

    for (const pr of this.projectiles) {
      if (!pr.alive) continue;
      let t = this.monsters.find((m) => m.id === pr.targetId);
      if (!t && this.player.id === pr.targetId) t = this.player;
      if (!t && this.player.pet?.id === pr.targetId) t = this.player.pet;
      if (!t || !t.alive) { pr.alive = false; continue; }
      const mv = moveToward(pr, t, pr.speed, dt);
      pr.x = mv.x; pr.y = mv.y;
      if (mv.arrived) {
        const src = pr.sourceId === p.id ? p : (p.pet?.id === pr.sourceId ? p.pet : null);
        this.applyDamage(src, t, pr.damage, pr.magical);
        pr.alive = false;
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.alive);
    for (const h of this.hazards) {
      h.t -= dt;
      if (!h.fired && h.t <= 0) {
        h.fired = true;
        h.t = -0.35;
        this.spawnEffect(h.x, h.y, h.r, '#ff5a36', 0.55, 'ring');
        if (dist(p, h) <= h.r + p.r) this.applyDamage(h.source, p, h.damage, true);
        this.onSfx?.('explosion');
      }
    }
    this.hazards = this.hazards.filter((h) => h.t > -0.35);
    for (const e of this.effects) e.t -= dt;
    this.effects = this.effects.filter((e) => e.t > 0);
    for (const f of this.floats) { f.t -= dt; f.y -= 28 * dt; }
    this.floats = this.floats.filter((f) => f.t > 0);

    this.cam.x += (p.x - this.cam.x) * Math.min(1, 7 * dt);
    this.cam.y += (p.y - this.cam.y) * Math.min(1, 7 * dt);
  }

  _animImg(classId, anim, frame) {
    const pack = this.assets.anim?.[classId]?.[anim];
    if (pack && pack.length) return pack[Math.floor(frame) % pack.length];
    return this.assets.units[classId];
  }

  _drawSprite(ctx, img, wx, wy, drawH, facing = 1, anchorY = 0.92) {
    const foot = this.worldToScreen(wx, wy);
    if (!img) {
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(foot.x, foot.y - 12, 12, 0, Math.PI * 2);
      ctx.fill();
      return { foot, topY: foot.y - drawH };
    }
    const w = drawH * (img.width / img.height);
    const dx = foot.x - w * 0.5;
    const dy = foot.y - drawH * anchorY;
    ctx.save();
    if (facing < 0) {
      ctx.translate(foot.x, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -w * 0.5, dy, w, drawH);
    } else {
      ctx.drawImage(img, dx, dy, w, drawH);
    }
    ctx.restore();
    return { foot, topY: dy };
  }

  _bar(ctx, x, y, w, pct, color) {
    ctx.fillStyle = '#111';
    ctx.fillRect(x - w / 2, y, w, 5);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * clamp(pct, 0, 1), 5);
  }

  render() {
    const ctx = this.ctx;
    const vw = this.viewW; const vh = this.viewH;
    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    // map background
    const bg = this.assets.maps[this.mapId === 'bich' ? 'town' : this.mapId === 'field' ? 'field' : 'temple'];
    if (bg) {
      // parallax-ish cover
      const scale = Math.max(vw / bg.width, vh / bg.height) * 1.15;
      const bw = bg.width * scale;
      const bh = bg.height * scale;
      const ox = vw / 2 - bw / 2 - (this.cam.x / (WORLD.cols * T)) * 40;
      const oy = vh / 2 - bh / 2 - (this.cam.y / (WORLD.rows * T)) * 40;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(bg, ox, oy, bw, bh);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = this.map.safe ? 'rgba(30,40,28,0.55)' : 'rgba(18,28,18,0.55)';
    ctx.fillRect(0, 0, vw, vh);

    // tiles: 地表贴图 + 街道 + 墙
    const startCol = Math.floor((this.cam.x - vw / 2) / T) - 1;
    const startRow = Math.floor((this.cam.y - vh / 2) / T) - 1;
    const cols = Math.ceil(vw / T) + 3;
    const rows = Math.ceil(vh / T) + 3;
    const groundKey = this.map.ground || (this.map.safe ? 'grass' : 'grass');
    const groundImg = this.assets.tiles?.[groundKey];
    const roadImg = this.assets.tiles?.road;
    const dirtImg = this.assets.tiles?.dirt;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tx = startCol + c;
        const ty = startRow + r;
        if (ty < 0 || tx < 0 || ty >= WORLD.rows || tx >= WORLD.cols) continue;
        const s = this.worldToScreen(tx * T, ty * T);
        const baseWall = this.map.grid[ty][tx] === 1;
        const isRoad = this.roadSet?.has(`${tx},${ty}`);
        if (baseWall) {
          // 墙脚下仍铺一点地表，再叠暗色
          if (dirtImg) ctx.drawImage(dirtImg, s.x, s.y, T + 1, T + 1);
          else {
            ctx.fillStyle = this.map.safe ? '#3a3228' : '#1a1e22';
            ctx.fillRect(s.x, s.y, T + 1, T + 1);
          }
          ctx.fillStyle = 'rgba(20,16,12,0.55)';
          ctx.fillRect(s.x, s.y, T + 1, T + 1);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.strokeRect(s.x + 2, s.y + 2, T - 4, T - 4);
        } else if (isRoad && roadImg) {
          ctx.drawImage(roadImg, s.x, s.y, T + 1, T + 1);
        } else if (groundImg) {
          ctx.drawImage(groundImg, s.x, s.y, T + 1, T + 1);
          if ((tx + ty) & 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(s.x, s.y, T + 1, T + 1);
          }
        } else {
          const odd = (tx + ty) & 1;
          ctx.fillStyle = this.map.safe
            ? (odd ? 'rgba(70,85,55,0.55)' : 'rgba(60,75,48,0.55)')
            : (odd ? 'rgba(40,55,38,0.5)' : 'rgba(32,48,32,0.5)');
          ctx.fillRect(s.x, s.y, T + 1, T + 1);
        }
      }
    }

    if (this.map.tint) {
      ctx.fillStyle = this.map.tint;
      ctx.fillRect(0, 0, vw, vh);
    }

    // restrained ambient ash/dust gives each zone motion without extra assets
    ctx.fillStyle = this.mapId === 'temple' ? 'rgba(255,112,48,0.42)' : 'rgba(224,192,96,0.2)';
    for (let i = 0; i < 24; i++) {
      const px = (i * 173 + this.time * (8 + (i % 4) * 3)) % (vw + 80) - 40;
      const py = (i * 97 + Math.sin(this.time * 0.7 + i) * 28 + vh) % vh;
      ctx.fillRect(px, py, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }

    for (const h of this.hazards) {
      const s = this.worldToScreen(h.x, h.y);
      const pulse = 0.55 + Math.sin(this.time * 18) * 0.15;
      ctx.fillStyle = `rgba(255,55,25,${Math.max(0.1, pulse * (h.t / h.maxT))})`;
      ctx.strokeStyle = '#ff7a3d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, h.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // portals
    for (const portal of this.portals) {
      const s = this.worldToScreen(portal.x, portal.y);
      ctx.strokeStyle = '#e0c060';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - 22, s.y - 22, 44, 44);
      ctx.fillStyle = 'rgba(224,192,96,0.2)';
      ctx.fillRect(s.x - 22, s.y - 22, 44, 44);
      ctx.fillStyle = '#e0c060';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(portal.label, s.x, s.y - 30);
    }

    // drops（先画，避免盖住单位）
    for (const d of this.drops) {
      const s = this.worldToScreen(d.x, d.y);
      const item = d.itemId ? ITEMS[d.itemId] : null;
      ctx.fillStyle = d.gold ? '#f1c40f' : RARITIES[item?.rarity || 'fine'].color;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (d.itemId && ITEMS[d.itemId]) {
        ctx.fillStyle = RARITIES[item.rarity || 'common'].color;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ITEMS[d.itemId].name, s.x, s.y - 10);
      }
    }

    // 装饰 + NPC + 单位 统一 Y 排序
    const list = [];
    for (const d of this.decors || []) list.push({ kind: 'decor', y: d.y, d });
    for (const n of this.npcs) list.push({ kind: 'npc', y: n.y, n });
    for (const m of this.monsters) if (m.alive) list.push({ kind: 'mob', y: m.y, u: m });
    if (this.player.pet?.alive) list.push({ kind: 'pet', y: this.player.pet.y, u: this.player.pet });
    if (this.player.alive) list.push({ kind: 'player', y: this.player.y, u: this.player });
    list.sort((a, b) => a.y - b.y);

    for (const item of list) {
      if (item.kind === 'decor') {
        const d = item.d;
        const img = this.assets.scenery?.[d.id];
        this._drawSprite(ctx, img, d.x, d.y, d.h, 1, d.anchor);
        continue;
      }
      if (item.kind === 'npc') {
        const n = item.n;
        const img = this.assets.npc[n.sprite];
        const drawn = this._drawSprite(ctx, img, n.x, n.y, 64);
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, drawn.foot.x, drawn.foot.y + 16);
        if (n.action === 'quest' && this.player.questId) {
          ctx.fillStyle = '#ffd866';
          ctx.font = 'bold 22px serif';
          ctx.fillText('!', drawn.foot.x, drawn.topY - 12);
        }
        continue;
      }
      const u = item.u;
      const shadow = this.worldToScreen(u.x, u.y);
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      if (ctx.ellipse) ctx.ellipse(shadow.x, shadow.y + 2, item.kind === 'player' ? 22 : u.elite ? 24 : 17, 7, 0, 0, Math.PI * 2);
      else ctx.arc(shadow.x, shadow.y + 2, item.kind === 'player' ? 17 : 14, 0, Math.PI * 2);
      ctx.fill();
      if (item.kind === 'player') {
        const img = this._animImg(u.classId, u.anim || 'idle', u.animFrame || 0);
        const drawY = u.y - (u.jumpY || 0);
        const drawn = this._drawSprite(ctx, img, u.x, drawY, 76, u.facing);
        this._bar(ctx, drawn.foot.x, drawn.topY - 8, 50, u.hp / u.maxHp, '#e74c3c');
        if (u.shieldT > 0) {
          ctx.strokeStyle = 'rgba(155,89,182,0.8)';
          ctx.beginPath();
          ctx.arc(drawn.foot.x, drawn.foot.y - 36, 28, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${u.name} Lv${u.level}`, drawn.foot.x, drawn.foot.y + 16);
        if (u.hitT > 0) {
          ctx.fillStyle = `rgba(255,255,255,${u.hitT * 2})`;
          ctx.beginPath();
          ctx.arc(drawn.foot.x, drawn.foot.y - 34, 28, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (item.kind === 'pet') {
        const img = this.assets.mobs.skeleton;
        const drawn = this._drawSprite(ctx, img, u.x, u.y, 48, u.facing || 1);
        this._bar(ctx, drawn.foot.x, drawn.topY - 6, 36, u.hp / u.maxHp, '#95a5a6');
        ctx.fillStyle = '#bdc3c7';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(u.name, drawn.foot.x, drawn.foot.y + 12);
      } else {
        const img = this.assets.mobs[u.kind];
        const aura = this.worldToScreen(u.x, u.y);
        if (u.boss) {
          ctx.strokeStyle = u.enraged ? '#ff3b2f' : '#f0a236';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(aura.x, aura.y - 28, 34 + Math.sin(this.time * 5) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        const drawn = this._drawSprite(ctx, img, u.x, u.y, u.boss ? 102 : u.elite ? 80 : 58, u.facing || 1);
        this._bar(ctx, drawn.foot.x, drawn.topY - 6, u.elite ? 56 : 38, u.hp / u.maxHp, u.elite ? '#f39c12' : '#c0392b');
        ctx.fillStyle = u.boss ? '#ff7a4d' : u.elite ? '#f39c12' : '#ddd';
        ctx.font = u.boss ? 'bold 13px sans-serif' : u.elite ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(u.name, drawn.foot.x, drawn.foot.y + 14);
        if (u.hitT > 0) {
          ctx.fillStyle = `rgba(255,255,255,${u.hitT * 2.2})`;
          ctx.beginPath();
          ctx.arc(drawn.foot.x, drawn.foot.y - (u.boss ? 48 : 30), u.boss ? 38 : 24, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (const pr of this.projectiles) {
      const s = this.worldToScreen(pr.x, pr.y);
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of this.effects) {
      const s = this.worldToScreen(e.x, e.y);
      const a = e.t / e.maxT;
      ctx.globalAlpha = a * 0.75;
      ctx.strokeStyle = e.color;
      ctx.fillStyle = e.color;
      if (e.kind === 'ring') {
        ctx.beginPath();
        ctx.arc(s.x, s.y, e.r * (1.2 - a * 0.3), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, e.r * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (const f of this.floats) {
      const s = this.worldToScreen(f.x, f.y);
      ctx.globalAlpha = f.t / f.maxT;
      ctx.fillStyle = f.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, s.x, s.y);
      ctx.globalAlpha = 1;
    }

    if (this.player.moveGoal) {
      const s = this.worldToScreen(this.player.moveGoal.x, this.player.moveGoal.y);
      ctx.strokeStyle = 'rgba(224,192,96,0.85)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.player.target?.alive) {
      const s = this.worldToScreen(this.player.target.x, this.player.target.y);
      ctx.strokeStyle = '#ffd866';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.ellipse) ctx.ellipse(s.x, s.y + 3, this.player.target.elite ? 28 : 20, 9, 0, 0, Math.PI * 2);
      else ctx.arc(s.x, s.y + 3, this.player.target.elite ? 24 : 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    // minimap
    this._minimap(ctx);
    ctx.restore();
  }

  _minimap(ctx) {
    const mw = 140; const mh = 105;
    const x0 = this.viewW - mw - 12; const y0 = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.strokeStyle = '#8a6a2a';
    ctx.strokeRect(x0, y0, mw, mh);
    const sx = mw / (WORLD.cols * T);
    const sy = mh / (WORLD.rows * T);
    // walls sample
    ctx.fillStyle = '#444';
    for (let y = 0; y < WORLD.rows; y += 2) {
      for (let x = 0; x < WORLD.cols; x += 2) {
        if (this.map.grid[y][x]) ctx.fillRect(x0 + x * T * sx, y0 + y * T * sy, 2, 2);
      }
    }
    for (const m of this.monsters) {
      if (!m.alive) continue;
      ctx.fillStyle = m.boss ? '#ff3b2f' : m.elite ? '#f39c12' : '#c0392b';
      ctx.fillRect(x0 + m.x * sx - 1, y0 + m.y * sy - 1, m.boss ? 5 : 3, m.boss ? 5 : 3);
    }
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(x0 + this.player.x * sx - 2, y0 + this.player.y * sy - 2, 4, 4);
    for (const p of this.portals) {
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(x0 + p.x * sx - 2, y0 + p.y * sy - 2, 4, 4);
    }
  }
}

export async function loadAssets() {
  // cache-bust so rebuilt anim frames refresh without hard-clear
  const v = `v=${Date.now()}`;
  const img = (path) => loadImage(`${path}${path.includes('?') ? '&' : '?'}${v}`);

  const units = {};
  const portraits = {};
  const avatars = {};
  const anim = {};
  for (const id of Object.keys(CLASSES)) {
    const c = CLASSES[id];
    units[id] = await img(c.unit);
    try { portraits[id] = await img(c.portrait); } catch { portraits[id] = units[id]; }
    try { avatars[id] = await img(c.avatar); } catch { avatars[id] = units[id]; }
    anim[id] = {};
    for (const act of ANIM_ACTIONS) {
      anim[id][act] = [];
      for (let i = 0; i < 16; i++) {
        const path = `assets/game/anim/${id}/${act}/${String(i).padStart(2, '0')}.png`;
        try {
          anim[id][act].push(await img(path));
        } catch {
          break;
        }
      }
      if (!anim[id][act].length) {
        throw new Error(`missing anim pack: ${id}/${act}`);
      }
    }
  }
  const mobs = {};
  for (const id of Object.keys(MONSTERS)) {
    mobs[id] = await img(MONSTERS[id].unit);
  }
  const npc = {
    healer: await img('assets/game/npc/healer.png'),
    merchant: await img('assets/game/npc/merchant.png'),
    warehouse: await img('assets/game/npc/warehouse.png'),
  };
  const maps = {
    town: await img('assets/game/map/town.jpg'),
    field: await img('assets/game/map/field.jpg'),
    temple: await img('assets/game/map/temple.jpg'),
  };
  const scenery = {};
  for (const id of Object.keys(SCENERY)) {
    try { scenery[id] = await img(SCENERY[id].src); } catch { /* optional */ }
  }
  const tiles = {};
  for (const [id, path] of Object.entries(TILES)) {
    try { tiles[id] = await img(path); } catch { /* optional */ }
  }
  return { units, portraits, avatars, anim, mobs, npc, maps, scenery, tiles };
}

export { CLASSES, ITEMS, SHOP_TOWN as SHOP, MAPS, QUESTS };
