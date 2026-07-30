import assert from 'node:assert/strict';
import {
  applyPlayerAction, createWorldState, registerPlayer, worldSnapshot,
} from '../server/local-server.mjs';

const state = createWorldState();
const sessions = [];
const started = performance.now();
for (let index = 0; index < 120; index++) {
  sessions.push(registerPlayer(state, {
    name: `压测${index}`,
    classId: ['warrior', 'wizard', 'taoist'][index % 3],
    mapId: 'bich',
  }, 10_000 + index));
}

for (let tick = 0; tick < 50; tick++) {
  const now = 11_000 + tick * 100;
  for (let index = 0; index < sessions.length; index++) {
    const session = sessions[index];
    const player = state.players.get(session.player.id);
    const result = applyPlayerAction(state, session.token, {
      type: 'move',
      x: player.x + ((index + tick) % 3 - 1) * 10,
      y: player.y + ((index + tick * 2) % 3 - 1) * 10,
      run: index % 2 === 0,
    }, now);
    assert.equal(result.ok, true);
  }
  if (tick % 10 === 0) {
    const snapshot = worldSnapshot(state, sessions[0].token);
    assert.equal(snapshot.players.length, sessions.length);
    JSON.stringify(snapshot);
  }
}

const originalRandom = Math.random;
Math.random = () => 0.5;
let pvpDamageEvents = 0;
try {
  for (let index = 0; index < sessions.length; index += 2) {
    const attackerSession = sessions[index];
    const targetSession = sessions[index + 1];
    const attacker = state.players.get(attackerSession.player.id);
    const target = state.players.get(targetSession.player.id);
    attacker.mapId = target.mapId = 'field';
    attacker.x = target.x = 300 + (index % 20) * 60;
    attacker.y = target.y = 300 + (Math.floor(index / 20) % 6) * 90;
    attacker.pkMode = 'all';
    target.pkPoints = 100;
    target.hp = target.maxHp;
    const result = applyPlayerAction(state, attackerSession.token, {
      type: 'pvp_attack',
      targetId: target.id,
      skillId: 'basic',
      actionId: `stress-pvp-${index}`,
    }, 20_000);
    assert.equal(result.ok, true, 'stress PvP action remains authoritative');
    if (target.events.some((event) => event.type === 'pvp_damage')) pvpDamageEvents += 1;
  }
} finally {
  Math.random = originalRandom;
}
const elapsed = performance.now() - started;
assert.equal(state.players.size, 120, 'all simulated sessions remain authoritative');
assert.ok(state.sequence >= 6_000, 'server processed the complete movement workload');
assert.equal(pvpDamageEvents, 60, '60 concurrent combat pairs receive target-side PvP damage events');
assert.ok(elapsed < 5_000, `120-player local stress run completes within budget (${elapsed.toFixed(1)}ms)`);
console.log(`server stress: 120 sessions / 6,000 moves / 60 PvP hits / snapshots in ${elapsed.toFixed(1)}ms`);
