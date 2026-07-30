import assert from 'node:assert/strict';
import {
  applyPlayerAction, createWorldState, registerPlayer, worldSnapshot,
} from '../server/local-server.mjs';
import { WORLD } from '../js/config.js';
import { createServerItem, refreshServerStats } from '../js/authoritative-rules.js';

const state = createWorldState();
const forged = registerPlayer(state, {
  name: '伪造角色',
  classId: 'wizard',
  level: 50,
  mapId: 'sanctum',
  x: 1,
  y: 1,
  hp: 100_000,
  maxHp: 100_000,
  gold: 999_999_999,
  bag: [{ id: 'dragon_staff', qty: 1 }],
  pkPoints: 999,
}, 1000);
const forgedPlayer = state.players.get(forged.player.id);

assert.equal(forgedPlayer.level, 1, 'new session ignores client-claimed level');
assert.equal(forgedPlayer.mapId, 'bich', 'new session ignores client-claimed map');
assert.equal(forgedPlayer.maxHp, 75, 'new session derives health from the selected class');
assert.equal(forgedPlayer.gold, 150, 'new session owns its starting currency');
assert.deepEqual(
  forgedPlayer.bag.map((entry) => entry.id),
  ['hp_pot', 'mp_pot', 'recall', 'wood_sword'],
  'new session owns its starting inventory',
);
assert.equal(forgedPlayer.pkPoints, 0, 'new session ignores client-claimed crime state');

assert.equal(applyPlayerAction(state, forged.token, {
  type: 'state',
  level: 50,
  hp: 100_000,
  maxHp: 100_000,
  pkPoints: 999,
  crimeT: 120,
}, 2000).ok, true, 'presentation state action remains compatible');
assert.equal(forgedPlayer.level, 1, 'state action cannot change authoritative level');
assert.equal(forgedPlayer.hp, 75, 'state action cannot change authoritative health');
assert.equal(forgedPlayer.pkPoints, 0, 'state action cannot change authoritative crime');

const forgedInventory = applyPlayerAction(state, forged.token, {
  type: 'inventory',
  gold: 999_999_999,
  bag: [{ id: 'dragon_staff', qty: 1 }],
}, 2100);
assert.equal(forgedInventory.ok, false, 'server rejects client-authored inventory snapshots');
assert.equal(forgedPlayer.gold, 150, 'rejected inventory cannot mint currency');
assert.equal(forgedPlayer.bag.some((entry) => entry.id === 'dragon_staff'), false, 'rejected inventory cannot mint equipment');

const attackerSession = registerPlayer(state, { name: '拾荒者', classId: 'warrior' }, 2200);
const victimSession = registerPlayer(state, { name: '红名目标', classId: 'taoist' }, 2200);
const attacker = state.players.get(attackerSession.player.id);
const victim = state.players.get(victimSession.player.id);
attacker.mapId = 'field';
victim.mapId = 'field';
attacker.x = victim.x = 20 * WORLD.tile;
attacker.y = victim.y = 14 * WORLD.tile;
attacker.pkMode = 'all';
victim.pkPoints = 100;
victim.gold = 1000;
victim.bag = [createServerItem('dragon_staff')];
victim.equip.armor = createServerItem('cloth');
refreshServerStats(victim, { fill: true });

const originalRandom = Math.random;
Math.random = () => 0.5;
try {
  const hpBefore = victim.hp;
  assert.equal(applyPlayerAction(state, attackerSession.token, {
    type: 'pvp_attack',
    targetId: victim.id,
    damage: 999_999,
  }, 4000).ok, true, 'server accepts a valid PvP attack');
  assert.ok(victim.hp > 0 && victim.hp < hpBefore, 'server computes damage and ignores an impossible client damage claim');

  victim.hp = 1;
  assert.equal(applyPlayerAction(state, attackerSession.token, {
    type: 'pvp_attack',
    targetId: victim.id,
    damage: 999_999,
  }, 6000).ok, true, 'a later authoritative attack can defeat the target');
} finally {
  Math.random = originalRandom;
}

assert.equal(victim.mapId, 'bich', 'defeated online player returns to the safe city');
assert.equal(victim.bag.length, 0, 'red-name death removes server-owned bag loot');
assert.equal(victim.equip.armor, null, 'red-name death can remove server-owned equipment');
assert.equal(victim.gold, 880, 'red-name death removes the configured carried-gold percentage');
assert.ok(state.drops.size >= 3, 'online death materializes item, equipment and gold as server-owned ground drops');
assert.ok(worldSnapshot(state, attackerSession.token).drops.length >= 3, 'nearby player receives authoritative ground drops');
assert.equal(Object.hasOwn(worldSnapshot(state, attackerSession.token).players[0], 'bag'), false, 'public player state never exposes inventory');
assert.ok(worldSnapshot(state, attackerSession.token).self.bag, 'private snapshot includes only the viewer authoritative inventory');

const itemDrop = [...state.drops.values()].find((drop) => drop.entry);
assert.equal(applyPlayerAction(state, attackerSession.token, {
  type: 'pickup_drop',
  dropId: itemDrop.id,
}, 7000).ok, true, 'nearby player can pick up a server-owned death drop');
assert.equal(state.drops.has(itemDrop.id), false, 'picked drop is atomically removed from the world ledger');
assert.ok(attacker.bag.some((entry) => entry.id === itemDrop.entry.id), 'picked equipment enters the authoritative inventory');

console.log('server authority: forged state rejected, PvP damage computed, death loot and pickup are authoritative');
