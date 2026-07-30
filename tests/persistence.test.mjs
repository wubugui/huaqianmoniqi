import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  applyPlayerAction,
  attachWorldPersistence,
  createLocalServer,
  createWorldState,
  loadWorldState,
  registerPlayer,
  restoreWorldState,
  serializeWorldState,
  worldSnapshot,
} from '../server/local-server.mjs';
import { addServerItem } from '../js/authoritative-rules.js';
import { MAPS, SCENERY, WORLD } from '../js/config.js';

const state = createWorldState();
const first = registerPlayer(state, {
  name: '持久战士',
  classId: 'warrior',
  bag: [{ id: 'iron_sword', qty: 1 }],
  gold: 321,
}, 1000);
const second = registerPlayer(state, { name: '持久法师', classId: 'wizard' }, 1000);
state.players.get(first.player.id).level = 20;
state.players.get(first.player.id).gold = 1321;
state.players.get(first.player.id).bag = [{
  id: 'iron_sword', qty: 1, uid: 'persist-iron', durability: 8, maxDurability: 8,
  enhance: 0, luck: 0, curse: 0, bonus: {},
}];
addServerItem(state.players.get(first.player.id), { id: 'orc_tooth', qty: 1 });
assert.equal(applyPlayerAction(state, first.token, {
  type: 'friend_request',
  targetId: second.player.id,
}, 1500).ok, true);
assert.equal(applyPlayerAction(state, second.token, {
  type: 'friend_accept',
  targetId: first.player.id,
}, 1600).ok, true);
assert.equal(applyPlayerAction(state, first.token, {
  type: 'team_invite',
  targetId: second.player.id,
}, 1700).ok, true);
assert.equal(applyPlayerAction(state, second.token, {
  type: 'team_accept',
  targetId: first.player.id,
}, 1800).ok, true);
assert.equal(applyPlayerAction(state, first.token, {
  type: 'guild_create',
  name: '永存行会',
}, 1900).ok, true);

const restored = restoreWorldState(serializeWorldState(state), 5000);
assert.equal(restored.players.size, 2, 'all player records survive serialization');
assert.equal(restored.characters.get(state.players.get(first.player.id).characterId), first.player.id, 'stable character index survives serialization');
assert.equal(worldSnapshot(restored).onlinePlayers, 0, 'restored players stay offline until they authenticate');
assert.equal(restored.teams.size, 1, 'team membership survives serialization');
assert.equal(restored.guilds.size, 1, 'guild membership survives serialization');
assert.equal(restored.players.get(first.player.id).gold, 321, 'authoritative inventory currency survives serialization');
assert.ok(restored.players.get(first.player.id).friends.has(second.player.id), 'friend graph survives serialization');
const resumed = registerPlayer(restored, { resumeToken: first.resumeToken }, 5100);
assert.equal(resumed.player.id, first.player.id, 'persisted resume credential restores the same player identity');
assert.equal(restored.players.get(first.player.id).teamId, state.players.get(first.player.id).teamId);
assert.equal(restored.players.get(first.player.id).guildId, state.players.get(first.player.id).guildId);

const legacyPayload = serializeWorldState(state);
delete legacyPayload.worldLayoutVersion;
legacyPayload.players[0].mapId = 'field';
legacyPayload.players[0].x = 5 * WORLD.tile;
legacyPayload.players[0].y = 14 * WORLD.tile;
legacyPayload.bosses[0].x = 1;
legacyPayload.bosses[0].y = 1;
const migratedWorld = restoreWorldState(legacyPayload, 5500);
const migratedPlayer = migratedWorld.players.get(legacyPayload.players[0].id);
assert.equal(migratedPlayer.x, MAPS.field.playerStart.x * WORLD.tile, 'legacy world player x migrates to expanded layout');
assert.ok(
  Math.abs(migratedPlayer.y - MAPS.field.playerStart.y * WORLD.tile) < 0.001,
  'legacy world player y migrates to expanded layout',
);
const lordSpawn = MAPS.sanctum.spawns.find((spawn) => spawn.monster === 'lord');
assert.equal(migratedWorld.bosses.get('lord').x, lordSpawn.x * WORLD.tile, 'legacy boss resets to the expanded authored spawn');
assert.equal(migratedWorld.bosses.get('lord').y, lordSpawn.y * WORLD.tile, 'legacy boss y resets to the expanded authored spawn');

const layoutV2Payload = serializeWorldState(state);
layoutV2Payload.worldLayoutVersion = 2;
layoutV2Payload.players[0].mapId = 'field';
layoutV2Payload.players[0].x = 5 * WORLD.tile * WORLD.previousLayoutScale;
layoutV2Payload.players[0].y = 14 * WORLD.tile * WORLD.previousLayoutScale;
const migratedLayoutV2 = restoreWorldState(layoutV2Payload, 5600);
const migratedLayoutV2Player = migratedLayoutV2.players.get(layoutV2Payload.players[0].id);
assert.ok(
  Math.abs(migratedLayoutV2Player.x - MAPS.field.playerStart.x * WORLD.tile) < 0.001,
  'layout-v2 world coordinates migrate proportionally to layout-v3',
);
assert.ok(
  Math.abs(migratedLayoutV2Player.y - MAPS.field.playerStart.y * WORLD.tile) < 0.001,
  'layout-v2 world y migrates proportionally to layout-v3',
);

const ecologyPayload = serializeWorldState(state);
const persistedFieldMonster = ecologyPayload.monsters.find((monster) => monster.mapId === 'field');
const blockingFieldDecor = MAPS.field.decors.find((decor) => (
  SCENERY[decor.id]?.block
  && (decor.blockRadius || SCENERY[decor.id]?.blockRadius || 0) > 0
));
assert.ok(persistedFieldMonster && blockingFieldDecor, 'field persistence fixture has a monster and blocking vegetation');
persistedFieldMonster.x = blockingFieldDecor.x * WORLD.tile;
persistedFieldMonster.y = blockingFieldDecor.y * WORLD.tile;
const ecologyRestored = restoreWorldState(ecologyPayload, 5700);
const repairedFieldMonster = ecologyRestored.monsters.get(persistedFieldMonster.id);
assert.notDeepEqual(
  [repairedFieldMonster.x, repairedFieldMonster.y],
  [persistedFieldMonster.x, persistedFieldMonster.y],
  'restored monsters are relocated out of newly authored blocking vegetation',
);

const directory = await mkdtemp(join(tmpdir(), 'mini-legend-state-'));
const filePath = join(directory, 'world-state.json');
const live = createLocalServer({ state });
const persistence = attachWorldPersistence(live.server, state, filePath, 60_000);
await persistence.flush(true);
const loaded = loadWorldState(filePath, 6000);
assert.equal(loaded.players.size, 2, 'atomic state file can be loaded after a process restart');
assert.equal(loaded.guilds.values().next().value.name, '永存行会');
persistence.stop();
live.server.close();
await rm(directory, { recursive: true, force: true });

console.log('persistence: players, friends, teams, guilds and atomic world-state recovery OK');
