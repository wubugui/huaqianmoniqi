import {
  ACHIEVEMENTS, BOUNTIES, CLASSES, COMBAT_RULES, ENHANCE_MAX, EQUIP_SLOTS, GATHER_DEFS, ITEMS, MAPS, MONSTERS, QUESTS, RARITIES, RECIPES,
  SCENERY, SHOP_TOWN, SKILL_MAX_LEVEL, TILES, VISUAL_SCALE, WALL_MATERIALS, WORLD, ZONE_VISUALS, enhanceCost,
  isWorldBlocked, isWorldPositionOpen,
} from './config.js?v=0.9.9';
import { clamp, dist, dist2, moveToward, loadImage, randInt } from './utils.js';
import {
  Player, Monster, Npc, Drop, Projectile, Effect, FloatingText, Pet, createItemEntry, normalizeItemEntry,
} from './entities.js?v=0.9.9';
import { saveGame, loadGame } from './save.js';
import {
  pickPlayerAnim, pickMonsterAnim, animFps, monsterAnimFps, direction8, directionalFrameCount,
  mobDirectionalFrameCount, contactFramesFor, contactFrameCrossings,
  PLAYER_DIRECTIONAL_SPECS, MOB_DIRECTIONAL_SPECS, ANIM_ACTIONS, MOB_ANIM_ACTIONS,
} from './anim.js?v=0.9.14';
import { findTilePath } from './navigation.js?v=0.9.11';

const T = WORLD.tile;

export {
  pickPlayerAnim, pickMonsterAnim, animFps, monsterAnimFps, direction8, ANIM_ACTIONS, MOB_ANIM_ACTIONS,
};

export class Game {
  constructor(canvas, assets, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assets = assets;
    this.assets.ensurePlayerAnim?.(opts.save?.player?.classId || opts.classId)?.catch((error) => console.error(error));
    this.renderQuality = ['performance', 'balanced', 'quality'].includes(opts.renderQuality)
      ? opts.renderQuality
      : 'balanced';
    this.onHint = opts.onHint || (() => {});
    this.onDeath = opts.onDeath || (() => {});
    this.onQuest = opts.onQuest || (() => {});
    this.onHud = opts.onHud || (() => {});
    this.onLog = opts.onLog || (() => {});
    this.onSfx = opts.onSfx || (() => {});
    this.onAchievement = opts.onAchievement || (() => {});
    this.onNpc = opts.onNpc || null;

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
    this.lastPotionAt = Number.NEGATIVE_INFINITY;
    this.combatLockUntil = 0;
    this.paused = false;
    this.saveTimer = 0;
    this.combo = 0;
    this.comboT = 0;
    this.shake = 0;
    this.impactT = 0;
    this.zoneIntroT = 0;
    this.zoneFadeT = 0;
    this.ambientSfxT = 0;
    this.pendingNpc = null;
    this.pendingDrop = null;
    this.pendingPortal = null;
    this.portalLoading = null;
    this.navigationPath = [];
    this.pendingGather = null;
    this.gathering = null;
    this.gatherNodes = [];
    this.pkDecayAccumulator = 0;
    this.remotePlayers = [];
    this.networkPets = [];
    this.networkPlayerId = null;
    this.onMapChange = opts.onMapChange || null;
    this.onRemoteSelected = opts.onRemoteSelected || null;
    this.onRemoteAttack = opts.onRemoteAttack || null;
    this.onNetworkMonsterAttack = opts.onNetworkMonsterAttack || null;
    this.onBossDamage = opts.onBossDamage || null;
    this.onNetworkPickup = opts.onNetworkPickup || null;
    this.onServerAction = opts.onServerAction || null;
    this.multiplayerActive = false;
    this.lastServerCombatVersion = 0;
    this.lastServerAuthorityVersion = 0;
    this.worldState = null;
    this.seenChatMessageIds = new Set();
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
    if (opts.save && !opts.save.player.characterId) this.persist();
  }

  get map() { return MAPS[this.mapId]; }
  get visual() { return ZONE_VISUALS[this.mapId] || ZONE_VISUALS.field; }

  resize() {
    // Full-screen Retina canvases can exceed eight million backing pixels.
    // Keep the logical viewport sharp while bounding the fill-rate needed by
    // combat flashes, particles and full-screen color grading.
    const nativeDpr = window.devicePixelRatio || 1;
    const profiles = {
      performance: { pixelBudget: 1_350_000, maxDpr: 1 },
      balanced: { pixelBudget: 2_100_000, maxDpr: 1.5 },
      quality: { pixelBudget: 4_150_000, maxDpr: 2 },
    };
    const profile = profiles[this.renderQuality] || profiles.balanced;
    const pixelBudget = profile.pixelBudget;
    const budgetDpr = Math.sqrt(pixelBudget / Math.max(1, innerWidth * innerHeight));
    const dpr = Math.min(nativeDpr, profile.maxDpr, Math.max(1, budgetDpr));
    this.canvas.width = Math.floor(innerWidth * dpr);
    this.canvas.height = Math.floor(innerHeight * dpr);
    this.canvas.style.width = `${innerWidth}px`;
    this.canvas.style.height = `${innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = innerWidth;
    this.viewH = innerHeight;
    this.clampCamera();
  }

  setRenderQuality(quality) {
    if (!['performance', 'balanced', 'quality'].includes(quality)) return false;
    this.renderQuality = quality;
    this.resize();
    return true;
  }

  clampCamera() {
    if (!this.viewW || !this.viewH) return;
    const worldW = WORLD.cols * T;
    const worldH = WORLD.rows * T;
    this.cam.x = this.viewW >= worldW ? worldW / 2 : clamp(this.cam.x, this.viewW / 2, worldW - this.viewW / 2);
    this.cam.y = this.viewH >= worldH ? worldH / 2 : clamp(this.cam.y, this.viewH / 2, worldH - this.viewH / 2);
  }

  monsterDrawHeight(monster) {
    return VISUAL_SCALE.monsters[monster.kind] || (monster.elite ? 112 : VISUAL_SCALE.player);
  }

  advanceMonsterAnim(actor, moving, dt) {
    const previousAnim = actor.anim;
    const next = pickMonsterAnim({
      alive: actor.alive,
      attacking: actor.attacking && actor.animT > 0,
      moving,
    });
    if (next !== actor.anim) {
      actor.anim = next;
      actor.animFrame = 0;
    }
    const previousFrame = actor.animFrame || 0;
    actor.animFrame = previousFrame + dt * monsterAnimFps(actor.anim, actor.kind);
    this.updateMonsterFootstep(
      actor,
      moving && actor.anim === 'walk',
      previousFrame,
      actor.animFrame,
      previousAnim === actor.anim,
    );
  }

  worldToScreen(x, y) {
    // Terrain, roads and actors share one pixel-snapped camera origin. This keeps
    // texture sampling stable while the follow camera eases between world pixels.
    return { x: x - Math.round(this.cam.x) + this.viewW / 2, y: y - Math.round(this.cam.y) + this.viewH / 2 };
  }

  worldPointInView(x, y, padding = 0) {
    return Math.abs(x - this.cam.x) <= this.viewW * 0.5 + padding
      && Math.abs(y - this.cam.y) <= this.viewH * 0.5 + padding;
  }

  screenToWorld(sx, sy) {
    return { x: sx + Math.round(this.cam.x) - this.viewW / 2, y: sy + Math.round(this.cam.y) - this.viewH / 2 };
  }

  pointerToView(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect?.();
    if (!rect) return { x: clientX, y: clientY };
    // Rendering uses ctx.setTransform(dpr, ...), so viewW/viewH stay in logical
    // CSS pixels. Normalize offsets and CSS transforms here; multiplying by the
    // backing-store DPR would double-scale Retina pointer coordinates.
    const rectW = rect.width || this.viewW || 1;
    const rectH = rect.height || this.viewH || 1;
    return {
      x: (clientX - rect.left) * ((this.viewW || rectW) / rectW),
      y: (clientY - rect.top) * ((this.viewH || rectH) / rectH),
    };
  }

  blocked(x, y) {
    return isWorldBlocked(this.mapId, x, y);
  }

  nearestOpenPoint(x, y, maxRadius = 8) {
    if (!this.blocked(x, y)) return { x, y };
    const originCol = Math.floor(x / T);
    const originRow = Math.floor(y / T);
    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let row = originRow - radius; row <= originRow + radius; row += 1) {
        for (let col = originCol - radius; col <= originCol + radius; col += 1) {
          if (Math.max(Math.abs(col - originCol), Math.abs(row - originRow)) !== radius) continue;
          const point = { x: (col + 0.5) * T, y: (row + 0.5) * T };
          if (!this.blocked(point.x, point.y)) return point;
        }
      }
    }
    const start = this.map.playerStart;
    return { x: start.x * T, y: start.y * T };
  }

  bodyBlocked(ent, x, y, oldX = ent.x, oldY = ent.y) {
    const radius = ent.r || (ent.type === 'player' ? COMBAT_RULES.playerBodyRadius : COMBAT_RULES.monsterBodyRadius);
    const blockers = [
      ...this.npcs,
      ...this.monsters.filter((unit) => unit.alive),
      ...this.remotePlayers.filter((unit) => unit.alive),
      ...this.networkPets.filter((unit) => unit.alive),
    ];
    if (this.player?.alive) blockers.push(this.player);
    if (this.player?.pet?.alive) blockers.push(this.player.pet);
    for (const blocker of blockers) {
      if (!blocker || blocker === ent || blocker.id === ent.id) continue;
      const minimum = radius + (blocker.r || 16) - 2;
      const nextDistance = Math.hypot(x - blocker.x, y - blocker.y);
      if (nextDistance >= minimum) continue;
      // A restored or freshly spawned unit may begin overlapped. It may step out,
      // but can never move deeper through the other unit.
      const oldDistance = Math.hypot(oldX - blocker.x, oldY - blocker.y);
      if (oldDistance < minimum && nextDistance > oldDistance + 0.01) continue;
      return true;
    }
    return false;
  }

  positionOpen(ent, x, y, oldX = ent.x, oldY = ent.y) {
    const r = ent.r * 0.6;
    return isWorldPositionOpen(this.mapId, x, y, r)
      && !this.bodyBlocked(ent, x, y, oldX, oldY);
  }

  /** 将连续移动/瞄准向量量化为传奇式八方向，同时保留左右镜像兼容旧素材。 */
  faceToward(ent, tx, ty = ent.y) {
    const dx = tx - ent.x;
    const dy = ty - ent.y;
    ent.direction = direction8(dx, dy, ent.direction || 's');
    if (Math.abs(dx) > 0.8) ent.facing = dx > 0 ? 1 : -1;
  }

  tryMove(ent, nx, ny) {
    const ox = ent.x;
    const oy = ent.y;
    let moved = false;
    if (this.positionOpen(ent, nx, ny, ox, oy)) {
      ent.x = nx; ent.y = ny;
      moved = true;
    } else if (this.positionOpen(ent, nx, ent.y, ox, oy)) {
      ent.x = nx;
      moved = true;
    } else if (this.positionOpen(ent, ent.x, ny, ox, oy)) {
      ent.y = ny;
      moved = true;
    }
    const dx = ent.x - ox;
    const dy = ent.y - oy;
    if (moved) {
      ent.direction = direction8(dx, dy, ent.direction || 's');
      if (Math.abs(dx) > 0.05) ent.facing = dx > 0 ? 1 : -1;
    }
    return moved;
  }

  loadMap(id, tx, ty, { authoritative = false } = {}) {
    const previousMapId = this.mapId;
    this.mapId = id;
    this.zoneIntroT = 2.4;
    this.zoneFadeT = 0.72;
    this.ambientSfxT = this.time + 0.18;
    const m = MAPS[id];
    this.assets.ensureMap?.(id)?.catch((error) => console.error(error));
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
        blockRadius: d.blockRadius || def.blockRadius || 0,
        fadeRadius: d.fadeRadius || def.fadeRadius || 0,
        shadowW: d.shadowW || def.shadowW || 0,
        facing: d.facing === -1 ? -1 : 1,
        ecology: d.ecology || '',
      };
    });
    this.minimapForestDecors = this.decors.filter(
      (decor) => decor.ecology === 'canopy' || decor.ecology === 'forest-edge',
    );
    // Pathfinding samples the exact same continuous collision function as live
    // client/server movement. Waypoints can no longer be routed through a tree
    // merely because the old decor rasterizer exempted a nominal road tile.
    const pathRadius = COMBAT_RULES.playerBodyRadius * 0.6;
    for (let row = 0; row < WORLD.rows; row++) {
      for (let col = 0; col < WORLD.cols; col++) {
        this.walkGrid[row][col] = isWorldPositionOpen(
          id,
          (col + 0.5) * T,
          (row + 0.5) * T,
          pathRadius,
        ) ? 0 : 1;
      }
    }

    this.npcs = m.npcs.map((n) => new Npc({ ...n, x: n.x * T, y: n.y * T }));
    this.portals = m.portals.map((p) => ({ ...p, x: p.x * T, y: p.y * T }));
    this.gatherNodes = (m.gathers || []).map((node, index) => {
      const def = GATHER_DEFS[node.type];
      return {
        ...node,
        id: `${id}:${node.type}:${index}`,
        x: node.x * T,
        y: node.y * T,
        def,
        charges: def?.charges || 1,
        active: true,
        respawnAt: 0,
      };
    }).filter((node) => !!node.def);
    this.monsters = [];
    this.drops = [];
    this.projectiles = [];
    this.effects = [];
    this.hazards = [];
    if (this.player.pet) this.player.pet = null;

    const spawnExclusions = [
      { x: m.playerStart.x * T, y: m.playerStart.y * T, r: 3.2 * T },
      ...m.portals.map((p) => ({ x: p.x * T, y: p.y * T, r: 2.5 * T })),
      ...this.decors.filter((d) => d.fadeRadius > 0).map((d) => ({ x: d.x, y: d.y, r: Math.max(2.2 * T, d.fadeRadius * 0.75) })),
    ];
    const spawnBlocked = (x, y) => this.blocked(x, y)
      || spawnExclusions.some((zone) => Math.hypot(x - zone.x, y - zone.y) < zone.r)
      || this.monsters.some((mob) => Math.hypot(x - mob.x, y - mob.y) < T * 0.58);
    for (let group = 0; group < m.spawns.length; group++) {
      const sp = m.spawns[group];
      for (let i = 0; i < sp.count; i++) {
        let x = sp.x * T;
        let y = sp.y * T;
        let valid = false;
        for (let tries = 0; tries < 48; tries++) {
          // 黄金角分布避免随机堆叠；换图后同一生态区仍保持可读阵型。
          const index = i + tries * Math.max(1, sp.count);
          const ang = index * 2.399963 + group * 0.87;
          const rr = Math.sqrt((index % (sp.count + 7)) / (sp.count + 6)) * sp.r * T;
          x = sp.x * T + Math.cos(ang) * rr;
          y = sp.y * T + Math.sin(ang) * rr;
          if (!spawnBlocked(x, y)) { valid = true; break; }
        }
        if (valid) this.monsters.push(new Monster(sp.monster, x, y));
      }
    }
    if (tx != null) {
      this.player.x = tx * T;
      this.player.y = ty * T;
    } else {
      this.player.x = m.playerStart.x * T;
      this.player.y = m.playerStart.y * T;
    }
    const repairedPlayerPoint = this.nearestOpenPoint(this.player.x, this.player.y);
    this.player.x = repairedPlayerPoint.x;
    this.player.y = repairedPlayerPoint.y;
    this.player.moveGoal = null;
    this.navigationPath = [];
    this.player.target = null;
    this.pendingNpc = null;
    this.pendingDrop = null;
    this.pendingPortal = null;
    this.pendingGather = null;
    this.gathering = null;
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this.clampCamera();
    this.onHint?.(m.name);
    this.log(`进入 ${m.name}`, 'zone');
    this.onSfx?.('portal');
    this.persist();
    if (!authoritative && previousMapId !== id) this.onMapChange?.(id);
  }

  applyNetworkSnapshot(snapshot, ownId) {
    if (!snapshot?.players || !ownId) return;
    this.worldState = snapshot;
    this.networkPlayerId = ownId;
    const own = snapshot.players.find((entry) => entry.id === ownId);
    if (own) {
      if (own.mapId !== this.mapId && MAPS[own.mapId]) {
        this.loadMap(own.mapId, own.x / T, own.y / T, { authoritative: true });
      } else if (
        own.mapId === this.mapId
        && (dist(this.player, own) > 140 || this.blocked(this.player.x, this.player.y))
      ) {
        this.player.x = own.x;
        this.player.y = own.y;
        this.player.moveGoal = null;
        this.onHint?.('位置已由服务器校正');
      }
      if ((own.combatVersion || 0) > this.lastServerCombatVersion) {
        this.lastServerCombatVersion = own.combatVersion;
        this.player.hp = clamp(own.hp, 0, this.player.maxHp);
        this.player.pkPoints = own.pkPoints || 0;
        this.player.playerKills = own.playerKills || 0;
        this.player.deaths = own.deaths || 0;
      }
      const self = snapshot.self;
      if (self && (self.authorityVersion || 0) > this.lastServerAuthorityVersion) {
        const previousAuthorityVersion = this.lastServerAuthorityVersion;
        const previousLevel = this.player.level;
        this.lastServerAuthorityVersion = self.authorityVersion || 0;
        this.player.level = self.level;
        this.player.xp = self.xp;
        this.player.gold = self.gold;
        this.player.bag = (self.bag || []).map((entry) => normalizeItemEntry(entry)).filter(Boolean);
        this.player.bagSize = self.bagSize || this.player.bagSize;
        this.player.warehouse = (self.warehouse || []).map((entry) => normalizeItemEntry(entry)).filter(Boolean);
        this.player.warehouseSize = self.warehouseSize || this.player.warehouseSize;
        for (const slot of EQUIP_SLOTS) {
          this.player.equip[slot] = self.equip?.[slot] ? normalizeItemEntry(self.equip[slot]) : null;
          this.player.enhance[slot] = self.enhance?.[slot] || self.equip?.[slot]?.enhance || 0;
        }
        this.player.skills = structuredClone(self.skills || this.player.skills);
        this.player.boost = self.activeBoost?.expiresAt > snapshot.serverTime
          ? { id: self.activeBoost.id, t: (self.activeBoost.expiresAt - snapshot.serverTime) / 1000 }
          : null;
        this.player.shieldT = Math.max(0, ((self.shieldUntil || 0) - snapshot.serverTime) / 1000);
        for (let index = 0; index < this.player.def.skills.length; index++) {
          const skill = this.player.def.skills[index];
          this.player.skillCd[index] = Math.max(
            this.player.skillCd[index] || 0,
            ((self.skillCooldowns?.[skill.id] || 0) - snapshot.serverTime) / 1000,
          );
        }
        this.player.questId = self.questId || null;
        this.player.questProgress = { ...(self.questProgress || {}) };
        this.player.completedQuests = [...(self.completedQuests || [])];
        this.player.killCounts = { ...(self.killCounts || {}) };
        this.player.achievements = [...(self.achievements || [])];
        this.player.claimedAchievements = [...(self.claimedAchievements || [])];
        this.player.totalKills = self.totalKills || 0;
        this.player.bounty = self.bounty ? { ...self.bounty } : null;
        this.player.bountyCompletions = self.bountyCompletions || 0;
        this.player.sabacWins = self.sabacWins || 0;
        this.player.gatheringLevel = self.gatheringLevel || 1;
        this.player.gatheringExp = self.gatheringExp || 0;
        this.player.gatheringCount = self.gatheringCount || 0;
        this.player.recalc();
        this.player.hp = clamp(self.hp, 0, this.player.maxHp);
        this.player.mp = clamp(self.mp, 0, this.player.maxMp);
        if (previousAuthorityVersion > 0 && self.level > previousLevel) this.announceLevelUp(self.level);
        this.onQuest?.();
      }
    }
    const previous = new Map(this.remotePlayers.map((player) => [player.networkId, player]));
    this.remotePlayers = snapshot.players
      .filter((entry) => entry.id !== ownId && entry.mapId === this.mapId && CLASSES[entry.classId])
      .map((entry) => {
        this.assets.ensurePlayerAnim?.(entry.classId)?.catch((error) => console.error(error));
        const remote = previous.get(entry.id) || {
          type: 'player',
          remote: true,
          networkId: entry.id,
          id: `remote:${entry.id}`,
          x: entry.x,
          y: entry.y,
          targetX: entry.x,
          targetY: entry.y,
          animFrame: 0,
          jumpY: 0,
          shieldT: 0,
          hitT: 0,
          alive: true,
          r: 18,
        };
        Object.assign(remote, {
          name: entry.name,
          classId: entry.classId,
          def: CLASSES[entry.classId],
          level: entry.level,
          targetX: entry.x,
          targetY: entry.y,
          hp: entry.hp,
          maxHp: entry.maxHp,
          facing: entry.facing,
          direction: entry.direction || remote.direction || 's',
          anim: entry.anim || 'idle',
          pkPoints: entry.pkPoints || 0,
          crimeT: entry.crimeT || 0,
          pkMode: entry.pkMode || 'peace',
          teamId: entry.teamId || null,
          guildId: entry.guildId || null,
          shieldT: Math.max(0, ((entry.shieldUntil || 0) - snapshot.serverTime) / 1000),
          alive: entry.hp > 0,
        });
        return remote;
      });
    const previousPets = new Map(this.networkPets.map((pet) => [pet.id, pet]));
    if ((snapshot.pets || []).some((entry) => entry.mapId === this.mapId && entry.hp > 0)) {
      this.assets.ensureMobAnim?.('skeleton')?.catch((error) => console.error(error));
    }
    this.networkPets = (snapshot.pets || [])
      .filter((entry) => entry.mapId === this.mapId && entry.ownerId !== ownId && entry.hp > 0)
      .map((entry) => {
        const pet = previousPets.get(entry.id) || {
          type: 'pet',
          networkPet: true,
          id: entry.id,
          r: entry.r || 15,
          animFrame: 0,
          alive: true,
        };
        Object.assign(pet, {
          name: entry.name || `${entry.ownerName || '玩家'}的骷髅`,
          ownerId: entry.ownerId,
          x: entry.x,
          y: entry.y,
          serverX: entry.x,
          serverY: entry.y,
          hp: entry.hp,
          maxHp: entry.maxHp,
          direction: entry.direction || pet.direction || 's',
          facing: entry.facing === -1 ? -1 : entry.facing === 1 ? 1 : pet.facing,
          anim: entry.anim || 'idle',
          alive: entry.hp > 0,
        });
        return pet;
      });
    const ownPet = (snapshot.pets || []).find((entry) => entry.ownerId === ownId && entry.mapId === this.mapId && entry.hp > 0);
    if (ownPet) {
      const pet = this.player.pet?.networkPet ? this.player.pet : {
        type: 'pet', networkPet: true, id: ownPet.id, r: ownPet.r || 15, animFrame: 0, alive: true,
      };
      Object.assign(pet, {
        name: ownPet.name,
        x: ownPet.x,
        y: ownPet.y,
        serverX: ownPet.x,
        serverY: ownPet.y,
        hp: ownPet.hp,
        maxHp: ownPet.maxHp,
        direction: ownPet.direction || pet.direction || 's',
        facing: ownPet.facing === -1 ? -1 : ownPet.facing === 1 ? 1 : pet.facing,
        anim: ownPet.anim || 'idle',
        alive: ownPet.hp > 0,
      });
      this.player.pet = pet;
    } else if (this.player.pet?.networkPet) {
      this.player.pet = null;
    }
    const previousMonsters = new Map(
      this.monsters.filter((monster) => monster.networkMonster).map((monster) => [monster.networkId, monster]),
    );
    const localBosses = this.monsters.filter((monster) => monster.boss && !monster.networkMonster);
    const networkMonsters = (snapshot.monsters || [])
      .filter((entry) => entry.mapId === this.mapId && MONSTERS[entry.kind])
      .map((entry) => {
        this.assets.ensureMobAnim?.(entry.kind)?.catch((error) => console.error(error));
        const monster = previousMonsters.get(entry.id) || new Monster(entry.kind, entry.x, entry.y);
        monster.networkMonster = true;
        monster.networkId = entry.id;
        monster.serverX = entry.x;
        monster.serverY = entry.y;
        monster.hp = entry.hp;
        monster.maxHp = entry.maxHp;
        monster.alive = entry.alive;
        monster.respawnAt = entry.respawnAt || 0;
        monster.targetId = entry.targetId;
        monster.direction = entry.direction || monster.direction;
        monster.facing = entry.facing === -1 ? -1 : entry.facing === 1 ? 1 : monster.facing;
        monster.serverAnim = entry.anim || 'idle';
        monster.combatVersion = entry.combatVersion || 0;
        if (!monster.alive) monster.anim = 'death';
        return monster;
      });
    this.monsters = [...networkMonsters, ...localBosses];
    const existingNetworkDrops = new Map(
      this.drops.filter((drop) => drop.networkDrop).map((drop) => [drop.networkId, drop]),
    );
    const localDrops = this.drops.filter((drop) => !drop.networkDrop);
    const networkDrops = (snapshot.drops || [])
      .filter((entry) => entry.mapId === this.mapId)
      .map((entry) => {
        const drop = existingNetworkDrops.get(entry.id) || new Drop(
          entry.x,
          entry.y,
          entry.entry?.id || null,
          entry.gold || 0,
          {
            ownerId: entry.ownerId,
            protectedUntil: Math.max(0, this.time + ((entry.protectedUntil || 0) - snapshot.serverTime) / 1000),
            ttl: Math.max(1, ((entry.expiresAt || snapshot.serverTime + 1000) - snapshot.serverTime) / 1000),
            entry: entry.entry ? normalizeItemEntry(entry.entry) : null,
            droppedBy: entry.source,
          },
        );
        drop.networkDrop = true;
        drop.networkId = entry.id;
        drop.x = entry.x;
        drop.y = entry.y;
        drop.ownerId = entry.ownerId || null;
        drop.protectedUntil = Math.max(0, this.time + ((entry.protectedUntil || 0) - snapshot.serverTime) / 1000);
        drop.t = Math.max(1, ((entry.expiresAt || snapshot.serverTime + 1000) - snapshot.serverTime) / 1000);
        drop.pickupRequested = false;
        return drop;
      });
    this.drops = [...localDrops, ...networkDrops];
    for (const bossState of snapshot.bosses || []) {
      if (bossState.mapId !== this.mapId) continue;
      const boss = this.monsters.find((monster) => monster.kind === bossState.id && monster.boss);
      if (!boss) continue;
      boss.networkBoss = true;
      boss.serverX = bossState.x;
      boss.serverY = bossState.y;
      boss.x = bossState.x;
      boss.y = bossState.y;
      boss.serverAnim = bossState.anim || (bossState.alive ? 'idle' : 'death');
      boss.direction = bossState.direction || boss.direction;
      boss.facing = bossState.facing === -1 ? -1 : bossState.facing === 1 ? 1 : boss.facing;
      boss.targetId = bossState.targetId || null;
      boss.combatVersion = bossState.combatVersion || 0;
      boss.maxHp = bossState.maxHp;
      boss.hp = bossState.hp;
      if (bossState.alive && !boss.alive) {
        boss.alive = true;
        boss.anim = 'idle';
        boss.animFrame = 0;
        boss.deathUntil = 0;
        boss.respawnAt = 0;
      } else if (!bossState.alive && boss.alive) {
        boss.alive = false;
        boss.anim = 'death';
        boss.animFrame = 0;
        boss.deathUntil = this.time + 1.2;
        boss.respawnAt = Number.POSITIVE_INFINITY;
      }
    }
  }

  applyNetworkEvent(event) {
    if (!event) return;
    if (event.type === 'trade_complete') {
      this.player.bag = (event.bag || []).map((entry) => normalizeItemEntry(entry)).filter(Boolean);
      this.player.gold = Math.max(0, Number(event.gold) || 0);
      this.player.selectedBag = -1;
      this.onHint?.('交易完成，物品与金币已到账');
      this.log('面对面交易完成', 'loot');
      this.onSfx?.('buy');
      this.persist();
      return;
    }
    if (event.type === 'boss_reward') {
      const protection = event.ownerIds?.includes(this.networkPlayerId)
        ? '，你所在队伍拥有首轮拾取权'
        : '';
      const levelUp = event.levels?.length ? `升级至 Lv.${event.levels.at(-1)}！` : '';
      this.onHint?.(`${levelUp}${event.bossName}贡献第${event.rank}名：+${event.xp || 0}经验${protection}`);
      this.log(`世界Boss贡献结算 · 第${event.rank}名 · ${event.xp || 0}经验`, 'loot');
      return;
    }
    if (event.type === 'pvp_hit') {
      const target = this.remotePlayers.find((entry) => entry.networkId === event.targetId);
      if (target) {
        this.applyVisualRecoil(target, this.player, event.critical ? 10 : 5);
        target.hitT = 0.16;
        this.spawnEffect(
          target.x,
          target.y - 12,
          event.critical ? 28 : 19,
          event.critical ? '#ffd866' : event.magical ? '#77baff' : '#ff654f',
          event.critical ? 0.34 : 0.26,
          event.critical ? 'crit_hit' : event.magical ? 'magic_hit' : 'hit',
        );
        this.float(target.x, target.y - 32, `${event.critical ? '暴击 ' : ''}-${event.damage || 0}`, event.critical ? '#ffd866' : '#ff6b6b');
        this.shake = Math.min(12, this.shake + (event.critical ? 6 : 2));
        this.impactT = Math.max(this.impactT, event.critical ? 0.16 : 0.09);
        this.onSfx?.(event.critical ? 'crit' : 'hit', this.soundOptionsAt(target, event.critical ? 1.08 : 1));
      }
      return;
    }
    if (event.type === 'pvp_miss') {
      const target = this.remotePlayers.find((entry) => entry.networkId === event.targetId);
      if (target) {
        this.float(target.x, target.y - 30, '闪避', '#8ff0ff');
        this.spawnEffect(target.x, target.y - 12, 30, '#8ff0ff', 0.34, 'dodge');
        this.onSfx?.('dodge', this.soundOptionsAt(target, 0.8));
      }
      return;
    }
    if (event.type === 'pvp_damage') {
      const attacker = this.remotePlayers.find((entry) => entry.networkId === event.attackerId)
        || { x: this.player.x - (this.player.facing || 1) * 52, y: this.player.y };
      this.applyVisualRecoil(this.player, attacker, event.critical ? 11 : 6);
      this.player.hitT = 0.18;
      this.spawnEffect(
        this.player.x,
        this.player.y - 12,
        event.critical ? 30 : 21,
        event.critical ? '#ffd866' : event.magical ? '#77baff' : '#ff654f',
        event.critical ? 0.36 : 0.28,
        event.critical ? 'crit_hit' : event.magical ? 'magic_hit' : 'hit',
      );
      this.float(this.player.x, this.player.y - 34, `${event.critical ? '暴击 ' : ''}-${event.damage || 0}`, event.critical ? '#ffd866' : '#ff6b6b');
      this.shake = Math.min(12, this.shake + (event.critical ? 7 : 3));
      this.impactT = Math.max(this.impactT, event.critical ? 0.18 : 0.11);
      this.onSfx?.('playerHit', this.soundOptionsAt(this.player, event.critical ? 1.12 : 1));
      return;
    }
    if (event.type === 'pvp_death') {
      const losses = (event.lostItems?.length || event.lostGold || event.lostExperience)
        ? ` · 掉落${event.lostItems?.length || 0}件物品/${event.lostGold || 0}金币，损失${event.lostExperience || 0}经验`
        : '';
      this.onHint?.(`被 ${event.killer?.name || '玩家'} 击败，已回到比奇城${losses}`);
      this.onSfx?.('playerDeath');
      return;
    }
    if (event.type === 'pve_death') {
      const losses = `掉落${event.lostItems?.length || 0}件物品/${event.lostGold || 0}金币，损失${event.lostExperience || 0}经验`;
      this.onHint?.(`被 ${event.monsterName || '怪物'} 击败 · ${losses}`);
      return;
    }
    if (event.type === 'monster_hit') {
      const monster = this.monsters.find((entry) => entry.networkId === event.monsterId);
      if (monster) {
        this.applyVisualRecoil(monster, this.player, event.critical ? 10 : monster.elite || monster.boss ? 7 : 4.5);
        this.spawnEffect(monster.x, monster.y - 10, event.critical ? 28 : 18, event.critical ? '#ffd866' : '#ff654f', 0.28, event.critical ? 'crit_hit' : 'hit');
        this.float(monster.x, monster.y - 30, `${event.critical ? '暴击 ' : ''}-${event.damage}`, event.critical ? '#ffd866' : '#ff6b6b');
        this.shake = Math.min(12, this.shake + (event.critical ? 6 : monster.elite ? 3 : 1.5));
        this.impactT = Math.max(this.impactT, event.critical ? 0.16 : monster.elite ? 0.11 : 0.07);
        this.onSfx?.(event.critical ? 'crit' : 'hit', this.soundOptionsAt(monster, event.critical ? 1.08 : 1));
      }
      return;
    }
    if (event.type === 'skill_heal') {
      this.float(this.player.x, this.player.y - 28, `+${event.amount || 0}`, '#2ecc71');
      return;
    }
    if (event.type === 'skill_level') {
      const skill = this.player.def.skills.find((entry) => entry.id === event.skillId);
      this.onHint?.(`${skill?.name || event.skillId}修炼至 ${event.level} 级`);
      return;
    }
    if (event.type === 'pet_hit' || event.type === 'poison_tick') {
      const monster = this.monsters.find((entry) => entry.networkId === event.monsterId);
      if (monster) {
        const color = event.type === 'poison_tick' ? '#5bd66f' : '#d8d8d8';
        this.applyVisualRecoil(monster, this.player.pet || this.player, event.critical ? 7 : 3.5);
        this.spawnEffect(monster.x, monster.y - 8, 18, color, 0.26, event.type === 'poison_tick' ? 'poison' : 'hit');
        this.float(monster.x, monster.y - 28, `-${event.damage || 0}`, color);
        this.onSfx?.(
          event.type === 'poison_tick' ? 'poison' : event.critical ? 'crit' : 'hit',
          this.soundOptionsAt(monster, event.critical ? 1.05 : 0.9),
        );
      }
      return;
    }
    if (event.type === 'pve_reward') {
      const levelUp = event.levels?.length ? `升级至 Lv.${event.levels.at(-1)}！` : '';
      this.onHint?.(`${levelUp}${MONSTERS[event.kind]?.name || '怪物'} +${event.xp || 0}经验${event.teamSize > 1 ? ` · ${event.teamSize}人组队分配` : ''}`);
      return;
    }
    if (event.type === 'monster_damage' || event.type === 'monster_charge'
      || event.type === 'monster_poison_damage') {
      const poisoned = event.type === 'monster_poison_damage';
      const charged = event.type === 'monster_charge';
      const color = poisoned ? '#63d46f' : event.magical ? '#77baff' : '#ff6b6b';
      const source = this.monsters.find((entry) => entry.networkId === event.monsterId)
        || this.monsters.find((entry) => entry.kind === event.kind && entry.alive)
        || { x: this.player.x - (this.player.facing || 1) * 48, y: this.player.y };
      this.applyVisualRecoil(this.player, source, charged ? 11 : poisoned ? 3 : 5.5);
      this.spawnEffect(
        this.player.x,
        this.player.y - 12,
        charged ? 34 : 22,
        color,
        charged ? 0.38 : 0.28,
        poisoned ? 'poison' : charged ? 'crit_hit' : event.magical ? 'magic_hit' : 'hit',
      );
      this.float(this.player.x, this.player.y - 34, `-${event.damage || 0}`, color);
      this.shake = Math.min(12, this.shake + (charged ? 7 : poisoned ? 0.8 : 2.5));
      this.impactT = Math.max(this.impactT, charged ? 0.18 : poisoned ? 0.04 : 0.1);
      this.onSfx?.('playerHit', this.soundOptionsAt(this.player, charged ? 1.12 : 1));
      if (charged) this.onHint?.(`${MONSTERS[event.kind]?.name || '怪物'}发动冲锋！`);
      return;
    }
    if (event.type === 'quest_completed') {
      const quest = QUESTS.find((entry) => entry.id === event.questId);
      const levelUp = event.levels?.length ? ` · 升级至 Lv.${event.levels.at(-1)}！` : '';
      this.onHint?.(`任务完成：${quest?.name || event.questId}${levelUp}`);
      this.onSfx?.('quest');
      return;
    }
    if (event.type === 'quest_status') {
      const quest = QUESTS.find((entry) => entry.id === event.questId);
      this.onHint?.(`${quest?.name || '任务'}：条件尚未完成`);
      return;
    }
    if (event.type === 'bounty_started') {
      this.onHint?.(`新悬赏：${event.bounty?.name || '猎杀任务'}`);
      this.onSfx?.('quest');
      return;
    }
    if (event.type === 'bounty_status') {
      const bounty = BOUNTIES.find((entry) => entry.id === event.bountyId);
      this.onHint?.(`${bounty?.name || '悬赏'}：${event.progress || 0}/${event.count || bounty?.count || 0}`);
      return;
    }
    if (event.type === 'bounty_completed') {
      const levelUp = event.levels?.length ? ` · 升级至 Lv.${event.levels.at(-1)}！` : '';
      this.onHint?.(`悬赏完成：${event.name || ''} · +${event.reward?.xp || 0}经验 +${event.reward?.gold || 0}金币${levelUp}`);
      this.onSfx?.('quest');
      return;
    }
    if (event.type === 'achievement_unlocked') {
      const achievement = ACHIEVEMENTS.find((entry) => entry.id === event.achievementId);
      if (achievement) this.onAchievement?.(achievement);
      this.onHint?.(`成就解锁：${event.name || achievement?.name || ''}`);
      this.onSfx?.('achievement');
      return;
    }
    if (event.type === 'achievement_claimed') {
      this.onHint?.(`领取成就奖励 +${event.reward || 0} 金币`);
      return;
    }
    if (event.type === 'skill_learned') {
      const skill = this.player.def.skills.find((entry) => entry.id === event.skillId);
      this.onHint?.(`学会技能：${skill?.name || event.skillId}`);
      return;
    }
    if (event.type === 'equipment_enhanced') {
      this.onHint?.(event.destroyed
        ? `${ITEMS[event.itemId]?.name || '武器'}升级失败，武器破碎！`
        : event.success ? `武器升级成功 +${event.level}` : `武器升级失败，等级不变`);
      this.onSfx?.(event.success ? 'forge' : 'forgeFail');
      return;
    }
    if (event.type === 'weapon_luck') {
      const results = {
        luck_up: `幸运提升至 +${event.luck}`,
        curse_down: `诅咒降低至 ${event.curse}`,
        curse_up: `武器受到诅咒 ${event.curse}`,
        unchanged: '祝福无效',
      };
      this.onHint?.(`祝福油：${results[event.outcome] || '无变化'}`);
      this.onSfx?.(['luck_up', 'curse_down'].includes(event.outcome) ? 'forge' : 'forgeFail');
      return;
    }
    if (event.type === 'healed_full') {
      this.onHint?.(event.cost ? `伤势已痊愈，支付 ${event.cost} 金币` : '伤势已痊愈（新人免费）');
      return;
    }
    if (event.type === 'sabac_gate_hit') {
      const gate = MAPS.sabac.siegeGate;
      this.player.anim = 'attack';
      this.player.animT = COMBAT_RULES.attackRecovery;
      this.spawnEffect(gate.x * T, gate.y * T - 48, 46, '#e1833d', 0.42, 'hit');
      this.float(gate.x * T, gate.y * T - 92, `城门 -${event.damage || 0}`, '#ffb46b');
      return;
    }
    if (event.type === 'loot_picked') {
      this.onHint?.(event.entry?.id
        ? `拾取 ${ITEMS[event.entry.id]?.name || event.entry.id}`
        : `拾取 ${event.gold || 0} 金币`);
      return;
    }
    const messages = {
      friend_request: `${event.from?.name || '玩家'}请求加你为好友`,
      friend_accept: `${event.from?.name || '玩家'}已成为你的好友`,
      team_invite: `${event.from?.name || '玩家'}邀请你组队`,
      team_join: `${event.player?.name || '玩家'}加入了队伍`,
      team_kicked: `你被${event.leader?.name || '队长'}移出队伍`,
      team_promoted: `${event.leader?.name || '玩家'}成为新队长`,
      guild_invite: `${event.guild?.name || '行会'}邀请你加入`,
      guild_join: `${event.player?.name || '玩家'}加入了行会`,
      guild_created: `行会${event.guild?.name || ''}创建成功`,
      guild_kicked: `你被移出${event.guildName || '行会'}`,
      guild_promoted: `${event.leader?.name || '玩家'}成为${event.guildName || '行会'}新会长`,
      trade_request: `${event.from?.name || '玩家'}请求与你交易`,
      trade_active: '交易窗口已开启',
      trade_cancelled: '交易已取消',
      guild_war_started: `${event.guildAName || '行会'}向${event.guildBName || '行会'}宣战`,
      sabac_started: '沙巴克攻城战已经开始',
      sabac_gate_broken: '沙巴克城门已破，皇宫争夺开始！',
      sabac_captured: `${event.guildName || '行会'}占领了沙巴克，获得 ${event.reward || 0} 金币`,
      sabac_ended: `攻城结束，沙巴克归属：${event.ownerGuildName || '无主'}`,
      guild_war_ended: `行会战结束，比分 ${event.scoreA || 0}:${event.scoreB || 0}${event.reward ? `，胜方奖励 ${event.reward} 金币` : ''}`,
      pvp_kill: `击败玩家 ${event.target?.name || ''}`,
    };
    if (messages[event.type]) {
      this.onHint?.(messages[event.type]);
      this.log(messages[event.type], 'system');
    }
  }

  announceLevelUp(level) {
    this.onHint?.(`升级！当前等级 Lv.${level}`);
    this.log(`角色升级至 Lv.${level} · 生命与魔法已恢复`, 'achievement');
    this.float(this.player.x, this.player.y - 54, `LEVEL UP · ${level}`, '#ffd866');
    this.spawnEffect(this.player.x, this.player.y - 8, 64, '#ffd866', 0.9, 'ring');
    this.onSfx?.('achievement');
  }

  showChatMessage(message) {
    if (!message?.id || message.channel === 'system' || this.seenChatMessageIds.has(message.id)) return;
    this.seenChatMessageIds.add(message.id);
    if (this.seenChatMessageIds.size > 120) {
      const keep = [...this.seenChatMessageIds].slice(-60);
      this.seenChatMessageIds.clear();
      keep.forEach((id) => this.seenChatMessageIds.add(id));
    }
    const speaker = message.fromId === this.networkPlayerId
      ? this.player
      : this.remotePlayers.find((entry) => entry.networkId === message.fromId);
    if (!speaker) return;
    speaker.chatBubble = {
      text: String(message.text || '').slice(0, 36),
      channel: message.channel || 'nearby',
      until: this.time + 5,
    };
  }

  log(message, type = 'system') {
    this.onLog?.({ message, type, time: this.time });
  }

  spawnEffect(x, y, r, color, t, kind, angle = null) {
    const effect = new Effect(x, y, r, color, t, kind);
    effect.angle = angle;
    this.effects.push(effect);
    if (this.effects.length > 48) this.effects.splice(0, this.effects.length - 48);
  }

  spawnGroundContact(actor, running = false) {
    const colors = {
      bich: '#b7a270',
      field: '#a8a16a',
      valley: '#66a67e',
      cave: '#8b705b',
      stone_tomb: '#9b6551',
      centipede_cave: '#81934f',
      temple: '#766b70',
      sanctum: '#81515a',
      sabac: '#b08a58',
    };
    this.spawnEffect(
      actor.x,
      actor.y + 4,
      running ? 20 : 14,
      colors[this.mapId] || '#9a8568',
      running ? 0.34 : 0.28,
      'footstep',
      Math.atan2(this.input.moveY || 0, this.input.moveX || actor.facing || 1),
    );
  }

  applyVisualRecoil(target, attacker, strength = 4) {
    if (!target || !attacker) return;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    target.hitOffsetX = dx / length * strength;
    target.hitOffsetY = dy / length * strength * 0.45;
  }

  decayVisualRecoil(actor, dt) {
    if (!actor) return;
    const damping = Math.exp(-20 * dt);
    actor.hitOffsetX = (actor.hitOffsetX || 0) * damping;
    actor.hitOffsetY = (actor.hitOffsetY || 0) * damping;
    if (Math.abs(actor.hitOffsetX) < 0.08) actor.hitOffsetX = 0;
    if (Math.abs(actor.hitOffsetY) < 0.08) actor.hitOffsetY = 0;
  }

  soundOptionsAt(actor, gain = 1) {
    if (!actor) return { gain };
    const viewportHalf = Math.max(220, (this.viewW || 900) * 0.5);
    const pan = clamp((actor.x - this.cam.x) / viewportHalf, -0.88, 0.88);
    const distanceGain = actor === this.player
      ? 1
      : clamp(1 - dist(this.player, actor) / 1150, 0.34, 1);
    return {
      gain: gain * distanceGain,
      pan,
      emitter: actor.networkId || actor.id || actor.kind || undefined,
    };
  }

  footstepSfxForMap() {
    if (['field', 'valley'].includes(this.mapId)) return 'footstepGrass';
    if (['cave', 'centipede_cave'].includes(this.mapId)) return 'footstepCave';
    return 'footstepStone';
  }

  monsterAttackSfx(kind) {
    if (['deer', 'wolf', 'boar', 'bat'].includes(kind)) return 'beastAttack';
    if (['zombie', 'skeleton'].includes(kind)) return 'undeadAttack';
    if (['orc', 'guardian', 'lord'].includes(kind)) return 'demonAttack';
    return 'monsterAttack';
  }

  ambientSfxForMap() {
    if (['bich', 'sabac'].includes(this.mapId)) return 'ambientTown';
    if (['field', 'valley'].includes(this.mapId)) return 'ambientWild';
    return 'ambientDungeon';
  }

  updateMonsterFootstep(monster, moving, previousFrame, nextFrame, sameState = true) {
    if (!moving || dist(this.player, monster) > 520) return;
    const frameCount = this.assets.directionalMobAnim?.[monster.kind]?.walk?.[monster.direction]?.length
      || this.assets.mobAnim?.[monster.kind]?.walk?.length
      || mobDirectionalFrameCount(monster.kind, 'walk', monster.direction)
      || 4;
    const contacts = contactFramesFor('walk', frameCount);
    if (!contactFrameCrossings(previousFrame, nextFrame, frameCount, contacts, sameState)) return;
    this.onSfx?.(this.footstepSfxForMap(), this.soundOptionsAt(monster, monster.boss ? 0.72 : 0.38));
  }

  float(x, y, text, color) {
    this.floats.push(new FloatingText(x, y, text, color));
    if (this.floats.length > 32) this.floats.splice(0, this.floats.length - 32);
  }

  gainSkillProficiency(skillId, amount = 1) {
    const skill = this.player.skillDef(skillId);
    if (!skill) return;
    const result = this.player.gainSkillExp(skillId, amount);
    if (!result.leveled) return;
    this.onHint?.(`${skill.name}修炼至 ${result.level} 级`);
    this.log(`技能「${skill.name}」达到 ${result.level} 级`, 'skill');
    this.onSfx?.('level');
    this.checkAchievements();
    this.persist();
  }

  equippedEntry(slot) {
    const equipped = this.player.equip[slot];
    if (!equipped) return null;
    if (typeof equipped === 'string') {
      this.player.equip[slot] = normalizeItemEntry(equipped, {
        enhance: this.player.enhance[slot] || 0,
      });
    }
    return this.player.equip[slot];
  }

  damageDurability(slot, amount = 1) {
    const entry = this.equippedEntry(slot);
    if (!entry || entry.durability <= 0) return false;
    entry.durability = Math.max(0, entry.durability - Math.max(1, amount));
    if (entry.durability === 0) {
      const item = ITEMS[entry.id];
      this.player.recalc();
      this.onHint?.(`${item?.name || '装备'}耐久耗尽，已失去属性`);
      this.log(`${item?.name || '装备'}已损坏，请回城修理`, 'gear');
      this.onSfx?.('forgeFail');
      this.persist();
    }
    return true;
  }

  wearArmor() {
    const candidates = EQUIP_SLOTS.filter((slot) => slot !== 'weapon' && this.equippedEntry(slot)?.durability > 0);
    if (!candidates.length) return;
    this.damageDurability(candidates[randInt(0, candidates.length - 1)]);
  }

  applyDamage(attacker, target, amount, magical = false, skillId = null) {
    if (!target.alive || amount <= 0) return 0;
    if (this.multiplayerActive && target.networkMonster && attacker?.type === 'player') {
      this.onNetworkMonsterAttack?.(target, skillId);
      return 0;
    }
    if (attacker?.type === 'player' && target.type === 'player') {
      if (!this.canAttackPlayer(attacker, target)) {
        if (attacker.id === this.player.id) this.onHint?.(this.map.safe ? '安全区内禁止PK' : '当前攻击模式不能攻击该玩家');
        return 0;
      }
      if ((target.pkPoints || 0) < 100 && (target.crimeT || 0) <= 0) attacker.crimeT = Math.max(60, attacker.crimeT || 0);
    }
    if (attacker === this.player || target === this.player) {
      this.combatLockUntil = Math.max(this.combatLockUntil, this.time + (target.type === 'player' ? 5 : 3));
    }
    if (target.type === 'player' && Math.random() < (target.dodge || 0)) {
      this.float(target.x, target.y - 30, '闪避', '#8ff0ff');
      this.spawnEffect(target.x, target.y - 12, 30, '#8ff0ff', 0.34, 'dodge');
      this.onSfx?.('dodge');
      return 0;
    }
    let dmg = amount;
    if (target.type === 'player' && target.shieldT > 0) dmg *= 0.45;
    if (magical) dmg = Math.max(1, dmg - (target.magDef || 0) * 0.65);
    else dmg = Math.max(1, dmg - (target.defense || 0) * 0.7);

    const boostId = attacker?.boost?.id;
    const boostLevel = boostId && attacker?.skillLevel ? Math.max(1, attacker.skillLevel(boostId)) : 1;
    if (boostId === 'thrust' && !magical) dmg += (10 + (attacker.level || 1) * 2) * (1 + (boostLevel - 1) * 0.22);
    if (boostId === 'fire_sword' && !magical) dmg *= 2.15 + boostLevel * 0.35;
    if (attacker?.boost && (attacker.boost.id === 'thrust' || attacker.boost.id === 'fire_sword')) {
      attacker.boost = null;
    }
    const slashLevel = attacker?.classId === 'warrior' && attacker?.skillLevel ? attacker.skillLevel('slash') : 0;
    if (slashLevel && !magical) dmg *= 1 + slashLevel * 0.08;
    const crit = attacker?.type === 'player' && Math.random() < (attacker.crit || 0);
    if (crit) dmg *= 1.75;

    dmg = Math.round(dmg);
    target.hp -= dmg;
    this.applyVisualRecoil(target, attacker, crit ? 10 : target.elite || target.boss ? 7 : 4.5);
    if (target.boss && attacker?.type === 'player' && this.multiplayerActive) {
      this.onBossDamage?.(target, dmg);
    }
    target.hitT = 0.16;
    if (attacker?.type === 'player' && target.type === 'monster'
      && ['pack', 'swarm'].includes(target.behavior)) {
      for (const ally of this.monsters) {
        if (!ally.alive || ally === target || ally.behavior !== target.behavior || dist(ally, target) > 190) continue;
        ally.target = attacker;
      }
    }
    this.shake = Math.min(12, this.shake + (crit ? 6 : target.elite ? 3 : 1.5));
    this.impactT = Math.max(this.impactT, crit ? 0.16 : target.elite ? 0.11 : 0.07);
    this.spawnEffect(
      target.x,
      target.y - 10,
      crit ? 28 : 18,
      crit ? '#ffd866' : magical ? '#69b9ff' : '#ff654f',
      crit ? 0.34 : 0.24,
      crit ? 'crit_hit' : magical ? 'magic_hit' : 'hit',
    );
    this.float(target.x, target.y - 30, `${crit ? '暴击 ' : ''}-${dmg}`, crit ? '#ffd866' : magical ? '#5dade2' : '#ff6b6b');
    if (attacker?.type === 'player' && attacker.lifesteal > 0) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + dmg * attacker.lifesteal);
    }
    this.onSfx?.(
      target === this.player ? 'playerHit' : crit ? 'crit' : 'hit',
      this.soundOptionsAt(target, crit ? 1.08 : 1),
    );
    if (target.type === 'player' && Math.random() < 0.12) this.wearArmor();
    if (attacker?.type === 'player' && !magical && slashLevel) this.gainSkillProficiency('slash', 1);
    if (attacker?.type === 'player' && boostId && !magical) this.gainSkillProficiency(boostId, boostId === 'fire_sword' ? 5 : 2);
    if (target.hp <= 0) {
      target.hp = 0;
      this.kill(attacker, target);
    }
    return dmg;
  }

  onKillQuest(kind) {
    const p = this.player;
    p.killCounts[kind] = (p.killCounts[kind] || 0) + 1;
    const bounty = BOUNTIES.find((entry) => entry.id === p.bounty?.id);
    if (bounty?.monster === kind) {
      p.bounty.progress = Math.min(bounty.count, (p.bounty.progress || 0) + 1);
      this.onHint?.(`悬赏进度 ${bounty.name} ${p.bounty.progress}/${bounty.count}`);
    }
    const q = QUESTS.find((x) => x.id === p.questId);
    if (!q) {
      this.onQuest?.();
      this.checkAchievements();
      return;
    }
    for (const step of q.steps) {
      if (step.type === 'kill' && step.monster === kind) {
        p.questProgress[kind] = (p.questProgress[kind] || 0) + 1;
        this.onHint?.(`任务进度 ${MONSTERS[kind].name} ${p.questProgress[kind]}/${step.count}`);
      }
    }
    this.onQuest?.();
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
      if (!p.questReady) {
        p.questReady = true;
        this.onHint?.('任务目标完成，回比奇城找卫士队长复命');
        this.log(`「${q.name}」目标完成，等待复命`, 'quest');
        this.onQuest?.();
        this.persist();
      }
      return true;
    }
    p.questReady = false;
    return false;
  }

  completeQuest(q) {
    const p = this.player;
    if (p.completedQuests.includes(q.id)) return;
    // take collect items
    for (const step of q.steps) {
      if (step.type === 'collect') p.removeItemId(step.item, step.count);
    }
    p.completedQuests.push(q.id);
    p.questReady = false;
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
    if (this.multiplayerActive && this.onServerAction) {
      this.onServerAction({ type: 'claim_achievement', achievementId: id });
      return true;
    }
    p.claimedAchievements.push(id);
    p.gold += a.reward;
    this.onHint?.(`领取成就奖励 +${a.reward} 金币`);
    this.log(`领取「${a.name}」奖励 ${a.reward} 金币`, 'loot');
    this.persist();
    return true;
  }

  talkQuest(npcId) {
    const p = this.player;
    if (this.multiplayerActive && this.onServerAction) {
      this.onServerAction({ type: 'quest_interact', npcId });
      return;
    }
    const q = QUESTS.find((x) => x.id === p.questId);
    if (!q) {
      const active = BOUNTIES.find((entry) => entry.id === p.bounty?.id);
      if (!active) {
        const eligible = BOUNTIES.filter((entry) => p.level >= entry.reqLevel);
        if (!eligible.length) {
          this.onHint?.('卫士队长：十二级后再来领取悬赏。');
          return;
        }
        const bounty = eligible[p.bountyCompletions % eligible.length];
        p.bounty = { id: bounty.id, progress: 0 };
        this.onHint?.(`领取悬赏：${bounty.name}`);
      } else if ((p.bounty.progress || 0) < active.count) {
        this.onHint?.(`${active.name}：${p.bounty.progress || 0}/${active.count}`);
      } else {
        p.addXp(active.reward.xp || 0);
        p.gold += active.reward.gold || 0;
        for (const reward of active.reward.items || []) p.addItem(reward.id, reward.qty);
        p.bountyCompletions += 1;
        p.bounty = null;
        this.onHint?.(`悬赏完成：+${active.reward.xp}经验 +${active.reward.gold}金币`);
        this.checkAchievements();
      }
      this.onQuest?.();
      this.persist();
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
    victim.anim = 'death';
    victim.animFrame = 0;
    victim.attacking = false;
    if (victim.type === 'monster') {
      this.spawnEffect(
        victim.x,
        victim.y - 12,
        victim.boss ? 76 : victim.elite ? 48 : 32,
        victim.boss ? '#ff784e' : victim.elite ? '#eeb65c' : '#b9a68a',
        victim.boss ? 1 : 0.62,
        'death',
      );
      if (victim.boss && this.multiplayerActive) {
        victim.respawnAt = Number.POSITIVE_INFINITY;
        victim.deathUntil = this.time + 1.2;
        this.onSfx?.('bossDown');
        return;
      }
      const loot = victim.rollDrop();
      const ownerId = (killer?.type === 'player' || killer?.type === 'pet') ? this.player.id : null;
      const protectedUntil = ownerId ? this.time + 10 : 0;
      if (loot.gold > 0) {
        this.drops.push(new Drop(victim.x, victim.y, null, loot.gold, {
          ownerId, protectedUntil, droppedBy: victim.kind,
        }));
      }
      for (const id of loot.items) {
        this.drops.push(new Drop(victim.x + randInt(-14, 14), victim.y + randInt(-14, 14), id, 0, {
          ownerId,
          protectedUntil,
          droppedBy: victim.kind,
          affixChance: victim.boss ? 0.32 : victim.elite ? 0.16 : 0.035,
        }));
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
          this.spawnEffect(p.x, p.y, 72, '#ffd866', 1.1, 'level');
          this.onSfx?.('level');
        }
        this.onKillQuest(victim.kind);
        this.checkAchievements();
      }
      const delay = victim.elite ? 60 : 14 + Math.random() * 10;
      victim.respawnAt = this.time + delay;
      victim.deathUntil = this.time + (victim.boss ? 1.2 : victim.elite ? 1 : 0.8);
      this.onSfx?.(victim.boss ? 'bossDown' : 'kill');
    }
    if (victim.type === 'pet') {
      this.player.pet = null;
    }
    if (victim.type === 'player') {
      victim.deaths = (victim.deaths || 0) + 1;
      if (killer?.type === 'player' && killer.id !== victim.id) this.registerPlayerKill(killer, victim);
      this.dropPlayerLoot(victim);
      victim.xp = Math.max(0, victim.xp - Math.floor(victim.xpNeed() * 0.1));
      this.onDeath?.();
      this.persist();
    }
  }

  pkStatus(player = this.player) {
    if ((player.pkPoints || 0) >= 100) return { id: 'red', name: '红名', color: '#ff4b3e' };
    if ((player.crimeT || 0) > 0) return { id: 'yellow', name: '黄名', color: '#f3c94d' };
    return { id: 'white', name: '白名', color: '#f3eadb' };
  }

  setPkMode(mode) {
    if (!['peace', 'team', 'guild', 'all'].includes(mode)) return false;
    this.player.pkMode = mode;
    const names = { peace: '和平', team: '组队', guild: '行会', all: '全体' };
    this.onHint?.(`攻击模式：${names[mode]}`);
    this.persist();
    return true;
  }

  cyclePkMode() {
    const modes = ['peace', 'team', 'guild', 'all'];
    const index = modes.indexOf(this.player.pkMode);
    this.setPkMode(modes[(index + 1) % modes.length]);
    return this.player.pkMode;
  }

  canAttackPlayer(attacker, target) {
    if (!attacker || !target || attacker.id === target.id || this.map.safe) return false;
    if (attacker.pkMode === 'peace') return false;
    if (attacker.pkMode === 'team' && attacker.teamId && attacker.teamId === target.teamId) return false;
    if (attacker.pkMode === 'guild' && attacker.guildId && attacker.guildId === target.guildId) return false;
    return true;
  }

  registerPlayerKill(killer, victim) {
    killer.playerKills = (killer.playerKills || 0) + 1;
    const justified = (victim.pkPoints || 0) >= 100 || (victim.crimeT || 0) > 0;
    if (!justified) killer.pkPoints = (killer.pkPoints || 0) + 100;
    killer.crimeT = justified ? Math.max(0, killer.crimeT || 0) : 60;
    this.log(
      justified
        ? `${killer.name}击败了危险玩家 ${victim.name}`
        : `${killer.name}恶意击杀 ${victim.name}，PK值 +100`,
      'combat',
    );
  }

  dropPlayerLoot(player) {
    if (this.map.safe) return [];
    const created = [];
    const red = (player.pkPoints || 0) >= 100;
    const bagDropCount = red ? 3 : (player.crimeT || 0) > 0 ? 2 : 1;
    const candidates = player.bag
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => ITEMS[entry.id]?.type !== 'quest');
    for (let i = 0; i < bagDropCount && candidates.length; i++) {
      if (Math.random() > (red ? 0.85 : 0.42)) continue;
      const selected = candidates.splice(randInt(0, candidates.length - 1), 1)[0];
      const currentIndex = player.bag.indexOf(selected.entry);
      if (currentIndex < 0) continue;
      const entry = player.bag.splice(currentIndex, 1)[0];
      const drop = new Drop(player.x + randInt(-22, 22), player.y + randInt(-22, 22), entry.id, 0, {
        entry, droppedBy: 'player', ttl: 180,
      });
      this.drops.push(drop);
      created.push(drop);
    }
    const equippedSlots = EQUIP_SLOTS.filter((slot) => player.equip[slot]);
    const equipChance = red ? 0.52 : (player.crimeT || 0) > 0 ? 0.22 : 0.08;
    if (equippedSlots.length && Math.random() < equipChance) {
      const slot = equippedSlots[randInt(0, equippedSlots.length - 1)];
      const equipped = player.equip[slot];
      const entry = typeof equipped === 'string'
        ? normalizeItemEntry(equipped, { enhance: player.enhance[slot] || 0 })
        : equipped;
      player.equip[slot] = null;
      player.enhance[slot] = 0;
      const drop = new Drop(player.x + randInt(-22, 22), player.y + randInt(-22, 22), entry.id, 0, {
        entry, droppedBy: 'player', ttl: 180,
      });
      this.drops.push(drop);
      created.push(drop);
    }
    const goldRate = red ? 0.12 : 0.05;
    const gold = Math.floor(player.gold * goldRate);
    if (gold > 0) {
      player.gold -= gold;
      const drop = new Drop(player.x, player.y + 18, null, gold, { droppedBy: 'player', ttl: 180 });
      this.drops.push(drop);
      created.push(drop);
    }
    if (created.length) {
      player.recalc();
      this.log(`阵亡掉落 ${created.length} 份物品，红名风险更高`, 'loot');
    }
    return created;
  }

  tryAttack(attacker, target) {
    if (!attacker.alive || !target?.alive) return;
    if (attacker.stun > 0) return;
    if (attacker.attackCd > 0) return;
    const range = (attacker.type === 'player' ? COMBAT_RULES.basicRange : (attacker.range || 50)) + target.r;
    if (dist(attacker, target) > range + COMBAT_RULES.attackLeeway) return;
    const cycle = Math.max(COMBAT_RULES.attackRecovery, 1 / Math.max(0.5, attacker.as || 1));
    attacker.attackCd = cycle;
    this.faceToward(attacker, target.x, target.y);
    attacker.anim = 'attack';
    attacker.animT = COMBAT_RULES.attackRecovery;
    attacker.animFrame = 0;
    attacker.attacking = true;
    attacker.combatAction = {
      target,
      elapsed: 0,
      hitAt: Math.min(COMBAT_RULES.attackWindup, cycle * 0.48),
      duration: COMBAT_RULES.attackRecovery,
      resolved: false,
      skillId: 'basic',
    };
    if (attacker === this.player) {
      this.combatLockUntil = Math.max(this.combatLockUntil, this.time + 3);
      this.onSfx?.('swing', this.soundOptionsAt(attacker));
    } else if (target === this.player) {
      this.onSfx?.(this.monsterAttackSfx(attacker.kind), this.soundOptionsAt(attacker));
    }
  }

  resolveBasicAttack(attacker, target) {
    if (!attacker?.alive || !target?.alive) return;
    const range = (attacker.type === 'player' ? COMBAT_RULES.basicRange : (attacker.range || 50)) + target.r;
    if (dist(attacker, target) > range + COMBAT_RULES.attackLeeway) {
      if (attacker === this.player) this.float(attacker.x, attacker.y - 24, '落空', '#b8b8b8');
      return;
    }
    if (attacker.type === 'player' && target.networkMonster && this.multiplayerActive) {
      this.onNetworkMonsterAttack?.(target, 'basic');
      return;
    }
    if (attacker.type === 'player' && target.networkBoss && this.multiplayerActive) {
      this.onBossDamage?.(target, 0, 'basic');
      return;
    }
    if (attacker.type === 'player' && target.remote) {
      const damage = Math.max(5, (attacker.atk || 5) + (attacker.mag || 0) * 0.45);
      this.onRemoteAttack?.(target, damage, 'basic');
      return;
    }
    const magical = attacker.type === 'monster' && attacker.behavior === 'ranged_caster';
    const baseAttack = magical ? (attacker.mag || attacker.atk) : (attacker.atk || 5);
    let rolledAttack = baseAttack + randInt(0, 4);
    if (attacker.type === 'player' && !magical) {
      const fate = Math.random();
      if ((attacker.weaponLuck || 0) > 0 && fate < attacker.weaponLuck / 7) {
        rolledAttack = baseAttack;
      } else if ((attacker.weaponCurse || 0) > 0 && fate > 1 - attacker.weaponCurse / 7) {
        rolledAttack = baseAttack * 0.68;
      } else {
        rolledAttack = baseAttack * (0.68 + Math.random() * 0.32);
      }
    }
    const dmg = rolledAttack;
    this.applyDamage(attacker, target, dmg, magical);
    if (attacker.type === 'monster' && attacker.behavior === 'venom'
      && target.type === 'player' && Math.random() < 0.36) {
      target.monsterPoison = {
        source: attacker,
        dps: Math.max(2, Math.floor(attacker.atk * 0.18)),
        t: 6,
      };
    }
    if (attacker.type === 'player' && Math.random() < 0.07) this.damageDurability('weapon');
  }

  advanceCombatAction(actor, dt) {
    const action = actor?.combatAction;
    if (!action) return;
    action.elapsed += dt;
    if (!action.resolved && action.elapsed >= action.hitAt) {
      action.resolved = true;
      if (action.kind === 'networkSkill') action.resolve?.();
      else this.resolveBasicAttack(actor, action.target);
    }
    if (action.elapsed >= action.duration) {
      actor.combatAction = null;
      actor.attacking = false;
      actor.animT = 0;
    }
  }

  castSkill(slot) {
    const p = this.player;
    if (!p.alive || this.paused) return;
    const sk = p.def.skills[slot];
    if (!sk || sk.type === 'passive') return;
    const skillState = p.skillState(sk.id);
    if (!skillState.learned) {
      this.onHint?.(`尚未学习 ${sk.name}（需要${sk.reqLevel}级技能书）`);
      return;
    }
    if (p.skillCd[slot] > 0) return;
    if (p.mp < sk.mana) { this.onHint?.('魔法不足'); return; }
    const skillPower = 1 + (Math.max(1, skillState.level) - 1) * 0.18;
    this.onSfx?.(sk.id || 'skill');
    if (this.multiplayerActive && this.onServerAction) {
      this.castNetworkSkill(slot, sk, skillState);
      return;
    }

    if (sk.type === 'boost') {
      p.mp -= sk.mana; p.skillCd[slot] = sk.cd;
      p.boost = { id: sk.id, t: 5 };
      this.spawnEffect(p.x, p.y, sk.id === 'fire_sword' ? 54 : 40, sk.id === 'fire_sword' ? '#ff6b35' : '#f7dc6f', 0.5, sk.id === 'fire_sword' ? 'fire' : 'slash');
      this.onHint?.(`${sk.name} 就绪`);
      return;
    }
    if (sk.type === 'heal') {
      p.mp -= sk.mana; p.skillCd[slot] = sk.cd;
      const heal = (50 + p.mag * 2.4 + p.level * 4) * skillPower;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.spawnEffect(p.x, p.y, 44, '#2ecc71', 0.6, 'heal');
      this.float(p.x, p.y - 28, `+${Math.floor(heal)}`, '#2ecc71');
      this.gainSkillProficiency(sk.id, 3);
      return;
    }
    if (sk.type === 'buff') {
      p.mp -= sk.mana; p.skillCd[slot] = sk.cd;
      p.shieldT = 6 + skillState.level * 2;
      this.spawnEffect(p.x, p.y, 50, '#8e44ad', 0.7, 'shield');
      this.onHint?.('魔法盾开启');
      this.gainSkillProficiency(sk.id, 4);
      return;
    }
    if (sk.type === 'summon') {
      p.mp -= sk.mana; p.skillCd[slot] = sk.cd;
      p.pet = new Pet(p);
      this.spawnEffect(p.x, p.y, 58, '#d5d8dc', 0.8, 'summon');
      this.onHint?.('召唤骷髅！');
      this.gainSkillProficiency(sk.id, 4);
      return;
    }
    if (sk.type === 'dash') {
      let target = p.target && p.target.alive ? p.target : this.nearestMonster(p, sk.range);
      if (!target) { this.onHint?.('需要目标'); return; }
      p.mp -= sk.mana; p.skillCd[slot] = sk.cd;
      this.faceToward(p, target.x, target.y);
      const ang = Math.atan2(target.y - p.y, target.x - p.x);
      const distTo = Math.min(sk.range, dist(p, target) - target.r - 4);
      const nx = p.x + Math.cos(ang) * distTo;
      const ny = p.y + Math.sin(ang) * distTo;
      this.tryMove(p, nx, ny);
      this.applyDamage(p, target, (12 + p.atk * 0.8) * skillPower, false, sk.id);
      target.stun = 0.7 + skillState.level * 0.25;
      this.spawnEffect(p.x, p.y, 68, '#e67e22', 0.42, 'rush', ang);
      this.spawnEffect(target.x, target.y, 48, '#ff8b3d', 0.46, 'crit_hit');
      p.anim = 'attack'; p.animT = 0.45; p.attacking = true; p.animFrame = 0;
      this.gainSkillProficiency(sk.id, 3);
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
      const dmg = (sk.id === 'talisman' ? 14 + p.mag * 1.5 + p.level : 12 + p.mag * 1.7 + p.level * 1.3) * skillPower;
      this.projectiles.push(new Projectile({
        x: p.x, y: p.y, targetId: target.id, speed: 480,
        damage: dmg, magical: true, color: sk.id === 'talisman' ? '#f1c40f' : '#e67e22',
        sourceId: p.id, kind: sk.id,
      }));
      this.gainSkillProficiency(sk.id, 1);
    } else if (sk.type === 'target') {
      if (sk.id === 'lightning') {
        this.applyDamage(p, target, (26 + p.mag * 2.4 + p.level * 2.2) * skillPower, true, sk.id);
        this.spawnEffect(target.x, target.y, 55, '#5dade2', 0.5, 'lightning');
      } else if (sk.id === 'poison') {
        target.poison = { dps: (10 + p.mag * 0.5) * skillPower, t: 6 + skillState.level };
        this.applyDamage(p, target, (8 + p.mag * 0.6) * skillPower, true, sk.id);
        this.spawnEffect(target.x, target.y, 38, '#27ae60', 0.6, 'poison');
      }
      this.gainSkillProficiency(sk.id, 2);
    } else if (sk.type === 'aoe') {
      const pt = target || p;
      const dmg = (22 + p.mag * 2.0 + p.level) * skillPower;
      this.spawnEffect(pt.x, pt.y, sk.radius, '#9be7ff', 0.7, 'ice');
      for (const m of this.monsters) {
        if (!m.alive) continue;
        if (dist(m, pt) <= sk.radius + m.r) this.applyDamage(p, m, dmg, true, sk.id);
      }
      this.gainSkillProficiency(sk.id, 4);
    }
  }

  castNetworkSkill(slot, sk, skillState) {
    const p = this.player;
    let target = p.target?.alive ? p.target : null;
    const offensive = ['missile', 'target', 'aoe', 'dash'].includes(sk.type);
    if (offensive && !target) {
      target = this.nearestMonster(p, sk.range || 360);
      p.target = target;
    }
    if (offensive && !target) {
      this.onHint?.('需要目标');
      return false;
    }
    if (sk.range && target && dist(p, target) > sk.range + (target.r || 16)) {
      this.onHint?.('距离不够');
      p.moveGoal = { x: target.x, y: target.y };
      return false;
    }

    p.mp = Math.max(0, p.mp - sk.mana);
    p.skillCd[slot] = sk.cd;
    if (sk.type === 'boost') {
      p.boost = { id: sk.id, t: 5 };
      this.spawnEffect(
        p.x, p.y, sk.id === 'fire_sword' ? 54 : 40,
        sk.id === 'fire_sword' ? '#ff6b35' : '#f7dc6f',
        0.5, sk.id === 'fire_sword' ? 'fire' : 'slash',
      );
      this.onHint?.(`${sk.name} 就绪`);
    } else if (sk.type === 'heal') {
      this.spawnEffect(p.x, p.y, 44, '#2ecc71', 0.6, 'heal');
    } else if (sk.type === 'buff') {
      p.shieldT = 6 + Math.max(1, skillState.level) * 2;
      this.spawnEffect(p.x, p.y, 50, '#8e44ad', 0.7, 'shield');
      this.onHint?.('魔法盾开启');
    } else if (sk.type === 'summon') {
      this.spawnEffect(p.x, p.y, 58, '#d5d8dc', 0.8, 'summon');
      this.onHint?.('召唤骷髅！');
    } else {
      this.faceToward(p, target.x, target.y);
      p.anim = 'attack';
      p.animT = COMBAT_RULES.attackRecovery;
      p.attacking = true;
      p.animFrame = 0;
      const colors = {
        fireball: '#e67e22', lightning: '#5dade2', burst: '#9be7ff',
        talisman: '#f1c40f', poison: '#27ae60', rush: '#ff8b3d',
      };
      this.spawnEffect(
        target.x, target.y - 8,
        sk.radius || (sk.id === 'rush' ? 54 : 38),
        colors[sk.id] || '#69b9ff',
        0.5,
        sk.id === 'burst' ? 'ice' : sk.id,
      );
    }

    const dispatch = () => {
      if (offensive && target?.remote) {
        this.onRemoteAttack?.(target, 0, sk.id);
      } else if (offensive && target?.boss) {
        this.onBossDamage?.(target, 0, sk.id);
      } else {
        this.onServerAction({
          type: 'skill_cast',
          skillId: sk.id,
          targetId: target?.networkId || null,
        });
      }
    };
    if (offensive) {
      p.combatAction = {
        kind: 'networkSkill',
        target,
        elapsed: 0,
        hitAt: COMBAT_RULES.attackWindup,
        duration: COMBAT_RULES.attackRecovery,
        resolved: false,
        resolve: dispatch,
      };
    } else {
      dispatch();
    }
    return true;
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

  isThreatened(range = 240) {
    if (this.map.safe || !this.player.alive) return false;
    return this.player.hitT > 0
      || Boolean(this.player.target?.alive)
      || Boolean(this.nearestMonster(this.player, range));
  }

  attackNearest(range = 460) {
    const p = this.player;
    if (!p.alive || this.paused) return false;
    let target = p.target?.alive ? p.target : this.nearestMonster(p, range);
    if (!target) {
      this.onHint?.('附近没有可攻击目标');
      return false;
    }
    p.target = target;
    p.moveGoal = null;
    this.pendingNpc = null;
    this.pendingDrop = null;
    this.pendingPortal = null;
    this.pendingGather = null;
    this.gathering = null;
    this.faceToward(p, target.x, target.y);
    if (dist(p, target) <= p.range + target.r + 8) this.tryAttack(p, target);
    return true;
  }

  useHotPotion(kind) {
    const p = this.player;
    const order = kind === 'hp' ? ['hp_pot_l', 'hp_pot_b', 'hp_pot'] : ['mp_pot_l', 'mp_pot_b', 'mp_pot'];
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
    if (this.multiplayerActive && this.onServerAction) {
      return this.onServerAction({
        type: 'use_item',
        index: idx,
        itemId: entry.id,
        uid: entry.uid || null,
      });
      return;
    }
    if (it.type === 'skillbook') {
      if (it.classId !== p.classId) {
        this.onHint?.(`${p.def.name}无法研读 ${it.name}`);
        return;
      }
      const learned = p.learnSkill(it.skillId);
      if (!learned.ok) {
        if (learned.reason === 'level') this.onHint?.(`需要 ${learned.reqLevel} 级才能研读 ${it.name}`);
        else if (learned.reason === 'learned') this.onHint?.(`${learned.skill?.name || it.name}已经学会`);
        else this.onHint?.('无法学习该技能');
        return;
      }
      p.removeBag(idx, 1);
      p.selectedBag = -1;
      this.onHint?.(`学会技能：${learned.skill.name}`);
      this.log(`研读 ${it.name}，学会「${learned.skill.name}」`, 'skill');
      this.onSfx?.('quest');
      this.persist();
      return;
    }
    if (it.type === 'quest') { this.onHint?.('任务物品不可使用'); return; }
    if (it.type === 'consumable') {
      if (it.use.weaponLuck) {
        const weapon = this.equippedEntry('weapon');
        if (!weapon) { this.onHint?.('请先装备武器'); return; }
        if (weapon.luck >= 7 && weapon.curse <= 0) { this.onHint?.('当前武器幸运已满'); return; }
        const successRate = Math.max(0.28, 0.78 - weapon.luck * 0.075);
        const roll = Math.random();
        let outcome = '祝福无效';
        if (roll < successRate) {
          if (weapon.curse > 0) {
            weapon.curse -= 1;
            outcome = `诅咒降低至 ${weapon.curse}`;
          } else {
            weapon.luck = Math.min(7, weapon.luck + 1);
            outcome = `幸运提升至 +${weapon.luck}`;
          }
          this.spawnEffect(p.x, p.y, 54, '#ffd866', 0.7, 'ring');
        } else if (roll > 0.9) {
          weapon.curse = Math.min(7, weapon.curse + 1);
          outcome = `武器受到诅咒 ${weapon.curse}`;
        }
        p.removeBag(idx, 1);
        p.selectedBag = -1;
        p.recalc();
        this.onHint?.(`${it.name}：${outcome}`);
        this.log(`${ITEMS[weapon.id].name} ${outcome}`, 'gear');
        this.onSfx?.(roll < successRate ? 'forge' : 'forgeFail');
        this.persist();
        return;
      }
      const restorative = it.use.hp || it.use.mp;
      if (restorative && this.time - this.lastPotionAt < 1.1) {
        this.onHint?.('药效尚未散开');
        return;
      }
      if (it.use.town && this.time < this.combatLockUntil) {
        this.onHint?.('战斗中无法使用回城卷');
        return;
      }
      if (it.use.randomTeleport) {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const x = (2 + Math.random() * (WORLD.cols - 4)) * T;
          const y = (2 + Math.random() * (WORLD.rows - 4)) * T;
          if (this.blocked(x, y)) continue;
          p.x = x;
          p.y = y;
          this.cam.x = x;
          this.cam.y = y;
          this.clampCamera();
          break;
        }
      }
      if (it.use.dungeonEscape) {
        this.combatLockUntil = 0;
        this.loadMap('bich');
      }
      if (it.use.hp && p.hp >= p.maxHp && !it.use.mp) { this.onHint?.('生命已满'); return; }
      if (it.use.mp && p.mp >= p.maxMp && !it.use.hp) { this.onHint?.('魔力已满'); return; }
      if (it.use.hp) { p.hp = Math.min(p.maxHp, p.hp + it.use.hp); this.float(p.x, p.y - 24, `+${it.use.hp}`, '#e74c3c'); }
      if (it.use.mp) { p.mp = Math.min(p.maxMp, p.mp + it.use.mp); this.float(p.x, p.y - 24, `+${it.use.mp}`, '#3498db'); }
      if (restorative) this.lastPotionAt = this.time;
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
      const slot = p.equipSlotFor(it.slot);
      if (!slot) { this.onHint?.('没有可用装备部位'); return; }
      const prev = p.equip[slot];
      p.bag.splice(idx, 1);
      p.equip[slot] = normalizeItemEntry(entry);
      p.enhance[slot] = p.equip[slot].enhance || 0;
      if (prev) p.addEntry(prev);
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
    const entry = this.equippedEntry(slot);
    const id = entry?.id;
    if (slot !== 'weapon') {
      this.onHint?.('黑铁矿只用于升级武器');
      return { ok: false, reason: 'weapon_only' };
    }
    if (this.multiplayerActive && this.onServerAction) {
      this.onServerAction({ type: 'enhance_slot', slot });
      return { ok: true, pending: true };
    }
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
      entry.enhance = level + 1;
      p.enhance[slot] = entry.enhance;
      p.recalc();
      this.onHint?.(`强化成功！${ITEMS[id].name} +${level + 1}`);
      this.log(`${ITEMS[id].name} 强化至 +${level + 1}`, 'forge');
      this.onSfx?.('forge');
      this.checkAchievements();
    } else {
      const destroyed = cost.destroysOnFailure;
      if (destroyed) {
        p.equip.weapon = null;
        p.enhance.weapon = 0;
      }
      p.recalc();
      this.onHint?.(destroyed ? `升级失败，${ITEMS[id].name}破碎！` : '升级失败，等级不变');
      this.onSfx?.('forgeFail');
      this.persist();
      return { ok: false, destroyed, level: destroyed ? 0 : level, cost };
    }
    this.persist();
    return { ok: success, level: p.enhance[slot], cost };
  }

  unequip(slot) {
    const p = this.player;
    const entry = this.equippedEntry(slot);
    if (!entry) return;
    if (this.multiplayerActive && this.onServerAction) {
      this.onServerAction({ type: 'unequip', slot });
      return;
    }
    if (!p.addEntry(entry)) { this.onHint?.('背包已满'); return; }
    p.equip[slot] = null;
    p.enhance[slot] = 0;
    p.recalc();
    this.persist();
  }

  repairAll() {
    const p = this.player;
    if (this.multiplayerActive && this.onServerAction) {
      this.onServerAction({ type: 'repair_all' });
      return { ok: true, pending: true, cost: 0 };
    }
    if (!this.map.safe) {
      this.onHint?.('只有城内铁匠可以修理装备');
      return { ok: false, reason: 'unsafe', cost: 0 };
    }
    const damaged = EQUIP_SLOTS.map((slot) => this.equippedEntry(slot)).filter(
      (entry) => entry && entry.durability < entry.maxDurability,
    );
    if (!damaged.length) {
      this.onHint?.('装备耐久完整');
      return { ok: false, reason: 'full', cost: 0 };
    }
    const cost = damaged.reduce((sum, entry) => {
      const item = ITEMS[entry.id];
      const missing = entry.maxDurability - entry.durability;
      return sum + Math.max(1, Math.ceil(missing * Math.max(1, item.price || item.sell || 1) / entry.maxDurability * 0.12));
    }, 0);
    if (p.gold < cost) {
      this.onHint?.(`修理需要 ${cost} 金币`);
      return { ok: false, reason: 'gold', cost };
    }
    p.gold -= cost;
    for (const entry of damaged) entry.durability = entry.maxDurability;
    p.recalc();
    this.onHint?.(`全部装备修复完毕 · ${cost} 金币`);
    this.log(`铁匠修复 ${damaged.length} 件装备，花费 ${cost} 金币`, 'gear');
    this.onSfx?.('forge');
    this.persist();
    return { ok: true, cost, count: damaged.length };
  }

  sellSelected() {
    const p = this.player;
    if (!this.map.safe) { this.onHint?.('请回城出售'); return; }
    const idx = p.selectedBag;
    if (idx < 0) return;
    const entry = p.bag[idx];
    const it = ITEMS[entry.id];
    if (!it || it.type === 'quest') { this.onHint?.('不可出售'); return; }
    if (this.multiplayerActive && this.onServerAction) {
      this.onServerAction({
        type: 'sell_item',
        index: idx,
        itemId: entry.id,
        uid: entry.uid || null,
      });
      return;
    }
    const gain = it.sell * entry.qty;
    p.gold += gain;
    p.bag.splice(idx, 1);
    p.selectedBag = -1;
    this.onHint?.(`出售获得 ${gain} 金`);
    this.persist();
  }

  buyItem(itemId) {
    const p = this.player;
    if (this.multiplayerActive && this.onServerAction) {
      this.onServerAction({ type: 'buy_item', itemId });
      return;
    }
    if (!this.map.safe || !SHOP_TOWN.includes(itemId)) return;
    const it = ITEMS[itemId];
    if (!it || p.gold < it.price) { this.onHint?.('金币不足'); return; }
    const added = it.slot
      ? p.addEntry(createItemEntry(itemId, { rollAffix: false }))
      : p.addItem(itemId, 1);
    if (!added) { this.onHint?.('背包已满'); return; }
    p.gold -= it.price;
    this.onHint?.(`购买 ${it.name}`);
    this.onSfx?.('buy');
    this.persist();
  }

  craftRecipe(recipeId) {
    const recipe = RECIPES[recipeId];
    const p = this.player;
    if (!recipe) return false;
    if (this.multiplayerActive && this.onServerAction) {
      this.onServerAction({ type: 'craft_recipe', recipeId });
      return true;
    }
    if (p.gold < recipe.gold) {
      this.onHint?.('金币不足');
      return false;
    }
    for (const material of recipe.materials) {
      if (p.countItem(material.id) < material.qty) {
        this.onHint?.(`材料不足：${ITEMS[material.id].name} ${material.qty}`);
        return false;
      }
    }
    const extraSlots = recipe.outputs
      .filter((output) => !['consumable', 'quest', 'material'].includes(ITEMS[output.id]?.type))
      .reduce((sum, output) => sum + output.qty, 0);
    if (p.bag.length + extraSlots > p.bagSize) {
      this.onHint?.('背包空间不足');
      return false;
    }
    p.gold -= recipe.gold;
    for (const material of recipe.materials) p.removeItemId(material.id, material.qty);
    for (const output of recipe.outputs) p.addItem(output.id, output.qty);
    const result = recipe.outputs.map((output) => `${ITEMS[output.id].name}×${output.qty}`).join('、');
    this.onHint?.(`制造成功：${result}`);
    this.log(`${recipe.name} · 获得 ${result}`, 'gear');
    this.onSfx?.('forge');
    this.persist();
    return true;
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
    if (!p.addEntry(entry)) { this.onHint?.('背包已满'); return; }
    p.warehouse.splice(i, 1);
    this.persist();
  }

  healFull() {
    if (this.multiplayerActive && this.onServerAction) {
      this.onServerAction({ type: 'heal_full' });
      return;
    }
    if (!this.map.safe) return;
    const p = this.player;
    const missingHp = Math.max(0, p.maxHp - p.hp);
    const missingMp = Math.max(0, p.maxMp - p.mp);
    if (missingHp <= 0 && missingMp <= 0) { this.onHint?.('状态已经很好'); return; }
    const cost = p.level <= 5
      ? 0
      : Math.max(10, Math.ceil((missingHp + missingMp * 0.55) * 0.18 + p.level * 3));
    if (p.gold < cost) { this.onHint?.(`疗伤需要 ${cost} 金币`); return; }
    p.gold -= cost;
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
    this.onHint?.(cost ? `伤势已痊愈，支付 ${cost} 金币` : '伤势已痊愈（新人免费）');
    this.persist();
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
      this.navigationPath = [];
      this.player.target = null;
      this.player.moveGoal = null;
      this.pendingNpc = null;
      this.pendingDrop = null;
      this.pendingPortal = null;
      this.pendingGather = null;
      this.gathering = null;
    }
  }

  interactNpc(npc) {
    if (!npc) return;
    this.player.moveGoal = null;
    this.player.target = null;
    this.pendingNpc = null;
    this.faceToward(this.player, npc.x, npc.y);
    this.faceToward(npc, this.player.x, this.player.y);
    if (this.onNpc) {
      this.onNpc(npc);
      return;
    }
    if (npc.action === 'heal') this.healFull();
    if (npc.action === 'shop') this.onHint?.('__SHOP__');
    if (npc.action === 'warehouse') this.onHint?.('__WAREHOUSE__');
    if (npc.action === 'quest') this.talkQuest(npc.id);
    if (npc.action === 'craft') this.onHint?.('__CRAFT__');
    if (npc.action === 'guide') {
      this.onHint?.(npc.id === 'miner'
        ? '老矿工：装备鹤嘴锄后点击矿脉采矿，越稀有的矿脉刷新越慢。'
        : '山谷守卫：雪狼成群行动，备好金创药再往石墓方向走。');
    }
  }

  approachNpc(npc) {
    const p = this.player;
    const dx = p.x - npc.x;
    const dy = p.y - npc.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const standOff = 66;
    const candidates = [
      { x: npc.x + dx / length * standOff, y: npc.y + dy / length * standOff },
      { x: npc.x, y: npc.y + standOff },
      { x: npc.x - standOff, y: npc.y },
      { x: npc.x + standOff, y: npc.y },
    ];
    const goal = candidates.find((point) => !this.blocked(point.x, point.y));
    if (!goal) {
      this.onHint?.(`${npc.name}附近无法落脚`);
      return;
    }
    p.target = null;
    p.moveGoal = goal;
    this.pendingNpc = npc;
    this.pendingDrop = null;
    this.pendingPortal = null;
    this.pendingGather = null;
    this.gathering = null;
    this.faceToward(p, npc.x, npc.y);
  }

  equippedGatherTool() {
    const weapon = this.equippedEntry('weapon');
    return weapon && weapon.durability > 0 ? ITEMS[weapon.id]?.gatherTool || null : null;
  }

  approachGather(node) {
    if (!node?.active) return false;
    this.player.target = null;
    this.player.moveGoal = { x: node.x, y: node.y };
    this.pendingNpc = null;
    this.pendingDrop = null;
    this.pendingPortal = null;
    this.pendingGather = node;
    this.gathering = null;
    return true;
  }

  tryGather(node) {
    if (!node?.active || dist(this.player, node) > 64) return false;
    if (node.def.tool && this.equippedGatherTool() !== node.def.tool) {
      this.pendingGather = null;
      this.player.moveGoal = null;
      this.onHint?.(`采集${node.def.name}需要装备鹤嘴锄`);
      return false;
    }
    this.player.moveGoal = null;
    this.player.target = null;
    this.pendingGather = node;
    this.gathering = {
      node,
      total: Math.max(0.25, node.def.gatherTime || 0.8),
      remaining: Math.max(0.25, node.def.gatherTime || 0.8),
    };
    this.faceToward(this.player, node.x, node.y);
    this.player.attacking = true;
    this.player.anim = 'attack';
    this.player.animFrame = 0;
    this.player.animT = this.gathering.total;
    this.onSfx?.('gather');
    return true;
  }

  completeGather() {
    const action = this.gathering;
    if (!action?.node?.active) {
      this.gathering = null;
      this.pendingGather = null;
      return false;
    }
    const { node } = action;
    const found = [];
    for (const loot of node.def.loot || []) {
      if (Math.random() > (loot.chance ?? 1)) continue;
      const levelBonus = Math.floor((this.player.gatheringLevel - 1) / 3);
      const qty = randInt(loot.min || 1, loot.max || 1) + (loot.id === 'herb' ? levelBonus : 0);
      if (!this.player.addItem(loot.id, qty)) {
        this.onHint?.('背包已满，采集物无法放入');
        continue;
      }
      found.push(`${ITEMS[loot.id].name}×${qty}`);
    }
    node.charges -= 1;
    if (node.charges <= 0) {
      node.active = false;
      node.respawnAt = this.time + node.def.respawn;
    }
    if (node.def.tool === 'mining') this.damageDurability('weapon', 1);
    const mastery = this.player.gainGatheringExp(node.def.tool === 'mining' ? 2 : 1);
    this.onHint?.(found.length ? `采集获得 ${found.join('、')}` : '这次没有采到可用材料');
    this.log(`采集 ${node.def.name}${found.length ? ` · ${found.join('、')}` : ''}`, 'loot');
    if (mastery.leveled) this.float(this.player.x, this.player.y - 36, `采集 Lv.${mastery.level}`, '#82e0aa');
    this.gathering = null;
    this.pendingGather = null;
    this.player.attacking = false;
    this.checkQuestComplete();
    this.persist();
    return true;
  }

  gatherNearest(range = 100) {
    let nearest = null;
    let best = range * range;
    for (const node of this.gatherNodes) {
      if (!node.active) continue;
      const distance = dist2(this.player, node);
      if (distance < best) { best = distance; nearest = node; }
    }
    if (!nearest) {
      this.onHint?.('附近没有可采集资源');
      return false;
    }
    if (dist(this.player, nearest) <= 64) return this.tryGather(nearest);
    return this.approachGather(nearest);
  }

  canPickupDrop(drop, player = this.player) {
    if (!drop?.alive) return false;
    return !drop.ownerId || drop.ownerId === player.id || this.time >= drop.protectedUntil;
  }

  pickupDrop(drop) {
    const p = this.player;
    if (!drop?.alive || dist(p, drop) > 50) return false;
    if (!this.canPickupDrop(drop, p)) {
      const seconds = Math.max(1, Math.ceil(drop.protectedUntil - this.time));
      this.onHint?.(`物品归属保护中（${seconds}秒）`);
      return false;
    }
    if (drop.networkDrop) {
      if (!drop.pickupRequested) {
        drop.pickupRequested = true;
        this.onNetworkPickup?.(drop.networkId);
      }
      this.pendingDrop = null;
      p.moveGoal = null;
      return true;
    }
    if (drop.gold) {
      p.gold += drop.gold;
      this.onHint?.(`拾取 ${drop.gold} 金币`);
      this.log(`拾取 ${drop.gold} 金币`, 'loot');
    } else if (drop.itemId) {
      if (!p.addEntry(drop.entry || { id: drop.itemId, qty: 1 })) {
        this.onHint?.('背包已满');
        return false;
      }
      const item = ITEMS[drop.itemId];
      const excellent = Object.keys(drop.entry?.bonus || {}).length ? ' · 极品' : '';
      this.onHint?.(`拾取 ${item.name}${excellent}`);
      this.log(`拾取 ${item.name}${excellent}`, 'loot');
      if (item.type === 'quest') this.checkQuestComplete();
    }
    drop.alive = false;
    this.pendingDrop = null;
    p.moveGoal = null;
    this.onSfx?.('loot');
    this.checkAchievements();
    this.persist();
    return true;
  }

  approachDrop(drop) {
    if (!drop?.alive) return;
    this.pendingNpc = null;
    this.pendingPortal = null;
    this.pendingGather = null;
    this.gathering = null;
    this.pendingDrop = drop;
    this.player.target = null;
    this.player.moveGoal = { x: drop.x, y: drop.y };
  }

  pickupNearestDrop(range = 86) {
    let nearest = null;
    let best = range * range;
    for (const drop of this.drops) {
      if (!drop.alive) continue;
      const distance = dist2(this.player, drop);
      if (distance < best) { best = distance; nearest = drop; }
    }
    if (!nearest) {
      this.onHint?.('附近没有可拾取物品');
      return false;
    }
    if (dist(this.player, nearest) <= 50) return this.pickupDrop(nearest);
    this.approachDrop(nearest);
    return true;
  }

  usePortal(portal) {
    const p = this.player;
    if (this.portalLoading) return false;
    if (portal.reqLevel && p.level < portal.reqLevel) {
      this.onHint?.(`需要 ${portal.reqLevel} 级才能进入 ${portal.label}`);
      return false;
    }
    this.pendingPortal = null;
    p.moveGoal = null;
    const loading = this.assets.ensureMap?.(portal.to);
    if (loading?.then) {
      this.portalLoading = portal.to;
      this.zoneFadeT = Math.max(this.zoneFadeT, 0.42);
      this.onHint?.(`正在进入 ${MAPS[portal.to]?.name || portal.label}…`);
      Promise.resolve(loading)
        .then(() => {
          if (this.portalLoading === portal.to) this.loadMap(portal.to, portal.tx, portal.ty);
        })
        .catch((error) => {
          console.error(error);
          this.onHint?.('区域战斗资源载入失败，请重试');
        })
        .finally(() => {
          if (this.portalLoading === portal.to) this.portalLoading = null;
        });
      return true;
    }
    this.loadMap(portal.to, portal.tx, portal.ty);
    return true;
  }

  approachPortal(portal) {
    this.pendingNpc = null;
    this.pendingDrop = null;
    this.pendingGather = null;
    this.gathering = null;
    this.pendingPortal = portal;
    this.player.target = null;
    this.navigationPath = findTilePath(
      this.walkGrid,
      this.player.x,
      this.player.y,
      portal.x,
      portal.y,
      T,
    );
    this.player.moveGoal = this.navigationPath.shift() || { x: portal.x, y: portal.y };
  }

  /** Legacy compatibility: classic ground combat deliberately has no free jump. */
  tryJump() {
    return false;
  }

  onClick(sx, sy) {
    if (!this.player.alive || this.paused) return;
    this.navigationPath = [];
    const w = this.screenToWorld(sx, sy);
    const p = this.player;

    for (const n of this.npcs) {
      if (Math.abs(w.x - n.x) <= 42 && w.y >= n.y - VISUAL_SCALE.npc * 0.92 && w.y <= n.y + 18) {
        if (dist(p, n) <= 92) this.interactNpc(n);
        else this.approachNpc(n);
        return;
      }
    }
    this.pendingNpc = null;
    for (const node of this.gatherNodes) {
      if (!node.active || dist(w, node) > 34) continue;
      if (dist(p, node) <= 64) this.tryGather(node);
      else this.approachGather(node);
      return;
    }
    this.pendingGather = null;
    this.gathering = null;
    for (const drop of this.drops) {
      if (!drop.alive || dist(w, drop) > 28) continue;
      if (dist(p, drop) <= 50) this.pickupDrop(drop);
      else this.approachDrop(drop);
      return;
    }
    this.pendingDrop = null;
    for (const portal of this.portals) {
      if (dist(w, portal) < 40) {
        if (dist(p, portal) <= 58) this.usePortal(portal);
        else this.approachPortal(portal);
        return;
      }
    }
    this.pendingPortal = null;
    for (const remote of this.remotePlayers) {
      if (!remote.alive) continue;
      const drawH = VISUAL_SCALE.player;
      if (Math.abs(w.x - remote.x) <= drawH * 0.35
        && w.y >= remote.y - drawH * 0.92 && w.y <= remote.y + 18) {
        p.target = remote;
        p.moveGoal = null;
        this.onRemoteSelected?.(remote);
        this.onHint?.(`已选中玩家：${remote.name}`);
        return;
      }
    }
    let hit = null; let best = 36 * 36;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const drawH = this.monsterDrawHeight(m);
      const dx = Math.abs(w.x - m.x);
      const withinSprite = dx <= Math.max(28, drawH * 0.32)
        && w.y >= m.y - drawH * 0.92
        && w.y <= m.y + 16;
      if (!withinSprite) continue;
      const d = dist2(w, m);
      if (d < best || !hit) { best = d; hit = m; }
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
    if (this.time >= this.ambientSfxT) {
      this.ambientSfxT = this.time + 2.28;
      this.onSfx?.(this.ambientSfxForMap(), { gain: 0.82, pan: 0, emitter: `ambience:${this.mapId}` });
    }
    this.player.playTime += dt;
    this.saveTimer += dt;
    if (this.saveTimer > 12) { this.saveTimer = 0; this.persist(); }

    const p = this.player;
    if (!p.alive) return;
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    this.shake = Math.max(0, this.shake - 18 * dt);
    this.impactT = Math.max(0, this.impactT - dt);
    this.zoneIntroT = Math.max(0, this.zoneIntroT - dt);
    this.zoneFadeT = Math.max(0, this.zoneFadeT - dt);
    p.hitT = Math.max(0, (p.hitT || 0) - dt);
    p.crimeT = Math.max(0, (p.crimeT || 0) - dt);
    this.pkDecayAccumulator += dt;
    while (this.pkDecayAccumulator >= 60) {
      this.pkDecayAccumulator -= 60;
      if (p.pkPoints > 0) p.pkPoints = Math.max(0, p.pkPoints - 1);
    }
    if (p.blessingT > 0) {
      const wasBlessed = p.blessingT > 0;
      p.blessingT = Math.max(0, p.blessingT - dt);
      if (wasBlessed && p.blessingT === 0) p.recalc();
    }

    p.attackCd = Math.max(0, p.attackCd - dt);
    this.advanceCombatAction(p, dt);
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
    if (p.monsterPoison) {
      const poisonSource = p.monsterPoison.source;
      p.monsterPoison.t -= dt;
      p.hp = Math.max(0, p.hp - p.monsterPoison.dps * dt);
      if (p.monsterPoison.t <= 0) p.monsterPoison = null;
      if (p.hp <= 0) {
        this.kill(poisonSource, p);
        return;
      }
    }

    const regen = this.map.safe ? 10 : 1.5;
    p.hp = Math.min(p.maxHp, p.hp + regen * dt);
    p.mp = Math.min(p.maxMp, p.mp + regen * 0.85 * dt);
    this.decayVisualRecoil(p, dt);

    p.running = !!this.input.run;
    const moveSpeed = p.ms * (p.running ? 1.65 : 1);
    let moving = false;
    const moveStartX = p.x;
    const moveStartY = p.y;

    // movement
    const manualMoving = Math.hypot(this.input.moveX, this.input.moveY) > 0.05;
    if (p.stun <= 0 && !p.attacking) {
      if (manualMoving) {
        moving = true;
        const nx = p.x + this.input.moveX * moveSpeed * dt;
        const ny = p.y + this.input.moveY * moveSpeed * dt;
        this.tryMove(p, nx, ny);
      } else if (p.target && p.target.alive) {
        const range = p.range + p.target.r;
        if (dist(p, p.target) <= range) {
          p.moveGoal = null;
          this.faceToward(p, p.target.x, p.target.y);
          this.tryAttack(p, p.target);
        } else {
          moving = true;
          this.faceToward(p, p.target.x, p.target.y);
          const m = moveToward(p, p.target, moveSpeed, dt);
          this.tryMove(p, m.x, m.y);
        }
      } else if (p.moveGoal) {
        moving = true;
        this.faceToward(p, p.moveGoal.x, p.moveGoal.y);
        const m = moveToward(p, p.moveGoal, moveSpeed, dt);
        this.tryMove(p, m.x, m.y);
        if (m.arrived || dist(p, p.moveGoal) < 4) {
          p.moveGoal = this.navigationPath.shift() || null;
        }
      }
    }

    if (p.attacking && p.animT <= 0) p.attacking = false;

    if (this.pendingNpc && dist(p, this.pendingNpc) <= 92) {
      const npc = this.pendingNpc;
      this.interactNpc(npc);
      moving = false;
    } else if (this.pendingNpc && !p.moveGoal) {
      this.pendingNpc = null;
    }
    if (this.pendingDrop && this.pendingDrop.alive && dist(p, this.pendingDrop) <= 50) {
      this.pickupDrop(this.pendingDrop);
      moving = false;
    } else if (this.pendingDrop && (!this.pendingDrop.alive || !p.moveGoal)) {
      this.pendingDrop = null;
    }
    if (this.pendingPortal && dist(p, this.pendingPortal) <= 58) {
      this.usePortal(this.pendingPortal);
      return;
    } else if (this.pendingPortal && !p.moveGoal) {
      this.pendingPortal = null;
    }
    if (this.pendingGather?.active && !this.gathering && dist(p, this.pendingGather) <= 64) {
      this.tryGather(this.pendingGather);
      moving = false;
    } else if (this.pendingGather && (!this.pendingGather.active || (!p.moveGoal && !this.gathering))) {
      this.pendingGather = null;
    }
    if (this.gathering) {
      this.gathering.remaining -= dt;
      p.attacking = true;
      p.anim = 'attack';
      if (this.gathering.remaining <= 0) this.completeGather();
    }
    for (const node of this.gatherNodes) {
      if (!node.active && node.respawnAt && this.time >= node.respawnAt) {
        node.active = true;
        node.charges = node.def.charges;
        node.respawnAt = 0;
      }
    }

    // Only animate real displacement. This prevents skating against walls and
    // keeps footfall feedback locked to the ground rather than input intent.
    moving = moving && Math.hypot(p.x - moveStartX, p.y - moveStartY) > 0.08;
    const previousAnim = p.anim;
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

    if (p.anim !== previousAnim) p.animFrame = 0;
    const previousFrame = p.animFrame || 0;
    p.animFrame = previousFrame + dt * animFps(p.anim);
    if (moving && (p.anim === 'walk' || p.anim === 'run')) {
      const selection = this._playerAnimSelection(p.classId, p.anim, p.animFrame, p.direction);
      const contacts = contactFramesFor(p.anim, selection.frameCount);
      if (contactFrameCrossings(
        previousFrame,
        p.animFrame,
        selection.frameCount,
        contacts,
        previousAnim === p.anim,
      )) {
        this.spawnGroundContact(p, p.running);
        this.onSfx?.(this.footstepSfxForMap(), this.soundOptionsAt(p, p.running ? 0.92 : 0.72));
      }
    }

    // Ground drops persist until manually picked up or expired.
    for (const d of this.drops) {
      if (!d.alive) continue;
      d.t -= dt;
      if (d.t <= 0) { d.alive = false; continue; }
    }
    this.drops = this.drops.filter((d) => d.alive);

    // pet
    if (p.pet) {
      const pet = p.pet;
      if (pet.networkPet && this.multiplayerActive) {
        const dx = (pet.serverX ?? pet.x) - pet.x;
        const dy = (pet.serverY ?? pet.y) - pet.y;
        if (Math.hypot(dx, dy) > 0.5) {
          pet.direction = direction8(dx, dy, pet.direction || 's');
          if (Math.abs(dx) > 0.05) pet.facing = dx > 0 ? 1 : -1;
        }
        const blend = Math.hypot(dx, dy) > 180 ? 1 : Math.min(1, dt * 12);
        pet.x += dx * blend;
        pet.y += dy * blend;
        pet.animFrame += dt * monsterAnimFps(pet.anim || 'idle', 'skeleton');
      } else {
      pet.ttl -= dt;
      if (pet.ttl <= 0 || !pet.alive) { p.pet = null; }
      else {
        let petMoving = false;
        pet.attackCd = Math.max(0, pet.attackCd - dt);
        this.advanceCombatAction(pet, dt);
        pet.animT = Math.max(0, pet.animT - dt);
        if (pet.animT <= 0) pet.attacking = false;
        let t = p.target && p.target.alive ? p.target : this.nearestMonster(pet, 220);
        if (t) {
          this.faceToward(pet, t.x, t.y);
          if (dist(pet, t) <= pet.range + t.r) this.tryAttack(pet, t);
          else {
            petMoving = true;
            const mv = moveToward(pet, t, pet.ms, dt);
            this.tryMove(pet, mv.x, mv.y);
          }
        } else if (dist(pet, p) > 70) {
          petMoving = true;
          this.faceToward(pet, p.x, p.y);
          const mv = moveToward(pet, p, pet.ms, dt);
          this.tryMove(pet, mv.x, mv.y);
        }
        this.advanceMonsterAnim(pet, petMoving, dt);
      }
      }
    }

    for (const pet of this.networkPets) {
      const dx = (pet.serverX ?? pet.x) - pet.x;
      const dy = (pet.serverY ?? pet.y) - pet.y;
      if (Math.hypot(dx, dy) > 0.5) {
        pet.direction = direction8(dx, dy, pet.direction || 's');
        if (Math.abs(dx) > 0.05) pet.facing = dx > 0 ? 1 : -1;
      }
      const blend = Math.hypot(dx, dy) > 180 ? 1 : Math.min(1, dt * 12);
      pet.x += dx * blend;
      pet.y += dy * blend;
      pet.animFrame += dt * monsterAnimFps(pet.anim || 'idle', 'skeleton');
    }

    // monsters
    for (const m of this.monsters) {
      m.hitT = Math.max(0, (m.hitT || 0) - dt);
      this.decayVisualRecoil(m, dt);
      const monsterStartX = m.x;
      const monsterStartY = m.y;
      if ((m.networkMonster || m.networkBoss) && this.multiplayerActive) {
        const dx = (m.serverX ?? m.x) - m.x;
        const dy = (m.serverY ?? m.y) - m.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0.5) {
          m.direction = direction8(dx, dy, m.direction || 's');
          if (Math.abs(dx) > 0.05) m.facing = dx > 0 ? 1 : -1;
        }
        const blend = distance > 180 ? 1 : Math.min(1, dt * 12);
        m.x += dx * blend;
        m.y += dy * blend;
        const previousAnim = m.anim;
        const nextAnim = m.alive ? (m.serverAnim || (distance > 2 ? 'walk' : 'idle')) : 'death';
        if (nextAnim !== m.anim) {
          m.anim = nextAnim;
          m.animFrame = 0;
        }
        const previousFrame = m.animFrame || 0;
        m.animFrame = previousFrame + dt * monsterAnimFps(m.anim, m.kind);
        this.updateMonsterFootstep(
          m,
          m.alive && m.anim === 'walk' && Math.hypot(m.x - monsterStartX, m.y - monsterStartY) > 0.05,
          previousFrame,
          m.animFrame,
          previousAnim === m.anim,
        );
        continue;
      }
      if (!m.alive) {
        this.advanceMonsterAnim(m, false, dt);
        if (m.respawnAt && this.time >= m.respawnAt) {
          m.alive = true;
          m.hp = m.maxHp;
          m.x = m.home.x; m.y = m.home.y;
          m.target = null;
          m.respawnAt = 0;
          m.deathUntil = 0;
          m.poison = null;
          m.anim = 'idle';
          m.animFrame = 0;
          m.animT = 0;
          m.attacking = false;
        }
        continue;
      }
      m.attackCd = Math.max(0, m.attackCd - dt);
      this.advanceCombatAction(m, dt);
      m.stun = Math.max(0, m.stun - dt);
      m.animT = Math.max(0, m.animT - dt);
      if (m.animT <= 0) m.attacking = false;
      let monsterMoving = false;
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
        if (!m.alive) {
          this.advanceMonsterAnim(m, false, dt);
          continue;
        }
      }
      if (m.stun > 0) {
        this.advanceMonsterAnim(m, false, dt);
        continue;
      }

      const aggroTarget = (!this.map.safe && m.behavior !== 'passive' && dist(m, p) < m.aggro) ? p : null;
      if (aggroTarget) m.target = aggroTarget;
      if (m.target && m.target.alive) {
        this.faceToward(m, m.target.x, m.target.y);
        const targetDistance = dist(m, m.target);
        if (m.behavior === 'charger' && targetDistance > m.range + 24
          && targetDistance <= 230 && (m.specialCd || 0) <= 0) {
          m.specialCd = 5.5;
          const angle = Math.atan2(m.target.y - m.y, m.target.x - m.x);
          const travel = Math.max(0, targetDistance - m.target.r - m.r);
          this.tryMove(m, m.x + Math.cos(angle) * travel, m.y + Math.sin(angle) * travel);
          this.applyDamage(m, m.target, m.atk * 1.45, false);
          m.target.stun = Math.max(m.target.stun || 0, 0.65);
          this.spawnEffect(m.x, m.y, 54, '#d66b35', 0.4, 'rush', angle);
        } else if (targetDistance <= m.range + m.target.r) this.tryAttack(m, m.target);
        else {
          monsterMoving = true;
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
          monsterMoving = true;
          this.faceToward(m, m.moveGoal.x, m.moveGoal.y);
          const mv = moveToward(m, m.moveGoal, m.ms * 0.55, dt);
          this.tryMove(m, mv.x, mv.y);
          if (mv.arrived) m.moveGoal = null;
        }
      }
      m.specialCd = Math.max(0, (m.specialCd || 0) - dt);
      monsterMoving = monsterMoving && Math.hypot(m.x - monsterStartX, m.y - monsterStartY) > 0.05;
      this.advanceMonsterAnim(m, monsterMoving, dt);
    }

    for (const pr of this.projectiles) {
      if (!pr.alive) continue;
      let t = this.monsters.find((m) => m.id === pr.targetId);
      if (!t && this.player.id === pr.targetId) t = this.player;
      if (!t && this.player.pet?.id === pr.targetId) t = this.player.pet;
      if (!t || !t.alive) { pr.alive = false; continue; }
      const mv = moveToward(pr, t, pr.speed, dt);
      pr.vx = mv.x - pr.x;
      pr.vy = mv.y - pr.y;
      pr.x = mv.x; pr.y = mv.y;
      if (mv.arrived) {
        const src = pr.sourceId === p.id ? p : (p.pet?.id === pr.sourceId ? p.pet : null);
        this.applyDamage(src, t, pr.damage, pr.magical, pr.kind || null);
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
    for (const remote of this.remotePlayers) {
      this.decayVisualRecoil(remote, dt);
      const dx = remote.targetX - remote.x;
      const dy = remote.targetY - remote.y;
      const distance = Math.hypot(dx, dy);
      const blend = distance > 180 ? 1 : Math.min(1, dt * 12);
      remote.x += dx * blend;
      remote.y += dy * blend;
      remote.animFrame += dt * animFps(remote.anim || 'idle');
    }

    this.cam.x += (p.x - this.cam.x) * Math.min(1, 7 * dt);
    this.cam.y += (p.y - this.cam.y) * Math.min(1, 7 * dt);
    this.clampCamera();
  }

  _playerAnimSelection(classId, anim, frame, direction = null) {
    const directionalPack = this.assets.directionalAnim?.[classId]?.[anim]?.[direction];
    if (directionalPack?.length) {
      return {
        img: directionalPack[Math.floor(frame) % directionalPack.length],
        authoredDirection: true,
        frameCount: directionalPack.length,
      };
    }
    const pack = this.assets.anim?.[classId]?.[anim];
    const fallbackCount = anim === 'walk' || anim === 'run' ? 10 : 6;
    return {
      img: pack?.length ? pack[Math.floor(frame) % pack.length] : this.assets.units[classId],
      authoredDirection: false,
      frameCount: pack?.length || directionalFrameCount(classId, anim, direction) || fallbackCount,
    };
  }

  _animImg(classId, anim, frame, direction = null) {
    return this._playerAnimSelection(classId, anim, frame, direction).img;
  }

  _npcAnimImg(sprite, frame) {
    const pack = this.assets.npcAnim?.[sprite]?.idle;
    if (pack?.length) return pack[Math.floor(frame) % pack.length];
    return this.assets.npc[sprite] || this.assets.npc.healer;
  }

  _mobAnimSelection(kind, anim, frame, direction = null) {
    const directionalPack = this.assets.directionalMobAnim?.[kind]?.[anim]?.[direction];
    if (directionalPack?.length) {
      const index = anim === 'attack' || anim === 'death'
        ? Math.min(directionalPack.length - 1, Math.floor(frame))
        : Math.floor(frame) % directionalPack.length;
      return {
        img: directionalPack[index],
        authoredDirection: true,
        frameCount: directionalPack.length,
      };
    }
    const pack = this.assets.mobAnim?.[kind]?.[anim];
    if (!pack?.length) {
      return {
        img: this.assets.mobs[kind],
        authoredDirection: false,
        frameCount: mobDirectionalFrameCount(kind, anim, direction) || 1,
      };
    }
    const index = anim === 'attack' || anim === 'death'
      ? Math.min(pack.length - 1, Math.floor(frame))
      : Math.floor(frame) % pack.length;
    return {
      img: pack[index],
      authoredDirection: false,
      frameCount: pack.length,
    };
  }

  _mobAnimImg(kind, anim, frame, direction = null) {
    return this._mobAnimSelection(kind, anim, frame, direction).img;
  }

  _drawSprite(
    ctx,
    img,
    wx,
    wy,
    drawH,
    facing = 1,
    anchorY = 0.92,
    direction = null,
    authoredDirection = false,
  ) {
    const foot = this.worldToScreen(wx, wy);
    if (!img) {
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(foot.x, foot.y - 12, 12, 0, Math.PI * 2);
      ctx.fill();
      return { foot, topY: foot.y - drawH };
    }
    const perspective = authoredDirection
      ? 1
      : direction === 'n' || direction === 's'
        ? 0.84
        : direction?.length === 2 ? 0.93 : 1;
    const w = drawH * (img.width / img.height) * perspective;
    const dx = foot.x - w * 0.5;
    const dy = foot.y - drawH * anchorY;
    ctx.save();
    if (!authoredDirection && facing < 0) {
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
    ctx.fillStyle = 'rgba(5,4,3,0.86)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * clamp(pct, 0, 1), 4);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x - w / 2, y, w * clamp(pct, 0, 1), 1);
  }

  _drawChatBubble(ctx, unit, drawn) {
    const bubble = unit.chatBubble;
    if (!bubble || this.time >= bubble.until || !bubble.text) return;
    const channelNames = { nearby: '附近', world: '世界', team: '组队', guild: '行会', whisper: '私聊' };
    const label = `${channelNames[bubble.channel] ? `[${channelNames[bubble.channel]}] ` : ''}${bubble.text}`;
    ctx.save();
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    const measured = ctx.measureText ? ctx.measureText(label).width : label.length * 11;
    const width = clamp(measured + 18, 66, 210);
    const x = drawn.foot.x - width / 2;
    const y = drawn.topY - 31;
    ctx.fillStyle = 'rgba(12,10,8,0.94)';
    ctx.strokeStyle = bubble.channel === 'world' ? '#c9984f' : bubble.channel === 'team' ? '#67b7d8' : bubble.channel === 'guild' ? '#69bd7d' : '#776247';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, width, 22, 4);
    else ctx.rect(x, y, width, 22);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(drawn.foot.x - 4, y + 22);
    ctx.lineTo(drawn.foot.x, y + 27);
    ctx.lineTo(drawn.foot.x + 4, y + 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f1e3ca';
    ctx.fillText(label, drawn.foot.x, y + 15, width - 10);
    ctx.restore();
  }

  _hash2(x, y, seed = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  _drawTintedTile(ctx, img, x, y, tint, alpha = 0.28, variation = 0) {
    if (img) {
      const flipX = variation > 0.5;
      const flipY = variation > 0.76 || variation < 0.12;
      ctx.save();
      ctx.translate(x + (flipX ? T + 1 : 0), y + (flipY ? T + 1 : 0));
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(img, 0, 0, T + 1, T + 1);
      ctx.restore();
    }
    else {
      ctx.fillStyle = tint;
      ctx.fillRect(x, y, T + 1, T + 1);
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, T + 1, T + 1);
    ctx.restore();
  }

  _drawZoneGroundTile(ctx, zoneImg, fallbackImg, tx, ty, s, visual, tint = visual.ground) {
    ctx.fillStyle = tint;
    ctx.fillRect(s.x, s.y, T + 1, T + 1);
    if (zoneImg?.width && zoneImg?.height) {
      const cells = 8;
      const sw = zoneImg.width / cells;
      const sh = zoneImg.height / cells;
      const sx = ((tx % cells) + cells) % cells * sw;
      const sy = ((ty % cells) + cells) % cells * sh;
      ctx.save();
      ctx.globalAlpha = 0.82;
      ctx.drawImage(zoneImg, sx, sy, sw + 0.5, sh + 0.5, s.x, s.y, T + 1, T + 1);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = tint;
      ctx.fillRect(s.x, s.y, T + 1, T + 1);
      ctx.restore();
      return;
    }
    this._drawTintedTile(ctx, fallbackImg, s.x, s.y, tint, 0.42, this._hash2(tx, ty, 7));
  }

  _drawRoadTile(ctx, zoneImg, roadImg, tx, ty, s, visual) {
    this._drawZoneGroundTile(ctx, zoneImg, roadImg, tx, ty, s, visual, visual.road);
    if (!roadImg || !zoneImg) return;
    ctx.save();
    ctx.globalAlpha = 0.46;
    const flip = this._hash2(tx, ty, 13) > 0.5;
    ctx.translate(s.x + (flip ? T + 1 : 0), s.y);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.drawImage(roadImg, 0, 0, T + 1, T + 1);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = visual.road;
    ctx.fillRect(s.x, s.y, T + 1, T + 1);
    ctx.restore();
  }

  _drawGroundDetail(ctx, tx, ty, s, visual, isRoad) {
    const h = this._hash2(tx, ty, this.mapId.length);
    const h2 = this._hash2(tx + 17, ty - 9, this.mapId.charCodeAt(0));
    if (isRoad) {
      if (h > 0.72) {
        ctx.fillStyle = 'rgba(25,18,12,0.2)';
        ctx.beginPath();
        ctx.ellipse(s.x + 8 + h2 * 30, s.y + 12 + h * 24, 2 + h * 3, 1.2, h2 * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    const x = s.x + 8 + h2 * 31;
    const y = s.y + 10 + h * 27;
    if (visual.detail === 'field' && h > 0.90) {
      ctx.strokeStyle = 'rgba(204,177,91,0.30)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 2, y + 4);
        ctx.quadraticCurveTo(x - 2 + i * 3, y, x - 1 + i * 2, y - 5 - i);
        ctx.stroke();
      }
      return;
    }
    if (visual.detail === 'valley' && h < 0.075) {
      ctx.fillStyle = 'rgba(43,123,76,0.20)';
      ctx.beginPath();
      ctx.ellipse(x, y, 8 + h2 * 5, 3 + h2 * 2, h2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(117,226,151,0.22)';
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + h2 * 3, 1.5 + h2, h2, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (visual.detail === 'cave' && h > 0.93) {
      ctx.strokeStyle = 'rgba(173,128,78,0.26)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x + 4, y - 4);
      ctx.lineTo(s.x + T - 4, y + 2);
      ctx.moveTo(s.x + 4, y + 2);
      ctx.lineTo(s.x + T - 4, y + 8);
      ctx.stroke();
      ctx.fillStyle = 'rgba(34,25,21,0.42)';
      for (let i = 0; i < 4; i++) ctx.fillRect(s.x + 7 + i * 11, y - 4 + i * 1.6, 2, 12);
      return;
    }
    if (visual.detail === 'tomb' && h > 0.90) {
      ctx.strokeStyle = 'rgba(255,91,47,0.34)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 5);
      ctx.lineTo(x - 2, y);
      ctx.lineTo(x - 7, y + 7);
      ctx.moveTo(x - 2, y);
      ctx.lineTo(x + 8, y + 3);
      ctx.stroke();
      return;
    }
    if (visual.detail === 'hive' && h < 0.08) {
      ctx.fillStyle = 'rgba(8,11,5,0.48)';
      ctx.beginPath();
      ctx.ellipse(x, y, 7 + h2 * 4, 4 + h2 * 2, h2 * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(153,202,80,0.18)';
      ctx.stroke();
      return;
    }
    if (visual.detail === 'temple' && h > 0.91) {
      ctx.strokeStyle = 'rgba(185,151,255,0.25)';
      ctx.lineWidth = 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-5, -5, 10, 10);
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (visual.detail === 'sanctum' && h < 0.075) {
      ctx.strokeStyle = 'rgba(223,66,87,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 7 + h2 * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 4);
      ctx.lineTo(x, y - 7);
      ctx.lineTo(x + 6, y + 4);
      ctx.closePath();
      ctx.stroke();
      return;
    }
    if (visual.detail === 'war' && h > 0.89) {
      ctx.fillStyle = 'rgba(17,11,7,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y, 8 + h2 * 5, 4 + h2 * 2, h2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(192,137,80,0.24)';
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 5);
      ctx.lineTo(x + 7, y + 5);
      ctx.moveTo(x + 4, y - 7);
      ctx.lineTo(x - 4, y + 7);
      ctx.stroke();
      return;
    }
    if (h > 0.76) {
      ctx.strokeStyle = visual.detail === 'cave' || visual.detail === 'temple' || visual.detail === 'sanctum'
        ? 'rgba(190,165,132,0.16)'
        : 'rgba(187,211,112,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.quadraticCurveTo(x - 2, y, x - 1, y - 4);
      ctx.moveTo(x + 1, y + 4);
      ctx.quadraticCurveTo(x + 4, y, x + 3, y - 3);
      ctx.stroke();
    } else if (h < 0.07) {
      ctx.fillStyle = visual.accent;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(s.x + 7 + h2 * 32, s.y + 9 + h * 30, 2, 2);
      ctx.globalAlpha = 1;
    }
  }

  _drawWorldLights(ctx, visual) {
    if (!visual.lights?.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const light of visual.lights) {
      const s = this.worldToScreen(light.x * T, light.y * T);
      const pulse = 0.92 + Math.sin(this.time * 3.1 + light.x) * 0.08;
      if (s.x < -light.r || s.y < -light.r || s.x > this.viewW + light.r || s.y > this.viewH + light.r) continue;
      const gradient = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, light.r * pulse);
      gradient.addColorStop(0, `${light.color}48`);
      gradient.addColorStop(0.32, `${light.color}20`);
      gradient.addColorStop(1, `${light.color}00`);
      ctx.fillStyle = gradient;
      ctx.fillRect(s.x - light.r, s.y - light.r, light.r * 2, light.r * 2);
      ctx.globalAlpha = 0.54;
      ctx.strokeStyle = light.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 2, 9 + pulse * 2, 4 + pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) {
        const a = this.time * (1.1 + i * 0.2) + i * 2.1;
        ctx.fillStyle = light.color;
        ctx.globalAlpha = 0.22 + i * 0.08;
        ctx.beginPath();
        ctx.arc(s.x + Math.cos(a) * (6 + i * 2), s.y - 5 - ((this.time * 18 + i * 9) % 22), 1 + i * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  _drawForegroundAtmosphere(ctx, visual, vw, vh) {
    if (!['valley', 'cave', 'hive', 'temple', 'sanctum', 'tomb'].includes(visual.detail)) return;
    const colors = {
      valley: 'rgba(61,131,91,0.075)', cave: 'rgba(43,34,48,0.10)', hive: 'rgba(93,124,56,0.08)',
      temple: 'rgba(88,65,124,0.09)', sanctum: 'rgba(119,35,55,0.105)', tomb: 'rgba(101,46,34,0.08)',
    };
    ctx.save();
    for (let layer = 0; layer < 3; layer++) {
      const y = vh * (0.58 + layer * 0.13) + Math.sin(this.time * (0.16 + layer * 0.03) + layer) * 18;
      const band = ctx.createLinearGradient(0, y - 44, 0, y + 55);
      band.addColorStop(0, 'rgba(0,0,0,0)');
      band.addColorStop(0.48, colors[visual.detail]);
      band.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, y - 44, vw, 100);
    }
    ctx.restore();
  }

  _drawRoadEdges(ctx, tx, ty, s, visual) {
    const has = (x, y) => this.roadSet?.has(`${x},${y}`);
    ctx.save();
    const feather = 10;
    const edgeBand = (side) => {
      const horizontal = side === 'n' || side === 's';
      const x0 = side === 'e' ? s.x + T - feather : s.x;
      const y0 = side === 's' ? s.y + T - feather : s.y;
      const x1 = horizontal ? x0 : x0 + feather;
      const y1 = horizontal ? y0 + feather : y0;
      const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
      const reverse = side === 'e' || side === 's';
      gradient.addColorStop(reverse ? 0 : 1, `${visual.roadEdge}00`);
      gradient.addColorStop(reverse ? 1 : 0, `${visual.roadEdge}a8`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x0, y0, horizontal ? T + 1 : feather + 1, horizontal ? feather + 1 : T + 1);
      ctx.strokeStyle = `${visual.accent}42`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const p = i / 5;
        const wobble = (this._hash2(tx * 7 + i, ty * 11 - i, side.charCodeAt(0)) - 0.5) * 5;
        const x = horizontal ? s.x + p * T : (side === 'w' ? s.x + feather : s.x + T - feather) + wobble;
        const y = horizontal ? (side === 'n' ? s.y + feather : s.y + T - feather) + wobble : s.y + p * T;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    if (!has(tx - 1, ty)) edgeBand('w');
    if (!has(tx + 1, ty)) edgeBand('e');
    if (!has(tx, ty - 1)) edgeBand('n');
    if (!has(tx, ty + 1)) edgeBand('s');
    ctx.restore();
  }

  _drawRoadNetwork(ctx, visual) {
    if (!this.map.roadPaths?.length) return;
    const roadTexture = ['bich', 'sabac'].includes(this.mapId)
      ? this.assets.tiles?.road
      : this.assets.tiles?.dirt;
    const roadPattern = roadTexture && ctx.createPattern ? ctx.createPattern(roadTexture, 'repeat') : null;
    if (roadPattern?.setTransform && typeof DOMMatrix !== 'undefined') {
      roadPattern.setTransform(new DOMMatrix().translate(
        this.viewW * 0.5 - Math.round(this.cam.x),
        this.viewH * 0.5 - Math.round(this.cam.y),
      ));
    }
    const buildPath = (points) => {
      const screen = points.map(([x, y]) => this.worldToScreen(x * T, y * T));
      ctx.beginPath();
      ctx.moveTo(screen[0].x, screen[0].y);
      for (let i = 1; i < screen.length - 1; i++) {
        const current = screen[i];
        const next = screen[i + 1];
        ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) * 0.5, (current.y + next.y) * 0.5);
      }
      const last = screen[screen.length - 1];
      ctx.lineTo(last.x, last.y);
      return screen;
    };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let pathIndex = 0; pathIndex < this.map.roadPaths.length; pathIndex++) {
      const path = this.map.roadPaths[pathIndex];
      const width = (path.width || 3) * T;
      buildPath(path.points);
      ctx.strokeStyle = `${visual.roadEdge}d0`;
      ctx.lineWidth = width + 16;
      ctx.stroke();
      buildPath(path.points);
      ctx.strokeStyle = roadPattern || visual.road;
      ctx.lineWidth = width;
      ctx.stroke();
      buildPath(path.points);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.46;
      ctx.strokeStyle = visual.road;
      ctx.lineWidth = Math.max(2, width - 4);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      buildPath(path.points);
      ctx.strokeStyle = `${visual.accent}18`;
      ctx.lineWidth = Math.max(2, width - 16);
      ctx.stroke();

      // 连续车辙与磨损把色块压回环境材质，不再出现逐格阶梯。
      for (const trackOffset of [-width * 0.22, width * 0.22]) {
        const pts = path.points.map(([x, y]) => this.worldToScreen(x * T, y * T + trackOffset));
        ctx.strokeStyle = 'rgba(27,18,12,0.18)';
        ctx.lineWidth = 2;
        ctx.setLineDash([18, 13]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (let i = 0; i < path.points.length - 1; i++) {
        const [ax, ay] = path.points[i];
        const [bx, by] = path.points[i + 1];
        const distance = Math.hypot(bx - ax, by - ay);
        const samples = Math.max(2, Math.ceil(distance * 1.4));
        for (let j = 0; j < samples; j++) {
          const t = (j + 0.5) / samples;
          const seed = this._hash2(i * 19 + j, pathIndex * 23, this.mapId.length * 5);
          if (seed < 0.42) continue;
          const center = this.worldToScreen((ax + (bx - ax) * t) * T, (ay + (by - ay) * t) * T);
          const lateral = (this._hash2(j, i, 71) - 0.5) * width * 0.72;
          ctx.fillStyle = 'rgba(25,17,11,0.18)';
          ctx.beginPath();
          ctx.ellipse(center.x + lateral, center.y + (seed - 0.5) * 18, 2 + seed * 3, 1.2 + seed, seed * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  _drawWallTile(ctx, img, tx, ty, s, visual, wallPattern = null) {
    const wallAt = (x, y) => y >= 0 && x >= 0 && y < WORLD.rows && x < WORLD.cols && this.map.grid[y][x] === 1;
    const openSides = {
      n: !wallAt(tx, ty - 1), e: !wallAt(tx + 1, ty),
      s: !wallAt(tx, ty + 1), w: !wallAt(tx - 1, ty),
    };
    const boundary = Object.values(openSides).some(Boolean);
    const organic = visual.structure === 'organic';
    const rocky = ['mine_rock', 'cliff', 'moss_cliff'].includes(visual.structure);
    if (wallPattern) {
      ctx.save();
      ctx.globalAlpha = 0.98;
      ctx.fillStyle = wallPattern;
      ctx.fillRect(s.x, s.y, T + 1, T + 1);
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = boundary ? 0.2 : 0.38;
      ctx.fillStyle = boundary ? visual.wall : visual.groundDark;
      ctx.fillRect(s.x, s.y, T + 1, T + 1);
      ctx.restore();
    } else {
      ctx.fillStyle = boundary && !rocky && !organic ? visual.wall : visual.groundDark;
      ctx.fillRect(s.x, s.y, T + 1, T + 1);
    }

    if (!boundary) return;
    ctx.save();
    if (!rocky && !organic) {
      const cap = ctx.createLinearGradient(s.x, s.y, s.x, s.y + T);
      cap.addColorStop(0, visual.wallTop);
      cap.addColorStop(0.46, `${visual.wall}70`);
      cap.addColorStop(1, `${visual.groundDark}a8`);
      ctx.globalAlpha = wallPattern ? 0.28 : 1;
      ctx.fillStyle = cap;
      ctx.fillRect(s.x, s.y, T + 1, T + 1);
      ctx.globalAlpha = 1;
    }

    // 只刻画临空边缘，连续墙体不再出现调试网格条纹。
    const edgePath = (side) => {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const p = i / 6;
        const n = (this._hash2(tx * 13 + i, ty * 17 - i, side.charCodeAt(0)) - 0.5) * (rocky || organic ? 7 : 2.4);
        let x = s.x + p * T; let y = s.y + p * T;
        if (side === 'n') y = s.y + 3 + n;
        if (side === 's') y = s.y + T - 5 + n;
        if (side === 'w') x = s.x + 3 + n;
        if (side === 'e') x = s.x + T - 4 + n;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    if (rocky || organic) {
      ctx.lineWidth = organic ? 7 : 6;
      ctx.strokeStyle = 'rgba(5,5,4,0.46)';
      if (openSides.n) edgePath('n');
      if (openSides.w) edgePath('w');
      if (openSides.e) edgePath('e');
      if (openSides.s) edgePath('s');
    }
    ctx.lineWidth = rocky || organic ? 1.15 : 1;
    ctx.strokeStyle = rocky
      ? 'rgba(174,166,143,0.24)'
      : organic
        ? 'rgba(151,160,91,0.22)'
        : 'rgba(204,181,143,0.2)';
    if (openSides.n) edgePath('n');
    if (openSides.w) edgePath('w');
    if (openSides.e) edgePath('e');
    ctx.strokeStyle = 'rgba(5,4,4,0.78)';
    ctx.lineWidth = rocky || organic ? 2.2 : 1.6;
    if (openSides.s) edgePath('s');

    const h = this._hash2(tx, ty, 83);
    if (organic) {
      ctx.fillStyle = 'rgba(154,194,78,0.13)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(s.x + 9 + ((h * 37 + i * 15) % 34), s.y + 10 + ((h * 29 + i * 11) % 26), 5 + i, 3 + i * 0.5, h * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = rocky ? 'rgba(20,16,15,0.42)' : 'rgba(18,12,15,0.32)';
      ctx.lineWidth = rocky ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(s.x + 8 + h * 16, s.y + 7);
      ctx.lineTo(s.x + 20 + h * 12, s.y + 20);
      ctx.lineTo(s.x + 16 + h * 18, s.y + 37);
      if (!rocky) {
        ctx.moveTo(s.x + 5, s.y + 27 + h * 6);
        ctx.lineTo(s.x + 34, s.y + 23 + h * 4);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawWallFace(ctx, face, visual, wallPattern = null, faceImg = null) {
    const s = this.worldToScreen(face.tx * T, face.ty * T);
    const rocky = ['mine_rock', 'cliff', 'moss_cliff'].includes(visual.structure);
    const organic = visual.structure === 'organic';
    const depth = visual.structure === 'fortress' ? 29 : rocky ? 35 : organic ? 32 : 27;
    const topY = s.y + T - 7;
    const j0 = (this._hash2(face.tx, face.ty, 91) - 0.5) * (rocky || organic ? 6 : 2);
    const j1 = (this._hash2(face.tx + 4, face.ty - 3, 97) - 0.5) * (rocky || organic ? 7 : 2);
    const facePath = () => {
      ctx.beginPath();
      ctx.moveTo(s.x, topY + j0);
      ctx.lineTo(s.x + T, topY + j1);
      ctx.lineTo(s.x + T, topY + depth - j0 * 0.35);
      if (rocky || organic) {
        ctx.lineTo(s.x + T * 0.76, topY + depth + j1 * 0.25);
        ctx.lineTo(s.x + T * 0.48, topY + depth - j0 * 0.4);
        ctx.lineTo(s.x + T * 0.22, topY + depth + j1 * 0.28);
      }
      ctx.lineTo(s.x, topY + depth - j1 * 0.35);
      ctx.closePath();
    };
    ctx.save();
    ctx.fillStyle = 'rgba(3,2,3,0.34)';
    ctx.beginPath();
    ctx.ellipse(s.x + T * 0.52, topY + depth + 5, T * 0.62, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    facePath();
    if (ctx.clip) ctx.clip();
    const faceGradient = ctx.createLinearGradient(s.x, topY, s.x, topY + depth);
    faceGradient.addColorStop(0, visual.wallTop);
    faceGradient.addColorStop(0.16, visual.wall);
    faceGradient.addColorStop(1, visual.groundDark);
    ctx.fillStyle = faceGradient;
    ctx.fillRect(s.x, topY - 5, T + 1, depth + 12);
    if (faceImg?.width && faceImg?.height) {
      const segments = 32;
      const sw = faceImg.width / segments;
      const segment = ((face.tx + face.ty * 7) % segments + segments) % segments;
      ctx.globalAlpha = 0.98;
      ctx.drawImage(faceImg, segment * sw, 0, sw + 1, faceImg.height, s.x, topY - 4, T + 1, depth + 10);
    } else if (wallPattern) {
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = wallPattern;
      ctx.fillRect(s.x, topY - 5, T + 1, depth + 12);
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.52;
    const shade = ctx.createLinearGradient(s.x, topY, s.x, topY + depth);
    shade.addColorStop(0, 'rgba(255,255,255,0.08)');
    shade.addColorStop(1, 'rgba(12,8,8,0.88)');
    ctx.fillStyle = shade;
    ctx.fillRect(s.x, topY - 5, T + 1, depth + 12);
    ctx.restore();

    ctx.strokeStyle = rocky
      ? 'rgba(188,178,150,0.3)'
      : organic
        ? 'rgba(157,171,91,0.28)'
        : 'rgba(210,186,146,0.25)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(s.x, topY + j0);
    ctx.lineTo(s.x + T, topY + j1);
    ctx.stroke();
    if (organic) {
      ctx.strokeStyle = 'rgba(175,217,91,0.24)';
      ctx.beginPath();
      ctx.moveTo(s.x + 10, topY + 4);
      ctx.quadraticCurveTo(s.x + 18, topY + depth - 2, s.x + 28, topY + 7);
      ctx.quadraticCurveTo(s.x + 34, topY + depth, s.x + 42, topY + 9);
      ctx.stroke();
    } else if (rocky) {
      ctx.strokeStyle = 'rgba(12,9,8,0.48)';
      ctx.beginPath();
      ctx.moveTo(s.x + 13, topY + 2);
      ctx.lineTo(s.x + 18, topY + depth * 0.48);
      ctx.lineTo(s.x + 11, topY + depth);
      ctx.moveTo(s.x + 35, topY + 1);
      ctx.lineTo(s.x + 31, topY + depth * 0.62);
      ctx.stroke();
    } else {
      // 砌体仅保留大尺度错缝，不再每 12px 画调试横线。
      ctx.strokeStyle = 'rgba(17,10,12,0.38)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x + T * 0.52, topY + 2);
      ctx.lineTo(s.x + T * 0.47, topY + depth);
      ctx.moveTo(s.x + 4, topY + depth * 0.58);
      ctx.lineTo(s.x + T - 5, topY + depth * 0.48);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawSceneMarks(ctx, visual) {
    for (const mark of this.map.marks || []) {
      const s = this.worldToScreen(mark.x * T, mark.y * T);
      const r = mark.r * T;
      ctx.save();
      ctx.globalAlpha = 0.62;
      const radial = ctx.createRadialGradient(s.x, s.y, r * 0.08, s.x, s.y, r);
      radial.addColorStop(0, `${visual.accent}24`);
      radial.addColorStop(0.68, `${visual.roadEdge}20`);
      radial.addColorStop(1, `${visual.roadEdge}00`);
      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      const ring = (scale, color, width = 2, dash = []) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, r * scale, r * scale * 0.48, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      if (['plaza', 'tomb_ring', 'ritual', 'sigil', 'capture', 'throne'].includes(mark.kind)) {
        ring(0.8, `${visual.accent}48`, 2);
        ring(0.52, 'rgba(15,10,9,0.42)', 2, [9, 7]);
      }
      if (mark.kind === 'plaza') {
        ctx.strokeStyle = 'rgba(222,196,145,0.22)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x - r, s.y); ctx.lineTo(s.x + r, s.y);
        ctx.moveTo(s.x, s.y - r * 0.5); ctx.lineTo(s.x, s.y + r * 0.5);
        ctx.stroke();
      } else if (['camp', 'siege'].includes(mark.kind)) {
        ring(0.42, 'rgba(45,20,10,0.58)', 6, [18, 5]);
        ctx.strokeStyle = 'rgba(32,20,13,0.44)';
        ctx.lineWidth = 3;
        for (const offset of [-18, 20]) {
          ctx.beginPath();
          ctx.moveTo(s.x - r * 0.9, s.y + offset);
          ctx.quadraticCurveTo(s.x, s.y + offset * 0.45, s.x + r * 0.9, s.y + offset * 0.2);
          ctx.stroke();
        }
      } else if (['rail', 'aisle', 'blood_aisle'].includes(mark.kind)) {
        const color = mark.kind === 'blood_aisle' ? 'rgba(104,8,24,0.55)' : 'rgba(42,29,22,0.52)';
        ctx.strokeStyle = color;
        ctx.lineWidth = mark.kind === 'blood_aisle' ? 12 : 3;
        for (const dy of [-10, 10]) {
          ctx.beginPath(); ctx.moveTo(s.x - r, s.y + dy); ctx.lineTo(s.x + r, s.y + dy); ctx.stroke();
        }
        if (mark.kind === 'rail') {
          ctx.lineWidth = 2;
          for (let x = -r; x <= r; x += 20) {
            ctx.beginPath(); ctx.moveTo(s.x + x, s.y - 14); ctx.lineTo(s.x + x, s.y + 14); ctx.stroke();
          }
        }
      } else if (['swamp', 'slime', 'nest'].includes(mark.kind)) {
        ctx.fillStyle = mark.kind === 'swamp' ? 'rgba(21,66,50,0.36)' : 'rgba(103,142,49,0.28)';
        for (let i = 0; i < 7; i++) {
          const a = i * 2.37;
          const rr = r * (0.18 + (i % 4) * 0.15);
          ctx.beginPath();
          ctx.ellipse(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr * 0.48, 18 + i * 2, 7 + i, a, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (['graveyard', 'crypt', 'bones', 'collapse'].includes(mark.kind)) {
        ctx.strokeStyle = 'rgba(21,16,15,0.55)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const x = s.x - r * 0.55 + (i % 3) * r * 0.5;
          const y = s.y - r * 0.18 + Math.floor(i / 3) * r * 0.28;
          ctx.beginPath(); ctx.moveTo(x - 8, y + 5); ctx.lineTo(x + 8, y - 5); ctx.moveTo(x - 6, y - 5); ctx.lineTo(x + 7, y + 5); ctx.stroke();
        }
      } else if (mark.kind === 'gate' || mark.kind === 'market' || mark.kind === 'meadow') {
        ring(0.72, `${visual.accent}2c`, 1.5, [5, 9]);
      }
      ctx.restore();
    }
  }

  _drawAtmosphere(ctx, visual, vw, vh) {
    const kind = visual.atmosphere;
    ctx.save();
    const count = kind === 'souls' ? 16 : 28;
    for (let i = 0; i < count; i++) {
      const speed = 6 + (i % 5) * 3;
      const drift = kind === 'ash' || kind === 'leaves' ? -speed : speed;
      const px = (i * 173 + this.time * drift + vw + 100) % (vw + 100) - 50;
      const py = (i * 97 + this.time * (kind === 'embers' ? -12 : 4) + Math.sin(this.time * 0.7 + i) * 26 + vh + 80) % (vh + 80) - 40;
      const pulse = 0.45 + Math.sin(this.time * 2 + i) * 0.22;
      if (kind === 'spores') {
        ctx.fillStyle = `rgba(128,231,157,${Math.max(0.08, pulse * 0.34)})`;
        ctx.beginPath();
        ctx.arc(px, py, i % 4 === 0 ? 2.2 : 1.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === 'embers') {
        ctx.fillStyle = `rgba(255,119,49,${Math.max(0.08, pulse * 0.55)})`;
        ctx.fillRect(px, py, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 4 : 2);
      } else if (kind === 'souls') {
        ctx.strokeStyle = `rgba(220,141,255,${Math.max(0.05, pulse * 0.24)})`;
        ctx.beginPath();
        ctx.arc(px, py, 4 + (i % 3) * 2, 0, Math.PI * 1.5);
        ctx.stroke();
      } else if (kind === 'leaves') {
        ctx.fillStyle = `rgba(207,166,75,${Math.max(0.05, pulse * 0.22)})`;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(this.time + i);
        ctx.fillRect(-2, -1, 5, 2);
        ctx.restore();
      } else {
        ctx.fillStyle = kind === 'ash'
          ? `rgba(194,159,139,${Math.max(0.04, pulse * 0.18)})`
          : `rgba(224,192,96,${Math.max(0.04, pulse * 0.16)})`;
        ctx.fillRect(px, py, i % 6 === 0 ? 2 : 1, i % 6 === 0 ? 2 : 1);
      }
    }
    ctx.restore();
  }

  _drawPortal(ctx, portal, visual) {
    const s = this.worldToScreen(portal.x, portal.y);
    const pulse = 0.5 + Math.sin(this.time * 3.4 + portal.x * 0.01) * 0.5;
    const [core, edge] = visual.portal;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(s.x, s.y - 5, 3, s.x, s.y - 5, 42 + pulse * 6);
    glow.addColorStop(0, `${core}bb`);
    glow.addColorStop(0.42, `${edge}55`);
    glow.addColorStop(1, `${edge}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(s.x - 52, s.y - 56, 104, 100);
    ctx.strokeStyle = core;
    ctx.globalAlpha = 0.72 + pulse * 0.2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 4, 25 + pulse * 3, 11 + pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.34;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 4, 18, 7, this.time, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + this.time * (i % 2 ? -0.9 : 0.7);
      const rr = 15 + (i % 3) * 7;
      const rise = ((this.time * 26 + i * 15) % 52);
      ctx.globalAlpha = 0.22 + (i % 3) * 0.12;
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * rr, s.y + 6 - rise, 1.2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(9,7,5,0.76)';
    ctx.fillRect(s.x - 46, s.y - 47, 92, 18);
    ctx.strokeStyle = `${edge}aa`;
    ctx.strokeRect(s.x - 46, s.y - 47, 92, 18);
    ctx.fillStyle = core;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(portal.label, s.x, s.y - 34);
  }

  _drawHitFlash(ctx, img, unit, drawY, drawH, anchor = 0.92, authoredDirection = false) {
    if (!img || unit.hitT <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(unit.hitT * 4.5, 0, 0.72);
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'brightness(3) saturate(0)';
    this._drawSprite(
      ctx,
      img,
      unit.x + (unit.hitOffsetX || 0),
      drawY + (unit.hitOffsetY || 0),
      drawH,
      unit.facing || 1,
      anchor,
      unit.direction,
      authoredDirection,
    );
    ctx.restore();
  }

  _drawScreenGrade(ctx, visual, vw, vh) {
    if (visual.fog) {
      ctx.fillStyle = visual.fog;
      ctx.fillRect(0, 0, vw, vh);
    }
    const vignette = ctx.createRadialGradient(vw * 0.5, vh * 0.48, Math.min(vw, vh) * 0.18, vw * 0.5, vh * 0.5, Math.max(vw, vh) * 0.68);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.66, `rgba(0,0,0,${visual.vignette * 0.22})`);
    vignette.addColorStop(1, `rgba(0,0,0,${visual.vignette})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, vw, vh);
    const hpPct = this.player.maxHp ? this.player.hp / this.player.maxHp : 1;
    if (hpPct < 0.34 && this.player.alive) {
      const danger = ctx.createRadialGradient(vw * 0.5, vh * 0.5, Math.min(vw, vh) * 0.26, vw * 0.5, vh * 0.5, Math.max(vw, vh) * 0.7);
      danger.addColorStop(0, 'rgba(116,0,0,0)');
      danger.addColorStop(1, `rgba(148,5,0,${(0.34 - hpPct) * (0.48 + Math.sin(this.time * 4) * 0.12)})`);
      ctx.fillStyle = danger;
      ctx.fillRect(0, 0, vw, vh);
    }
    if (this.impactT > 0) {
      ctx.fillStyle = `rgba(255,223,177,${this.impactT * 0.22})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    if (this.zoneFadeT > 0) {
      const alpha = Math.pow(clamp(this.zoneFadeT / 0.72, 0, 1), 2);
      ctx.fillStyle = `rgba(3,2,2,${alpha * 0.9})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    if (this.zoneIntroT > 0) {
      const phase = this.zoneIntroT / 2.4;
      const alpha = Math.min(1, (1 - phase) * 4, phase * 2.2);
      const subtitles = {
        bich: '王城余烬 · 安全区域', field: '荒原风起 · 危险区域', valley: '毒雾潜行 · 危险区域',
        cave: '矿灯将熄 · 危险区域', stone_tomb: '石墓迷阵 · 危险区域', centipede_cave: '百足巢穴 · 危险区域',
        temple: '沃玛遗迹 · 危险区域', sanctum: '教主内殿 · 极危区域', sabac: '王城战地 · 争夺区域',
      };
      ctx.textAlign = 'center';
      ctx.globalAlpha = alpha * 0.92;
      ctx.fillStyle = '#f5ddb0';
      ctx.font = '28px "STKaiti", "KaiTi", serif';
      ctx.fillText(this.map.name, vw / 2, vh * 0.24);
      ctx.globalAlpha = alpha * 0.64;
      ctx.fillStyle = visual.accent;
      ctx.font = '10px sans-serif';
      ctx.fillText(subtitles[this.mapId] || '玛法大陆', vw / 2, vh * 0.24 + 22);
      ctx.globalAlpha = 1;
    }
  }

  render() {
    const ctx = this.ctx;
    const vw = this.viewW; const vh = this.viewH;
    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    const visual = this.visual;
    if (this.shake > 0) {
      const falloff = Math.min(1, this.shake / 8);
      ctx.translate(Math.sin(this.time * 91) * this.shake * 0.42 * falloff, Math.cos(this.time * 73) * this.shake * 0.28 * falloff);
    }

    // 玩法画面只混合世界坐标地表。旧的屏幕空间远景与地砖以不同速率
    // 位移，会在镜头跟随时产生地面“游动”的错觉。
    ctx.fillStyle = visual.groundDark;
    ctx.fillRect(0, 0, vw, vh);
    // 地表、道路与实体墙：统一色彩主题并为道路补齐边缘。
    const startCol = Math.floor((this.cam.x - vw / 2) / T) - 1;
    const startRow = Math.floor((this.cam.y - vh / 2) / T) - 1;
    const cols = Math.ceil(vw / T) + 3;
    const rows = Math.ceil(vh / T) + 3;
    const groundKey = this.map.ground || (this.map.safe ? 'grass' : 'grass');
    const groundImg = this.assets.tiles?.[groundKey];
    const roadImg = this.assets.tiles?.road;
    const dirtImg = this.assets.tiles?.dirt;
    const zoneGroundImg = this.assets.zoneGround?.[this.mapId];
    const wallMaterial = this.assets.wallMaterials?.[this.mapId] || {};
    const wallTextureImg = wallMaterial.top || zoneGroundImg;
    const wallFaceImg = wallMaterial.face || null;
    const wallPattern = wallTextureImg && ctx.createPattern ? ctx.createPattern(wallTextureImg, 'repeat') : null;
    if (wallPattern?.setTransform && typeof DOMMatrix !== 'undefined') {
      wallPattern.setTransform(new DOMMatrix().translate(
        vw * 0.5 - Math.round(this.cam.x),
        vh * 0.5 - Math.round(this.cam.y),
      ));
    }
    const wallFaces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tx = startCol + c;
        const ty = startRow + r;
        if (ty < 0 || tx < 0 || ty >= WORLD.rows || tx >= WORLD.cols) continue;
        const s = this.worldToScreen(tx * T, ty * T);
        const baseWall = this.map.renderWalls && this.map.grid[ty][tx] === 1;
        const isRoad = this.roadSet?.has(`${tx},${ty}`);
        if (baseWall) {
          this._drawWallTile(ctx, dirtImg, tx, ty, s, visual, wallPattern);
          if (ty + 1 < WORLD.rows && this.map.grid[ty + 1][tx] === 0) wallFaces.push({ tx, ty });
        } else if (isRoad && !this.map.roadPaths?.length) {
          this._drawRoadTile(ctx, zoneGroundImg, roadImg || dirtImg, tx, ty, s, visual);
          this._drawRoadEdges(ctx, tx, ty, s, visual);
          this._drawGroundDetail(ctx, tx, ty, s, visual, true);
        } else {
          this._drawZoneGroundTile(ctx, zoneGroundImg, groundImg, tx, ty, s, visual);
          const shade = this._hash2(tx, ty, 31);
          if (shade > 0.55) {
            ctx.fillStyle = `rgba(0,0,0,${0.025 + shade * 0.035})`;
            ctx.fillRect(s.x, s.y, T + 1, T + 1);
          }
          this._drawGroundDetail(ctx, tx, ty, s, visual, false);
        }
      }
    }

    this._drawRoadNetwork(ctx, visual);
    this._drawSceneMarks(ctx, visual);
    this._drawWorldLights(ctx, visual);
    this._drawAtmosphere(ctx, visual, vw, vh);

    for (const h of this.hazards) {
      const s = this.worldToScreen(h.x, h.y);
      const remaining = clamp(h.t / h.maxT, 0, 1);
      const pulse = 0.55 + Math.sin(this.time * 18) * 0.18;
      const hazardGradient = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, h.r);
      hazardGradient.addColorStop(0, `rgba(255,236,153,${0.07 + pulse * 0.08})`);
      hazardGradient.addColorStop(0.72, `rgba(255,66,24,${0.09 + (1 - remaining) * 0.16})`);
      hazardGradient.addColorStop(1, 'rgba(124,8,0,0.04)');
      ctx.fillStyle = hazardGradient;
      ctx.beginPath();
      ctx.arc(s.x, s.y, h.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = remaining < 0.28 ? '#fff0b0' : '#ff7142';
      ctx.lineWidth = remaining < 0.28 ? 4 : 2.5;
      ctx.setLineDash([10, 7]);
      ctx.lineDashOffset = -this.time * 38;
      ctx.beginPath();
      ctx.arc(s.x, s.y, h.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(-this.time * 0.9);
      ctx.strokeStyle = 'rgba(255,183,88,0.36)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(h.r * 0.3, 0);
        ctx.lineTo(h.r * 0.72, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const portal of this.portals) this._drawPortal(ctx, portal, visual);

    // drops（先画，避免盖住单位）
    for (const d of this.drops) {
      const s = this.worldToScreen(d.x, d.y);
      const item = d.itemId ? ITEMS[d.itemId] : null;
      const dropColor = d.gold ? '#f1c40f' : RARITIES[item?.rarity || 'fine'].color;
      const pulse = 0.72 + Math.sin(this.time * 4 + d.x * 0.03) * 0.18;
      const rarity = item?.rarity || 'fine';
      ctx.fillStyle = dropColor;
      ctx.shadowColor = dropColor;
      ctx.shadowBlur = rarity === 'legendary' ? 24 : rarity === 'epic' ? 18 : 12;
      ctx.globalAlpha = pulse;
      const pillar = d.gold ? 15 : rarity === 'legendary' ? 40 : rarity === 'epic' ? 31 : 22;
      const beam = ctx.createLinearGradient(s.x, s.y - pillar, s.x, s.y + 4);
      beam.addColorStop(0, `${dropColor}00`);
      beam.addColorStop(1, `${dropColor}66`);
      ctx.fillStyle = beam;
      ctx.fillRect(s.x - 3, s.y - pillar, 6, pillar + 4);
      ctx.fillStyle = dropColor;
      ctx.beginPath();
      ctx.arc(s.x, s.y, d.gold ? 5 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      if (d.itemId && item) {
        const excellent = Object.keys(d.entry?.bonus || {}).length ? ' [极品]' : '';
        const protectedMark = d.ownerId && this.time < d.protectedUntil ? ' 🔒' : '';
        ctx.fillStyle = RARITIES[item.rarity || 'common'].color;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.name}${excellent}${protectedMark}`, s.x, s.y - 10);
      } else if (d.gold) {
        const protectedMark = d.ownerId && this.time < d.protectedUntil ? ' 🔒' : '';
        ctx.fillStyle = '#f1c40f';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${d.gold} 金币${protectedMark}`, s.x, s.y - 10);
      }
    }

    // 可交互采集点：独立高亮，耗尽后等待刷新。
    for (const node of this.gatherNodes) {
      if (!node.active) continue;
      const def = SCENERY[node.def.scenery] || {};
      const img = this.assets.scenery?.[node.def.scenery];
      const drawn = this._drawSprite(ctx, img, node.x, node.y, def.h || 58, 1, def.anchor ?? 0.94);
      const selected = this.pendingGather === node || this.gathering?.node === node;
      ctx.strokeStyle = selected ? '#82e0aa' : 'rgba(130,224,170,0.55)';
      ctx.lineWidth = selected ? 3 : 1;
      ctx.beginPath();
      if (ctx.ellipse) ctx.ellipse(drawn.foot.x, drawn.foot.y + 2, 24, 9, 0, 0, Math.PI * 2);
      else ctx.arc(drawn.foot.x, drawn.foot.y + 2, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#a9dfbf';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.def.name, drawn.foot.x, drawn.foot.y + 15);
      if (this.gathering?.node === node) {
        const pct = 1 - this.gathering.remaining / this.gathering.total;
        this._bar(ctx, drawn.foot.x, drawn.topY - 8, 52, pct, '#58d68d');
      }
    }

    // 装饰 + NPC + 单位 统一 Y 排序
    const list = [];
    for (const face of wallFaces) list.push({ kind: 'wall', y: (face.ty + 1) * T + 6, face });
    for (const d of this.decors || []) {
      if (this.worldPointInView(d.x, d.y, Math.max(96, d.h + 36))) {
        list.push({ kind: 'decor', y: d.y, d });
      }
    }
    for (const n of this.npcs) list.push({ kind: 'npc', y: n.y, n });
    for (const m of this.monsters) {
      if (m.alive || (m.deathUntil && this.time < m.deathUntil)) list.push({ kind: 'mob', y: m.y, u: m });
    }
    for (const remote of this.remotePlayers) {
      if (remote.alive) list.push({ kind: 'player', y: remote.y, u: remote });
    }
    if (this.player.pet?.alive) list.push({ kind: 'pet', y: this.player.pet.y, u: this.player.pet });
    for (const pet of this.networkPets) {
      if (pet.alive) list.push({ kind: 'pet', y: pet.y, u: pet });
    }
    if (this.player.alive) list.push({ kind: 'player', y: this.player.y, u: this.player });
    list.sort((a, b) => a.y - b.y);

    let localPlayerOccludedByDecor = false;
    for (const item of list) {
      if (item.kind === 'wall') {
        this._drawWallFace(ctx, item.face, visual, wallPattern, wallFaceImg);
        continue;
      }
      if (item.kind === 'decor') {
        const d = item.d;
        const img = this.assets.scenery?.[d.id];
        const foot = this.worldToScreen(d.x, d.y);
        const sabacGateBroken = d.id === 'sabac_gate'
          && ['palace', 'captured'].includes(this.worldState?.sabac?.war?.phase);
        if (sabacGateBroken) {
          ctx.save();
          ctx.globalAlpha = 0.52;
          this._drawSprite(ctx, img, d.x, d.y + 8, Math.max(72, d.h * 0.32), 1, d.anchor);
          ctx.fillStyle = 'rgba(112,79,55,0.22)';
          for (let index = 0; index < 5; index++) {
            const drift = Math.sin(this.time * 0.7 + index * 1.9);
            ctx.beginPath();
            ctx.arc(foot.x - 52 + index * 25 + drift * 7, foot.y - 18 - ((this.time * 9 + index * 13) % 38), 9 + index * 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          continue;
        }
        const shadowW = d.shadowW
          || (['house_a', 'house_b'].includes(d.id) ? Math.min(118, d.h * 0.28) : Math.min(54, d.h * 0.19));
        const isGrove = d.id.startsWith('grove_');
        ctx.fillStyle = isGrove ? 'rgba(4,6,3,0.15)' : 'rgba(4,3,2,0.24)';
        ctx.beginPath();
        ctx.ellipse(foot.x, foot.y + 3, shadowW, Math.max(5, shadowW * (isGrove ? 0.15 : 0.22)), 0, 0, Math.PI * 2);
        ctx.fill();
        const treeFamily = ['tree', 'pine'].includes(d.id)
          || d.id.startsWith('tree_')
          || d.id.startsWith('pine_');
        const canOcclude = treeFamily
          || ['house_a', 'house_b'].includes(d.id)
          || d.fadeRadius > 0;
        const fadeRadius = d.fadeRadius || (['house_a', 'house_b'].includes(d.id) ? 105 : 56);
        const decorDrawW = img?.width && img?.height
          ? d.h * (img.width / img.height)
          : d.h * 0.86;
        const decorTop = d.y - d.h * (d.anchor ?? 0.94);
        const playerTop = this.player.y - VISUAL_SCALE.player * 0.9;
        const playerBottom = this.player.y + 8;
        const overlapsVisibleSprite = Math.abs(this.player.x - d.x) <= decorDrawW * 0.52 + 18
          && playerBottom >= decorTop + d.h * 0.03
          && playerTop <= d.y + 12;
        const occludingPlayer = canOcclude
          && this.player.y < d.y
          && (
            Math.hypot(this.player.x - d.x, this.player.y - d.y) < fadeRadius
            || overlapsVisibleSprite
          );
        ctx.save();
        if (occludingPlayer) {
          localPlayerOccludedByDecor = true;
          // Overlapping canopy sprites must not compound into an opaque wall.
          ctx.globalAlpha = isGrove ? 0.1 : treeFamily ? 0.16 : 0.22;
        }
        this._drawSprite(ctx, img, d.x, d.y, d.h, d.facing, d.anchor);
        ctx.restore();
        continue;
      }
      if (item.kind === 'npc') {
        const n = item.n;
        const img = this._npcAnimImg(n.sprite, this.time * 3 + n.animOffset);
        const drawn = this._drawSprite(ctx, img, n.x, n.y, VISUAL_SCALE.npc);
        if (this.pendingNpc === n) {
          ctx.strokeStyle = '#ffd866';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (ctx.ellipse) ctx.ellipse(drawn.foot.x, drawn.foot.y + 2, 25, 9, 0, 0, Math.PI * 2);
          else ctx.arc(drawn.foot.x, drawn.foot.y + 2, 18, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, drawn.foot.x, drawn.foot.y + 16);
        if (n.action === 'quest' && this.player.questId) {
          ctx.fillStyle = '#ffd866';
          ctx.font = 'bold 22px serif';
          ctx.fillText(this.player.questReady ? '?' : '!', drawn.foot.x, drawn.topY - 12);
        }
        continue;
      }
      const u = item.u;
      const shadow = this.worldToScreen(u.x, u.y);
      if (u.alive) {
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        const shadowW = item.kind === 'player' ? 24 : u.boss ? 38 : u.elite ? 30 : 20;
        if (ctx.ellipse) ctx.ellipse(shadow.x, shadow.y + 2, shadowW, Math.max(7, shadowW * 0.3), 0, 0, Math.PI * 2);
        else ctx.arc(shadow.x, shadow.y + 2, item.kind === 'player' ? 17 : 14, 0, Math.PI * 2);
        ctx.fill();
      }
      if (item.kind === 'player') {
        const sprite = this._playerAnimSelection(
          u.classId,
          u.anim || 'idle',
          u.animFrame || 0,
          u.direction,
        );
        const img = sprite.img;
        const visualX = u.x + (u.hitOffsetX || 0);
        const drawY = u.y + (u.hitOffsetY || 0) - (u.jumpY || 0);
        const drawn = this._drawSprite(
          ctx,
          img,
          visualX,
          drawY,
          VISUAL_SCALE.player,
          u.facing,
          0.92,
          u.direction,
          sprite.authoredDirection,
        );
        this._bar(ctx, drawn.foot.x, drawn.topY - 8, 50, u.hp / u.maxHp, '#e74c3c');
        if (u.shieldT > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const shieldGlow = ctx.createRadialGradient(drawn.foot.x, drawn.foot.y - 36, 6, drawn.foot.x, drawn.foot.y - 36, 34);
          shieldGlow.addColorStop(0, 'rgba(166,116,255,0.04)');
          shieldGlow.addColorStop(0.72, 'rgba(116,169,255,0.08)');
          shieldGlow.addColorStop(1, 'rgba(172,116,255,0)');
          ctx.fillStyle = shieldGlow;
          ctx.fillRect(drawn.foot.x - 40, drawn.foot.y - 76, 80, 80);
          ctx.strokeStyle = 'rgba(181,139,255,0.86)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(drawn.foot.x, drawn.foot.y - 36, 29 + Math.sin(this.time * 4) * 1.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.46;
          ctx.setLineDash([8, 5]);
          ctx.lineDashOffset = -this.time * 18;
          ctx.beginPath();
          ctx.arc(drawn.foot.x, drawn.foot.y - 36, 24, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        ctx.fillStyle = this.pkStatus(u).color;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${u.name} Lv${u.level}`, drawn.foot.x, drawn.foot.y + 16);
        this._drawChatBubble(ctx, u, drawn);
        this._drawHitFlash(
          ctx,
          img,
          u,
          u.y - (u.jumpY || 0),
          VISUAL_SCALE.player,
          0.92,
          sprite.authoredDirection,
        );
      } else if (item.kind === 'pet') {
        const sprite = this._mobAnimSelection(
          'skeleton',
          u.anim || 'idle',
          u.animFrame || 0,
          u.direction,
        );
        const img = sprite.img;
        const drawn = this._drawSprite(
          ctx,
          img,
          u.x + (u.hitOffsetX || 0),
          u.y + (u.hitOffsetY || 0),
          VISUAL_SCALE.pet,
          u.facing || 1,
          0.92,
          u.direction,
          sprite.authoredDirection,
        );
        this._bar(ctx, drawn.foot.x, drawn.topY - 6, 36, u.hp / u.maxHp, '#95a5a6');
        ctx.fillStyle = '#bdc3c7';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(u.name, drawn.foot.x, drawn.foot.y + 12);
      } else {
        const sprite = this._mobAnimSelection(
          u.kind,
          u.anim || (u.alive ? 'idle' : 'death'),
          u.animFrame || 0,
          u.direction,
        );
        const img = sprite.img;
        const aura = this.worldToScreen(u.x, u.y);
        const drawH = this.monsterDrawHeight(u);
        if ((u.boss || u.elite) && u.alive) {
          ctx.save();
          ctx.translate(aura.x, aura.y + 2);
          ctx.rotate(this.time * (u.boss ? 0.32 : -0.48));
          ctx.strokeStyle = u.boss ? (u.enraged ? '#ff3b2f' : '#f0a236') : '#e9a943';
          ctx.globalAlpha = u.boss ? 0.82 : 0.52;
          ctx.lineWidth = u.boss ? 3 : 1.5;
          ctx.setLineDash(u.boss ? [12, 7] : [6, 5]);
          ctx.lineDashOffset = -this.time * 15;
          ctx.beginPath();
          ctx.ellipse(0, 0, u.boss ? 42 : 30, u.boss ? 15 : 10, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        ctx.save();
        if (!u.alive) ctx.globalAlpha = clamp((u.deathUntil - this.time) / (u.boss ? 1.2 : u.elite ? 1 : 0.8), 0, 1);
        const drawn = this._drawSprite(
          ctx,
          img,
          u.x + (u.hitOffsetX || 0),
          u.y + (u.hitOffsetY || 0),
          drawH,
          u.facing || 1,
          0.92,
          u.direction,
          sprite.authoredDirection,
        );
        ctx.restore();
        if (u.alive) {
          const showNameplate = u.boss || u.elite || u.hitT > 0 || this.player.target === u || dist(this.player, u) < 90;
          if (showNameplate) {
            this._bar(ctx, drawn.foot.x, drawn.topY - 6, u.boss ? 92 : u.elite ? 68 : 44, u.hp / u.maxHp, u.elite ? '#f39c12' : '#c0392b');
            ctx.fillStyle = u.boss ? '#ff7a4d' : u.elite ? '#f39c12' : '#ddd';
            ctx.font = u.boss ? 'bold 13px sans-serif' : u.elite ? 'bold 11px sans-serif' : '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(u.name, drawn.foot.x, drawn.foot.y + 14);
          }
          this._drawHitFlash(ctx, img, u, u.y, drawH, 0.92, sprite.authoredDirection);
        }
      }
    }

    // 商业 ARPG 的密林不能让本地角色彻底消失。树冠仍保留半透明前景层，
    // 但在所有 Y 排序对象之后补绘一个带暖色轮廓的角色“透视影像”，确保战斗可读性。
    this.playerOccludedByDecor = localPlayerOccludedByDecor;
    if (localPlayerOccludedByDecor && this.player.alive) {
      const u = this.player;
      const sprite = this._playerAnimSelection(
        u.classId,
        u.anim || 'idle',
        u.animFrame || 0,
        u.direction,
      );
      const visualX = u.x + (u.hitOffsetX || 0);
      const drawY = u.y + (u.hitOffsetY || 0) - (u.jumpY || 0);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = 'rgba(255,222,145,0.96)';
      ctx.shadowBlur = 10;
      const drawn = this._drawSprite(
        ctx,
        sprite.img,
        visualX,
        drawY,
        VISUAL_SCALE.player,
        u.facing,
        0.92,
        u.direction,
        sprite.authoredDirection,
      );
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,222,145,0.92)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      if (ctx.ellipse) ctx.ellipse(drawn.foot.x, drawn.foot.y + 2, 26, 9, 0, 0, Math.PI * 2);
      else ctx.arc(drawn.foot.x, drawn.foot.y + 2, 18, 0, Math.PI * 2);
      ctx.stroke();
      this._bar(ctx, drawn.foot.x, drawn.topY - 8, 50, u.hp / u.maxHp, '#e74c3c');
      ctx.fillStyle = this.pkStatus(u).color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${u.name} Lv${u.level}`, drawn.foot.x, drawn.foot.y + 16);
      ctx.restore();
    }

    for (const pr of this.projectiles) {
      const s = this.worldToScreen(pr.x, pr.y);
      const velocity = Math.hypot(pr.vx || 0, pr.vy || 0) || 1;
      const ux = (pr.vx || 1) / velocity;
      const uy = (pr.vy || 0) / velocity;
      const radius = pr.kind === 'fireball' ? 8 : 6;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = pr.color;
      ctx.shadowBlur = pr.kind === 'fireball' ? 22 : 14;
      for (let i = 5; i >= 1; i--) {
        ctx.globalAlpha = (6 - i) * 0.06;
        ctx.fillStyle = pr.color;
        ctx.beginPath();
        ctx.arc(s.x - ux * i * 7, s.y - uy * i * 7, Math.max(1, radius - i), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = pr.color;
      ctx.strokeStyle = pr.color;
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, pr.kind === 'fireball' ? 15 : 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      if (pr.kind === 'talisman') {
        ctx.translate(s.x, s.y);
        ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2);
        ctx.fillRect(-4, -8, 8, 16);
        ctx.fillStyle = 'rgba(255,248,194,0.88)';
        ctx.fillRect(-1, -6, 2, 11);
      } else {
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff4ca';
        ctx.globalAlpha = 0.88;
        ctx.beginPath();
        ctx.arc(s.x - radius * 0.25, s.y - radius * 0.25, radius * 0.38, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
    for (const e of this.effects) {
      const s = this.worldToScreen(e.x, e.y);
      const a = e.t / e.maxT;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * 0.75;
      ctx.strokeStyle = e.color;
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = e.kind === 'lightning' || e.kind === 'fire' ? 18 : 12;
      ctx.lineWidth = 2 + (1 - a) * 2;
      if (e.kind === 'hit' || e.kind === 'crit_hit') {
        const progress = 1 - a;
        const spokes = e.kind === 'crit_hit' ? 10 : 6;
        const reach = e.r * (0.45 + progress * 0.85);
        ctx.lineWidth = e.kind === 'crit_hit' ? 3.5 * a + 1 : 2.2 * a + 0.8;
        for (let i = 0; i < spokes; i++) {
          const angle = e.seed + i * Math.PI * 2 / spokes;
          const inner = reach * 0.22;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(angle) * inner, s.y + Math.sin(angle) * inner * 0.7);
          ctx.lineTo(s.x + Math.cos(angle) * reach, s.y + Math.sin(angle) * reach * 0.7);
          ctx.stroke();
        }
        ctx.globalAlpha = a * 0.36;
        ctx.beginPath();
        ctx.arc(s.x, s.y, e.r * (0.25 + progress * 0.55), 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'magic_hit') {
        const progress = 1 - a;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(progress * 1.8 + e.seed);
        for (let ring = 0; ring < 2; ring++) {
          const rr = e.r * (0.42 + ring * 0.28 + progress * 0.18);
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            const px = Math.cos(angle) * rr;
            const py = Math.sin(angle) * rr * 0.68;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.rotate(-progress * 2.4);
        }
        ctx.restore();
      } else if (e.kind === 'footstep') {
        const progress = 1 - a;
        const angle = e.angle ?? e.seed;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = a * 0.34;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.ellipse(
          s.x - dx * progress * 7,
          s.y - dy * progress * 3,
          e.r * (0.28 + progress * 0.55),
          e.r * (0.09 + progress * 0.18),
          angle,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const spread = (i - 2) * 0.7 + e.seed;
          const travel = e.r * progress * (0.25 + (i % 3) * 0.13);
          ctx.globalAlpha = a * (0.09 + (i % 2) * 0.06);
          ctx.beginPath();
          ctx.arc(
            s.x - dx * travel + Math.cos(spread) * 5,
            s.y - dy * travel * 0.45 + Math.sin(spread) * 2,
            0.8 + (i % 2) * 0.7,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      } else if (e.kind === 'dodge') {
        const progress = 1 - a;
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = a * (0.42 - i * 0.09);
          ctx.beginPath();
          ctx.arc(s.x - progress * (10 + i * 8), s.y, e.r * (0.45 + i * 0.12), Math.PI * 1.2, Math.PI * 1.82);
          ctx.stroke();
        }
      } else if (e.kind === 'death') {
        const progress = 1 - a;
        ctx.globalAlpha = a * 0.52;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 5, e.r * (0.55 + progress * 0.22), e.r * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 14; i++) {
          const angle = e.seed + i * 2.399;
          const spread = e.r * (0.16 + (i % 5) * 0.1);
          const rise = progress * e.r * (0.45 + (i % 4) * 0.18);
          ctx.globalAlpha = a * (0.18 + (i % 4) * 0.07);
          ctx.fillRect(
            s.x + Math.cos(angle) * spread - 1,
            s.y + Math.sin(angle) * spread * 0.34 - rise,
            1.5 + (i % 3),
            1.5 + (i % 2) * 2,
          );
        }
      } else if (e.kind === 'rush') {
        const angle = e.angle ?? e.seed;
        const progress = 1 - a;
        ctx.lineWidth = 2 + a * 3;
        for (let i = -2; i <= 2; i++) {
          const offset = i * 6;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          ctx.globalAlpha = a * (0.26 + (2 - Math.abs(i)) * 0.08);
          ctx.beginPath();
          ctx.moveTo(s.x - dx * e.r * (0.15 + progress) - dy * offset, s.y - dy * e.r * (0.15 + progress) + dx * offset);
          ctx.lineTo(s.x + dx * e.r * 0.34 - dy * offset, s.y + dy * e.r * 0.34 + dx * offset);
          ctx.stroke();
        }
      } else if (e.kind === 'level') {
        const progress = 1 - a;
        for (let i = 0; i < 10; i++) {
          const angle = i * Math.PI * 2 / 10;
          const rr = e.r * (0.36 + progress * 0.52);
          ctx.globalAlpha = a * 0.42;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(angle) * rr * 0.45, s.y + Math.sin(angle) * rr * 0.3);
          ctx.lineTo(s.x + Math.cos(angle) * rr, s.y + Math.sin(angle) * rr * 0.58 - progress * 28);
          ctx.stroke();
        }
        ctx.globalAlpha = a * 0.62;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 4, e.r * (0.5 + progress * 0.5), e.r * (0.14 + progress * 0.12), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'lightning') {
        ctx.beginPath();
        ctx.moveTo(s.x - 8, s.y - e.r * 1.5);
        ctx.lineTo(s.x + 7, s.y - e.r);
        ctx.lineTo(s.x - 4, s.y - e.r * 0.55);
        ctx.lineTo(s.x + 8, s.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x, s.y, e.r * (1 - a * 0.5), 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'slash') {
        ctx.lineWidth = 5 * a + 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y - e.r * 0.35, e.r * (1.1 - a * 0.25), Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      } else if (e.kind === 'ice') {
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4 + this.time * 0.4;
          const inner = e.r * 0.22;
          const outer = e.r * (1 - a * 0.22);
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(angle) * inner, s.y + Math.sin(angle) * inner);
          ctx.lineTo(s.x + Math.cos(angle) * outer, s.y + Math.sin(angle) * outer);
          ctx.stroke();
        }
      } else if (e.kind === 'heal') {
        const rise = (1 - a) * 24;
        for (let i = 0; i < 4; i++) {
          const angle = i * Math.PI / 2;
          const x = s.x + Math.cos(angle) * e.r * 0.65;
          const y = s.y - rise + Math.sin(angle) * e.r * 0.3;
          ctx.fillRect(x - 2, y - 8, 4, 16);
          ctx.fillRect(x - 8, y - 2, 16, 4);
        }
      } else if (e.kind === 'poison') {
        for (let i = 0; i < 7; i++) {
          const angle = i * 2.399 + this.time;
          const radius = e.r * (0.2 + (i % 3) * 0.23);
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(angle) * radius, s.y - (1 - a) * 24 + Math.sin(angle) * radius * 0.5, 3 + (i % 2) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.kind === 'summon') {
        ctx.beginPath();
        ctx.arc(s.x, s.y, e.r * (1.1 - a * 0.2), 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + Math.cos(angle) * e.r, s.y + Math.sin(angle) * e.r * 0.45);
          ctx.stroke();
        }
      } else if (e.kind === 'fire') {
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3 + this.time * 2;
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(angle) * e.r * 0.55, s.y - (1 - a) * 28 + Math.sin(angle) * e.r * 0.22, 5 + 5 * a, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.kind === 'shield') {
        ctx.beginPath();
        ctx.arc(s.x, s.y - 30, e.r * (1.05 - a * 0.08), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha *= 0.2;
        ctx.fill();
      } else if (e.kind === 'ring') {
        ctx.beginPath();
        ctx.arc(s.x, s.y, e.r * (1.2 - a * 0.3), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, e.r * a, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!['heal', 'shield', 'footstep'].includes(e.kind)) {
        for (let i = 0; i < 7; i++) {
          const angle = e.seed + i * 2.399 + (1 - a) * (i % 2 ? 1.8 : -1.2);
          const travel = e.r * (0.18 + (1 - a) * (0.35 + (i % 3) * 0.13));
          ctx.globalAlpha = a * (0.16 + (i % 3) * 0.07);
          ctx.beginPath();
          ctx.arc(
            s.x + Math.cos(angle) * travel,
            s.y + Math.sin(angle) * travel * 0.55 - (1 - a) * 12,
            1.2 + (i % 2) * 0.9,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      ctx.restore();
    }
    for (const f of this.floats) {
      const s = this.worldToScreen(f.x, f.y);
      const alpha = f.t / f.maxT;
      const isCrit = f.text.includes('暴击');
      const isHeal = f.text.startsWith('+');
      const isDodge = f.text === '闪避';
      const scale = 0.9 + (1 - alpha) * 0.12;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.strokeStyle = 'rgba(4,3,2,0.92)';
      ctx.lineWidth = isCrit ? 4 : 3;
      ctx.font = `${isCrit ? '900' : 'bold'} ${isCrit ? 18 : isHeal || isDodge ? 16 : 14}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.translate(s.x, s.y);
      ctx.scale(scale, scale);
      ctx.strokeText?.(f.text, 0, 0);
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }

    if (this.player.moveGoal) {
      const s = this.worldToScreen(this.player.moveGoal.x, this.player.moveGoal.y);
      const pulse = 7 + Math.sin(this.time * 8) * 2;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(this.time * 0.8);
      ctx.strokeStyle = 'rgba(244,207,126,0.82)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(pulse + 2, 0);
        ctx.lineTo(pulse + 6, -3);
        ctx.lineTo(pulse + 6, 3);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.player.target?.alive) {
      const s = this.worldToScreen(this.player.target.x, this.player.target.y);
      const elite = this.player.target.elite || this.player.target.boss;
      ctx.save();
      ctx.translate(s.x, s.y + 3);
      ctx.rotate(this.time * 0.55);
      ctx.strokeStyle = elite ? '#ff9a4d' : '#ffd866';
      ctx.lineWidth = elite ? 2.5 : 2;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -this.time * 12;
      ctx.beginPath();
      ctx.ellipse(0, 0, elite ? 29 : 21, elite ? 11 : 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    this._drawForegroundAtmosphere(ctx, visual, vw, vh);
    this._drawScreenGrade(ctx, visual, vw, vh);
    this._minimap(ctx);
    ctx.restore();
  }

  _minimap(ctx) {
    const compact = this.viewW <= 700;
    const mw = compact ? 124 : 150;
    const mh = compact ? 88 : 110;
    const header = compact ? 16 : 19;
    const x0 = this.viewW - mw - 12;
    const y0 = compact ? 46 : 12;
    const visual = this.visual;
    ctx.save();
    ctx.fillStyle = 'rgba(7,6,5,0.84)';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.fillStyle = `${visual.wall}99`;
    ctx.fillRect(x0 + 1, y0 + header, mw - 2, mh - header - 1);
    const frame = ctx.createLinearGradient(x0, y0, x0 + mw, y0);
    frame.addColorStop(0, `${visual.accent}44`);
    frame.addColorStop(0.5, `${visual.accent}bb`);
    frame.addColorStop(1, `${visual.accent}44`);
    ctx.fillStyle = frame;
    ctx.fillRect(x0, y0 + header - 1, mw, 1);
    ctx.strokeStyle = `${visual.accent}88`;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, mw - 1, mh - 1);
    ctx.fillStyle = '#ddcaa3';
    ctx.font = compact ? 'bold 9px sans-serif' : 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(this.map.name, x0 + 7, y0 + header - 5);
    ctx.fillStyle = this.map.safe ? '#75d69a' : '#e26e55';
    ctx.textAlign = 'right';
    ctx.fillText(this.map.safe ? '安全' : '危险', x0 + mw - 7, y0 + header - 5);
    const sx = mw / (WORLD.cols * T);
    const sy = (mh - header) / (WORLD.rows * T);
    const mapY = y0 + header;

    // Show the actual travelled landscape instead of reducing the minimap to
    // collision rectangles: forest mass first, then the continuous road mesh.
    ctx.save();
    ctx.fillStyle = 'rgba(42,73,43,0.58)';
    for (const decor of this.minimapForestDecors || []) {
      const radius = decor.id.startsWith('grove_') ? 2.4 : 1.25;
      ctx.fillRect(
        x0 + decor.x * sx - radius,
        mapY + decor.y * sy - radius,
        radius * 2,
        radius * 2,
      );
    }
    ctx.strokeStyle = 'rgba(193,157,105,0.78)';
    ctx.lineWidth = compact ? 1.35 : 1.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const road of this.map.roadPaths || []) {
      if (!road.points?.length) continue;
      ctx.beginPath();
      road.points.forEach(([roadX, roadY], index) => {
        const px = x0 + roadX * T * sx;
        const py = mapY + roadY * T * sy;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = `${visual.wallTop}aa`;
    for (let y = 0; y < WORLD.rows; y += 2) {
      for (let x = 0; x < WORLD.cols; x += 2) {
        if (this.map.grid[y][x]) ctx.fillRect(x0 + x * T * sx, mapY + y * T * sy, 2, 2);
      }
    }
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (!m.boss && !m.elite && dist(this.player, m) > 520) continue;
      ctx.fillStyle = m.boss ? '#ff3b2f' : m.elite ? '#f4b942' : '#bd5949';
      const size = m.boss ? 5 : m.elite ? 4 : 2;
      ctx.fillRect(x0 + m.x * sx - size / 2, mapY + m.y * sy - size / 2, size, size);
    }
    for (const remote of this.remotePlayers) {
      ctx.fillStyle = '#5dade2';
      ctx.fillRect(x0 + remote.x * sx - 2, mapY + remote.y * sy - 2, 4, 4);
    }
    for (const p of this.portals) {
      ctx.strokeStyle = visual.portal[0];
      ctx.beginPath();
      ctx.arc(x0 + p.x * sx, mapY + p.y * sy, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    const px = x0 + this.player.x * sx;
    const py = mapY + this.player.y * sy;
    ctx.fillStyle = '#6ff5a3';
    ctx.shadowColor = '#6ff5a3';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(px, py - 4);
    ctx.lineTo(px + 3.5, py + 3);
    ctx.lineTo(px, py + 1.5);
    ctx.lineTo(px - 3.5, py + 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export async function loadAssets() {
  // Versioned immutable URLs retain the large animation library across local reloads.
  const v = 'v=0.9.14';
  const img = (path) => loadImage(`${path}${path.includes('?') ? '&' : '?'}${v}`);

  const units = {};
  const portraits = {};
  const avatars = {};
  const anim = {};
  const directionalAnim = {};
  const directionalMobAnim = {};
  const classIds = Object.keys(CLASSES);
  const playerFrameCounts = { idle: 6, walk: 10, run: 10, jump: 6, attack: 6 };
  await Promise.all(classIds.map(async (id) => {
    units[id] = await img(CLASSES[id].unit);
  }));
  await Promise.all(classIds.map(async (id) => {
    const c = CLASSES[id];
    [portraits[id], avatars[id]] = await Promise.all([
      img(c.portrait).catch(() => units[id]),
      img(c.avatar).catch(() => units[id]),
    ]);
    anim[id] = {};
    directionalAnim[id] = {};
  }));
  const mobs = {};
  const monsterIds = Object.keys(MONSTERS);
  await Promise.all(monsterIds.map(async (id) => {
    mobs[id] = await img(MONSTERS[id].unit);
  }));
  const mobAnim = {};
  for (const id of monsterIds) {
    mobAnim[id] = {};
    directionalMobAnim[id] = {};
  }
  const playerAnimLoads = new Map();
  const playerDirectionalReady = new Set();
  const mobAnimLoads = new Map();
  const mobDirectionalReady = new Set();
  const ensurePlayerAnim = (id) => {
    if (!CLASSES[id]) return Promise.resolve();
    if (ANIM_ACTIONS.every((action) => anim[id]?.[action]?.length) && playerDirectionalReady.has(id)) {
      return Promise.resolve(anim[id]);
    }
    if (playerAnimLoads.has(id)) return playerAnimLoads.get(id);
    const legacyLoads = ANIM_ACTIONS.map(async (act) => {
      const count = playerFrameCounts[act];
      try {
        anim[id][act] = await Promise.all(Array.from({ length: count }, (_, frame) => {
          const path = `assets/game/anim/${id}/${act}/${String(frame).padStart(2, '0')}.png`;
          return img(path);
        }));
      } catch {
        throw new Error(`missing anim pack: ${id}/${act}`);
      }
    });
    const directionalLoads = Object.entries(PLAYER_DIRECTIONAL_SPECS[id] || {}).flatMap(
      ([action, directions]) => Object.entries(directions).map(async ([direction, count]) => {
        directionalAnim[id][action] ||= {};
        try {
          directionalAnim[id][action][direction] = await Promise.all(
            Array.from({ length: count }, (_, frame) => {
              const path = `assets/game/anim/directional/${id}/${direction}/${action}/${String(frame).padStart(2, '0')}.png`;
              return img(path);
            }),
          );
        } catch {
          throw new Error(`missing authored directional anim pack: ${id}/${direction}/${action}`);
        }
      }),
    );
    const loading = Promise.all([...legacyLoads, ...directionalLoads])
      .then(() => {
        playerDirectionalReady.add(id);
        return anim[id];
      })
      .finally(() => playerAnimLoads.delete(id));
    playerAnimLoads.set(id, loading);
    return loading;
  };
  const ensureMobAnim = (id) => {
    if (!MONSTERS[id]) return Promise.resolve();
    if (
      MOB_ANIM_ACTIONS.every((action) => mobAnim[id]?.[action]?.length)
      && mobDirectionalReady.has(id)
    ) {
      return Promise.resolve(mobAnim[id]);
    }
    if (mobAnimLoads.has(id)) return mobAnimLoads.get(id);
    const animKey = MONSTERS[id].animKey || id;
    const legacyLoads = MOB_ANIM_ACTIONS.map(async (action) => {
      mobAnim[id][action] = await Promise.all(Array.from({ length: 4 }, (_, frame) => {
        const path = `assets/game/anim/mob/${animKey}/${action}/${String(frame).padStart(2, '0')}.png`;
        return img(path);
      }));
    });
    const directionalLoads = Object.entries(MOB_DIRECTIONAL_SPECS[id] || {}).flatMap(
      ([action, directions]) => Object.entries(directions).map(async ([direction, count]) => {
        directionalMobAnim[id][action] ||= {};
        try {
          directionalMobAnim[id][action][direction] = await Promise.all(
            Array.from({ length: count }, (_, frame) => {
              const path = `assets/game/anim/directional/mob/${id}/${direction}/${action}/${String(frame).padStart(2, '0')}.png`;
              return img(path);
            }),
          );
        } catch {
          throw new Error(`missing authored directional mob anim pack: ${id}/${direction}/${action}`);
        }
      }),
    );
    const loading = Promise.all([...legacyLoads, ...directionalLoads])
      .then(() => {
        mobDirectionalReady.add(id);
        return mobAnim[id];
      })
      .finally(() => mobAnimLoads.delete(id));
    mobAnimLoads.set(id, loading);
    return loading;
  };
  const ensureMap = (mapId) => {
    const kinds = new Set((MAPS[mapId]?.spawns || []).map((spawn) => spawn.monster));
    return Promise.all([...kinds].map((kind) => ensureMobAnim(kind)));
  };
  const [healerNpc, merchantNpc, warehouseNpc] = await Promise.all([
    img('assets/game/npc/healer.png'),
    img('assets/game/npc/merchant.png'),
    img('assets/game/npc/warehouse.png'),
  ]);
  const npc = {
    healer: healerNpc,
    merchant: merchantNpc,
    warehouse: warehouseNpc,
    captain: units.warrior,
  };
  const npcAnim = {};
  await Promise.all(['healer', 'merchant', 'warehouse', 'captain'].map(async (id) => {
    npcAnim[id] = { idle: [] };
    npcAnim[id].idle = await Promise.all(Array.from({ length: 4 }, (_, frame) => {
      const path = `assets/game/anim/npc/${id}/idle/${String(frame).padStart(2, '0')}.png`;
      return img(path);
    }));
  }));
  const [townMap, fieldMap, templeMap] = await Promise.all([
    img('assets/game/map/town.jpg'),
    img('assets/game/map/field.jpg'),
    img('assets/game/map/temple.jpg'),
  ]);
  const maps = { town: townMap, field: fieldMap, temple: templeMap };
  const scenery = {};
  await Promise.all(Object.keys(SCENERY).map(async (id) => {
    try { scenery[id] = await img(SCENERY[id].src); } catch { /* optional */ }
  }));
  const tiles = {};
  await Promise.all(Object.entries(TILES).map(async ([id, path]) => {
    try { tiles[id] = await img(path); } catch { /* optional */ }
  }));
  const zoneGround = {};
  await Promise.all(Object.entries(ZONE_VISUALS).map(async ([id, visual]) => {
    try { zoneGround[id] = await img(`assets/game/map/ground/${visual.texture}.png`); } catch { /* optional */ }
  }));
  const wallMaterials = {};
  await Promise.all(Object.entries(WALL_MATERIALS).map(async ([id, material]) => {
    const entry = {};
    try { entry.top = await img(material.top); } catch { /* optional */ }
    if (material.face) {
      try { entry.face = await img(material.face); } catch { /* optional */ }
    }
    wallMaterials[id] = entry;
  }));
  return {
    units,
    portraits,
    avatars,
    anim,
    directionalAnim,
    directionalMobAnim,
    mobs,
    mobAnim,
    npc,
    npcAnim,
    maps,
    scenery,
    tiles,
    zoneGround,
    wallMaterials,
    ensurePlayerAnim,
    ensureMobAnim,
    ensureMap,
  };
}

export { CLASSES, ITEMS, SHOP_TOWN as SHOP, MAPS, QUESTS, RECIPES };
