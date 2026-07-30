import assert from 'node:assert/strict';
import { MultiplayerClient } from '../js/network.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, timeoutMs = 1000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('condition timed out');
    await wait(5);
  }
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) || null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

class FakeEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.closed = false;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  open() {
    this.onopen?.();
  }

  message(snapshot) {
    this.onmessage?.({ data: JSON.stringify(snapshot) });
  }

  fail() {
    this.onerror?.(new Error('stream failed'));
  }
}

const jsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() {
    return payload;
  },
});

const storage = new MemoryStorage();
const statuses = [];
const socialUpdates = [];
const snapshots = [];
const actions = [];
let sessionCalls = 0;
let disconnectCalls = 0;
let heldMove = null;
let failInventoryOnce = true;
const fetchImpl = async (url, options = {}) => {
  if (url === '/api/session') {
    sessionCalls += 1;
    const body = JSON.parse(options.body);
    const playerId = 'player-stable';
    return jsonResponse(201, {
      ok: true,
      token: `token-${sessionCalls}`,
      resumeToken: 'resume-stable',
      resumed: sessionCalls > 1,
      player: { id: playerId },
      snapshot: {
        type: 'snapshot',
        sequence: sessionCalls,
        onlinePlayers: 1,
        players: [{ id: playerId, name: body.name, mapId: 'bich' }],
        social: { messages: [], events: [] },
      },
    });
  }
  if (url === '/api/disconnect') {
    disconnectCalls += 1;
    return jsonResponse(200, { ok: true });
  }
  if (url === '/api/action') {
    const body = JSON.parse(options.body);
    actions.push(body.action);
    if (body.action.type === 'inventory' && failInventoryOnce) {
      failInventoryOnce = false;
      return jsonResponse(409, { ok: false, reason: 'inventory' });
    }
    if (body.action.type === 'move' && !heldMove) {
      return new Promise((resolve) => {
        heldMove = () => resolve(jsonResponse(200, { ok: true }));
      });
    }
    return jsonResponse(200, { ok: true });
  }
  throw new Error(`unexpected URL ${url}`);
};

const client = new MultiplayerClient({
  fetchImpl,
  EventSourceImpl: FakeEventSource,
  storage,
  onStatus: (status) => statuses.push(status),
  onSocial: (social) => socialUpdates.push(social),
  onSnapshot: (snapshot) => snapshots.push(snapshot),
  reconnectBaseMs: 10,
  reconnectMaxMs: 20,
  heartbeatIntervalMs: 10_000,
  requestTimeoutMs: 100,
});

assert.equal(await client.connect({ name: '网络战士', classId: 'warrior' }), true, 'initial session connects');
assert.equal(client.connected, true, 'client reports online after the authoritative session response');
assert.equal(storage.getItem('ember_multiplayer_resume_v1'), 'resume-stable', 'resume credential is stored for reload recovery');
assert.match(FakeEventSource.instances.at(-1).url, /token-1/, 'event stream uses the current short-lived token');
assert.match(FakeEventSource.instances.at(-1).url, /delta=1/, 'client negotiates compact authoritative snapshot deltas');

FakeEventSource.instances.at(-1).fail();
await waitFor(() => sessionCalls >= 2 && client.connected);
assert.equal(client.token, 'token-2', 'stream failure automatically creates a replacement authenticated session');
assert.ok(statuses.some((status) => status.state === 'reconnecting'), 'reconnect state is observable by the UI');

const stream = FakeEventSource.instances.at(-1);
const repeatedSocial = { messages: [], events: [], friends: [], team: null, guild: null };
const statusCountBeforeSnapshots = statuses.length;
const socialCountBeforeSnapshots = socialUpdates.length;
stream.message({
  type: 'snapshot', sequence: 20, onlinePlayers: 1,
  players: [{ id: client.playerId, name: '网络战士', mapId: 'bich' }],
  social: repeatedSocial,
});
stream.message({
  type: 'snapshot', sequence: 21, onlinePlayers: 1,
  players: [{ id: client.playerId, name: '网络战士', mapId: 'bich' }],
  social: repeatedSocial,
});
assert.equal(statuses.length, statusCountBeforeSnapshots, 'identical combat snapshots do not churn online-status DOM callbacks');
assert.ok(socialUpdates.length - socialCountBeforeSnapshots <= 1, 'identical social payloads are coalesced before UI rendering');
assert.ok(snapshots.length >= 2, 'authoritative world snapshots still reach gameplay interpolation');
stream.message({
  type: 'snapshot_delta',
  sequence: 22,
  baseSequence: 21,
  serverTime: 22_000,
  changes: { onlinePlayers: 2 },
  collections: {
    players: {
      upsert: [
        { id: client.playerId, x: 72, y: 96, anim: 'run' },
        { id: 'nearby-player', name: '同屏队友', classId: 'taoist', mapId: 'bich', x: 80, y: 96 },
      ],
      remove: [],
    },
  },
});
assert.equal(snapshots.at(-1).type, 'snapshot', 'delta frames are reconstructed into the legacy full-snapshot contract');
assert.equal(snapshots.at(-1).players.find((entry) => entry.id === client.playerId).x, 72, 'entity patches merge changed movement fields');
assert.equal(snapshots.at(-1).players.length, 2, 'entity patches can add a newly interested player');
assert.deepEqual(snapshots.at(-1).social, repeatedSocial, 'unchanged social state is retained without retransmission');
stream.message({
  type: 'snapshot_delta',
  sequence: 23,
  baseSequence: 22,
  serverTime: 23_000,
  changes: {},
  collections: {
    players: { upsert: [], remove: ['nearby-player'] },
  },
});
assert.deepEqual(
  snapshots.at(-1).players.map((entry) => entry.id),
  [client.playerId],
  'interest-area removals cannot leave ghost remote players behind',
);

client.lastInventoryHash = 'pending-inventory';
client.queueLatest('inventory', { type: 'inventory', gold: 1, bag: [] });
await waitFor(() => actions.some((action) => action.type === 'inventory'));
await waitFor(() => client.lastInventoryHash === '');
assert.equal(client.lastInventoryHash, '', 'rejected inventory sync is retried on the next player sample');

client.queueLatest('move', { type: 'move', mapId: 'bich', x: 1, y: 1, run: false });
await waitFor(() => actions.some((action) => action.type === 'move'));
client.queueLatest('move', { type: 'move', mapId: 'bich', x: 2, y: 2, run: false });
client.queueLatest('move', { type: 'move', mapId: 'bich', x: 3, y: 3, run: true });
heldMove();
await waitFor(() => actions.filter((action) => action.type === 'move').length === 2);
const moves = actions.filter((action) => action.type === 'move');
assert.deepEqual(moves.map((action) => action.x), [1, 3], 'movement backpressure keeps only the newest pending position');
assert.deepEqual(moves.map((action) => action.clientSeq), [1, 2], 'movement packets carry a monotonic channel sequence');

stream.message({
  type: 'snapshot_delta',
  sequence: 24,
  baseSequence: 999,
  serverTime: 24_000,
  changes: {},
  collections: {},
});
await waitFor(() => sessionCalls >= 3 && client.connected);
assert.equal(client.token, 'token-3', 'a delta baseline mismatch repairs itself through a fresh authoritative session');

client.close({ notify: true });
await waitFor(() => disconnectCalls === 1);
assert.equal(client.connected, false, 'explicit close leaves the client offline');

let timeoutSessionCalls = 0;
const timeoutFetch = async (url, options = {}) => {
  if (url === '/api/session') {
    timeoutSessionCalls += 1;
    return jsonResponse(201, {
      token: 'timeout-token',
      resumeToken: 'timeout-resume',
      player: { id: 'timeout-player' },
      snapshot: {
        onlinePlayers: 1,
        players: [{ id: 'timeout-player' }],
      },
    });
  }
  if (url === '/api/action') {
    return new Promise((resolve, reject) => {
      options.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  }
  return jsonResponse(200, { ok: true });
};
const timeoutClient = new MultiplayerClient({
  fetchImpl: timeoutFetch,
  EventSourceImpl: FakeEventSource,
  storage: new MemoryStorage(),
  reconnectBaseMs: 50,
  reconnectMaxMs: 50,
  heartbeatIntervalMs: 10_000,
  requestTimeoutMs: 20,
});
await timeoutClient.connect({ name: '超时测试', classId: 'wizard' });
const timeoutResult = await timeoutClient.send({ type: 'chat', channel: 'world', text: '测试' });
assert.equal(timeoutResult.reason, 'timeout', 'hung action requests are aborted within the configured deadline');
assert.equal(timeoutClient.connected, false, 'request timeout enters reconnecting state');
timeoutClient.close();

let retrySessionCalls = 0;
let retryActionCalls = 0;
const retryActionIds = [];
const retryFetch = async (url, options = {}) => {
  if (url === '/api/session') {
    retrySessionCalls += 1;
    return jsonResponse(201, {
      token: `retry-token-${retrySessionCalls}`,
      resumeToken: 'retry-resume',
      player: { id: 'retry-player' },
      snapshot: {
        type: 'snapshot',
        sequence: retrySessionCalls,
        serverTime: retrySessionCalls * 100,
        onlinePlayers: 1,
        players: [{ id: 'retry-player', mapId: 'bich' }],
        social: { messages: [], events: [] },
      },
    });
  }
  if (url === '/api/action') {
    const action = JSON.parse(options.body).action;
    retryActionCalls += 1;
    retryActionIds.push(action.actionId);
    if (retryActionCalls === 1) {
      return new Promise((resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }
    return jsonResponse(200, { ok: true });
  }
  return jsonResponse(200, { ok: true });
};
const retryClient = new MultiplayerClient({
  fetchImpl: retryFetch,
  EventSourceImpl: FakeEventSource,
  storage: new MemoryStorage(),
  reconnectBaseMs: 5,
  reconnectMaxMs: 5,
  heartbeatIntervalMs: 10_000,
  requestTimeoutMs: 20,
  randomImpl: () => 0.5,
});
await retryClient.connect({ name: '可靠操作', classId: 'taoist' });
const ambiguousResult = await retryClient.send({ type: 'buy_item', itemId: 'potion_small' });
assert.equal(ambiguousResult.reason, 'timeout', 'the caller observes the ambiguous first request');
await waitFor(() => retrySessionCalls >= 2 && retryActionCalls >= 2);
assert.equal(new Set(retryActionIds).size, 1, 'transactional retry reuses the same idempotency key');
assert.equal(retryClient.reliablePending.size, 0, 'successful reconnect flush removes the reliable outbox entry');
retryClient.close();

let conflictCalls = 0;
const conflictStatuses = [];
const conflictClient = new MultiplayerClient({
  fetchImpl: async () => {
    conflictCalls += 1;
    return jsonResponse(409, { ok: false, reason: 'character_online' });
  },
  EventSourceImpl: FakeEventSource,
  storage: new MemoryStorage(),
  reconnectBaseMs: 10,
  reconnectMaxMs: 10,
  onStatus: (status) => conflictStatuses.push(status),
});
assert.equal(await conflictClient.connect({
  characterId: 'same-character',
  name: '重复窗口',
  classId: 'warrior',
}), false);
await wait(30);
assert.equal(conflictCalls, 1, 'duplicate live character conflict does not enter a reconnect fight');
assert.equal(conflictStatuses.at(-1).state, 'conflict', 'duplicate window receives a stable conflict state');

console.log('network: reconnect, resume token, timeout, movement coalescing and graceful disconnect OK');
