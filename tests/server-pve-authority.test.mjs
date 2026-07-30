import assert from 'node:assert/strict';
import {
  advanceWorldSystems, applyPlayerAction, createWorldState, registerPlayer, worldSnapshot,
} from '../server/local-server.mjs';

const state = createWorldState();
const session = registerPlayer(state, { name: '猎人', classId: 'warrior' }, 1000);
const player = state.players.get(session.player.id);
const deer = [...state.monsters.values()].find((monster) => monster.kind === 'deer');
player.mapId = deer.mapId;
player.x = deer.x;
player.y = deer.y;
deer.hp = 1;

const attack = applyPlayerAction(state, session.token, {
  type: 'monster_attack',
  targetId: deer.id,
  damage: 999_999,
}, 3000);
assert.equal(attack.ok, true, 'server accepts an in-range monster attack');
assert.equal(deer.alive, false, 'server owns monster death');
assert.equal(player.xp, 14, 'server grants configured monster experience');
assert.equal(player.totalKills, 1, 'server records the kill in authoritative progression');
assert.equal(player.killCounts.deer, 1, 'server records per-monster kill progression');
assert.ok([...state.drops.values()].some((drop) => drop.source === 'deer' && drop.gold > 0), 'server creates ground gold for a defeated monster');
assert.ok(
  worldSnapshot(state, session.token).drops.every((drop) => drop.ownerIds?.includes(player.id)),
  'monster loot protection is assigned by the server',
);

const goldDrop = [...state.drops.values()].find((drop) => drop.source === 'deer' && drop.gold > 0);
const goldBefore = player.gold;
assert.equal(applyPlayerAction(state, session.token, {
  type: 'pickup_drop',
  dropId: goldDrop.id,
}, 3200).ok, true, 'server validates monster-loot pickup');
assert.equal(player.gold, goldBefore + goldDrop.gold, 'picked monster gold reaches the authoritative currency ledger');

advanceWorldSystems(state, deer.respawnAt, 0.1);
assert.equal(deer.alive, true, 'server respawns a defeated world monster on its authoritative timer');
player.x = deer.x - 160;
player.y = deer.y;
deer.targetId = player.id;
advanceWorldSystems(state, deer.respawnAt + 1000, 0.1);
assert.equal(deer.facing, -1, 'server-owned monster faces left while moving toward a target on its left');
assert.equal(
  worldSnapshot(state, session.token).monsters.find((entry) => entry.id === deer.id)?.facing,
  -1,
  'monster facing is included in the authoritative snapshot',
);
deer.x = player.x;
deer.y = player.y;
deer.homeX = deer.x;
deer.homeY = deer.y;
deer.targetId = player.id;
deer.lastAttack = 0;
const hpBefore = player.hp;
advanceWorldSystems(state, deer.respawnAt + 2000, 0.1);
assert.ok(player.hp < hpBefore, 'server-owned monster AI damages an in-range player');

player.pkPoints = 100;
player.hp = 1;
deer.lastAttack = 0;
advanceWorldSystems(state, deer.respawnAt + 4000, 0.1);
assert.equal(player.mapId, 'bich', 'server-owned monster death returns the player to town');
assert.ok(player.events.some((event) => event.type === 'pve_death'), 'server emits an authoritative PvE death event');

console.log('server PvE authority: monster combat, XP, loot, pickup, AI damage and death are server-owned');
