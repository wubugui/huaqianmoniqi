import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyPlayerAction, createLocalServer, createWorldState, registerPlayer,
  removeStalePlayers, worldSnapshot,
} from '../server/local-server.mjs';
import { MAPS, WORLD } from '../js/config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const state = createWorldState();
const fieldPortal = MAPS.bich.portals.find((portal) => portal.to === 'field');
const joined = registerPlayer(state, {
  name: '<测试勇士>',
  classId: 'warrior',
  mapId: 'bich',
  x: fieldPortal.x * WORLD.tile,
  y: fieldPortal.y * WORLD.tile,
}, 1000);
assert.equal(joined.player.name, '测试勇士', 'server sanitizes player names');
assert.equal(worldSnapshot(state).players.length, 1, 'registered player appears in authoritative snapshot');

const internal = state.players.get(joined.player.id);
const startX = internal.x;
const moved = applyPlayerAction(state, joined.token, {
  type: 'move',
  x: startX + 1000,
  y: internal.y,
  run: false,
}, 1100);
assert.equal(moved.ok, true, 'server accepts a valid movement action');
assert.ok(internal.x - startX < 100, 'server caps impossible movement distance');

internal.x = fieldPortal.x * WORLD.tile;
internal.y = fieldPortal.y * WORLD.tile;
const transition = applyPlayerAction(state, joined.token, { type: 'map', to: 'field' }, 1200);
assert.equal(transition.ok, true, 'server accepts a map transition at a configured portal');
assert.equal(internal.mapId, 'field', 'server owns the authoritative map id');
const invalidTransition = applyPlayerAction(state, joined.token, { type: 'map', to: 'sanctum' }, 1300);
assert.equal(invalidTransition.ok, false, 'server rejects transitions without a configured portal');

const unknown = applyPlayerAction(state, 'invalid-token', { type: 'heartbeat' }, 1400);
assert.equal(unknown.status, 401, 'server rejects unknown sessions');
assert.equal(removeStalePlayers(state, 40_000, 30_000), 1, 'inactive sessions are removed');

const live = createLocalServer({ root: ROOT });
await new Promise((resolve) => live.server.listen(0, '127.0.0.1', resolve));
const address = live.server.address();
const base = `http://127.0.0.1:${address.port}`;

const health = await fetch(`${base}/api/health`).then((response) => response.json());
assert.equal(health.mode, 'authoritative-local', 'health endpoint identifies authoritative local mode');

const index = await fetch(`${base}/`);
assert.equal(index.status, 200, 'local server serves the game client');
assert.match(await index.text(), /玛法余烬/, 'served client is the game entry page');

const sessionResponse = await fetch(`${base}/api/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '联机玩家', classId: 'wizard', mapId: 'bich' }),
});
assert.equal(sessionResponse.status, 201, 'HTTP session endpoint creates a player');
const session = await sessionResponse.json();
assert.ok(session.token && session.player.id, 'session response includes opaque credentials and player id');

const actionResponse = await fetch(`${base}/api/action`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: session.token, action: { type: 'heartbeat' } }),
});
assert.equal(actionResponse.status, 200, 'HTTP action endpoint accepts authenticated heartbeat');

await new Promise((resolve) => live.server.close(resolve));
console.log('server: authoritative sessions, movement limits, portals, cleanup and local HTTP deployment OK');
