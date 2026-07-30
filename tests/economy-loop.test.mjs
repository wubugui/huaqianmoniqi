import assert from 'node:assert/strict';
import {
  applyPlayerAction, createWorldState, registerPlayer,
} from '../server/local-server.mjs';
import {
  ENHANCE_MAX, ITEMS, SHOP_TOWN,
} from '../js/config.js';
import {
  addServerItem, createServerDropItem, createServerItem, refreshServerStats, serverAttackDamage,
} from '../js/authoritative-rules.js';

assert.equal(ENHANCE_MAX, 7, 'classic weapon upgrading stops at +7');
assert.equal(SHOP_TOWN.includes('blessing_oil'), false, 'blessing oil remains a hunt/craft chase item');
assert.equal(SHOP_TOWN.includes('magic_ring'), false, 'rare jewellery cannot be bought from the town shop');
assert.equal(SHOP_TOWN.some((id) => ['epic', 'legendary'].includes(ITEMS[id].rarity)), false,
  'town shop cannot sell endgame rarity equipment');

const lucky = {
  atk: 100, mag: 100, crit: 0, weaponLuck: 7, weaponCurse: 0,
};
const cursed = {
  atk: 100, mag: 100, crit: 0, weaponLuck: 0, weaponCurse: 7,
};
const defender = { defense: 0, magDef: 0 };
const originalRandom = Math.random;
Math.random = () => 0;
const luckyHit = serverAttackDamage(lucky, defender);
Math.random = () => 0.999;
const cursedHit = serverAttackDamage(cursed, defender);
Math.random = originalRandom;
assert.equal(luckyHit.damage, 100, 'luck +7 forces the physical attack ceiling');
assert.equal(luckyHit.highRoll, true, 'maximum-luck hit is labelled as a high roll');
assert.equal(cursedHit.damage, 68, 'curse +7 forces the physical attack floor');
assert.equal(serverAttackDamage(lucky, defender, { magical: true }).highRoll, false,
  'weapon luck does not force spell damage to its ceiling');

const excellent = createServerDropItem('iron_sword', { elite: true, random: () => 0 });
const ordinary = createServerDropItem('iron_sword', { random: () => 0.999 });
assert.ok(Object.keys(excellent.bonus).length >= 1, 'elite equipment can carry an excellent affix');
assert.deepEqual(ordinary.bonus, {}, 'most regular equipment remains ordinary');

const state = createWorldState();
const session = registerPlayer(state, { name: '经济测试', classId: 'warrior' }, 1000);
const player = state.players.get(session.player.id);
const act = (action, now) => applyPlayerAction(state, session.token, action, now);
player.gold = 20_000;
player.equip.weapon = createServerItem('iron_sword', { enhance: 3 });
player.enhance.weapon = 3;
player.equip.armor = createServerItem('cloth');
addServerItem(player, { id: 'black_iron', qty: 20 });
refreshServerStats(player, { fill: true });

assert.equal(act({ type: 'enhance_slot', slot: 'armor' }, 1500).ok, false,
  'black iron upgrading is restricted to weapons');
Math.random = () => 1;
try {
  assert.equal(act({ type: 'enhance_slot', slot: 'weapon' }, 1600).ok, true,
    'a failed risky upgrade is still a committed server transaction');
} finally {
  Math.random = originalRandom;
}
assert.equal(player.equip.weapon, null, 'failure while attempting +4 destroys the weapon');
assert.equal(player.enhance.weapon, 0, 'destroyed weapon clears the legacy enhancement ledger');

player.hp = 1;
let potionIndex = player.bag.findIndex((entry) => entry.id === 'hp_pot');
assert.equal(act({ type: 'use_item', index: potionIndex, itemId: 'hp_pot' }, 3000).ok, true,
  'first potion use succeeds');
player.hp = 1;
potionIndex = player.bag.findIndex((entry) => entry.id === 'hp_pot');
assert.equal(act({ type: 'use_item', index: potionIndex, itemId: 'hp_pot' }, 3500).ok, false,
  'potions share an authoritative cooldown');
assert.equal(act({ type: 'use_item', index: potionIndex, itemId: 'hp_pot' }, 4200).ok, true,
  'potion can be used after the cooldown');

player.mapId = 'field';
player.combatLockUntil = 6000;
addServerItem(player, { id: 'random_scroll', qty: 1 });
const randomScrollIndex = player.bag.findIndex((entry) => entry.id === 'random_scroll');
const positionBeforeRandom = `${player.x}:${player.y}`;
Math.random = () => 0.5;
try {
  assert.equal(act({ type: 'use_item', index: randomScrollIndex, itemId: 'random_scroll' }, 4800).ok, true,
    'random scroll can disengage during an active fight');
} finally {
  Math.random = originalRandom;
}
assert.equal(player.mapId, 'field', 'random scroll stays in the current hunting zone');
assert.notEqual(`${player.x}:${player.y}`, positionBeforeRandom, 'random scroll changes the authoritative position');
const recallIndex = player.bag.findIndex((entry) => entry.id === 'recall');
assert.equal(act({ type: 'use_item', index: recallIndex, itemId: 'recall' }, 5000).ok, false,
  'recall scroll cannot bypass an active fight');
assert.equal(act({ type: 'use_item', index: recallIndex, itemId: 'recall' }, 6100).ok, true,
  'recall scroll works after combat lock expires');

player.mapId = 'temple';
player.combatLockUntil = 9000;
addServerItem(player, { id: 'dungeon_scroll', qty: 1 });
const dungeonScrollIndex = player.bag.findIndex((entry) => entry.id === 'dungeon_scroll');
assert.equal(act({ type: 'use_item', index: dungeonScrollIndex, itemId: 'dungeon_scroll' }, 6200).ok, true,
  'dungeon escape scroll provides an emergency exit from a dangerous zone');
assert.equal(player.mapId, 'bich', 'dungeon escape scroll returns the player to the safe city');

player.level = 7;
refreshServerStats(player, { fill: true });
player.hp = 1;
const goldBeforeHealing = player.gold;
assert.equal(act({ type: 'heal_full' }, 7000).ok, true, 'town healer restores an injured veteran');
assert.ok(player.gold < goldBeforeHealing, 'healing above novice level is a gold sink');

console.log('economy loop: scarce shop, luck ceiling, excellent drops, risky +7 weapons, potion lock and paid healing OK');
