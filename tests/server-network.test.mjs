import assert from 'node:assert/strict';
import {
  applyPlayerAction, createLocalServer, createWorldState, registerPlayer, worldSnapshot,
} from '../server/local-server.mjs';
import { MultiplayerClient } from '../js/network.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, timeoutMs = 2500) {
  const started = Date.now();
  while (!(await predicate())) {
    if (Date.now() - started > timeoutMs) throw new Error('condition timed out');
    await wait(10);
  }
}

const state = createWorldState();
const characterState = createWorldState();
const characterSession = registerPlayer(characterState, {
  characterId: 'character-stable',
  instanceId: 'window-a',
  name: '唯一角色',
  classId: 'warrior',
}, 900);
const characterConflict = registerPlayer(characterState, {
  characterId: 'character-stable',
  instanceId: 'window-b',
  name: '唯一角色',
  classId: 'warrior',
}, 950);
assert.equal(characterConflict.status, 409, 'same saved character cannot create a duplicate live session');
assert.equal(characterState.players.size, 1, 'duplicate window does not create a ghost character');
applyPlayerAction(characterState, characterSession.token, { type: 'disconnect' }, 975);
const characterResume = registerPlayer(characterState, {
  characterId: 'character-stable',
  instanceId: 'window-b',
}, 990);
assert.equal(characterResume.player.id, characterSession.player.id, 'offline saved character resumes by stable character id');

const first = registerPlayer(state, { name: '比奇甲', classId: 'warrior', mapId: 'bich' }, 1000);
const second = registerPlayer(state, { name: '野外乙', classId: 'wizard', mapId: 'field' }, 1000);
const third = registerPlayer(state, { name: '比奇丙', classId: 'taoist', mapId: 'bich' }, 1000);
state.players.get(second.player.id).mapId = 'field';
const firstView = worldSnapshot(state, first.token);
assert.equal(firstView.onlinePlayers, 3, 'snapshot reports the global online count');
assert.deepEqual(
  new Set(firstView.players.map((player) => player.id)),
  new Set([first.player.id, third.player.id]),
  'snapshot interest management only includes players on the viewer map',
);
state.players.get(first.player.id).x = 30;
state.players.get(first.player.id).y = 30;
state.players.get(third.player.id).x = 1_890;
state.players.get(third.player.id).y = 1_410;
assert.deepEqual(
  worldSnapshot(state, first.token).players.map((player) => player.id),
  [first.player.id],
  'spatial interest management omits remote entities well outside the camera safety margin',
);
state.players.get(first.player.id).x = first.player.x;
state.players.get(first.player.id).y = first.player.y;
state.players.get(third.player.id).x = third.player.x;
state.players.get(third.player.id).y = third.player.y;

const resumed = registerPlayer(state, { resumeToken: first.resumeToken }, 1500);
assert.equal(resumed.player.id, first.player.id, 'resume credential preserves player identity');
assert.equal(resumed.resumed, true, 'server identifies a resumed session');
assert.equal(state.players.size, 3, 'session resume does not create a ghost duplicate');
assert.equal(applyPlayerAction(state, first.token, { type: 'heartbeat' }, 1600).status, 401, 'rotated short-lived token is invalidated');

const internal = state.players.get(first.player.id);
const moveStart = internal.x;
assert.equal(applyPlayerAction(state, resumed.token, {
  type: 'move', mapId: 'bich', x: moveStart + 20, y: internal.y, clientSeq: 2,
}, 1700).ok, true);
const acceptedX = internal.x;
const staleMove = applyPlayerAction(state, resumed.token, {
  type: 'move', mapId: 'bich', x: moveStart - 20, y: internal.y, clientSeq: 1,
}, 1800);
assert.equal(staleMove.stale, true, 'out-of-order movement is acknowledged but discarded');
assert.equal(internal.x, acceptedX, 'discarded movement cannot rewind authoritative position');
assert.equal(applyPlayerAction(state, resumed.token, {
  type: 'move', mapId: 'field', x: internal.x, y: internal.y, clientSeq: 3,
}, 1900).reason, 'map', 'movement from a stale map is rejected');

const pvpState = createWorldState();
const pvpAttackerSession = registerPlayer(pvpState, { name: '协议攻击者', classId: 'warrior' }, 1000);
const pvpTargetSession = registerPlayer(pvpState, { name: '协议受击者', classId: 'taoist' }, 1000);
const pvpAttacker = pvpState.players.get(pvpAttackerSession.player.id);
const pvpTarget = pvpState.players.get(pvpTargetSession.player.id);
pvpAttacker.mapId = pvpTarget.mapId = 'field';
pvpAttacker.x = pvpTarget.x = 600;
pvpAttacker.y = pvpTarget.y = 500;
pvpAttacker.pkMode = 'all';
pvpTarget.pkPoints = 100;
pvpTarget.dodge = 0;
const originalRandom = Math.random;
Math.random = () => 0.5;
try {
  assert.equal(applyPlayerAction(pvpState, pvpAttackerSession.token, {
    type: 'pvp_attack', targetId: pvpTarget.id, skillId: 'basic', actionId: 'pvp-hit-stable',
  }, 2000).ok, true, 'authoritative PvP hit is accepted');
  const damageEvent = worldSnapshot(pvpState, pvpTargetSession.token).social.events
    .find((event) => event.type === 'pvp_damage');
  assert.deepEqual(
    {
      attackerId: damageEvent?.attackerId,
      attackerName: damageEvent?.attackerName,
      damageType: damageEvent?.damageType,
      skillId: damageEvent?.skillId,
      defeated: damageEvent?.defeated,
    },
    {
      attackerId: pvpAttacker.id,
      attackerName: pvpAttacker.name,
      damageType: 'physical',
      skillId: 'basic',
      defeated: false,
    },
    'target receives a complete nonlethal PvP damage event contract',
  );
  assert.ok(damageEvent.damage > 0, 'PvP damage event carries the applied post-shield amount');
  assert.ok(
    worldSnapshot(pvpState, pvpAttackerSession.token).social.events.some((event) => event.type === 'pvp_hit'),
    'legacy attacker-side pvp_hit remains compatible',
  );
  const firstHitEvent = pvpAttacker.events.find((event) => event.type === 'pvp_hit');
  assert.deepEqual(
    {
      magical: firstHitEvent?.magical,
      damageType: firstHitEvent?.damageType,
      shielded: firstHitEvent?.shielded,
      defeated: firstHitEvent?.defeated,
    },
    {
      magical: false,
      damageType: 'physical',
      shielded: false,
      defeated: false,
    },
    'attacker hit confirmation carries a consistent damage presentation contract',
  );
  const hitEventsBeforeReplay = pvpAttacker.events.filter((event) => event.type === 'pvp_hit').length;
  assert.equal(applyPlayerAction(pvpState, pvpAttackerSession.token, {
    type: 'pvp_attack', targetId: pvpTarget.id, skillId: 'basic', actionId: 'pvp-hit-stable',
  }, 3100).ok, true, 'an idempotent PvP replay returns the cached success');
  assert.equal(
    pvpAttacker.events.filter((event) => event.type === 'pvp_hit').length,
    hitEventsBeforeReplay,
    'an idempotent replay cannot duplicate hit feedback',
  );

  pvpTarget.hp = 1;
  assert.equal(applyPlayerAction(pvpState, pvpAttackerSession.token, {
    type: 'pvp_attack', targetId: pvpTarget.id, skillId: 'basic', actionId: 'pvp-lethal-stable',
  }, 4200).ok, true, 'authoritative lethal PvP hit is accepted');
  const targetEvents = pvpTarget.events;
  const lethalDamageIndex = targetEvents.findLastIndex(
    (event) => event.type === 'pvp_damage' && event.defeated,
  );
  const deathIndex = targetEvents.findLastIndex((event) => event.type === 'pvp_death');
  assert.ok(lethalDamageIndex >= 0 && deathIndex > lethalDamageIndex, 'lethal damage feedback is ordered before the death event');
  const lethalHitIndex = pvpAttacker.events.findLastIndex(
    (event) => event.type === 'pvp_hit' && event.defeated,
  );
  const killIndex = pvpAttacker.events.findLastIndex((event) => event.type === 'pvp_kill');
  assert.ok(lethalHitIndex >= 0 && killIndex > lethalHitIndex, 'attacker receives lethal hit feedback before the kill event');
} finally {
  Math.random = originalRandom;
}

let eventBase = '';
class FetchEventSource {
  constructor(path) {
    this.path = path;
    this.closed = false;
    this.controller = new AbortController();
    queueMicrotask(() => this.run());
  }

  async run() {
    try {
      const response = await fetch(new URL(this.path, eventBase), {
        signal: this.controller.signal,
        headers: { Accept: 'text/event-stream' },
      });
      if (!response.ok) throw new Error(`events ${response.status}`);
      this.onopen?.();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!this.closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = frame.split('\n')
            .filter((line) => line.startsWith('data: '))
            .map((line) => line.slice(6))
            .join('\n');
          if (data) this.onmessage?.({ data });
          boundary = buffer.indexOf('\n\n');
        }
      }
      if (!this.closed) this.onerror?.(new Error('events closed'));
    } catch (error) {
      if (!this.closed && error.name !== 'AbortError') this.onerror?.(error);
    }
  }

  close() {
    this.closed = true;
    this.controller.abort();
  }
}

async function listen(server, port = 0) {
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return server.address().port;
}

async function stop(server) {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
}

const liveOne = createLocalServer();
const port = await listen(liveOne.server);
eventBase = `http://127.0.0.1:${port}`;
const absoluteFetch = (url, options) => fetch(new URL(url, eventBase), options);
const statuses = [];
const snapshots = [];
const client = new MultiplayerClient({
  fetchImpl: absoluteFetch,
  EventSourceImpl: FetchEventSource,
  storage: null,
  heartbeatIntervalMs: 40,
  reconnectBaseMs: 20,
  reconnectMaxMs: 50,
  requestTimeoutMs: 250,
  onStatus: (status) => statuses.push(status),
  onSnapshot: (snapshot) => snapshots.push(snapshot),
});

assert.equal(await client.connect({ name: '重启恢复', classId: 'warrior', mapId: 'bich' }), true);
await waitFor(() => snapshots.length >= 1 && client.connected);
const liveHealth = await fetch(`${eventBase}/api/health`).then((response) => response.json());
assert.equal(liveHealth.streams, 1, 'active SSE response remains registered after the request headers are complete');
const observer = await fetch(`${eventBase}/api/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '临时观察者', classId: 'wizard', mapId: 'bich' }),
}).then((response) => response.json());
await waitFor(() => snapshots.at(-1)?.onlinePlayers === 2);
await fetch(`${eventBase}/api/disconnect`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: observer.token }),
});
await waitFor(() => snapshots.at(-1)?.onlinePlayers === 1);
const socketOnly = await fetch(`${eventBase}/api/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '断线观察者', classId: 'taoist', mapId: 'bich' }),
}).then((response) => response.json());
const socketResponse = await fetch(`${eventBase}/api/events?token=${encodeURIComponent(socketOnly.token)}`);
const socketReader = socketResponse.body.getReader();
await socketReader.read();
await waitFor(() => snapshots.at(-1)?.onlinePlayers === 2);
await socketReader.cancel();
await waitFor(async () => {
  const health = await fetch(`${eventBase}/api/health`).then((response) => response.json());
  return health.streams === 1;
});
assert.equal(
  snapshots.at(-1)?.onlinePlayers,
  2,
  'brief stream loss keeps the character present during the heartbeat reconnection grace window',
);
await fetch(`${eventBase}/api/disconnect`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: socketOnly.token }),
});
await waitFor(() => snapshots.at(-1)?.onlinePlayers === 1);
const deltaHealth = await fetch(`${eventBase}/api/health`).then((response) => response.json());
assert.ok(deltaHealth.deltaFrames > 0, 'negotiated SSE streams deliver compact delta frames after the initial snapshot');
const originalPlayerId = client.playerId;
await stop(liveOne.server);
await waitFor(() => statuses.some((status) => status.state === 'reconnecting'));

const liveTwo = createLocalServer();
await listen(liveTwo.server, port);
await waitFor(() => client.connected && client.playerId !== originalPlayerId, 3000);
assert.equal(liveTwo.state.players.size, 1, 'automatic recovery establishes exactly one session after restart');
assert.ok(
  statuses.filter((status) => status.state === 'online').length >= 2,
  'client returns to online state without a page refresh',
);

client.close({ notify: true });
await waitFor(async () => {
  const health = await fetch(`${eventBase}/api/health`).then((response) => response.json());
  return health.players === 0 && health.sessions === 1;
});
await stop(liveTwo.server);

console.log('server network: interest management, token rotation, ordering, restart recovery and disconnect cleanup OK');
