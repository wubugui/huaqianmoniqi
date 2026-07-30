import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  ACHIEVEMENTS, BOUNTIES, CLASSES, COMBAT_RULES, EQUIP_SLOTS, ITEMS, MAPS, MONSTERS, QUESTS, RECIPES, SCENERY, SHOP_TOWN,
  SKILL_COMBAT, SLOT_TYPES, WORLD, enhanceCost,
} from '../js/config.js';
import {
  addServerExperience, addServerItem, createServerCharacter, createServerDropItem, loseDeathExperience, normalizeServerCharacter,
  gainServerSkillExperience, privateServerCharacter, refreshServerStats, rollDeathLoss, sanitizeServerBag,
  serverAttackDamage,
} from '../js/authoritative-rules.js';

const T = WORLD.tile;
export const ONLINE_TIMEOUT_MS = 15_000;
export const SESSION_RETENTION_MS = Number.POSITIVE_INFINITY;
const SSE_KEEPALIVE_MS = 15_000;
const INTEREST_RADIUS_X = 1_080;
const INTEREST_RADIUS_Y = 820;
const SNAPSHOT_COLLECTIONS = ['players', 'drops', 'monsters', 'pets', 'bosses'];
const SNAPSHOT_VALUES = ['onlinePlayers', 'sabac', 'guildWars', 'self', 'social'];
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function cleanName(value) {
  return String(value || '无名旅人').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12) || '无名旅人';
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function nearestWalkablePoint(mapId, x, y) {
  if (!isBlocked(mapId, x, y)) return { x, y };
  const originCol = Math.floor(x / T);
  const originRow = Math.floor(y / T);
  for (let radius = 1; radius <= 6; radius += 1) {
    for (let row = originRow - radius; row <= originRow + radius; row += 1) {
      for (let col = originCol - radius; col <= originCol + radius; col += 1) {
        if (Math.max(Math.abs(col - originCol), Math.abs(row - originRow)) !== radius) continue;
        const candidate = { x: (col + 0.5) * T, y: (row + 0.5) * T };
        if (!isBlocked(mapId, candidate.x, candidate.y)) return candidate;
      }
    }
  }
  const start = MAPS[mapId].playerStart;
  return { x: start.x * T, y: start.y * T };
}

function createWorldMonster(mapId, groupIndex, index, spawn) {
  const definition = MONSTERS[spawn.monster];
  const angle = index * 2.399963 + groupIndex * 0.87;
  const radius = Math.sqrt((index + 1) / (spawn.count + 1)) * spawn.r * T;
  const point = nearestWalkablePoint(
    mapId,
    spawn.x * T + Math.cos(angle) * radius,
    spawn.y * T + Math.sin(angle) * radius,
  );
  return {
    id: `${mapId}:${groupIndex}:${index}`,
    kind: spawn.monster,
    mapId,
    x: point.x,
    y: point.y,
    homeX: point.x,
    homeY: point.y,
    hp: definition.hp,
    maxHp: definition.hp,
    alive: true,
    respawnAt: 0,
    targetId: null,
    lastAttack: 0,
    lastHit: 0,
    direction: 's',
    facing: 1,
    anim: 'idle',
    combatVersion: 0,
  };
}

function seedWorldMonsters(state) {
  for (const [mapId, map] of Object.entries(MAPS)) {
    (map.spawns || []).forEach((spawn, groupIndex) => {
      if (MONSTERS[spawn.monster]?.boss) return;
      for (let index = 0; index < spawn.count; index += 1) {
        const monster = createWorldMonster(mapId, groupIndex, index, spawn);
        state.monsters.set(monster.id, monster);
      }
    });
  }
}

export function createWorldState() {
  const state = {
    players: new Map(),
    tokens: new Map(),
    resumeTokens: new Map(),
    characters: new Map(),
    streams: new Map(),
    teams: new Map(),
    guilds: new Map(),
    guildWars: new Map(),
    trades: new Map(),
    drops: new Map(),
    monsters: new Map(),
    bosses: new Map(),
    sabac: { ownerGuildId: null, war: null, history: [] },
    messages: [],
    eventSequence: 0,
    sequence: 0,
  };
  seedWorldMonsters(state);
  const authoredLordSpawn = MAPS.sanctum.spawns.find((spawn) => spawn.monster === 'lord');
  const lordX = (authoredLordSpawn?.x ?? 30) * T;
  const lordY = (authoredLordSpawn?.y ?? 16.5) * T;
  state.bosses.set('lord', {
    id: 'lord',
    kind: 'lord',
    name: MONSTERS.lord.name,
    mapId: 'sanctum',
    x: lordX,
    y: lordY,
    homeX: lordX,
    homeY: lordY,
    hp: MONSTERS.lord.hp,
    maxHp: MONSTERS.lord.hp,
    alive: true,
    respawnAt: 0,
    targetId: null,
    lastAttack: 0,
    lastSpecial: 0,
    direction: 's',
    facing: 1,
    anim: 'idle',
    combatVersion: 0,
    contributions: new Map(),
  });
  return state;
}

export function serializeWorldState(state) {
  return {
    version: 1,
    worldLayoutVersion: WORLD.layoutVersion,
    savedAt: Date.now(),
    sequence: state.sequence,
    eventSequence: state.eventSequence,
    players: [...state.players.values()].map((player) => ({
      ...player,
      token: null,
      friends: [...player.friends],
      friendRequests: [...player.friendRequests],
      teamInvites: [...player.teamInvites],
      guildInvites: [...player.guildInvites],
      processedActions: [...(player.processedActions || new Map())],
      lastActionSeq: { ...(player.lastActionSeq || {}) },
      online: false,
    })),
    teams: [...state.teams.values()].map((team) => ({ ...team, members: [...team.members] })),
    guilds: [...state.guilds.values()].map((guild) => ({ ...guild, members: [...guild.members] })),
    guildWars: [...state.guildWars.values()],
    trades: [...state.trades.values()].map((trade) => ({
      ...trade,
      offers: [...trade.offers],
      confirmed: [...trade.confirmed],
    })),
    drops: [...state.drops.values()],
    monsters: [...state.monsters.values()],
    bosses: [...state.bosses.values()].map((boss) => ({
      ...boss,
      contributions: [...boss.contributions],
    })),
    sabac: state.sabac,
    messages: state.messages,
  };
}

export function restoreWorldState(payload, now = Date.now()) {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.players)) return createWorldState();
  const savedLayoutVersion = Math.max(1, Math.floor(Number(payload.worldLayoutVersion) || 1));
  const migratingLayout = savedLayoutVersion < WORLD.layoutVersion;
  const savedLayoutScale = savedLayoutVersion >= 2 ? WORLD.previousLayoutScale : 1;
  const coordinateScale = migratingLayout ? WORLD.layoutScale / savedLayoutScale : 1;
  const state = createWorldState();
  state.players.clear();
  state.tokens.clear();
  state.resumeTokens.clear();
  state.characters.clear();
  state.streams.clear();
  for (const saved of payload.players) {
    if (!saved?.id || !saved.resumeToken || !CLASSES[saved.classId] || !MAPS[saved.mapId]) continue;
    const migratedPoint = nearestWalkablePoint(
      saved.mapId,
      Number(saved.x) * coordinateScale,
      Number(saved.y) * coordinateScale,
    );
    const player = normalizeServerCharacter({
      ...saved,
      x: migratedPoint.x,
      y: migratedPoint.y,
      token: null,
      friends: new Set(saved.friends || []),
      friendRequests: new Set(saved.friendRequests || []),
      teamInvites: new Set(saved.teamInvites || []),
      guildInvites: new Set(saved.guildInvites || []),
      events: Array.isArray(saved.events) ? saved.events.slice(-50) : [],
      processedActions: new Map(saved.processedActions || []),
      lastActionSeq: Object.assign(Object.create(null), saved.lastActionSeq || {}),
      online: false,
      disconnectedAt: now,
      lastSeen: Number.isFinite(saved.lastSeen) ? saved.lastSeen : now,
      lastMove: now,
    });
    player.characterId ||= randomUUID();
    state.players.set(player.id, player);
    state.resumeTokens.set(player.resumeToken, player.id);
    state.characters.set(player.characterId, player.id);
  }
  state.teams = new Map((payload.teams || []).map((team) => [
    team.id,
    { ...team, members: new Set((team.members || []).filter((id) => state.players.has(id))) },
  ]));
  state.guilds = new Map((payload.guilds || []).map((guild) => [
    guild.id,
    { ...guild, members: new Set((guild.members || []).filter((id) => state.players.has(id))) },
  ]));
  state.guildWars = new Map((payload.guildWars || []).map((war) => [war.id, war]));
  state.trades = new Map((payload.trades || []).map((trade) => [
    trade.id,
    {
      ...trade,
      offers: new Map(trade.offers || []),
      confirmed: new Set(trade.confirmed || []),
    },
  ]));
  state.drops = new Map((payload.drops || []).flatMap((drop) => (
    drop?.id && MAPS[drop.mapId]
      ? [[drop.id, {
        ...drop,
        x: Number(drop.x) * coordinateScale,
        y: Number(drop.y) * coordinateScale,
      }]]
      : []
  )));
  if (Array.isArray(payload.monsters) && payload.monsters.length) {
    // Merge only exact spawn identities into the current authored ecology.
    // Removed groups disappear and newly-authored groups appear after upgrades.
    for (const monster of payload.monsters) {
      const seeded = state.monsters.get(monster?.id);
      if (!seeded || seeded.kind !== monster.kind || seeded.mapId !== monster.mapId) continue;
      const restoredPoint = nearestWalkablePoint(
        seeded.mapId,
        migratingLayout ? seeded.x : Number(monster.x),
        migratingLayout ? seeded.y : Number(monster.y),
      );
      state.monsters.set(monster.id, {
        ...seeded,
        ...monster,
        x: restoredPoint.x,
        y: restoredPoint.y,
        homeX: seeded.homeX,
        homeY: seeded.homeY,
      });
    }
  }
  if (Array.isArray(payload.bosses) && payload.bosses.length) {
    for (const boss of payload.bosses) {
      const seeded = state.bosses.get(boss?.id);
      if (!seeded) continue;
      const restoredPoint = nearestWalkablePoint(
        seeded.mapId,
        migratingLayout ? seeded.x : Number(boss.x),
        migratingLayout ? seeded.y : Number(boss.y),
      );
      state.bosses.set(boss.id, {
        ...seeded,
        ...boss,
        kind: seeded.kind,
        x: restoredPoint.x,
        y: restoredPoint.y,
        homeX: seeded.homeX,
        homeY: seeded.homeY,
        contributions: new Map(boss.contributions || []),
      });
    }
  }
  state.sabac = payload.sabac && typeof payload.sabac === 'object'
    ? payload.sabac
    : state.sabac;
  state.messages = Array.isArray(payload.messages) ? payload.messages.slice(-300) : [];
  state.eventSequence = Math.max(0, Math.floor(Number(payload.eventSequence) || 0));
  state.sequence = Math.max(0, Math.floor(Number(payload.sequence) || 0));
  return state;
}

export function loadWorldState(filePath, now = Date.now()) {
  try {
    return restoreWorldState(JSON.parse(readFileSync(filePath, 'utf8')), now);
  } catch {
    return createWorldState();
  }
}

export function attachWorldPersistence(server, state, filePath, intervalMs = 1000) {
  let lastSavedSequence = -1;
  let activeSave = null;
  let saveAgain = false;
  const flush = async (force = false) => {
    if (!filePath || (!force && state.sequence === lastSavedSequence)) return false;
    if (activeSave) {
      saveAgain = true;
      await activeSave;
      return flush(force);
    }
    const sequence = state.sequence;
    const serialized = `${JSON.stringify(serializeWorldState(state))}\n`;
    const temporaryPath = `${filePath}.tmp`;
    activeSave = (async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(temporaryPath, serialized, { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryPath, filePath);
      lastSavedSequence = sequence;
    })();
    try {
      await activeSave;
    } finally {
      activeSave = null;
    }
    if (saveAgain || state.sequence !== lastSavedSequence) {
      saveAgain = false;
      return flush();
    }
    return true;
  };
  const timer = setInterval(() => {
    flush().catch((error) => {
      console.error(`世界状态保存失败：${error.message}`);
    });
  }, intervalMs);
  timer.unref();
  server.on('close', () => clearInterval(timer));
  return {
    flush,
    stop() {
      clearInterval(timer);
    },
  };
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    classId: player.classId,
    level: player.level,
    mapId: player.mapId,
    x: Math.round(player.x * 10) / 10,
    y: Math.round(player.y * 10) / 10,
    hp: player.hp,
    maxHp: player.maxHp,
    facing: player.facing,
    direction: player.direction,
    anim: player.anim,
    pkPoints: player.pkPoints,
    crimeT: player.crimeT,
    pkMode: player.pkMode,
    teamId: player.teamId || null,
    guildId: player.guildId || null,
    playerKills: player.playerKills || 0,
    deaths: player.deaths || 0,
    combatVersion: player.combatVersion || 0,
    shieldUntil: player.shieldUntil || 0,
    online: player.online !== false,
  };
}

function onlinePlayerCount(state) {
  let count = 0;
  for (const player of state.players.values()) {
    if (player.online !== false) count += 1;
  }
  return count;
}

function insideInterestArea(viewer, entity) {
  if (!viewer) return true;
  if (entity.mapId !== viewer.mapId) return false;
  if (entity.id === viewer.id) return true;
  return Math.abs(entity.x - viewer.x) <= INTEREST_RADIUS_X
    && Math.abs(entity.y - viewer.y) <= INTEREST_RADIUS_Y;
}

function publicGroup(group, state) {
  if (!group) return null;
  return {
    id: group.id,
    name: group.name || null,
    leaderId: group.leaderId,
    members: [...group.members].map((id) => state.players.get(id)).filter(Boolean).map(publicPlayer),
  };
}

function visibleMessages(state, player) {
  return state.messages.filter((message) => {
    if (message.channel === 'world' || message.channel === 'system') return true;
    if (message.channel === 'nearby') return message.mapId === player.mapId;
    if (message.channel === 'team') return player.teamId && message.groupId === player.teamId;
    if (message.channel === 'guild') return player.guildId && message.groupId === player.guildId;
    if (message.channel === 'whisper') return message.fromId === player.id || message.toId === player.id;
    return false;
  }).slice(-60);
}

function socialSnapshot(state, player) {
  const activeTrade = [...state.trades.values()].find(
    (trade) => trade.status !== 'completed' && trade.status !== 'cancelled' && trade.members.includes(player.id),
  );
  return {
    friends: [...player.friends].map((id) => state.players.get(id)).filter(Boolean).map(publicPlayer),
    friendRequests: [...player.friendRequests].map((id) => state.players.get(id)).filter(Boolean).map(publicPlayer),
    teamInvites: [...player.teamInvites].map((id) => state.players.get(id)).filter(Boolean).map(publicPlayer),
    guildInvites: [...player.guildInvites].map((id) => state.guilds.get(id)).filter(Boolean).map((guild) => publicGroup(guild, state)),
    team: publicGroup(state.teams.get(player.teamId), state),
    guild: publicGroup(state.guilds.get(player.guildId), state),
    trade: activeTrade ? {
      id: activeTrade.id,
      status: activeTrade.status,
      requesterId: activeTrade.requesterId,
      members: activeTrade.members.map((id) => state.players.get(id)).filter(Boolean).map(publicPlayer),
      offers: Object.fromEntries([...activeTrade.offers].map(([id, offer]) => [id, offer])),
      confirmed: [...activeTrade.confirmed],
    } : null,
    messages: visibleMessages(state, player),
    events: player.events.slice(-30),
  };
}

export function worldSnapshot(state, token = null) {
  const viewer = state.players.get(state.tokens.get(token));
  const players = [...state.players.values()].filter((player) => {
    if (player.id === viewer?.id) return true;
    if (player.online === false) return false;
    return insideInterestArea(viewer, player);
  });
  const snapshot = {
    type: 'snapshot',
    sequence: state.sequence,
    serverTime: Date.now(),
    onlinePlayers: onlinePlayerCount(state),
    players: players.map(publicPlayer),
    drops: [...state.drops.values()]
      .filter((drop) => insideInterestArea(viewer, drop))
      .map((drop) => ({
        id: drop.id,
        mapId: drop.mapId,
        x: drop.x,
        y: drop.y,
        entry: drop.entry || null,
        gold: drop.gold || 0,
        ownerId: drop.ownerId || null,
        ownerIds: drop.ownerIds || null,
        protectedUntil: drop.protectedUntil || 0,
        expiresAt: drop.expiresAt,
        source: drop.source,
      })),
    monsters: [...state.monsters.values()]
      .filter((monster) => insideInterestArea(viewer, monster))
      .map((monster) => ({
        id: monster.id,
        kind: monster.kind,
        mapId: monster.mapId,
        x: Math.round(monster.x * 10) / 10,
        y: Math.round(monster.y * 10) / 10,
        hp: monster.hp,
        maxHp: monster.maxHp,
        alive: monster.alive,
        respawnAt: monster.respawnAt,
        targetId: monster.targetId,
        direction: monster.direction,
        facing: monster.facing === -1 ? -1 : 1,
        anim: monster.anim,
        combatVersion: monster.combatVersion,
      })),
    pets: [...state.players.values()]
      .filter((owner) => owner.pet?.hp > 0 && insideInterestArea(viewer, owner.pet))
      .map((owner) => ({
        ...owner.pet,
        ownerId: owner.id,
        ownerName: owner.name,
        hp: Math.max(0, owner.pet.hp),
        maxHp: owner.pet.maxHp,
      })),
    bosses: [...state.bosses.values()]
      .filter((boss) => !viewer || boss.mapId === viewer.mapId)
      .map((boss) => ({
        id: boss.id,
        name: boss.name,
        mapId: boss.mapId,
        x: boss.x,
        y: boss.y,
        hp: boss.hp,
        maxHp: boss.maxHp,
        alive: boss.alive,
        respawnAt: boss.respawnAt,
        targetId: boss.targetId,
        direction: boss.direction,
        facing: boss.facing === -1 ? -1 : 1,
        anim: boss.anim,
        combatVersion: boss.combatVersion || 0,
        leaders: [...boss.contributions.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id, damage]) => ({ id, name: state.players.get(id)?.name || '离线玩家', damage })),
      })),
    sabac: {
      ownerGuildId: state.sabac.ownerGuildId,
      ownerGuildName: state.guilds.get(state.sabac.ownerGuildId)?.name || '无主',
      war: state.sabac.war ? {
        ...state.sabac.war,
        attackerGuildName: state.guilds.get(state.sabac.war.attackerGuildId)?.name || '未知行会',
        defenderGuildName: state.guilds.get(state.sabac.war.defenderGuildId)?.name || '无主',
      } : null,
    },
    guildWars: [...state.guildWars.values()].filter((war) => war.status === 'active').map((war) => ({
      ...war,
      guildAName: state.guilds.get(war.guildA)?.name || '未知行会',
      guildBName: state.guilds.get(war.guildB)?.name || '未知行会',
    })),
  };
  if (viewer) {
    snapshot.self = privateServerCharacter(viewer);
    snapshot.social = socialSnapshot(state, viewer);
  }
  return snapshot;
}

function serializedEqual(left, right) {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffSnapshotCollection(previous = [], current = []) {
  const before = new Map(previous.map((entry) => [entry.id, entry]));
  const afterIds = new Set();
  const upsert = [];
  for (const entry of current) {
    afterIds.add(entry.id);
    const old = before.get(entry.id);
    if (!old) {
      upsert.push(entry);
      continue;
    }
    const patch = { id: entry.id };
    for (const [key, value] of Object.entries(entry)) {
      if (key === 'id' || serializedEqual(value, old[key])) continue;
      patch[key] = value;
    }
    if (Object.keys(patch).length > 1) upsert.push(patch);
  }
  const remove = previous
    .filter((entry) => !afterIds.has(entry.id))
    .map((entry) => entry.id);
  return upsert.length || remove.length ? { upsert, remove } : null;
}

function createSnapshotDelta(previous, current) {
  const changes = {};
  for (const key of SNAPSHOT_VALUES) {
    if (!serializedEqual(previous[key], current[key])) changes[key] = current[key];
  }
  const collections = {};
  for (const key of SNAPSHOT_COLLECTIONS) {
    const patch = diffSnapshotCollection(previous[key], current[key]);
    if (patch) collections[key] = patch;
  }
  if (!Object.keys(changes).length && !Object.keys(collections).length) return null;
  return {
    type: 'snapshot_delta',
    sequence: current.sequence,
    serverTime: current.serverTime,
    baseSequence: previous.sequence,
    changes,
    collections,
  };
}

function sanitizeBag(bag) {
  return sanitizeServerBag(bag);
}

function pushEvent(state, playerId, type, payload = {}) {
  const player = state.players.get(playerId);
  if (!player) return null;
  const event = { id: ++state.eventSequence, type, ...payload, ts: Date.now() };
  player.events.push(event);
  if (player.events.length > 50) player.events.splice(0, player.events.length - 50);
  state.sequence += 1;
  return event;
}

function findPlayer(state, idOrName) {
  return state.players.get(idOrName)
    || [...state.players.values()].find((entry) => entry.name === cleanName(idOrName));
}

function bagItemCount(player, itemId) {
  return player.bag
    .filter((entry) => entry.id === itemId)
    .reduce((total, entry) => total + (entry.qty || 1), 0);
}

function removeBagItem(player, itemId, quantity = 1) {
  let remaining = Math.max(0, Math.floor(quantity));
  for (let index = player.bag.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const entry = player.bag[index];
    if (entry.id !== itemId) continue;
    const used = Math.min(remaining, entry.qty || 1);
    entry.qty = (entry.qty || 1) - used;
    remaining -= used;
    if (entry.qty <= 0) player.bag.splice(index, 1);
  }
  if (remaining > 0) return false;
  player.authorityVersion += 1;
  return true;
}

function consumeBagIndex(player, index, expectedItemId, quantity = 1) {
  const entry = player.bag[index];
  if (!entry || entry.id !== expectedItemId || (entry.qty || 1) < quantity) return false;
  entry.qty = (entry.qty || 1) - quantity;
  if (entry.qty <= 0) player.bag.splice(index, 1);
  player.authorityVersion += 1;
  return true;
}

function equipmentSlotFor(player, itemSlot) {
  const matches = EQUIP_SLOTS.filter((slot) => SLOT_TYPES[slot] === itemSlot);
  return matches.find((slot) => !player.equip[slot]) || matches[0] || null;
}

function validatedBagEntry(player, action) {
  const index = Math.floor(Number(action.index));
  if (!Number.isInteger(index) || index < 0 || index >= player.bag.length) return null;
  const entry = player.bag[index];
  if (action.itemId && action.itemId !== entry.id) return null;
  if (action.uid && action.uid !== entry.uid) return null;
  return { entry, index, item: ITEMS[entry.id] };
}

function applyUseItem(state, player, action, now) {
  const selected = validatedBagEntry(player, action);
  if (!selected?.item) return false;
  const { entry, index, item } = selected;
  if (item.type === 'quest' || item.type === 'material') return false;
  if (item.type === 'skillbook') {
    if (item.classId !== player.classId || player.level < (CLASSES[player.classId].skills.find(
      (skill) => skill.id === item.skillId,
    )?.reqLevel || 1)) return false;
    const skill = player.skills[item.skillId];
    if (!skill || skill.learned) return false;
    skill.learned = true;
    skill.level = 1;
    skill.exp = 0;
    consumeBagIndex(player, index, item.id, 1);
    pushEvent(state, player.id, 'skill_learned', { skillId: item.skillId, bookId: item.id });
    return true;
  }
  if (item.type === 'consumable') {
    if (item.use?.weaponLuck) {
      const weapon = player.equip.weapon;
      if (!weapon || (weapon.luck >= 7 && weapon.curse <= 0)) return false;
      const successRate = Math.max(0.28, 0.78 - weapon.luck * 0.075);
      const roll = Math.random();
      let outcome = 'unchanged';
      if (roll < successRate) {
        if (weapon.curse > 0) {
          weapon.curse -= 1;
          outcome = 'curse_down';
        } else {
          weapon.luck = Math.min(7, weapon.luck + 1);
          outcome = 'luck_up';
        }
      } else if (roll > 0.9) {
        weapon.curse = Math.min(7, weapon.curse + 1);
        outcome = 'curse_up';
      }
      consumeBagIndex(player, index, item.id, 1);
      refreshServerStats(player);
      player.authorityVersion += 1;
      pushEvent(state, player.id, 'weapon_luck', {
        outcome, luck: weapon.luck, curse: weapon.curse,
      });
      return true;
    }
    const restorative = item.use?.hp || item.use?.mp;
    if (restorative && now - (player.lastPotionAt || 0) < 1100) return false;
    if (item.use?.town && now < (player.combatLockUntil || 0)) return false;
    if (item.use?.randomTeleport) {
      const x = (2 + Math.random() * (WORLD.cols - 4)) * T;
      const y = (2 + Math.random() * (WORLD.rows - 4)) * T;
      const point = nearestWalkablePoint(player.mapId, x, y);
      player.x = point.x;
      player.y = point.y;
    }
    if (item.use?.dungeonEscape) {
      const start = MAPS.bich.playerStart;
      player.mapId = 'bich';
      player.x = start.x * T;
      player.y = start.y * T;
      player.combatLockUntil = 0;
    }
    if (item.use?.hp && player.hp >= player.maxHp && !item.use?.mp) return false;
    if (item.use?.mp && player.mp >= player.maxMp && !item.use?.hp) return false;
    if (item.use?.hp) player.hp = Math.min(player.maxHp, player.hp + item.use.hp);
    if (item.use?.mp) player.mp = Math.min(player.maxMp, player.mp + item.use.mp);
    if (restorative) player.lastPotionAt = now;
    if (item.use?.town) {
      const start = MAPS.bich.playerStart;
      player.mapId = 'bich';
      player.x = start.x * T;
      player.y = start.y * T;
    }
    consumeBagIndex(player, index, item.id, 1);
    player.combatVersion += 1;
    return true;
  }
  if (!item.slot || (item.reqLevel && player.level < item.reqLevel)
    || (item.classes && !item.classes.includes(player.classId))) return false;
  const slot = equipmentSlotFor(player, item.slot);
  if (!slot) return false;
  const previous = player.equip[slot];
  player.bag.splice(index, 1);
  player.equip[slot] = entry;
  player.enhance[slot] = entry.enhance || 0;
  if (previous && !addServerItem(player, previous)) {
    player.equip[slot] = previous;
    player.bag.splice(index, 0, entry);
    return false;
  }
  refreshServerStats(player);
  player.authorityVersion += 1;
  pushEvent(state, player.id, 'equipment_changed', { slot, itemId: item.id });
  return true;
}

function applyInventoryCommand(state, player, action, now) {
  if (action.type === 'use_item') return applyUseItem(state, player, action, now);
  if (action.type === 'unequip') {
    const slot = action.slot;
    const entry = EQUIP_SLOTS.includes(slot) ? player.equip[slot] : null;
    if (!entry || !addServerItem(player, entry)) return false;
    player.equip[slot] = null;
    player.enhance[slot] = 0;
    refreshServerStats(player);
    player.authorityVersion += 1;
    return true;
  }
  if (action.type === 'buy_item') {
    const item = ITEMS[action.itemId];
    if (!MAPS[player.mapId]?.safe || !item || !SHOP_TOWN.includes(item.id) || player.gold < item.price) return false;
    if (!addServerItem(player, { id: item.id, qty: 1 })) return false;
    player.gold -= item.price;
    player.authorityVersion += 1;
    pushEvent(state, player.id, 'item_bought', { itemId: item.id, price: item.price });
    return true;
  }
  if (action.type === 'sell_item') {
    if (!MAPS[player.mapId]?.safe) return false;
    const selected = validatedBagEntry(player, action);
    if (!selected?.item || selected.item.type === 'quest') return false;
    const quantity = selected.entry.qty || 1;
    const gain = Math.max(0, Math.floor((selected.item.sell || 0) * quantity));
    player.bag.splice(selected.index, 1);
    player.gold = Math.min(1_000_000_000, player.gold + gain);
    player.authorityVersion += 1;
    pushEvent(state, player.id, 'item_sold', { itemId: selected.item.id, gain });
    return true;
  }
  if (action.type === 'repair_all') {
    if (!MAPS[player.mapId]?.safe) return false;
    const damaged = EQUIP_SLOTS.map((slot) => player.equip[slot]).filter(
      (entry) => entry && entry.durability < entry.maxDurability,
    );
    if (!damaged.length) return false;
    const cost = damaged.reduce((total, entry) => {
      const item = ITEMS[entry.id];
      const missing = entry.maxDurability - entry.durability;
      return total + Math.max(1, Math.ceil(missing * Math.max(1, item.price || item.sell || 1)
        / entry.maxDurability * 0.12));
    }, 0);
    if (player.gold < cost) return false;
    player.gold -= cost;
    for (const entry of damaged) entry.durability = entry.maxDurability;
    refreshServerStats(player);
    player.authorityVersion += 1;
    pushEvent(state, player.id, 'equipment_repaired', { cost, count: damaged.length });
    return true;
  }
  if (action.type === 'enhance_slot') {
    if (!MAPS[player.mapId]?.safe || action.slot !== 'weapon') return false;
    const entry = player.equip.weapon;
    if (!entry) return false;
    const level = entry.enhance || 0;
    const cost = enhanceCost(level);
    if (level >= 7 || player.gold < cost.gold || bagItemCount(player, 'black_iron') < cost.ore) return false;
    player.gold -= cost.gold;
    if (cost.ore) removeBagItem(player, 'black_iron', cost.ore);
    const success = Math.random() <= cost.rate;
    const destroyed = !success && cost.destroysOnFailure;
    if (success) {
      entry.enhance = level + 1;
      player.enhance.weapon = entry.enhance;
    } else if (destroyed) {
      player.equip.weapon = null;
      player.enhance.weapon = 0;
    }
    refreshServerStats(player);
    player.authorityVersion += 1;
    pushEvent(state, player.id, 'equipment_enhanced', {
      slot: 'weapon',
      itemId: entry.id,
      success,
      destroyed,
      level: destroyed ? 0 : entry.enhance,
      cost,
    });
    return true;
  }
  if (action.type === 'craft_recipe') {
    if (!MAPS[player.mapId]?.safe) return false;
    const recipe = RECIPES[action.recipeId];
    if (!recipe || player.gold < recipe.gold
      || recipe.materials.some((material) => bagItemCount(player, material.id) < material.qty)) return false;
    const equipmentOutputs = recipe.outputs.reduce((total, output) => (
      total + (ITEMS[output.id]?.slot ? output.qty : 0)
    ), 0);
    if (player.bag.length + equipmentOutputs > player.bagSize) return false;
    player.gold -= recipe.gold;
    for (const material of recipe.materials) removeBagItem(player, material.id, material.qty);
    for (const output of recipe.outputs) addServerItem(player, { id: output.id, qty: output.qty });
    player.authorityVersion += 1;
    pushEvent(state, player.id, 'recipe_crafted', { recipeId: recipe.id, outputs: recipe.outputs });
    return true;
  }
  if (action.type === 'heal_full') {
    if (!MAPS[player.mapId]?.safe) return false;
    const missingHp = Math.max(0, player.maxHp - player.hp);
    const missingMp = Math.max(0, player.maxMp - player.mp);
    if (missingHp <= 0 && missingMp <= 0) return false;
    const cost = player.level <= 5
      ? 0
      : Math.max(10, Math.ceil((missingHp + missingMp * 0.55) * 0.18 + player.level * 3));
    if (player.gold < cost) return false;
    player.gold -= cost;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    player.combatVersion += 1;
    player.authorityVersion += 1;
    pushEvent(state, player.id, 'healed_full', { cost });
    return true;
  }
  if (action.type === 'claim_achievement') {
    const achievement = ACHIEVEMENTS.find((entry) => entry.id === action.achievementId);
    if (!achievement || !player.achievements.includes(achievement.id)
      || player.claimedAchievements.includes(achievement.id)) return false;
    player.claimedAchievements.push(achievement.id);
    player.gold = Math.min(1_000_000_000, player.gold + achievement.reward);
    player.authorityVersion += 1;
    pushEvent(state, player.id, 'achievement_claimed', {
      achievementId: achievement.id,
      reward: achievement.reward,
    });
    return true;
  }
  return false;
}

function interactQuest(state, player, action) {
  const npc = MAPS[player.mapId]?.npcs?.find((entry) => entry.id === action.npcId);
  if (!npc || npc.action !== 'quest'
    || Math.hypot(player.x - npc.x * T, player.y - npc.y * T) > 130) return false;
  const quest = QUESTS.find((entry) => entry.id === player.questId);
  if (!quest) {
    const active = BOUNTIES.find((entry) => entry.id === player.bounty?.id);
    if (!active) {
      const eligible = BOUNTIES.filter((entry) => player.level >= entry.reqLevel);
      if (!eligible.length) return false;
      const bounty = eligible[(player.bountyCompletions || 0) % eligible.length];
      player.bounty = { id: bounty.id, progress: 0 };
      player.authorityVersion += 1;
      pushEvent(state, player.id, 'bounty_started', { bounty });
      return true;
    }
    if ((player.bounty.progress || 0) < active.count) {
      pushEvent(state, player.id, 'bounty_status', {
        bountyId: active.id,
        progress: player.bounty.progress || 0,
        count: active.count,
      });
      return true;
    }
    const levels = addServerExperience(player, active.reward.xp || 0);
    player.gold = Math.min(1_000_000_000, player.gold + (active.reward.gold || 0));
    for (const reward of active.reward.items || []) addServerItem(player, reward);
    player.bountyCompletions = (player.bountyCompletions || 0) + 1;
    player.bounty = null;
    player.authorityVersion += 1;
    pushEvent(state, player.id, 'bounty_completed', {
      bountyId: active.id,
      name: active.name,
      reward: active.reward,
      completions: player.bountyCompletions,
      levels,
    });
    return true;
  }
  if (quest.giver !== npc.id) return false;
  const complete = quest.steps.every((step) => {
    if (step.type === 'talk') return step.npc === npc.id;
    if (step.type === 'kill') return (player.questProgress[step.monster] || 0) >= step.count;
    if (step.type === 'collect') return bagItemCount(player, step.item) >= step.count;
    return false;
  });
  if (!complete) {
    pushEvent(state, player.id, 'quest_status', { questId: quest.id, complete: false });
    return true;
  }
  const equipmentRewards = (quest.reward.items || []).reduce((total, reward) => (
    total + (ITEMS[reward.id]?.slot ? reward.qty : 0)
  ), 0);
  if (player.bag.length + equipmentRewards > player.bagSize) return false;
  for (const step of quest.steps) {
    if (step.type === 'collect') removeBagItem(player, step.item, step.count);
  }
  const levels = addServerExperience(player, quest.reward.xp || 0);
  player.gold = Math.min(1_000_000_000, player.gold + (quest.reward.gold || 0));
  for (const reward of quest.reward.items || []) addServerItem(player, reward);
  player.completedQuests.push(quest.id);
  player.questId = quest.next;
  player.questProgress = {};
  player.authorityVersion += 1;
  pushEvent(state, player.id, 'quest_completed', {
    questId: quest.id,
    nextQuestId: quest.next,
    reward: quest.reward,
    levels,
  });
  return true;
}

export function registerPlayer(state, profile = {}, now = Date.now()) {
  const requestedResumeToken = String(profile.resumeToken || '').slice(0, 128);
  const requestedCharacterId = String(profile.characterId || '').slice(0, 128);
  const instanceId = String(profile.instanceId || '').slice(0, 128);
  const tokenResumedId = requestedResumeToken ? state.resumeTokens.get(requestedResumeToken) : null;
  const characterResumedId = requestedCharacterId ? state.characters.get(requestedCharacterId) : null;
  const resumedId = tokenResumedId || characterResumedId;
  const resumedPlayer = state.players.get(resumedId);
  if (resumedPlayer) {
    if (!tokenResumedId && resumedPlayer.online && resumedPlayer.instanceId !== instanceId) {
      return {
        ok: false,
        status: 409,
        reason: 'character_online',
      };
    }
    if (requestedCharacterId && requestedCharacterId !== resumedPlayer.characterId) {
      const characterOwner = state.characters.get(requestedCharacterId);
      if (characterOwner && characterOwner !== resumedPlayer.id) {
        return {
          ok: false,
          status: 409,
          reason: 'character_conflict',
        };
      }
    }
    const previousToken = resumedPlayer.token;
    const previousStream = state.streams.get(previousToken);
    previousStream?.response?.end();
    previousStream?.end?.();
    state.streams.delete(previousToken);
    state.tokens.delete(previousToken);
    const token = randomUUID();
    resumedPlayer.token = token;
    resumedPlayer.online = true;
    resumedPlayer.disconnectedAt = 0;
    resumedPlayer.lastSeen = now;
    resumedPlayer.lastMove = now;
    resumedPlayer.lastActionSeq = Object.create(null);
    resumedPlayer.instanceId = instanceId;
    if (requestedCharacterId && requestedCharacterId !== resumedPlayer.characterId) {
      state.characters.delete(resumedPlayer.characterId);
      resumedPlayer.characterId = requestedCharacterId;
      state.characters.set(requestedCharacterId, resumedPlayer.id);
    }
    state.tokens.set(token, resumedPlayer.id);
    state.sequence += 1;
    return {
      token,
      resumeToken: resumedPlayer.resumeToken,
      resumed: true,
      player: publicPlayer(resumedPlayer),
    };
  }
  const classId = CLASSES[profile.classId] ? profile.classId : 'warrior';
  // A new online character always starts from server-owned state. Client saves are
  // never accepted as proof of level, location, health, currency or inventory.
  const mapId = 'bich';
  const start = MAPS[mapId].playerStart;
  const token = randomUUID();
  const resumeToken = randomUUID();
  const characterId = requestedCharacterId || randomUUID();
  const id = randomUUID();
  const character = createServerCharacter(classId);
  const player = {
    ...character,
    id,
    token,
    resumeToken,
    characterId,
    instanceId,
    name: cleanName(profile.name),
    classId,
    mapId,
    x: start.x * T,
    y: start.y * T,
    facing: profile.facing === -1 ? -1 : 1,
    direction: ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'].includes(profile.direction) ? profile.direction : 's',
    anim: 'idle',
    pkPoints: 0,
    crimeT: 0,
    pkMode: 'peace',
    teamId: null,
    guildId: null,
    friends: new Set(),
    friendRequests: new Set(),
    teamInvites: new Set(),
    guildInvites: new Set(),
    events: [],
    playerKills: 0,
    deaths: 0,
    combatVersion: 0,
    combatLockUntil: 0,
    lastPotionAt: 0,
    lastPvpAttack: 0,
    lastBossAttack: 0,
    lastSeen: now,
    lastMove: now,
    online: true,
    disconnectedAt: 0,
    lastActionSeq: Object.create(null),
    processedActions: new Map(),
  };
  if (isBlocked(mapId, player.x, player.y)) {
    player.x = start.x * T;
    player.y = start.y * T;
  }
  state.players.set(id, player);
  state.tokens.set(token, id);
  state.resumeTokens.set(resumeToken, id);
  state.characters.set(characterId, id);
  state.sequence += 1;
  return {
    token,
    resumeToken,
    resumed: false,
    player: publicPlayer(player),
  };
}

function isBlocked(mapId, x, y) {
  const col = Math.floor(x / T);
  const row = Math.floor(y / T);
  const map = MAPS[mapId];
  const grid = map?.grid;
  if (!grid || row < 0 || col < 0 || row >= WORLD.rows || col >= WORLD.cols || grid[row][col] === 1) return true;
  for (const decor of map.decors || []) {
    const definition = SCENERY[decor.id];
    if (!definition?.block) continue;
    const radius = (decor.blockRadius || definition.blockRadius || 0) * T;
    if (radius > 0 && Math.hypot(x - decor.x * T, y - decor.y * T) <= radius) return true;
  }
  return false;
}

function serverBodyClear(state, entity, x, y, radius, oldX = entity.x, oldY = entity.y) {
  const overlaps = (blocker, fallbackRadius = COMBAT_RULES.monsterBodyRadius) => {
    const minimum = radius + (blocker.r || fallbackRadius) - 2;
    const nextDistance = Math.hypot(x - blocker.x, y - blocker.y);
    if (nextDistance >= minimum) return false;
    const oldDistance = Math.hypot(oldX - blocker.x, oldY - blocker.y);
    return !(oldDistance < minimum && nextDistance > oldDistance + 0.01);
  };
  for (const player of state.players.values()) {
    if (player.id === entity.id || player.online === false || player.hp <= 0 || player.mapId !== entity.mapId) continue;
    if (overlaps(player, COMBAT_RULES.playerBodyRadius)) return false;
    if (player.pet?.hp > 0 && player.pet.mapId === entity.mapId
      && player.pet.id !== entity.id && overlaps(player.pet)) return false;
  }
  for (const monster of state.monsters.values()) {
    if (monster.id === entity.id || !monster.alive || monster.mapId !== entity.mapId) continue;
    if (overlaps(monster)) return false;
  }
  for (const boss of state.bosses.values()) {
    if (boss.id === entity.id || !boss.alive || boss.mapId !== entity.mapId) continue;
    if (overlaps(boss, 24)) return false;
  }
  for (const npc of MAPS[entity.mapId]?.npcs || []) {
    if (overlaps({ x: npc.x * T, y: npc.y * T }, 20)) return false;
  }
  return true;
}

function tryServerMove(state, entity, nextX, nextY, radius) {
  const oldX = entity.x;
  const oldY = entity.y;
  const commit = (x, y) => {
    entity.x = x;
    entity.y = y;
    const dx = x - oldX;
    const dy = y - oldY;
    if (Math.hypot(dx, dy) > 0.05) {
      entity.direction = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'][
        (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
      ];
      if (Math.abs(dx) > 0.05) entity.facing = dx > 0 ? 1 : -1;
    }
    return true;
  };
  if (!isBlocked(entity.mapId, nextX, nextY)
    && serverBodyClear(state, entity, nextX, nextY, radius, oldX, oldY)) {
    return commit(nextX, nextY);
  }
  if (!isBlocked(entity.mapId, nextX, oldY)
    && serverBodyClear(state, entity, nextX, oldY, radius, oldX, oldY)) {
    return commit(nextX, oldY);
  }
  if (!isBlocked(entity.mapId, oldX, nextY)
    && serverBodyClear(state, entity, oldX, nextY, radius, oldX, oldY)) {
    return commit(oldX, nextY);
  }
  return false;
}

function movePlayer(state, player, action, now) {
  const requestedX = boundedNumber(action.x, player.x, 24, WORLD.cols * T - 24);
  const requestedY = boundedNumber(action.y, player.y, 24, WORLD.rows * T - 24);
  const elapsed = Math.max(0.05, Math.min(0.5, (now - player.lastMove) / 1000));
  const speed = (CLASSES[player.classId]?.base.ms || 160) * (action.run ? 1.45 : 1);
  const maxDistance = speed * elapsed + 28;
  const dx = requestedX - player.x;
  const dy = requestedY - player.y;
  const distance = Math.hypot(dx, dy);
  const scale = distance > maxDistance ? maxDistance / distance : 1;
  const directionIndex = distance > 0.5
    ? (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
    : null;
  const directionVectors = [
    [1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2],
    [-1, 0], [-Math.SQRT1_2, -Math.SQRT1_2], [0, -1], [Math.SQRT1_2, -Math.SQRT1_2],
  ];
  const vector = directionIndex === null ? [0, 0] : directionVectors[directionIndex];
  const step = distance * scale;
  const nextX = player.x + vector[0] * step;
  const nextY = player.y + vector[1] * step;
  if (now >= (player.combatLockedUntil || 0)) {
    tryServerMove(state, player, nextX, nextY, COMBAT_RULES.playerBodyRadius);
  }
  if (Math.abs(dx) > 0.5) player.facing = dx > 0 ? 1 : -1;
  if (directionIndex !== null) {
    const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
    player.direction = directions[directionIndex];
  }
  player.anim = now < (player.combatLockedUntil || 0)
    ? 'attack'
    : distance > 2 ? (action.run ? 'run' : 'walk') : 'idle';
  player.lastMove = now;
}

function changeMap(player, action) {
  const source = MAPS[player.mapId];
  const portal = source?.portals.find((entry) => entry.to === action.to);
  if (!portal || (portal.reqLevel && player.level < portal.reqLevel)) return false;
  const portalX = portal.x * T;
  const portalY = portal.y * T;
  if (Math.hypot(player.x - portalX, player.y - portalY) > 130) return false;
  const target = MAPS[action.to];
  player.mapId = action.to;
  player.x = boundedNumber(portal.tx * T, target.playerStart.x * T, 24, WORLD.cols * T - 24);
  player.y = boundedNumber(portal.ty * T, target.playerStart.y * T, 24, WORLD.rows * T - 24);
  player.anim = 'idle';
  return true;
}

function activeTradeFor(state, playerId) {
  return [...state.trades.values()].find(
    (trade) => trade.status !== 'completed' && trade.status !== 'cancelled' && trade.members.includes(playerId),
  );
}

function leaveTeam(state, player) {
  const team = state.teams.get(player.teamId);
  if (!team) { player.teamId = null; return; }
  team.members.delete(player.id);
  player.teamId = null;
  if (!team.members.size) state.teams.delete(team.id);
  else if (team.leaderId === player.id) team.leaderId = team.members.values().next().value;
}

function leaveGuild(state, player) {
  const guild = state.guilds.get(player.guildId);
  if (!guild) { player.guildId = null; return; }
  guild.members.delete(player.id);
  player.guildId = null;
  if (!guild.members.size) state.guilds.delete(guild.id);
  else if (guild.leaderId === player.id) guild.leaderId = guild.members.values().next().value;
}

function addChatMessage(state, player, action, now) {
  const channel = ['nearby', 'world', 'team', 'guild', 'whisper'].includes(action.channel)
    ? action.channel
    : 'nearby';
  const text = String(action.text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 100);
  if (!text || now - (player.lastChat || 0) < 450) return false;
  if (channel === 'team' && !player.teamId) return false;
  if (channel === 'guild' && !player.guildId) return false;
  const target = channel === 'whisper' ? findPlayer(state, action.targetId || action.targetName) : null;
  if (channel === 'whisper' && !target) return false;
  const message = {
    id: randomUUID(),
    channel,
    text,
    fromId: player.id,
    fromName: player.name,
    toId: target?.id || null,
    toName: target?.name || null,
    mapId: player.mapId,
    groupId: channel === 'team' ? player.teamId : channel === 'guild' ? player.guildId : null,
    ts: now,
  };
  state.messages.push(message);
  if (state.messages.length > 300) state.messages.splice(0, state.messages.length - 300);
  player.lastChat = now;
  return true;
}

function applySocialAction(state, player, action, now) {
  const target = action.targetId ? findPlayer(state, action.targetId) : null;
  if (action.type === 'chat') return addChatMessage(state, player, action, now);
  if (action.type === 'friend_request') {
    if (!target || target.id === player.id) return false;
    target.friendRequests.add(player.id);
    pushEvent(state, target.id, 'friend_request', { from: publicPlayer(player) });
    return true;
  }
  if (action.type === 'friend_accept') {
    if (!target || !player.friendRequests.has(target.id)) return false;
    player.friendRequests.delete(target.id);
    player.friends.add(target.id);
    target.friends.add(player.id);
    pushEvent(state, target.id, 'friend_accept', { from: publicPlayer(player) });
    return true;
  }
  if (action.type === 'friend_remove') {
    if (!target) return false;
    player.friends.delete(target.id);
    target.friends.delete(player.id);
    return true;
  }
  if (action.type === 'team_invite') {
    if (!target || target.id === player.id || target.teamId) return false;
    const ownTeam = state.teams.get(player.teamId);
    if (ownTeam && ownTeam.leaderId !== player.id) return false;
    target.teamInvites.add(player.id);
    pushEvent(state, target.id, 'team_invite', { from: publicPlayer(player) });
    return true;
  }
  if (action.type === 'team_accept') {
    if (!target || !player.teamInvites.has(target.id) || player.teamId) return false;
    player.teamInvites.delete(target.id);
    let team = state.teams.get(target.teamId);
    if (!team) {
      team = { id: randomUUID(), leaderId: target.id, members: new Set([target.id]), createdAt: now };
      state.teams.set(team.id, team);
      target.teamId = team.id;
    }
    if (team.members.size >= 5) return false;
    team.members.add(player.id);
    player.teamId = team.id;
    pushEvent(state, target.id, 'team_join', { player: publicPlayer(player) });
    return true;
  }
  if (action.type === 'team_leave') {
    leaveTeam(state, player);
    return true;
  }
  if (action.type === 'team_kick') {
    const team = state.teams.get(player.teamId);
    if (!target || !team || team.leaderId !== player.id || target.id === player.id
      || target.teamId !== team.id) return false;
    leaveTeam(state, target);
    pushEvent(state, target.id, 'team_kicked', { leader: publicPlayer(player) });
    return true;
  }
  if (action.type === 'team_promote') {
    const team = state.teams.get(player.teamId);
    if (!target || !team || team.leaderId !== player.id || target.id === player.id
      || target.teamId !== team.id) return false;
    team.leaderId = target.id;
    for (const memberId of team.members) {
      pushEvent(state, memberId, 'team_promoted', { leader: publicPlayer(target) });
    }
    return true;
  }
  if (action.type === 'guild_create') {
    const name = String(action.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10);
    if (name.length < 2 || player.guildId || player.level < 20 || player.gold < 1000
      || bagItemCount(player, 'orc_tooth') < 1
      || [...state.guilds.values()].some((guild) => guild.name === name)) return false;
    player.gold -= 1000;
    removeBagItem(player, 'orc_tooth', 1);
    const guild = { id: randomUUID(), name, leaderId: player.id, members: new Set([player.id]), createdAt: now };
    state.guilds.set(guild.id, guild);
    player.guildId = guild.id;
    player.authorityVersion += 1;
    pushEvent(state, player.id, 'guild_created', { guild: publicGroup(guild, state), cost: 1000 });
    return true;
  }
  if (action.type === 'guild_invite') {
    const guild = state.guilds.get(player.guildId);
    if (!target || !guild || guild.leaderId !== player.id || target.guildId) return false;
    target.guildInvites.add(guild.id);
    pushEvent(state, target.id, 'guild_invite', { guild: publicGroup(guild, state) });
    return true;
  }
  if (action.type === 'guild_accept') {
    const guild = state.guilds.get(action.guildId);
    if (!guild || player.guildId || !player.guildInvites.has(guild.id) || guild.members.size >= 50) return false;
    player.guildInvites.delete(guild.id);
    guild.members.add(player.id);
    player.guildId = guild.id;
    pushEvent(state, guild.leaderId, 'guild_join', { player: publicPlayer(player) });
    return true;
  }
  if (action.type === 'guild_leave') {
    const activeWar = [...state.guildWars.values()].some((war) => war.status === 'active'
      && [war.guildA, war.guildB].includes(player.guildId));
    const siege = state.sabac.war;
    if (activeWar || (siege?.status === 'active'
      && [siege.attackerGuildId, siege.defenderGuildId].includes(player.guildId))) return false;
    leaveGuild(state, player);
    return true;
  }
  if (action.type === 'guild_kick') {
    const guild = state.guilds.get(player.guildId);
    const activeWar = [...state.guildWars.values()].some((war) => war.status === 'active'
      && [war.guildA, war.guildB].includes(player.guildId));
    const siege = state.sabac.war;
    if (!target || !guild || guild.leaderId !== player.id || target.id === player.id
      || target.guildId !== guild.id || activeWar || (siege?.status === 'active'
        && [siege.attackerGuildId, siege.defenderGuildId].includes(guild.id))) return false;
    leaveGuild(state, target);
    pushEvent(state, target.id, 'guild_kicked', { guildName: guild.name });
    return true;
  }
  if (action.type === 'guild_promote') {
    const guild = state.guilds.get(player.guildId);
    if (!target || !guild || guild.leaderId !== player.id || target.id === player.id
      || target.guildId !== guild.id) return false;
    guild.leaderId = target.id;
    for (const memberId of guild.members) {
      pushEvent(state, memberId, 'guild_promoted', { leader: publicPlayer(target), guildName: guild.name });
    }
    return true;
  }
  if (action.type === 'inventory') {
    // Inventory is a server ledger. Loot, trade, shops and crafting must mutate it
    // through their own validated actions; a client snapshot is never authoritative.
    return false;
  }
  if (action.type === 'trade_request') {
    if (!target || target.id === player.id || target.mapId !== player.mapId
      || activeTradeFor(state, player.id) || activeTradeFor(state, target.id)) return false;
    const trade = {
      id: randomUUID(),
      requesterId: player.id,
      members: [player.id, target.id],
      status: 'requested',
      offers: new Map(),
      confirmed: new Set(),
      createdAt: now,
    };
    state.trades.set(trade.id, trade);
    pushEvent(state, target.id, 'trade_request', { tradeId: trade.id, from: publicPlayer(player) });
    return true;
  }
  const trade = state.trades.get(action.tradeId) || activeTradeFor(state, player.id);
  if (!trade || !trade.members.includes(player.id)) return false;
  if (action.type === 'trade_accept') {
    if (trade.status !== 'requested' || trade.requesterId === player.id) return false;
    trade.status = 'active';
    for (const memberId of trade.members) pushEvent(state, memberId, 'trade_active', { tradeId: trade.id });
    return true;
  }
  if (action.type === 'trade_offer') {
    if (trade.status !== 'active') return false;
    const itemIndex = action.itemIndex == null ? null : Math.floor(Number(action.itemIndex));
    const item = itemIndex == null ? null : player.bag[itemIndex];
    if (itemIndex != null && !item) return false;
    const gold = Math.floor(boundedNumber(action.gold, 0, 0, player.gold));
    trade.offers.set(player.id, { itemIndex, item: item ? { ...item } : null, gold });
    trade.confirmed.clear();
    return true;
  }
  if (action.type === 'trade_confirm') {
    if (trade.status !== 'active' || !trade.offers.has(player.id)) return false;
    trade.confirmed.add(player.id);
    if (trade.confirmed.size < 2) return true;
    const [firstId, secondId] = trade.members;
    const first = state.players.get(firstId);
    const second = state.players.get(secondId);
    const firstOffer = trade.offers.get(firstId) || { itemIndex: null, item: null, gold: 0 };
    const secondOffer = trade.offers.get(secondId) || { itemIndex: null, item: null, gold: 0 };
    if (!first || !second || first.gold < firstOffer.gold || second.gold < secondOffer.gold) return false;
    if (firstOffer.item && first.bag[firstOffer.itemIndex]?.id !== firstOffer.item.id) return false;
    if (secondOffer.item && second.bag[secondOffer.itemIndex]?.id !== secondOffer.item.id) return false;
    const firstItem = firstOffer.item ? first.bag.splice(firstOffer.itemIndex, 1)[0] : null;
    const secondItem = secondOffer.item ? second.bag.splice(secondOffer.itemIndex, 1)[0] : null;
    if (secondItem) first.bag.push(secondItem);
    if (firstItem) second.bag.push(firstItem);
    first.gold += secondOffer.gold - firstOffer.gold;
    second.gold += firstOffer.gold - secondOffer.gold;
    first.authorityVersion += 1;
    second.authorityVersion += 1;
    trade.status = 'completed';
    pushEvent(state, first.id, 'trade_complete', { tradeId: trade.id, bag: first.bag, gold: first.gold });
    pushEvent(state, second.id, 'trade_complete', { tradeId: trade.id, bag: second.bag, gold: second.gold });
    return true;
  }
  if (action.type === 'trade_cancel') {
    trade.status = 'cancelled';
    for (const memberId of trade.members) pushEvent(state, memberId, 'trade_cancelled', { tradeId: trade.id });
    return true;
  }
  return false;
}

function guildWarBetween(state, guildA, guildB, now = Date.now()) {
  if (!guildA || !guildB) return null;
  return [...state.guildWars.values()].find((war) => war.status === 'active' && war.endsAt > now
    && ((war.guildA === guildA && war.guildB === guildB) || (war.guildA === guildB && war.guildB === guildA)));
}

function sabacCombat(state, attacker, target) {
  const war = state.sabac.war;
  if (!war || war.status !== 'active' || attacker.mapId !== 'sabac' || target.mapId !== 'sabac') return false;
  return [war.attackerGuildId, war.defenderGuildId].includes(attacker.guildId)
    && [war.attackerGuildId, war.defenderGuildId].includes(target.guildId)
    && attacker.guildId !== target.guildId;
}

function declareGuildWar(state, player, action, now) {
  const ownGuild = state.guilds.get(player.guildId);
  const targetGuild = state.guilds.get(action.targetGuildId);
  if (!ownGuild || ownGuild.leaderId !== player.id || !targetGuild || targetGuild.id === ownGuild.id
    || player.level < 20 || player.gold < 500
    || guildWarBetween(state, ownGuild.id, targetGuild.id, now)) return false;
  player.gold -= 500;
  player.authorityVersion += 1;
  const war = {
    id: randomUUID(),
    guildA: ownGuild.id,
    guildB: targetGuild.id,
    declaredBy: player.id,
    startsAt: now,
    endsAt: now + 30 * 60_000,
    status: 'active',
    scoreA: 0,
    scoreB: 0,
    declarationCost: 500,
  };
  state.guildWars.set(war.id, war);
  for (const memberId of [...ownGuild.members, ...targetGuild.members]) {
    pushEvent(state, memberId, 'guild_war_started', {
      warId: war.id,
      guildAName: ownGuild.name,
      guildBName: targetGuild.name,
    });
  }
  return true;
}

function declareSabacWar(state, player, now) {
  const guild = state.guilds.get(player.guildId);
  if (!guild || guild.leaderId !== player.id || state.sabac.war?.status === 'active'
    || state.sabac.ownerGuildId === guild.id || player.level < 30 || player.gold < 5000
    || bagItemCount(player, 'lord_seal') < 1) return false;
  player.gold -= 5000;
  removeBagItem(player, 'lord_seal', 1);
  player.authorityVersion += 1;
  const gateMaxHp = MAPS.sabac.siegeGate?.maxHp || 2800;
  state.sabac.war = {
    id: randomUUID(),
    attackerGuildId: guild.id,
    defenderGuildId: state.sabac.ownerGuildId,
    startsAt: now,
    endsAt: now + 20 * 60_000,
    status: 'active',
    phase: 'gate',
    gateHp: gateMaxHp,
    gateMaxHp,
    captureGuildId: null,
    captureProgress: 0,
    attackerKills: 0,
    defenderKills: 0,
    declarationCost: 5000,
  };
  for (const memberId of guild.members) pushEvent(state, memberId, 'sabac_started', { warId: state.sabac.war.id });
  const defender = state.guilds.get(state.sabac.ownerGuildId);
  for (const memberId of defender?.members || []) pushEvent(state, memberId, 'sabac_started', { warId: state.sabac.war.id });
  return true;
}

function applySabacObjectiveAttack(state, player, action, now) {
  const war = state.sabac.war;
  const gate = MAPS.sabac.siegeGate;
  if (!war || war.status !== 'active' || war.phase !== 'gate' || !gate
    || player.guildId !== war.attackerGuildId || player.mapId !== 'sabac' || player.hp <= 0) return false;
  refreshServerStats(player);
  const prepared = offensiveSkillProfile(player, action.skillId || 'basic', now);
  if (!prepared || Math.hypot(player.x - gate.x * T, player.y - gate.y * T) > prepared.range + gate.r * T) return false;
  if (!commitOffensiveAttack(state, player, prepared, now)) return false;
  const result = serverAttackDamage(player, { defense: 18, magDef: 14 }, {
    magical: !!prepared.profile.magical,
    multiplier: prepared.profile.multiplier,
  });
  war.gateHp = Math.max(0, war.gateHp - result.damage);
  pushEvent(state, player.id, 'sabac_gate_hit', {
    damage: result.damage,
    gateHp: war.gateHp,
    gateMaxHp: war.gateMaxHp,
  });
  if (war.gateHp <= 0) {
    war.phase = 'palace';
    war.gateDestroyedAt = now;
    const participants = [
      ...(state.guilds.get(war.attackerGuildId)?.members || []),
      ...(state.guilds.get(war.defenderGuildId)?.members || []),
    ];
    for (const memberId of participants) pushEvent(state, memberId, 'sabac_gate_broken', {});
  }
  return true;
}

function createGroundDrop(state, player, payload, now, offset = 0) {
  const angle = offset * 2.399963;
  const radius = offset ? 18 + (offset % 3) * 7 : 0;
  const drop = {
    id: randomUUID(),
    mapId: player.mapId,
    x: player.x + Math.cos(angle) * radius,
    y: player.y + Math.sin(angle) * radius,
    entry: payload.entry || null,
    gold: Math.max(0, Math.floor(payload.gold || 0)),
    ownerId: payload.ownerId || null,
    ownerIds: Array.isArray(payload.ownerIds) ? [...new Set(payload.ownerIds)] : null,
    protectedUntil: payload.protectedUntil || 0,
    expiresAt: now + (payload.ttlMs || 180_000),
    source: payload.source || 'unknown',
  };
  state.drops.set(drop.id, drop);
  return drop;
}

function dropDefeatedPlayerLoot(state, player, now) {
  const loss = rollDeathLoss(player);
  const created = [];
  loss.entries.forEach((lost, index) => {
    created.push(createGroundDrop(state, player, {
      entry: lost.entry,
      source: 'player',
    }, now, index + 1));
  });
  if (loss.gold > 0) {
    created.push(createGroundDrop(state, player, {
      gold: loss.gold,
      source: 'player',
    }, now, created.length + 1));
  }
  const experience = loseDeathExperience(player, 0.1);
  return { drops: created, experience, gold: loss.gold };
}

function pickupGroundDrop(state, player, action, now) {
  const drop = state.drops.get(action.dropId);
  if (!drop || drop.mapId !== player.mapId || drop.expiresAt <= now) return false;
  if (Math.hypot(player.x - drop.x, player.y - drop.y) > 72) return false;
  const allowedOwner = !drop.ownerId && !drop.ownerIds
    || drop.ownerId === player.id
    || drop.ownerIds?.includes(player.id);
  if (!allowedOwner && now < drop.protectedUntil) return false;
  if (drop.entry && !addServerItem(player, drop.entry)) return false;
  if (drop.gold > 0) {
    player.gold = Math.min(1_000_000_000, player.gold + drop.gold);
    player.authorityVersion += 1;
  }
  state.drops.delete(drop.id);
  pushEvent(state, player.id, 'loot_picked', {
    entry: drop.entry || null,
    gold: drop.gold || 0,
    source: drop.source,
  });
  return true;
}

function nearbyTeamMembers(state, player, radius = 640) {
  const team = state.teams.get(player.teamId);
  if (!team) return [player];
  const members = [...team.members]
    .map((id) => state.players.get(id))
    .filter((member) => member && member.online !== false && member.hp > 0
      && member.mapId === player.mapId
      && Math.hypot(member.x - player.x, member.y - player.y) <= radius);
  return members.length ? members : [player];
}

function recordMonsterKill(player, kind) {
  player.totalKills = (player.totalKills || 0) + 1;
  player.killCounts[kind] = (player.killCounts[kind] || 0) + 1;
  const quest = QUESTS.find((entry) => entry.id === player.questId);
  for (const step of quest?.steps || []) {
    if (step.type !== 'kill' || step.monster !== kind) continue;
    player.questProgress[kind] = (player.questProgress[kind] || 0) + 1;
  }
  const bounty = BOUNTIES.find((entry) => entry.id === player.bounty?.id);
  if (bounty?.monster === kind) {
    player.bounty.progress = Math.min(bounty.count, (player.bounty.progress || 0) + 1);
  }
  player.authorityVersion += 1;
}

function unlockServerAchievements(state, player) {
  let unlocked = false;
  player.achievements ||= [];
  player.claimedAchievements ||= [];
  for (const achievement of ACHIEVEMENTS) {
    if (player.achievements.includes(achievement.id) || !achievement.check(player)) continue;
    player.achievements.push(achievement.id);
    player.authorityVersion += 1;
    pushEvent(state, player.id, 'achievement_unlocked', {
      achievementId: achievement.id,
      name: achievement.name,
      reward: achievement.reward,
    });
    unlocked = true;
  }
  return unlocked;
}

function defeatWorldMonster(state, player, monster, now) {
  const definition = MONSTERS[monster.kind];
  monster.hp = 0;
  monster.alive = false;
  monster.targetId = null;
  monster.respawnAt = now + (definition.elite ? 10 * 60_000 : 30_000 + Math.random() * 30_000);
  monster.anim = 'death';
  monster.combatVersion += 1;
  const team = nearbyTeamMembers(state, player);
  const sharedXp = Math.max(1, Math.floor(definition.xp * (1 + Math.max(0, team.length - 1) * 0.1) / team.length));
  for (const member of team) {
    const levelDifference = (definition.level || 1) - member.level;
    const adjustedXp = levelDifference < -8
      ? Math.floor(sharedXp * 0.25)
      : levelDifference < -4
        ? Math.floor(sharedXp * 0.55)
        : sharedXp;
    const levels = addServerExperience(member, adjustedXp);
    pushEvent(state, member.id, 'pve_reward', {
      monsterId: monster.id,
      kind: monster.kind,
      xp: adjustedXp,
      levels,
      killerId: player.id,
      teamSize: team.length,
    });
    recordMonsterKill(member, monster.kind);
  }
  const ownership = team.map((member) => member.id);
  const dropSource = { mapId: monster.mapId, x: monster.x, y: monster.y };
  let dropOffset = 0;
  const gold = Math.floor(definition.gold[0] + Math.random() * (definition.gold[1] - definition.gold[0] + 1));
  if (gold > 0) {
    createGroundDrop(state, dropSource, {
      gold,
      ownerIds: ownership,
      protectedUntil: now + 10_000,
      ttlMs: 120_000,
      source: monster.kind,
    }, now, dropOffset++);
  }
  for (const configured of definition.drops || []) {
    if (Math.random() >= configured.rate) continue;
    createGroundDrop(state, dropSource, {
      entry: createServerDropItem(configured.id, {
        elite: !!definition.elite,
        boss: !!definition.boss,
      }),
      ownerIds: ownership,
      protectedUntil: now + 10_000,
      ttlMs: 120_000,
      source: monster.kind,
    }, now, dropOffset++);
  }
  pushEvent(state, player.id, 'monster_kill', {
    monsterId: monster.id,
    kind: monster.kind,
    drops: dropOffset,
  });
}

function playerSkillDefinition(player, skillId) {
  return CLASSES[player.classId]?.skills?.find((skill) => skill.id === skillId) || null;
}

function skillReady(player, skill, now) {
  const state = player.skills?.[skill.id];
  return !!state?.learned
    && state.level > 0
    && player.level >= (skill.reqLevel || 1)
    && player.mp >= (skill.mana || 0)
    && now >= (player.skillCooldowns?.[skill.id] || 0);
}

function commitSkill(state, player, skill, now, mastery = 1) {
  if (!skillReady(player, skill, now)) return false;
  player.mp = Math.max(0, player.mp - (skill.mana || 0));
  player.skillCooldowns ??= {};
  player.skillCooldowns[skill.id] = now + Math.max(0, skill.cd || 0) * 1000;
  const leveled = gainServerSkillExperience(player, skill.id, mastery);
  player.combatLockedUntil = Math.max(player.combatLockedUntil || 0, now + COMBAT_RULES.attackRecovery * 1000);
  player.anim = 'attack';
  player.authorityVersion += 1;
  if (leveled) {
    pushEvent(state, player.id, 'skill_level', {
      skillId: skill.id,
      level: player.skills[skill.id].level,
    });
  }
  return true;
}

function offensiveSkillProfile(player, requestedSkillId, now) {
  if (!requestedSkillId || requestedSkillId === 'basic') {
    let skillId = 'basic';
    let profile = { magical: false, multiplier: 1, mastery: 0 };
    if (player.activeBoost?.expiresAt > now && ['thrust', 'fire_sword'].includes(player.activeBoost.id)) {
      skillId = player.activeBoost.id;
      profile = SKILL_COMBAT[skillId];
    } else if (player.classId === 'warrior' && player.skills?.slash?.learned) {
      skillId = 'slash';
      const level = Math.max(1, player.skills.slash.level || 1);
      profile = { ...SKILL_COMBAT.slash, multiplier: 1 + level * 0.08 };
    }
    return { skillId, skill: null, profile, range: COMBAT_RULES.basicRange };
  }
  const skill = playerSkillDefinition(player, requestedSkillId);
  const profile = SKILL_COMBAT[requestedSkillId];
  if (!skill || !profile || !['missile', 'target', 'aoe', 'dash'].includes(skill.type)) return null;
  return { skillId: requestedSkillId, skill, profile, range: profile.range || skill.range || COMBAT_RULES.basicRange };
}

function commitOffensiveAttack(state, player, prepared, now) {
  if (prepared.skill) {
    if (!commitSkill(state, player, prepared.skill, now, prepared.profile.mastery || 1)) return false;
  } else {
    const cooldown = Math.max(420, Math.floor(1000 / Math.max(0.5, player.as || 1)));
    if (now - (player.lastCombatAttack || 0) < cooldown) return false;
    player.lastCombatAttack = now;
    player.combatLockedUntil = now + COMBAT_RULES.attackRecovery * 1000;
    player.anim = 'attack';
    if (prepared.skillId === 'slash') gainServerSkillExperience(player, 'slash', 1);
    if (['thrust', 'fire_sword'].includes(prepared.skillId)) {
      player.activeBoost = null;
      gainServerSkillExperience(player, prepared.skillId, prepared.profile.mastery || 1);
      player.authorityVersion += 1;
    }
  }
  player.combatLockUntil = Math.max(player.combatLockUntil || 0, now + 3000);
  return true;
}

function damageWorldMonster(state, player, monster, prepared, now, multiplier = 1) {
  const definition = MONSTERS[monster.kind];
  const skillLevel = Math.max(1, player.skills?.[prepared.skillId]?.level || 1);
  const masteryPower = 1 + (skillLevel - 1) * 0.18;
  const defenseScale = prepared.profile.ignoreDefense || 1;
  const result = serverAttackDamage(player, {
    defense: (definition.def || 0) * defenseScale,
    magDef: (definition.magDef || 0) * defenseScale,
  }, {
    magical: !!prepared.profile.magical,
    multiplier: prepared.profile.multiplier * masteryPower * multiplier,
  });
  monster.hp = Math.max(0, monster.hp - result.damage);
  monster.targetId = player.id;
  monster.lastHit = now;
  monster.anim = 'hit';
  monster.combatVersion += 1;
  if (['pack', 'swarm'].includes(definition.behavior)) {
    for (const ally of state.monsters.values()) {
      if (!ally.alive || ally.id === monster.id || ally.mapId !== monster.mapId) continue;
      const allyDefinition = MONSTERS[ally.kind];
      if (allyDefinition.behavior !== definition.behavior
        || Math.hypot(ally.x - monster.x, ally.y - monster.y) > 190) continue;
      ally.targetId = player.id;
    }
  }
  if (prepared.skillId === 'poison') {
    monster.poison = {
      sourcePlayerId: player.id,
      dps: Math.max(2, Math.floor((player.mag * 0.42 + player.level * 0.7) * masteryPower)),
      expiresAt: now + (prepared.profile.poisonSeconds + skillLevel) * 1000,
      nextEventAt: now + 1000,
    };
  }
  if (prepared.skillId === 'rush') {
    monster.stunUntil = Math.max(monster.stunUntil || 0, now + (prepared.profile.stun + (skillLevel - 1) * 0.25) * 1000);
  }
  pushEvent(state, player.id, 'monster_hit', {
    monsterId: monster.id,
    kind: monster.kind,
    damage: result.damage,
    critical: result.critical,
    skillId: prepared.skillId,
  });
  if (monster.hp <= 0) defeatWorldMonster(state, player, monster, now);
  return result.damage;
}

function applyMonsterAttack(state, player, action, now) {
  const monster = state.monsters.get(action.targetId);
  if (!monster?.alive || monster.mapId !== player.mapId || player.hp <= 0) return false;
  refreshServerStats(player);
  const prepared = offensiveSkillProfile(player, action.skillId || 'basic', now);
  if (!prepared) return false;
  if (Math.hypot(player.x - monster.x, player.y - monster.y) > prepared.range + COMBAT_RULES.attackLeeway) return false;
  if (!commitOffensiveAttack(state, player, prepared, now)) return false;
  player.lastMonsterAttack = now;
  if (prepared.skillId === 'rush') {
    const distance = Math.max(0.001, Math.hypot(monster.x - player.x, monster.y - player.y));
    const travel = Math.max(
      0,
      Math.min(prepared.range - 12, distance - COMBAT_RULES.monsterBodyRadius - COMBAT_RULES.playerBodyRadius),
    );
    tryServerMove(
      state,
      player,
      player.x + (monster.x - player.x) / distance * travel,
      player.y + (monster.y - player.y) / distance * travel,
      COMBAT_RULES.playerBodyRadius,
    );
  }
  if (prepared.skillId === 'burst') {
    for (const candidate of state.monsters.values()) {
      if (!candidate.alive || candidate.mapId !== monster.mapId
        || Math.hypot(candidate.x - monster.x, candidate.y - monster.y) > prepared.profile.radius) continue;
      damageWorldMonster(state, player, candidate, prepared, now, candidate.id === monster.id ? 1 : 0.86);
    }
  } else {
    damageWorldMonster(state, player, monster, prepared, now);
    if (prepared.skillId === 'thrust') {
      const dx = monster.x - player.x;
      const dy = monster.y - player.y;
      const primaryDistance = Math.max(0.001, Math.hypot(dx, dy));
      const ux = dx / primaryDistance;
      const uy = dy / primaryDistance;
      let pierced = null;
      let piercedProjection = Number.POSITIVE_INFINITY;
      for (const candidate of state.monsters.values()) {
        if (!candidate.alive || candidate.id === monster.id || candidate.mapId !== monster.mapId) continue;
        const rx = candidate.x - player.x;
        const ry = candidate.y - player.y;
        const projection = rx * ux + ry * uy;
        const perpendicular = Math.abs(rx * uy - ry * ux);
        if (projection <= primaryDistance + 8 || projection > primaryDistance + 96 || perpendicular > 26) continue;
        if (projection < piercedProjection) {
          pierced = candidate;
          piercedProjection = projection;
        }
      }
      if (pierced) damageWorldMonster(state, player, pierced, prepared, now, 0.72);
    }
  }
  return true;
}

function applySkillCast(state, player, action, now) {
  const skill = playerSkillDefinition(player, action.skillId);
  if (!skill || !skillReady(player, skill, now)) return false;
  if (['missile', 'target', 'aoe', 'dash'].includes(skill.type)) {
    return applyMonsterAttack(state, player, action, now);
  }
  let supportTarget = player;
  if (skill.type === 'heal' && action.targetId) {
    supportTarget = findPlayer(state, action.targetId);
    const allied = supportTarget && (
      supportTarget.id === player.id
      || (player.teamId && supportTarget.teamId === player.teamId)
      || (player.guildId && supportTarget.guildId === player.guildId)
    );
    if (!allied || supportTarget.hp <= 0 || supportTarget.mapId !== player.mapId
      || Math.hypot(supportTarget.x - player.x, supportTarget.y - player.y) > 280) return false;
  }
  const mastery = SKILL_COMBAT[skill.id]?.mastery || 1;
  if (!commitSkill(state, player, skill, now, mastery)) return false;
  const level = Math.max(1, player.skills[skill.id]?.level || 1);
  if (skill.type === 'boost') {
    player.activeBoost = { id: skill.id, expiresAt: now + 12_000 };
  } else if (skill.type === 'heal') {
    const target = supportTarget;
    const amount = Math.floor((42 + player.mag * 2.2 + player.level * 3.2) * (1 + (level - 1) * 0.18));
    const applied = target.poison ? Math.max(1, Math.floor(amount * 0.5)) : amount;
    target.hp = Math.min(target.maxHp, target.hp + applied);
    target.authorityVersion += 1;
    pushEvent(state, target.id, 'skill_heal', {
      skillId: skill.id,
      amount: applied,
      casterId: player.id,
    });
    if (target.id !== player.id) {
      pushEvent(state, player.id, 'skill_heal_other', {
        skillId: skill.id,
        amount: applied,
        targetId: target.id,
        targetName: target.name,
      });
    }
  } else if (skill.type === 'buff') {
    player.shieldUntil = now + (7 + level * 2) * 1000;
  } else if (skill.type === 'summon') {
    const maxHp = Math.floor(70 + player.level * 10 + level * 35);
    player.pet = {
      id: `pet:${player.id}`,
      kind: 'skeleton',
      name: `${player.name}的骷髅`,
      mapId: player.mapId,
      x: player.x + 34,
      y: player.y + 18,
      hp: maxHp,
      maxHp,
      atk: Math.floor(8 + player.level * 1.2 + level * 6),
      r: 15,
      direction: player.direction,
      facing: player.facing === -1 ? -1 : 1,
      anim: 'idle',
      targetId: null,
      lastAttack: 0,
      expiresAt: now + (60 + level * 45) * 1000,
    };
  } else {
    return false;
  }
  player.authorityVersion += 1;
  pushEvent(state, player.id, 'skill_cast', { skillId: skill.id, level });
  return true;
}

function applyPvpAttack(state, attacker, action, now) {
  const target = findPlayer(state, action.targetId);
  if (!target || target.id === attacker.id || !target.hp || attacker.mapId !== target.mapId || MAPS[attacker.mapId]?.safe) return false;
  refreshServerStats(attacker);
  refreshServerStats(target);
  const prepared = offensiveSkillProfile(attacker, action.skillId || 'basic', now);
  if (!prepared || Math.hypot(attacker.x - target.x, attacker.y - target.y) > prepared.range + COMBAT_RULES.attackLeeway) return false;
  const war = guildWarBetween(state, attacker.guildId, target.guildId, now);
  const justified = !!war || sabacCombat(state, attacker, target) || target.pkPoints >= 100 || target.crimeT > 0;
  if (!justified) {
    if (attacker.pkMode === 'peace') return false;
    if (attacker.pkMode === 'team' && attacker.teamId && attacker.teamId === target.teamId) return false;
    if (attacker.pkMode === 'guild' && attacker.guildId && attacker.guildId === target.guildId) return false;
    attacker.crimeT = Math.max(attacker.crimeT, 60);
  }
  if (!commitOffensiveAttack(state, attacker, prepared, now)) return false;
  if (Math.random() < (target.dodge || 0)) {
    attacker.lastPvpAttack = now;
    pushEvent(state, attacker.id, 'pvp_miss', { targetId: target.id, skillId: prepared.skillId });
    return true;
  }
  const result = serverAttackDamage(attacker, target, {
    magical: !!prepared.profile.magical,
    multiplier: prepared.profile.multiplier
      * (1 + (Math.max(1, attacker.skills?.[prepared.skillId]?.level || 1) - 1) * 0.18),
  });
  const shieldedDamage = now < (target.shieldUntil || 0)
    ? Math.max(1, Math.floor(result.damage * 0.48))
    : result.damage;
  target.hp = Math.max(0, target.hp - shieldedDamage);
  if (prepared.skillId === 'poison') {
    target.poison = {
      sourcePlayerId: attacker.id,
      dps: Math.max(2, Math.floor(attacker.mag * 0.35 + attacker.level * 0.5)),
      expiresAt: now + 9_000,
      nextEventAt: now + 1000,
    };
  }
  if (prepared.skillId === 'rush') {
    target.combatLockedUntil = Math.max(target.combatLockedUntil || 0, now + 900);
    const distance = Math.max(0.001, Math.hypot(target.x - attacker.x, target.y - attacker.y));
    const travel = Math.max(0, Math.min(prepared.range - 12, distance - COMBAT_RULES.playerBodyRadius * 2));
    tryServerMove(
      state,
      attacker,
      attacker.x + (target.x - attacker.x) / distance * travel,
      attacker.y + (target.y - attacker.y) / distance * travel,
      COMBAT_RULES.playerBodyRadius,
    );
  }
  if (attacker.lifesteal > 0) {
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.floor(shieldedDamage * attacker.lifesteal));
  }
  target.combatVersion += 1;
  target.authorityVersion += 1;
  target.combatLockUntil = now + 5000;
  attacker.combatLockUntil = Math.max(attacker.combatLockUntil || 0, now + 5000);
  attacker.lastPvpAttack = now;
  pushEvent(state, target.id, 'pvp_damage', {
    attackerId: attacker.id,
    attackerName: attacker.name,
    attackerClassId: attacker.classId,
    damage: shieldedDamage,
    critical: !!result.critical,
    highRoll: !!result.highRoll,
    skillId: prepared.skillId,
    magical: !!prepared.profile.magical,
    damageType: prepared.profile.magical ? 'magical' : 'physical',
    shielded: shieldedDamage < result.damage,
    remainingHp: target.hp,
    defeated: target.hp <= 0,
  });
  pushEvent(state, attacker.id, 'pvp_hit', {
    targetId: target.id,
    targetName: target.name,
    targetClassId: target.classId,
    damage: shieldedDamage,
    critical: !!result.critical,
    highRoll: !!result.highRoll,
    skillId: prepared.skillId,
    magical: !!prepared.profile.magical,
    damageType: prepared.profile.magical ? 'magical' : 'physical',
    shielded: shieldedDamage < result.damage,
    remainingHp: target.hp,
    defeated: target.hp <= 0,
  });
  if (target.hp <= 0) {
    attacker.playerKills += 1;
    target.deaths += 1;
    if (!justified) {
      attacker.pkPoints += 100;
      attacker.crimeT = Math.max(attacker.crimeT || 0, 60);
      attacker.authorityVersion += 1;
    }
    if (war) {
      if (attacker.guildId === war.guildA) war.scoreA += 1;
      if (attacker.guildId === war.guildB) war.scoreB += 1;
    }
    const siege = state.sabac.war;
    if (siege?.status === 'active' && attacker.mapId === 'sabac') {
      if (attacker.guildId === siege.attackerGuildId) siege.attackerKills += 1;
      if (attacker.guildId === siege.defenderGuildId) siege.defenderKills += 1;
    }
    const loss = dropDefeatedPlayerLoot(state, target, now);
    pushEvent(state, attacker.id, 'pvp_kill', {
      target: publicPlayer(target), justified, damage: shieldedDamage, critical: result.critical, skillId: prepared.skillId,
    });
    pushEvent(state, target.id, 'pvp_death', {
      killer: publicPlayer(attacker),
      justified,
      lostItems: loss.drops.filter((drop) => drop.entry).map((drop) => drop.entry),
      lostGold: loss.gold,
      lostExperience: loss.experience,
    });
    const start = MAPS.bich.playerStart;
    target.mapId = 'bich';
    target.x = start.x * T;
    target.y = start.y * T;
    target.hp = Math.max(1, Math.floor(target.maxHp * 0.55));
    target.mp = Math.max(0, Math.floor(target.maxMp * 0.55));
    target.combatVersion += 1;
    target.authorityVersion += 1;
  }
  return true;
}

function applyBossDamage(state, player, action, now) {
  const boss = state.bosses.get(action.bossId);
  if (!boss?.alive || player.mapId !== boss.mapId || player.hp <= 0) return false;
  refreshServerStats(player);
  const prepared = offensiveSkillProfile(player, action.skillId || 'basic', now);
  if (!prepared || Math.hypot(player.x - boss.x, player.y - boss.y) > prepared.range + 32) return false;
  if (!commitOffensiveAttack(state, player, prepared, now)) return false;
  const definition = MONSTERS[action.bossId];
  const { damage } = serverAttackDamage(player, {
    defense: definition?.def || 0,
    magDef: definition?.magDef || 0,
  }, {
    magical: !!prepared.profile.magical,
    multiplier: prepared.profile.multiplier
      * (1 + (Math.max(1, player.skills?.[prepared.skillId]?.level || 1) - 1) * 0.18),
  });
  boss.hp = Math.max(0, boss.hp - damage);
  boss.anim = 'hit';
  boss.combatVersion = (boss.combatVersion || 0) + 1;
  boss.contributions.set(player.id, (boss.contributions.get(player.id) || 0) + damage);
  player.lastBossAttack = now;
  if (boss.hp <= 0) {
    boss.alive = false;
    boss.anim = 'death';
    boss.targetId = null;
    boss.respawnAt = now + 30 * 60_000;
    const ranking = [...boss.contributions.entries()].sort((a, b) => b[1] - a[1]);
    const ownerId = ranking[0]?.[0] || null;
    const topContributor = state.players.get(ownerId);
    const ownerIds = topContributor
      ? nearbyTeamMembers(state, topContributor, 720).map((member) => member.id)
      : ownerId ? [ownerId] : [];
    const dropSource = { mapId: boss.mapId, x: boss.x, y: boss.y };
    let dropOffset = 0;
    const gold = definition?.gold
      ? Math.floor(definition.gold[0] + Math.random() * (definition.gold[1] - definition.gold[0] + 1))
      : 0;
    if (gold > 0) {
      createGroundDrop(state, dropSource, {
        gold,
        ownerIds,
        protectedUntil: now + 8_000,
        ttlMs: 180_000,
        source: boss.id,
      }, now, dropOffset++);
    }
    for (const configured of definition?.drops || []) {
      if (Math.random() >= configured.rate) continue;
      createGroundDrop(state, dropSource, {
        entry: createServerDropItem(configured.id, {
          elite: true,
          boss: true,
        }),
        ownerIds,
        protectedUntil: now + 8_000,
        ttlMs: 180_000,
        source: boss.id,
      }, now, dropOffset++);
    }
    ranking.forEach(([playerId, contribution], index) => {
      const contributor = state.players.get(playerId);
      if (!contributor) return;
      recordMonsterKill(contributor, boss.id);
      const xp = Math.max(1, Math.floor((definition?.xp || 1) * (index === 0 ? 1 : index < 3 ? 0.7 : 0.45)));
      const levels = addServerExperience(contributor, xp);
      pushEvent(state, playerId, 'boss_reward', {
        bossName: boss.name,
        rank: index + 1,
        contribution,
        xp,
        levels,
        groundDrops: dropOffset,
        ownerId,
        ownerIds,
      });
    });
  } else {
    pushEvent(state, player.id, 'boss_hit', {
      bossId: boss.id,
      damage,
      skillId: prepared.skillId,
    });
  }
  return true;
}

function defeatPlayerByMonster(state, player, monster, now) {
  player.deaths += 1;
  const loss = dropDefeatedPlayerLoot(state, player, now);
  const start = MAPS.bich.playerStart;
  player.mapId = 'bich';
  player.x = start.x * T;
  player.y = start.y * T;
  player.hp = Math.max(1, Math.floor(player.maxHp * 0.55));
  player.mp = Math.max(0, Math.floor(player.maxMp * 0.55));
  player.combatVersion += 1;
  player.authorityVersion += 1;
  pushEvent(state, player.id, 'pve_death', {
    monsterId: monster.id,
    kind: monster.kind,
    monsterName: MONSTERS[monster.kind]?.name,
    lostItems: loss.drops.filter((drop) => drop.entry).map((drop) => drop.entry),
    lostGold: loss.gold,
    lostExperience: loss.experience,
  });
}

function damagePlayerFromMonster(state, monster, target, now, {
  multiplier = 1,
  magical = false,
  special = null,
  allowEffect = true,
} = {}) {
  const definition = MONSTERS[monster.kind] || MONSTERS.lord;
  refreshServerStats(target);
  const result = serverAttackDamage({
    atk: definition.atk,
    mag: definition.mag || definition.atk,
    crit: definition.elite ? 0.06 : 0.02,
  }, target, { magical, multiplier });
  const damage = now < (target.shieldUntil || 0)
    ? Math.max(1, Math.floor(result.damage * 0.48))
    : result.damage;
  target.hp = Math.max(0, target.hp - damage);
  target.combatVersion += 1;
  target.authorityVersion += 1;
  target.combatLockUntil = Math.max(target.combatLockUntil || 0, now + 3000);
  if (allowEffect && definition.behavior === 'venom' && Math.random() < 0.36) {
    target.monsterPoison = {
      monsterId: monster.id,
      dps: Math.max(2, Math.floor(definition.atk * 0.18)),
      expiresAt: now + 6_000,
      nextEventAt: now + 1000,
    };
  }
  pushEvent(state, target.id, special === 'charge' ? 'monster_charge' : 'monster_damage', {
    monsterId: monster.id,
    kind: monster.kind,
    damage,
    critical: result.critical,
    magical,
    special,
  });
  if (target.hp <= 0) defeatPlayerByMonster(state, target, monster, now);
  return damage;
}

function advanceWorldMonsters(state, now, dt) {
  let changed = false;
  for (const monster of state.monsters.values()) {
    const definition = MONSTERS[monster.kind];
    if (!monster.alive) {
      if (!monster.respawnAt || now < monster.respawnAt) continue;
      monster.alive = true;
      monster.hp = monster.maxHp;
      monster.x = monster.homeX;
      monster.y = monster.homeY;
      monster.targetId = null;
      monster.respawnAt = 0;
      monster.anim = 'idle';
      monster.combatVersion += 1;
      changed = true;
      continue;
    }
    if (monster.poison) {
      if (now >= monster.poison.expiresAt) {
        monster.poison = null;
      } else {
        const source = state.players.get(monster.poison.sourcePlayerId);
        if (source && source.mapId === monster.mapId && source.hp > 0) {
          const poisonDamage = Math.max(0, monster.poison.dps * dt);
          monster.hp = Math.max(0, monster.hp - poisonDamage);
          monster.combatVersion += 1;
          if (now >= (monster.poison.nextEventAt || 0)) {
            monster.poison.nextEventAt = now + 1000;
            pushEvent(state, source.id, 'poison_tick', {
              monsterId: monster.id,
              kind: monster.kind,
              damage: Math.max(1, Math.floor(monster.poison.dps)),
            });
          }
          if (monster.hp <= 0) {
            defeatWorldMonster(state, source, monster, now);
            changed = true;
            continue;
          }
        }
      }
    }
    if (now < (monster.stunUntil || 0)) {
      monster.anim = 'idle';
      changed = true;
      continue;
    }
    let target = state.players.get(monster.targetId);
    const validTarget = target && target.online !== false && target.hp > 0 && target.mapId === monster.mapId
      && Math.hypot(target.x - monster.homeX, target.y - monster.homeY) <= 520;
    if (!validTarget) {
      target = null;
      if (definition.behavior === 'passive') {
        monster.targetId = null;
      } else {
      let nearestDistance = definition.aggro || 180;
      for (const candidate of state.players.values()) {
        if (candidate.online === false || candidate.hp <= 0 || candidate.mapId !== monster.mapId) continue;
        const distance = Math.hypot(candidate.x - monster.x, candidate.y - monster.y);
        if (distance >= nearestDistance) continue;
        target = candidate;
        nearestDistance = distance;
      }
      monster.targetId = target?.id || null;
      }
    }
    if (!target) {
      const homeDistance = Math.hypot(monster.homeX - monster.x, monster.homeY - monster.y);
      if (homeDistance <= 3) {
        if (monster.anim !== 'idle') {
          monster.anim = 'idle';
          changed = true;
        }
        continue;
      }
      const step = Math.min(homeDistance, definition.ms * dt);
      const nextX = monster.x + (monster.homeX - monster.x) / homeDistance * step;
      const nextY = monster.y + (monster.homeY - monster.y) / homeDistance * step;
      tryServerMove(state, monster, nextX, nextY, COMBAT_RULES.monsterBodyRadius);
      monster.anim = 'walk';
      changed = true;
      continue;
    }
    const dx = target.x - monster.x;
    const dy = target.y - monster.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    monster.direction = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'][
      (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
    ];
    if (definition.behavior === 'charger'
      && distance > definition.range + 24
      && distance <= 230
      && now - (monster.lastSpecial || 0) >= 5_500) {
      monster.lastSpecial = now;
      monster.anim = 'attack';
      const travel = Math.max(0, distance - COMBAT_RULES.playerBodyRadius - COMBAT_RULES.monsterBodyRadius);
      tryServerMove(
        state,
        monster,
        monster.x + dx / distance * travel,
        monster.y + dy / distance * travel,
        COMBAT_RULES.monsterBodyRadius,
      );
      damagePlayerFromMonster(state, monster, target, now, { multiplier: 1.45, special: 'charge' });
      changed = true;
      continue;
    }
    if (distance <= definition.range + 20) {
      monster.anim = 'attack';
      const cooldown = definition.behavior === 'ranged_caster' ? 1450 : definition.elite ? 950 : 1100;
      if (now - (monster.lastAttack || 0) < cooldown) continue;
      monster.lastAttack = now;
      damagePlayerFromMonster(state, monster, target, now, {
        magical: definition.behavior === 'ranged_caster',
      });
      if (definition.behavior === 'cleave') {
        for (const nearby of state.players.values()) {
          if (nearby.id === target.id || nearby.online === false || nearby.hp <= 0
            || nearby.mapId !== monster.mapId || Math.hypot(nearby.x - monster.x, nearby.y - monster.y) > 86) continue;
          damagePlayerFromMonster(state, monster, nearby, now, {
            multiplier: 0.58,
            allowEffect: false,
          });
        }
      }
      changed = true;
      continue;
    }
    const step = Math.min(distance, definition.ms * dt);
    const nextX = monster.x + dx / distance * step;
    const nextY = monster.y + dy / distance * step;
    tryServerMove(state, monster, nextX, nextY, COMBAT_RULES.monsterBodyRadius);
    monster.anim = 'walk';
    changed = true;
  }
  return changed;
}

function advanceWorldBosses(state, now, dt) {
  let changed = false;
  for (const boss of state.bosses.values()) {
    const definition = MONSTERS[boss.kind || boss.id];
    if (!boss.alive) {
      if (!boss.respawnAt || now < boss.respawnAt) continue;
      boss.alive = true;
      boss.hp = boss.maxHp;
      boss.x = boss.homeX;
      boss.y = boss.homeY;
      boss.targetId = null;
      boss.respawnAt = 0;
      boss.anim = 'idle';
      boss.combatVersion += 1;
      boss.contributions.clear();
      changed = true;
      continue;
    }
    let target = state.players.get(boss.targetId);
    if (!target || target.online === false || target.hp <= 0 || target.mapId !== boss.mapId
      || Math.hypot(target.x - boss.homeX, target.y - boss.homeY) > 620) {
      target = null;
      let nearest = definition.aggro || 420;
      for (const candidate of state.players.values()) {
        if (candidate.online === false || candidate.hp <= 0 || candidate.mapId !== boss.mapId) continue;
        const distance = Math.hypot(candidate.x - boss.x, candidate.y - boss.y);
        if (distance >= nearest) continue;
        target = candidate;
        nearest = distance;
      }
      boss.targetId = target?.id || null;
    }
    if (!target) {
      const distance = Math.hypot(boss.homeX - boss.x, boss.homeY - boss.y);
      if (distance <= 3) {
        boss.anim = 'idle';
        continue;
      }
      const step = Math.min(distance, definition.ms * dt);
      tryServerMove(
        state,
        boss,
        boss.x + (boss.homeX - boss.x) / distance * step,
        boss.y + (boss.homeY - boss.y) / distance * step,
        24,
      );
      boss.anim = 'walk';
      changed = true;
      continue;
    }
    const dx = target.x - boss.x;
    const dy = target.y - boss.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    boss.direction = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'][
      (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
    ];
    if (now - (boss.lastSpecial || 0) >= 6_500 && distance <= 190) {
      boss.lastSpecial = now;
      boss.anim = 'attack';
      for (const nearby of state.players.values()) {
        if (nearby.online === false || nearby.hp <= 0 || nearby.mapId !== boss.mapId
          || Math.hypot(nearby.x - boss.x, nearby.y - boss.y) > 155) continue;
        damagePlayerFromMonster(state, boss, nearby, now, {
          multiplier: 1.18,
          magical: true,
          special: 'boss_nova',
          allowEffect: false,
        });
      }
      changed = true;
      continue;
    }
    if (distance <= definition.range + 28) {
      boss.anim = 'attack';
      if (now - (boss.lastAttack || 0) < 900) continue;
      boss.lastAttack = now;
      damagePlayerFromMonster(state, boss, target, now, {
        multiplier: boss.hp / boss.maxHp < 0.35 ? 1.32 : 1,
        magical: boss.hp / boss.maxHp < 0.6,
        allowEffect: false,
      });
      changed = true;
      continue;
    }
    const step = Math.min(distance, definition.ms * dt);
    tryServerMove(
      state,
      boss,
      boss.x + dx / distance * step,
      boss.y + dy / distance * step,
      24,
    );
    boss.anim = 'walk';
    changed = true;
  }
  return changed;
}

function advanceServerPets(state, now, dt) {
  let changed = false;
  for (const owner of state.players.values()) {
    const pet = owner.pet;
    if (!pet) continue;
    if (pet.hp <= 0 || now >= pet.expiresAt || owner.hp <= 0) {
      owner.pet = null;
      owner.authorityVersion += 1;
      changed = true;
      continue;
    }
    if (pet.mapId !== owner.mapId) {
      pet.mapId = owner.mapId;
      pet.x = owner.x + 28;
      pet.y = owner.y + 18;
      pet.targetId = null;
      changed = true;
    }
    let target = state.monsters.get(pet.targetId);
    if (!target?.alive || target.mapId !== pet.mapId || Math.hypot(target.x - pet.x, target.y - pet.y) > 360) {
      target = null;
      let nearest = 260;
      for (const candidate of state.monsters.values()) {
        if (!candidate.alive || candidate.mapId !== pet.mapId) continue;
        const distance = Math.hypot(candidate.x - pet.x, candidate.y - pet.y);
        if (distance >= nearest) continue;
        target = candidate;
        nearest = distance;
      }
      pet.targetId = target?.id || null;
    }
    const followTarget = target || owner;
    const dx = followTarget.x - pet.x;
    const dy = followTarget.y - pet.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    pet.direction = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'][
      (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
    ];
    if (target && distance <= 58 + COMBAT_RULES.monsterBodyRadius) {
      pet.anim = 'attack';
      if (now - (pet.lastAttack || 0) >= 950) {
        pet.lastAttack = now;
        const definition = MONSTERS[target.kind];
        const result = serverAttackDamage({ atk: pet.atk, crit: 0.04 }, {
          defense: definition.def || 0,
          magDef: definition.magDef || 0,
        });
        target.hp = Math.max(0, target.hp - result.damage);
        target.targetId = owner.id;
        target.combatVersion += 1;
        pushEvent(state, owner.id, 'pet_hit', {
          petId: pet.id,
          monsterId: target.id,
          kind: target.kind,
          damage: result.damage,
          critical: result.critical,
        });
        if (target.hp <= 0) defeatWorldMonster(state, owner, target, now);
        changed = true;
      }
      continue;
    }
    if (!target && distance <= 68) {
      pet.anim = 'idle';
      continue;
    }
    const speed = 138;
    const step = Math.min(distance, speed * dt);
    tryServerMove(
      state,
      pet,
      pet.x + dx / distance * step,
      pet.y + dy / distance * step,
      pet.r || 15,
    );
    pet.anim = 'walk';
    changed = true;
  }
  return changed;
}

function advancePlayerStatuses(state, now, dt) {
  let changed = false;
  for (const player of state.players.values()) {
    if (player.hp <= 0) continue;
    if (player.monsterPoison) {
      const monster = state.monsters.get(player.monsterPoison.monsterId);
      if (now >= player.monsterPoison.expiresAt || !monster?.alive || monster.mapId !== player.mapId) {
        player.monsterPoison = null;
        player.authorityVersion += 1;
        changed = true;
      } else {
        const damage = Math.max(0, player.monsterPoison.dps * dt);
        player.hp = Math.max(0, player.hp - damage);
        player.combatVersion += 1;
        player.authorityVersion += 1;
        if (now >= (player.monsterPoison.nextEventAt || 0)) {
          player.monsterPoison.nextEventAt = now + 1000;
          pushEvent(state, player.id, 'monster_poison_damage', {
            monsterId: monster.id,
            kind: monster.kind,
            damage: Math.max(1, Math.floor(player.monsterPoison.dps)),
          });
        }
        if (player.hp <= 0) {
          player.monsterPoison = null;
          defeatPlayerByMonster(state, player, monster, now);
          changed = true;
          continue;
        }
        changed = true;
      }
    }
    if (!player.poison) continue;
    if (now >= player.poison.expiresAt) {
      player.poison = null;
      player.authorityVersion += 1;
      changed = true;
      continue;
    }
    const source = state.players.get(player.poison.sourcePlayerId);
    if (!source || source.mapId !== player.mapId || source.hp <= 0) continue;
    const damage = Math.max(0, player.poison.dps * dt);
    player.hp = Math.max(0, player.hp - damage);
    player.combatVersion += 1;
    player.authorityVersion += 1;
    if (now >= (player.poison.nextEventAt || 0)) {
      player.poison.nextEventAt = now + 1000;
      pushEvent(state, player.id, 'poison_damage', {
        sourceId: source.id,
        damage: Math.max(1, Math.floor(player.poison.dps)),
      });
    }
    if (player.hp <= 0) {
      source.playerKills += 1;
      player.deaths += 1;
      const loss = dropDefeatedPlayerLoot(state, player, now);
      pushEvent(state, source.id, 'pvp_kill', {
        target: publicPlayer(player),
        justified: player.pkPoints >= 100 || player.crimeT > 0,
        damage: Math.max(1, Math.floor(player.poison.dps)),
        skillId: 'poison',
      });
      pushEvent(state, player.id, 'pvp_death', {
        killer: publicPlayer(source),
        lostItems: loss.drops.filter((drop) => drop.entry).map((drop) => drop.entry),
        lostGold: loss.gold,
        lostExperience: loss.experience,
      });
      const start = MAPS.bich.playerStart;
      player.mapId = 'bich';
      player.x = start.x * T;
      player.y = start.y * T;
      player.hp = Math.max(1, Math.floor(player.maxHp * 0.55));
      player.mp = Math.max(0, Math.floor(player.maxMp * 0.55));
      player.poison = null;
    }
    changed = true;
  }
  return changed;
}

export function advanceWorldSystems(state, now = Date.now(), dt = 0.1) {
  let changed = false;
  for (const [dropId, drop] of state.drops) {
    if (drop.expiresAt > now) continue;
    state.drops.delete(dropId);
    changed = true;
  }
  const statusesChanged = advancePlayerStatuses(state, now, dt);
  const petsChanged = advanceServerPets(state, now, dt);
  const monstersChanged = advanceWorldMonsters(state, now, dt);
  const bossesChanged = advanceWorldBosses(state, now, dt);
  changed ||= statusesChanged;
  changed ||= petsChanged;
  changed ||= monstersChanged;
  changed ||= bossesChanged;
  for (const player of state.players.values()) {
    const achievementChanged = unlockServerAchievements(state, player);
    changed ||= achievementChanged;
  }
  for (const war of state.guildWars.values()) {
    if (war.status === 'active' && now >= war.endsAt) {
      war.status = 'ended';
      war.winnerGuildId = war.scoreA === war.scoreB ? null : war.scoreA > war.scoreB ? war.guildA : war.guildB;
      for (const guildId of [war.guildA, war.guildB]) {
        const guild = state.guilds.get(guildId);
        for (const memberId of guild?.members || []) {
          const member = state.players.get(memberId);
          const won = guildId === war.winnerGuildId;
          if (member && won) {
            member.gold = Math.min(1_000_000_000, member.gold + 300);
            member.authorityVersion += 1;
          }
          pushEvent(state, memberId, 'guild_war_ended', {
            winnerGuildId: war.winnerGuildId,
            scoreA: war.scoreA,
            scoreB: war.scoreB,
            reward: won ? 300 : 0,
          });
        }
      }
      changed = true;
    }
  }
  const war = state.sabac.war;
  if (!war || war.status !== 'active') {
    if (changed) state.sequence += 1;
    return changed;
  }
  if (now >= war.endsAt) {
    war.status = 'ended';
    war.phase = 'ended';
    state.sabac.history.push({ ...war, ownerGuildId: state.sabac.ownerGuildId });
    for (const guildId of [war.attackerGuildId, war.defenderGuildId]) {
      const guild = state.guilds.get(guildId);
      for (const memberId of guild?.members || []) {
        pushEvent(state, memberId, 'sabac_ended', {
          ownerGuildId: state.sabac.ownerGuildId,
          ownerGuildName: state.guilds.get(state.sabac.ownerGuildId)?.name || '无主',
        });
      }
    }
    state.sequence += 1;
    return true;
  }
  if (war.phase === 'gate') {
    if (changed) state.sequence += 1;
    return changed;
  }
  const zone = MAPS.sabac.captureZone;
  let attackers = 0;
  let defenders = 0;
  for (const player of state.players.values()) {
    if (player.mapId !== 'sabac' || !player.guildId || player.hp <= 0) continue;
    if (![war.attackerGuildId, war.defenderGuildId].includes(player.guildId)) continue;
    if (Math.hypot(player.x - zone.x * T, player.y - zone.y * T) > zone.r * T) continue;
    if (player.guildId === war.attackerGuildId) attackers += 1;
    if (player.guildId === war.defenderGuildId) defenders += 1;
  }
  if (!attackers || defenders >= attackers) {
    const progress = Math.max(0, war.captureProgress - dt * (defenders ? 3 : 1.25));
    changed ||= progress !== war.captureProgress;
    war.captureProgress = progress;
    war.captureGuildId = progress > 0 ? war.attackerGuildId : null;
    if (changed) state.sequence += 1;
    return changed;
  }
  war.captureGuildId = war.attackerGuildId;
  const advantage = Math.max(1, attackers - defenders);
  const progress = Math.min(100, war.captureProgress + dt * (1.7 + Math.min(2, advantage - 1) * 0.35));
  changed ||= progress !== war.captureProgress;
  war.captureProgress = progress;
  if (war.captureProgress >= 100) {
    const guildId = war.attackerGuildId;
    state.sabac.ownerGuildId = guildId;
    war.status = 'captured';
    war.phase = 'captured';
    war.capturedAt = now;
    state.sabac.history.push({ ...war, ownerGuildId: guildId });
    const guild = state.guilds.get(guildId);
    for (const memberId of guild?.members || []) {
      const member = state.players.get(memberId);
      if (member) {
        member.gold = Math.min(1_000_000_000, member.gold + 1500);
        member.sabacWins = (member.sabacWins || 0) + 1;
        member.authorityVersion += 1;
      }
      pushEvent(state, memberId, 'sabac_captured', { guildName: guild.name, reward: 1500 });
    }
    changed = true;
  }
  if (changed) state.sequence += 1;
  return changed;
}

export function applyPlayerAction(state, token, action = {}, now = Date.now()) {
  const playerId = state.tokens.get(token);
  const player = state.players.get(playerId);
  if (!player) return { ok: false, status: 401, reason: 'session' };
  const actionId = String(action.actionId || '').slice(0, 128);
  if (actionId && player.processedActions?.has(actionId)) {
    return player.processedActions.get(actionId);
  }
  const remember = (result) => {
    if (!actionId) return result;
    player.processedActions ??= new Map();
    player.processedActions.set(actionId, result);
    if (player.processedActions.size > 200) {
      const oldest = player.processedActions.keys().next().value;
      player.processedActions.delete(oldest);
    }
    return result;
  };
  const sequencedChannel = ['move', 'state', 'inventory'].includes(action.type) ? action.type : null;
  const clientSeq = Math.floor(Number(action.clientSeq));
  if (sequencedChannel && Number.isFinite(clientSeq)) {
    player.lastActionSeq ??= Object.create(null);
    if (clientSeq <= (player.lastActionSeq[sequencedChannel] || 0)) {
      return remember({
        ok: true,
        status: 200,
        stale: true,
        player: publicPlayer(player),
      });
    }
    player.lastActionSeq[sequencedChannel] = clientSeq;
  }
  const wasOffline = player.online === false;
  player.lastSeen = now;
  player.online = true;
  player.disconnectedAt = 0;
  if (action.type === 'move') {
    if (action.mapId && action.mapId !== player.mapId) {
      return remember({ ok: false, status: 409, reason: 'map' });
    }
    movePlayer(state, player, action, now);
  } else if (action.type === 'map') {
    if (!changeMap(player, action)) return remember({ ok: false, status: 409, reason: 'portal' });
  } else if (action.type === 'state') {
    if (['peace', 'team', 'guild', 'all'].includes(action.pkMode)) player.pkMode = action.pkMode;
    if (['idle', 'walk', 'run', 'attack', 'death'].includes(action.anim)) player.anim = action.anim;
  } else if ([
    'chat', 'friend_request', 'friend_accept', 'friend_remove',
    'team_invite', 'team_accept', 'team_leave', 'team_kick', 'team_promote',
    'guild_create', 'guild_invite', 'guild_accept', 'guild_leave', 'guild_kick', 'guild_promote',
    'inventory', 'trade_request', 'trade_accept', 'trade_offer', 'trade_confirm', 'trade_cancel',
  ].includes(action.type)) {
    if (!applySocialAction(state, player, action, now)) {
      return remember({ ok: false, status: 409, reason: action.type });
    }
  } else if ([
    'use_item', 'unequip', 'buy_item', 'sell_item', 'repair_all',
    'enhance_slot', 'craft_recipe', 'heal_full', 'claim_achievement',
  ].includes(action.type)) {
    if (!applyInventoryCommand(state, player, action, now)) {
      return remember({ ok: false, status: 409, reason: action.type });
    }
  } else if (action.type === 'quest_interact') {
    if (!interactQuest(state, player, action)) {
      return remember({ ok: false, status: 409, reason: action.type });
    }
  } else if (action.type === 'guild_war_declare') {
    if (!declareGuildWar(state, player, action, now)) {
      return remember({ ok: false, status: 409, reason: action.type });
    }
  } else if (action.type === 'sabac_declare') {
    if (!declareSabacWar(state, player, now)) {
      return remember({ ok: false, status: 409, reason: action.type });
    }
  } else if (action.type === 'sabac_objective_attack') {
    if (!applySabacObjectiveAttack(state, player, action, now)) {
      return remember({ ok: false, status: 409, reason: action.type });
    }
  } else if (action.type === 'pvp_attack') {
    if (!applyPvpAttack(state, player, action, now)) {
      return remember({ ok: false, status: 409, reason: action.type });
    }
  } else if (action.type === 'monster_attack') {
    if (!applyMonsterAttack(state, player, action, now)) {
      return remember({ ok: false, status: 409, reason: action.type });
    }
  } else if (action.type === 'skill_cast') {
    if (!applySkillCast(state, player, action, now)) {
      return remember({ ok: false, status: 409, reason: action.type });
    }
  } else if (action.type === 'boss_damage') {
    if (!applyBossDamage(state, player, action, now)) {
      return remember({ ok: false, status: 409, reason: action.type });
    }
  } else if (action.type === 'pickup_drop') {
    if (!pickupGroundDrop(state, player, action, now)) {
      return remember({ ok: false, status: 409, reason: action.type });
    }
  } else if (action.type === 'disconnect') {
    player.online = false;
    player.disconnectedAt = now;
    const stream = state.streams.get(token);
    stream?.response?.end();
    stream?.end?.();
    state.streams.delete(token);
  } else if (action.type !== 'heartbeat') {
    return remember({ ok: false, status: 400, reason: 'action' });
  }
  unlockServerAchievements(state, player);
  if (action.type !== 'heartbeat' || wasOffline) state.sequence += 1;
  const result = { ok: true, status: 200, player: publicPlayer(player) };
  if (action.type === 'chat') result.message = state.messages.at(-1) || null;
  return remember(result);
}

export function markInactivePlayers(state, now = Date.now(), timeoutMs = ONLINE_TIMEOUT_MS) {
  let marked = 0;
  for (const player of state.players.values()) {
    if (player.online === false || now - player.lastSeen <= timeoutMs) continue;
    player.online = false;
    player.disconnectedAt = now;
    marked += 1;
  }
  if (marked) state.sequence += 1;
  return marked;
}

export function removeStalePlayers(state, now = Date.now(), timeoutMs = SESSION_RETENTION_MS) {
  let removed = 0;
  for (const [id, player] of state.players) {
    if (now - player.lastSeen <= timeoutMs) continue;
    state.players.delete(id);
    state.tokens.delete(player.token);
    state.resumeTokens.delete(player.resumeToken);
    state.characters.delete(player.characterId);
    leaveTeam(state, player);
    leaveGuild(state, player);
    for (const other of state.players.values()) {
      other.friends.delete(id);
      other.friendRequests.delete(id);
      other.teamInvites.delete(id);
    }
    const trade = activeTradeFor(state, id);
    if (trade) {
      trade.status = 'cancelled';
      for (const memberId of trade.members) {
        if (memberId !== id) pushEvent(state, memberId, 'trade_cancelled', { tradeId: trade.id });
      }
    }
    const stream = state.streams.get(player.token);
    stream?.response?.end();
    stream?.end?.();
    state.streams.delete(player.token);
    removed += 1;
  }
  if (removed) state.sequence += 1;
  return removed;
}

async function readJson(request, limit = 32_768) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > limit) throw new Error('payload');
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

export function createLocalServer({
  root = (() => {
    const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    return existsSync(resolve(moduleRoot, 'index.html')) ? moduleRoot : resolve(moduleRoot, 'client');
  })(),
  state = createWorldState(),
} = {}) {
  const streams = state.streams;
  const networkMetrics = {
    frames: 0,
    fullFrames: 0,
    deltaFrames: 0,
    skippedFrames: 0,
    bytes: 0,
  };
  const closeStream = (token, stream = streams.get(token)) => {
    if (!stream) return;
    if (streams.get(token) === stream) streams.delete(token);
    try {
      stream.response?.end();
      stream.end?.();
    } catch {
      // The socket is already gone.
    }
  };
  const writeSnapshot = (token, stream, now, force = false) => {
    if (!stream || stream.blocked || stream.response.destroyed || stream.response.writableEnded) {
      if (stream?.response?.destroyed || stream?.response?.writableEnded) closeStream(token, stream);
      return false;
    }
    if (!force && stream.lastSequence === state.sequence) {
      if (now - stream.lastSentAt < SSE_KEEPALIVE_MS) return true;
      try {
        const writable = stream.response.write(`: keepalive ${now}\n\n`);
        stream.lastSentAt = now;
        if (!writable) stream.blocked = true;
        return true;
      } catch {
        closeStream(token, stream);
        return false;
      }
    }
    try {
      const snapshot = worldSnapshot(state, token);
      const payload = stream.delta && stream.lastSnapshot
        ? createSnapshotDelta(stream.lastSnapshot, snapshot)
        : snapshot;
      stream.lastSequence = snapshot.sequence;
      if (!payload) {
        networkMetrics.skippedFrames += 1;
        return true;
      }
      stream.lastSnapshot = snapshot;
      const frame = `id: ${snapshot.sequence}\ndata: ${JSON.stringify(payload)}\n\n`;
      const writable = stream.response.write(frame);
      stream.lastSentAt = now;
      networkMetrics.frames += 1;
      networkMetrics.bytes += Buffer.byteLength(frame);
      if (payload.type === 'snapshot_delta') networkMetrics.deltaFrames += 1;
      else networkMetrics.fullFrames += 1;
      if (!writable) stream.blocked = true;
      return true;
    } catch {
      closeStream(token, stream);
      return false;
    }
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        const blockedStreams = [...streams.values()].filter((stream) => stream.blocked).length;
        const streamLag = [...streams.values()].reduce(
          (maximum, stream) => Math.max(maximum, state.sequence - stream.lastSequence),
          0,
        );
        sendJson(response, 200, {
          ok: true,
          players: onlinePlayerCount(state),
          sessions: state.players.size,
          streams: streams.size,
          blockedStreams,
          streamLag,
          sequence: state.sequence,
          frames: networkMetrics.frames,
          fullFrames: networkMetrics.fullFrames,
          deltaFrames: networkMetrics.deltaFrames,
          skippedFrames: networkMetrics.skippedFrames,
          snapshotBytes: networkMetrics.bytes,
          mode: 'authoritative-local',
        });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/session') {
        const joined = registerPlayer(state, await readJson(request));
        if (joined.ok === false) {
          sendJson(response, joined.status, joined);
          return;
        }
        sendJson(response, 201, { ok: true, ...joined, snapshot: worldSnapshot(state, joined.token) });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/action') {
        const payload = await readJson(request);
        const result = applyPlayerAction(state, payload.token, payload.action);
        sendJson(response, result.status, result);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/disconnect') {
        const payload = await readJson(request);
        const result = applyPlayerAction(state, payload.token, { type: 'disconnect' });
        sendJson(response, result.status, result);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/events') {
        const token = url.searchParams.get('token');
        const player = state.players.get(state.tokens.get(token));
        if (!player) {
          sendJson(response, 401, { ok: false, reason: 'session' });
          return;
        }
        player.online = true;
        player.disconnectedAt = 0;
        player.lastSeen = Date.now();
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        response.write('retry: 1000\n\n');
        closeStream(token);
        const stream = {
          response,
          lastSequence: -1,
          lastSentAt: 0,
          blocked: false,
          delta: url.searchParams.get('delta') === '1',
          lastSnapshot: null,
        };
        streams.set(token, stream);
        response.on('drain', () => {
          if (streams.get(token) !== stream) return;
          stream.blocked = false;
          writeSnapshot(token, stream, Date.now());
        });
        response.on('error', () => closeStream(token, stream));
        writeSnapshot(token, stream, Date.now(), true);
        response.on('close', () => {
          if (streams.get(token) !== stream) return;
          streams.delete(token);
          // A transport interruption is not an explicit logout. Keep the
          // authoritative character online during the heartbeat grace window
          // so short mobile/Wi-Fi handovers do not make players disappear.
        });
        return;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { ok: false, reason: 'method' });
        return;
      }
      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const filePath = resolve(root, `.${pathname}`);
      if (!filePath.startsWith(`${resolve(root)}${sep}`) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        sendJson(response, 404, { ok: false, reason: 'not_found' });
        return;
      }
      response.writeHead(200, {
        'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': /\.(?:png|jpe?g|webp|woff2?)$/i.test(filePath)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(filePath).pipe(response);
    } catch (error) {
      sendJson(response, error.message === 'payload' ? 413 : 400, { ok: false, reason: 'bad_request' });
    }
  });

  let lastWorldTick = Date.now();
  const broadcastTimer = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(1, Math.max(0, (now - lastWorldTick) / 1000));
    lastWorldTick = now;
    markInactivePlayers(state, now);
    removeStalePlayers(state, now);
    advanceWorldSystems(state, now, dt);
    for (const [token, stream] of streams) {
      writeSnapshot(token, stream, now);
    }
  }, 100);
  broadcastTimer.unref();
  server.on('close', () => clearInterval(broadcastTimer));
  return { server, state };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 8080;
  const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const worldStateFile = process.env.WORLD_STATE_FILE || resolve(moduleRoot, '.local', 'world-state.json');
  const state = loadWorldState(worldStateFile);
  const { server } = createLocalServer({ state });
  const persistence = attachWorldPersistence(server, state, worldStateFile);
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    persistence.stop();
    try {
      await persistence.flush(true);
    } catch (error) {
      console.error(`世界状态最终保存失败：${error.message}`);
    }
    server.closeAllConnections?.();
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  server.listen(port, '0.0.0.0', () => {
    console.log(`玛法本地权威服已启动：http://127.0.0.1:${port}`);
  });
}
