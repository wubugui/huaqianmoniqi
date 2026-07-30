import assert from 'node:assert/strict';
import { createLocalServer } from '../server/local-server.mjs';

const live = createLocalServer();
await new Promise((resolve) => live.server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${live.server.address().port}`;
const clients = 60;
const maps = ['bich', 'field', 'temple'];
const sessions = await Promise.all(Array.from({ length: clients }, async (_, index) => {
  const response = await fetch(`${base}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `网络压测${index}`,
      classId: ['warrior', 'wizard', 'taoist'][index % 3],
      mapId: maps[index % maps.length],
    }),
  });
  assert.equal(response.status, 201);
  return response.json();
}));
sessions.forEach((session, index) => {
  const player = live.state.players.get(session.player.id);
  player.mapId = maps[index % maps.length];
  player.x = 240 + (index % 10) * 150;
  player.y = 180 + (Math.floor(index / 10) % 6) * 180;
});
live.state.sequence += 1;

const eventResponses = await Promise.all(sessions.map((session) => (
  fetch(`${base}/api/events?token=${encodeURIComponent(session.token)}&delta=1`)
)));
const readers = eventResponses.map((response) => response.body.getReader());
let receivedBytes = 0;
const pumps = readers.map(async (reader) => {
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      receivedBytes += value.byteLength;
    }
  } catch {
    // Reader cancellation closes the stress client.
  }
});

const batchLatencies = [];
const healthLatencies = [];
for (let tick = 0; tick < 12; tick++) {
  const batchStarted = performance.now();
  await Promise.all(sessions.map((session, index) => fetch(`${base}/api/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: session.token,
      action: {
        type: 'move',
        mapId: maps[index % maps.length],
        x: 1728 + (index % 8) * 3 + tick,
        y: 672 + (index % 6) * 3,
        run: index % 2 === 0,
        clientSeq: tick + 1,
      },
    }),
  })));
  batchLatencies.push(performance.now() - batchStarted);
  const healthStarted = performance.now();
  const health = await fetch(`${base}/api/health`).then((response) => response.json());
  healthLatencies.push(performance.now() - healthStarted);
  assert.equal(health.players, clients);
  assert.equal(health.streams, clients);
  assert.equal(health.blockedStreams, 0);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const percentile = (values, percentileValue) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentileValue))];
};
const actionP95 = percentile(batchLatencies, 0.95);
const healthP95 = percentile(healthLatencies, 0.95);
assert.ok(actionP95 < 1000, `60-client action batch P95 remains responsive (${actionP95.toFixed(1)}ms)`);
assert.ok(healthP95 < 500, `health endpoint P95 remains responsive (${healthP95.toFixed(1)}ms)`);
assert.ok(receivedBytes < 9_000_000, `spatial delta broadcasting stays within budget (${(receivedBytes / 1e6).toFixed(1)}MB)`);

await Promise.all(readers.map((reader) => reader.cancel().catch(() => {})));
await Promise.all(pumps);
await new Promise((resolve) => setTimeout(resolve, 150));
const afterTransportClose = await fetch(`${base}/api/health`).then((response) => response.json());
assert.equal(afterTransportClose.players, clients, 'transport loss retains players during the reconnect grace window');
assert.equal(afterTransportClose.streams, 0, 'closed SSE clients release all stream records');
assert.ok(afterTransportClose.deltaFrames > 0, 'stress run exercised compact delta serialization');
await Promise.all(sessions.map((session) => fetch(`${base}/api/disconnect`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: session.token }),
})));
const afterClose = await fetch(`${base}/api/health`).then((response) => response.json());
assert.equal(afterClose.players, 0, 'explicit disconnect removes all players without waiting for the grace window');
live.server.closeAllConnections?.();
await new Promise((resolve) => live.server.close(resolve));

console.log(
  `server live stress: ${clients} SSE clients / ${clients * 12} HTTP actions / `
  + `${(receivedBytes / 1e6).toFixed(1)}MB / action P95 ${actionP95.toFixed(1)}ms / health P95 ${healthP95.toFixed(1)}ms`,
);
