import assert from 'node:assert/strict';
import {
  advanceWorldSystems, applyPlayerAction, createWorldState, registerPlayer, worldSnapshot,
} from '../server/local-server.mjs';
import { COMBAT_RULES } from '../js/config.js';
import { refreshServerStats } from '../js/authoritative-rules.js';

function unlockAll(player, level = 40) {
  player.level = level;
  for (const skill of Object.values(player.skills)) {
    skill.learned = true;
    skill.level = 3;
    skill.exp = 9999;
  }
  refreshServerStats(player, { fill: true });
}

function placeWithMonster(state, player, kind = 'deer', distance = 120) {
  const monster = [...state.monsters.values()].find((entry) => entry.kind === kind && entry.alive);
  player.mapId = monster.mapId;
  player.x = monster.x - distance;
  player.y = monster.y;
  monster.homeX = monster.x;
  monster.homeY = monster.y;
  monster.targetId = null;
  monster.hp = monster.maxHp;
  return monster;
}

const originalRandom = Math.random;
Math.random = () => 0.5;
try {
  {
    const state = createWorldState();
    const session = registerPlayer(state, { name: '雷法', classId: 'wizard' }, 1000);
    const wizard = state.players.get(session.player.id);
    unlockAll(wizard);
    const target = placeWithMonster(state, wizard, 'deer', 180);
    target.maxHp = target.hp = 10_000;
    const act = (action, now) => applyPlayerAction(state, session.token, action, now);

    assert.equal(act({
      type: 'monster_attack', targetId: target.id, skillId: 'basic',
    }, 2000).ok, false, 'wizard basic attack is melee and cannot masquerade as a ranged spell');

    const mpBefore = wizard.mp;
    const hpBefore = target.hp;
    assert.equal(act({
      type: 'skill_cast', targetId: target.id, skillId: 'fireball',
    }, 2200).ok, true, 'learned fireball is accepted at spell range');
    assert.ok(target.hp < hpBefore, 'fireball damage is server-authoritative');
    assert.equal(wizard.mp, mpBefore - 6, 'fireball mana is deducted on the server');
    assert.equal(act({
      type: 'skill_cast', targetId: target.id, skillId: 'fireball',
    }, 2500).ok, false, 'server rejects a fireball cast inside its cooldown');

    const nearby = [...state.monsters.values()].find(
      (entry) => entry.id !== target.id && entry.kind === 'deer' && entry.mapId === target.mapId,
    );
    nearby.x = target.x + 24;
    nearby.y = target.y;
    nearby.maxHp = nearby.hp = 10_000;
    const nearbyHp = nearby.hp;
    assert.equal(act({
      type: 'skill_cast', targetId: target.id, skillId: 'burst',
    }, 4000).ok, true, 'ice burst is accepted at range');
    assert.ok(nearby.hp < nearbyHp, 'ice burst applies authoritative area damage');

    assert.equal(act({ type: 'skill_cast', skillId: 'shield' }, 5000).ok, true, 'magic shield is server-owned');
    assert.ok(wizard.shieldUntil > 5000, 'magic shield has an authoritative expiry');
  }

  {
    const state = createWorldState();
    const session = registerPlayer(state, { name: '玄门', classId: 'taoist' }, 1000);
    const taoist = state.players.get(session.player.id);
    unlockAll(taoist);
    const target = placeWithMonster(state, taoist, 'zombie', 160);
    target.maxHp = target.hp = 10_000;
    const act = (action, now) => applyPlayerAction(state, session.token, action, now);

    assert.equal(act({
      type: 'skill_cast', targetId: target.id, skillId: 'poison',
    }, 2000).ok, true, 'poison is accepted at talisman range');
    assert.equal(target.poison.sourcePlayerId, taoist.id, 'poison ownership is recorded on the target');
    const poisonedHp = target.hp;
    advanceWorldSystems(state, 3000, 1);
    assert.ok(target.hp < poisonedHp, 'server poison continues to tick after the initial cast');

    taoist.hp = 1;
    assert.equal(act({ type: 'skill_cast', skillId: 'heal' }, 4000).ok, true, 'healing spell is server-owned');
    assert.ok(taoist.hp > 1, 'healing restores authoritative health');

    assert.equal(act({ type: 'skill_cast', skillId: 'summon' }, 5000).ok, true, 'summon creates an authoritative pet');
    assert.ok(taoist.pet?.hp > 0, 'summoned skeleton has authoritative health');
    assert.ok(worldSnapshot(state, session.token).pets.some((pet) => pet.ownerId === taoist.id), 'pet is present in world snapshots');
    target.x = taoist.pet.x + 30;
    target.y = taoist.pet.y;
    target.hp = target.maxHp;
    taoist.pet.targetId = target.id;
    const petTargetHp = target.hp;
    advanceWorldSystems(state, 6500, 0.1);
    assert.ok(target.hp < petTargetHp, 'server-owned skeleton attacks nearby monsters');

    const allySession = registerPlayer(state, { name: '队友', classId: 'warrior' }, 7000);
    const ally = state.players.get(allySession.player.id);
    ally.mapId = taoist.mapId;
    ally.x = taoist.x + 40;
    ally.y = taoist.y;
    ally.hp = 1;
    taoist.teamId = ally.teamId = 'test-team';
    assert.equal(act({
      type: 'skill_cast', skillId: 'heal', targetId: ally.id,
    }, 8000).ok, true, 'taoist can heal a nearby allied player');
    assert.ok(ally.hp > 1, 'allied healing changes the target authoritative health');
  }

  {
    const state = createWorldState();
    const session = registerPlayer(state, { name: '烈火刀', classId: 'warrior' }, 1000);
    const warrior = state.players.get(session.player.id);
    unlockAll(warrior);
    const target = placeWithMonster(state, warrior, 'zombie', 50);
    target.maxHp = target.hp = 10_000;
    const act = (action, now) => applyPlayerAction(state, session.token, action, now);

    assert.equal(act({ type: 'skill_cast', skillId: 'fire_sword' }, 2000).ok, true, 'fire sword stores an authoritative next-hit boost');
    assert.equal(warrior.activeBoost.id, 'fire_sword');
    const hpBefore = target.hp;
    assert.equal(act({
      type: 'monster_attack', targetId: target.id, skillId: 'basic',
    }, 2600).ok, true, 'next basic swing consumes the stored fire-sword boost');
    assert.equal(warrior.activeBoost, null);
    assert.ok(hpBefore - target.hp > warrior.atk, 'fire-sword hit is materially stronger than a plain swing');
    target.alive = false;

    const rushTarget = [...state.monsters.values()].find(
      (entry) => entry.id !== target.id && entry.alive && entry.mapId === warrior.mapId,
    );
    for (const monster of state.monsters.values()) {
      if (monster.mapId === warrior.mapId && monster.id !== rushTarget.id) monster.alive = false;
    }
    rushTarget.x = warrior.x + 150;
    rushTarget.y = warrior.y;
    const startX = warrior.x;
    assert.equal(act({
      type: 'skill_cast', targetId: rushTarget.id, skillId: 'rush',
    }, 4000).ok, true, 'rush is server-authoritative');
    assert.ok(warrior.x > startX, 'rush advances the warrior without teleporting through the target');
    assert.ok(rushTarget.stunUntil > 4000, 'rush applies server-owned hit-stun');
  }

  {
    const state = createWorldState();
    const firstSession = registerPlayer(state, { name: '甲', classId: 'warrior' }, 1000);
    const secondSession = registerPlayer(state, { name: '乙', classId: 'warrior' }, 1000);
    const first = state.players.get(firstSession.player.id);
    const second = state.players.get(secondSession.player.id);
    first.mapId = second.mapId = 'field';
    first.x = 500;
    first.y = second.y = 500;
    second.x = 500 + COMBAT_RULES.playerBodyRadius * 2 + 6;
    applyPlayerAction(state, firstSession.token, {
      type: 'move', mapId: 'field', x: second.x, y: second.y,
    }, 2000);
    assert.ok(
      Math.hypot(first.x - second.x, first.y - second.y) >= COMBAT_RULES.playerBodyRadius * 2 - 2,
      'server body blocking prevents players from walking through each other',
    );
  }
} finally {
  Math.random = originalRandom;
}

console.log('server class combat: melee range, skill cooldowns, AoE, shield, poison, heal, summon, rush and body blocking OK');
