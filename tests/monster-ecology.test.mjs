import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  advanceWorldSystems, applyPlayerAction, createWorldState, registerPlayer,
} from '../server/local-server.mjs';
import { ITEMS, MAPS, MONSTERS } from '../js/config.js';
import { refreshServerStats } from '../js/authoritative-rules.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const huntingMaps = ['field', 'valley', 'cave', 'centipede_cave', 'stone_tomb', 'temple', 'sanctum'];
for (const mapId of huntingMaps) {
  const map = MAPS[mapId];
  assert.ok(Array.isArray(map.recommendedLevel) && map.recommendedLevel.length === 2, `${mapId} declares its level band`);
  assert.ok(map.spawns.length >= 2, `${mapId} has more than one ecological role`);
}
assert.equal(MAPS.sabac.spawns.length, 0, 'siege space is reserved for players instead of filler monsters');

const behaviors = new Set(Object.values(MONSTERS).map((monster) => monster.behavior));
for (const required of ['passive', 'pack', 'ambush', 'charger', 'venom', 'ranged_caster', 'cleave', 'boss_caster']) {
  assert.ok(behaviors.has(required), `monster ecology includes ${required}`);
}

for (const monster of Object.values(MONSTERS)) {
  const animKey = monster.animKey || monster.id;
  for (const action of ['idle', 'walk', 'attack', 'death']) {
    assert.ok(
      existsSync(join(ROOT, 'assets/game/anim/mob', animKey, action, '00.png')),
      `${monster.id} reuses a semantically matching ${animKey}/${action} pack`,
    );
  }
  for (const drop of monster.drops) {
    assert.ok(ITEMS[drop.id], `${monster.id} drop ${drop.id} exists`);
    if (ITEMS[drop.id].rarity === 'legendary') {
      assert.ok(drop.rate <= 0.015, `${monster.id} legendary drops remain scarce`);
    }
  }
}

const originalRandom = Math.random;
Math.random = () => 0;
try {
  const state = createWorldState();
  const session = registerPlayer(state, { name: '生态测试员', classId: 'warrior' }, 1000);
  const player = state.players.get(session.player.id);
  player.level = 40;
  refreshServerStats(player, { fill: true });

  const deer = [...state.monsters.values()].find((monster) => monster.kind === 'deer');
  player.mapId = deer.mapId;
  player.x = deer.x + 40;
  player.y = deer.y;
  deer.targetId = null;
  advanceWorldSystems(state, 2000, 0.1);
  assert.equal(deer.targetId, null, 'passive prey does not aggro merely because a player is nearby');

  const wolves = [...state.monsters.values()].filter((monster) => monster.kind === 'wolf').slice(0, 2);
  player.mapId = wolves[0].mapId;
  player.x = wolves[0].x - 45;
  player.y = wolves[0].y;
  wolves[0].maxHp = wolves[0].hp = 10_000;
  wolves[1].x = wolves[0].x + 60;
  wolves[1].y = wolves[0].y;
  assert.equal(applyPlayerAction(state, session.token, {
    type: 'monster_attack', targetId: wolves[0].id, skillId: 'basic',
  }, 3000).ok, true);
  assert.equal(wolves[1].targetId, player.id, 'attacking one pack hunter alerts nearby packmates');

  const caster = [...state.monsters.values()].find((monster) => monster.kind === 'orc_shaman');
  for (const monster of state.monsters.values()) {
    if (monster.mapId === caster.mapId && monster.id !== caster.id) monster.alive = false;
  }
  player.mapId = caster.mapId;
  player.x = caster.x - 170;
  player.y = caster.y;
  caster.targetId = player.id;
  caster.lastAttack = 0;
  const casterHpBefore = player.hp;
  advanceWorldSystems(state, 5000, 0.1);
  assert.ok(player.hp < casterHpBefore, 'ranged caster attacks from outside melee distance');
  assert.ok(Math.hypot(player.x - caster.x, player.y - caster.y) > 100, 'ranged caster holds distance');

  const venom = [...state.monsters.values()].find((monster) => monster.kind === 'venom_centipede');
  for (const monster of state.monsters.values()) {
    if (monster.mapId === venom.mapId && monster.id !== venom.id) monster.alive = false;
  }
  player.mapId = venom.mapId;
  player.x = venom.x - 40;
  player.y = venom.y;
  player.hp = player.maxHp;
  venom.targetId = player.id;
  venom.lastAttack = 0;
  advanceWorldSystems(state, 7000, 0.1);
  assert.equal(player.monsterPoison?.monsterId, venom.id, 'venom monster applies an authoritative damage-over-time effect');

  const charger = [...state.monsters.values()].find((monster) => monster.kind === 'boar_king');
  for (const monster of state.monsters.values()) {
    if (monster.mapId === charger.mapId && monster.id !== charger.id) monster.alive = false;
  }
  player.mapId = charger.mapId;
  player.x = charger.x + 170;
  player.y = charger.y;
  player.hp = player.maxHp;
  charger.targetId = player.id;
  charger.lastSpecial = 0;
  const chargerX = charger.x;
  advanceWorldSystems(state, 13_000, 0.1);
  assert.ok(charger.x > chargerX, 'charger closes distance in a burst');
  assert.ok(player.events.some((event) => event.type === 'monster_charge'), 'charge has an explicit combat event');

  const boss = state.bosses.get('lord');
  for (const monster of state.monsters.values()) {
    if (monster.mapId === boss.mapId) monster.alive = false;
  }
  player.mapId = boss.mapId;
  player.x = boss.x - 55;
  player.y = boss.y;
  player.hp = player.maxHp;
  boss.targetId = player.id;
  boss.lastAttack = 0;
  boss.lastSpecial = 20_000;
  const bossHpBefore = player.hp;
  advanceWorldSystems(state, 21_000, 0.1);
  assert.ok(player.hp < bossHpBefore, 'world boss damage is server-authoritative');
  assert.ok(player.events.some((event) => event.kind === 'lord'), 'world boss attack is visible in the authoritative event stream');
} finally {
  Math.random = originalRandom;
}

console.log('monster ecology: level bands, scarce loot, passive/pack/ranged/venom/charge/cleave roles and boss AI OK');
