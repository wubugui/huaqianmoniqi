import assert from 'node:assert/strict';
import {
  advanceWorldSystems, applyPlayerAction, createWorldState, registerPlayer, worldSnapshot,
} from '../server/local-server.mjs';
import { MAPS, WORLD } from '../js/config.js';
import { addServerItem, refreshServerStats } from '../js/authoritative-rules.js';

const state = createWorldState();
const attackerSession = registerPlayer(state, {
  name: '攻城战士', classId: 'warrior', level: 40, hp: 1200, maxHp: 1200,
}, 1000);
const defenderSession = registerPlayer(state, {
  name: '守城法师', classId: 'wizard', level: 40, hp: 500, maxHp: 500,
}, 1000);
const act = (session, action, now) => applyPlayerAction(state, session.token, action, now);
const attacker = state.players.get(attackerSession.player.id);
const defender = state.players.get(defenderSession.player.id);
attacker.level = 35;
defender.level = 35;
attacker.gold = 20_000;
defender.gold = 5_000;
addServerItem(attacker, { id: 'orc_tooth', qty: 1 });
addServerItem(defender, { id: 'orc_tooth', qty: 1 });
refreshServerStats(attacker, { fill: true });
refreshServerStats(defender, { fill: true });

assert.equal(act(attackerSession, { type: 'guild_create', name: '烈焰' }, 1100).ok, true, 'attacker guild is created');
assert.equal(act(defenderSession, { type: 'guild_create', name: '苍月' }, 1200).ok, true, 'defender guild is created');
assert.equal(act(attackerSession, {
  type: 'guild_war_declare',
  targetGuildId: defender.guildId,
}, 1300).ok, true, 'guild leader can declare war');

attacker.mapId = 'field';
defender.mapId = 'field';
attacker.x = defender.x = 20 * WORLD.tile;
attacker.y = defender.y = 14 * WORLD.tile;
defender.hp = 1;
defender.dodge = 0;
attacker.pkMode = 'peace';
assert.equal(act(attackerSession, {
  type: 'pvp_attack',
  targetId: defender.id,
  damage: 999,
}, 2000).ok, true, 'declared guild war permits server-authoritative PvP even in peace mode');
assert.equal(attacker.pkPoints, 0, 'guild-war kill does not add PK crime points');
const war = [...state.guildWars.values()][0];
assert.equal(war.scoreA, 1, 'guild-war kill increments the correct score');
assert.equal(defender.mapId, 'bich', 'defeated player is returned to the safe city');

const boss = state.bosses.get('lord');
attacker.mapId = 'sanctum';
attacker.x = boss.x;
attacker.y = boss.y;
boss.hp = 1;
assert.equal(act(attackerSession, {
  type: 'boss_damage',
  bossId: 'lord',
  damage: 999,
}, 3200).ok, true, 'server accepts a valid world boss hit after the shared attack recovery');
assert.equal(boss.alive, false, 'world boss death is authoritative on the server');
assert.ok(attacker.events.some((event) => event.type === 'boss_reward'), 'boss contributor receives ranked reward event');
advanceWorldSystems(state, boss.respawnAt, 0.1);
assert.equal(boss.alive, true, 'world boss respawns on the authoritative timer');
assert.equal(boss.hp, boss.maxHp, 'respawn restores boss health');

state.sabac.ownerGuildId = defender.guildId;
addServerItem(attacker, { id: 'lord_seal', qty: 1 });
assert.equal(act(attackerSession, { type: 'sabac_declare' }, 3500).ok, true, 'qualified guild leader can pay to declare a Sabac siege');
assert.equal(state.sabac.war.phase, 'gate', 'siege begins at the city gate phase');
const gate = MAPS.sabac.siegeGate;
attacker.mapId = 'sabac';
attacker.x = gate.x * WORLD.tile;
attacker.y = gate.y * WORLD.tile;
attacker.hp = attacker.maxHp;
state.sabac.war.gateHp = 1;
assert.equal(act(attackerSession, {
  type: 'sabac_objective_attack',
  skillId: 'basic',
}, 4500).ok, true, 'attacker can damage the authoritative city gate at melee range');
assert.equal(state.sabac.war.gateHp, 0, 'city gate health reaches zero');
assert.equal(state.sabac.war.phase, 'palace', 'destroying the gate opens the palace phase');

const zone = MAPS.sabac.captureZone;
attacker.x = zone.x * WORLD.tile;
attacker.y = zone.y * WORLD.tile;
advanceWorldSystems(state, 5500, 10);
const progressBeforeDefense = state.sabac.war.captureProgress;
defender.mapId = 'sabac';
defender.x = zone.x * WORLD.tile;
defender.y = zone.y * WORLD.tile;
defender.hp = defender.maxHp;
advanceWorldSystems(state, 6500, 5);
assert.ok(state.sabac.war.captureProgress < progressBeforeDefense, 'an equal defending force pushes palace occupation backward');
defender.x = 5 * WORLD.tile;
defender.y = 25 * WORLD.tile;
const captureGold = attacker.gold;
advanceWorldSystems(state, 70_000, 65);
assert.equal(state.sabac.ownerGuildId, attacker.guildId, 'uncontested palace occupation captures Sabac');
assert.equal(state.sabac.war.status, 'captured', 'siege closes immediately on full capture progress');
assert.equal(worldSnapshot(state).sabac.ownerGuildName, '烈焰', 'public world state exposes the current Sabac owner');
assert.equal(attacker.gold, captureGold + 1500, 'winning guild member receives the authoritative siege reward');

console.log('warfare: paid guild war, team-owned boss loot, gate assault, defended palace and Sabac rewards OK');
