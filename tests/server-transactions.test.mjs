import assert from 'node:assert/strict';
import {
  applyPlayerAction, createWorldState, registerPlayer, worldSnapshot,
} from '../server/local-server.mjs';
import { MAPS, WORLD } from '../js/config.js';
import {
  addServerItem, createServerItem, refreshServerStats,
} from '../js/authoritative-rules.js';

const state = createWorldState();
const session = registerPlayer(state, { name: '账本战士', classId: 'warrior' }, 1000);
const player = state.players.get(session.player.id);
const act = (action, now) => applyPlayerAction(state, session.token, action, now);

const captain = MAPS.bich.npcs.find((npc) => npc.id === 'captain');
player.x = captain.x * WORLD.tile;
player.y = captain.y * WORLD.tile;
player.xp = 60;
assert.equal(act({ type: 'quest_interact', npcId: 'captain' }, 1500).ok, true, 'server completes a validated NPC talk quest');
assert.equal(player.questId, 'q_deer', 'server advances the authoritative quest chain');
assert.equal(player.level, 2, 'authoritative quest experience crosses the level threshold');
assert.equal(player.xp, 0, 'level-up consumes only the required experience and preserves overflow');
assert.deepEqual(player.events.at(-1).levels, [2], 'quest completion event reports the gained level for UI feedback');
assert.equal(player.gold, 200, 'server grants authoritative quest currency');
assert.equal(player.bag.find((entry) => entry.id === 'hp_pot').qty, 15, 'server grants and stacks quest items');

const goldBeforeBuy = player.gold;
assert.equal(act({ type: 'buy_item', itemId: 'hp_pot' }, 1700).ok, true, 'server validates a town shop purchase');
assert.equal(player.gold, goldBeforeBuy - 25, 'shop purchase charges the authoritative ledger');
assert.equal(player.bag.find((entry) => entry.id === 'hp_pot').qty, 16, 'shop purchase reaches authoritative inventory');
assert.equal(act({ type: 'buy_item', itemId: 'dragon_blade' }, 1800).ok, false, 'server rejects items outside the configured town shop');

player.level = 7;
refreshServerStats(player, { fill: true });
addServerItem(player, { id: 'book_slash', qty: 1 });
const bookIndex = player.bag.findIndex((entry) => entry.id === 'book_slash');
assert.equal(act({
  type: 'use_item', index: bookIndex, itemId: 'book_slash',
}, 1900).ok, true, 'server validates and consumes an eligible skill book');
assert.equal(player.skills.slash.learned, true, 'learned skill lives in the authoritative character state');
assert.equal(player.bag.some((entry) => entry.id === 'book_slash'), false, 'consumed skill book leaves the server inventory');

addServerItem(player, createServerItem('iron_sword'));
const swordIndex = player.bag.findIndex((entry) => entry.id === 'iron_sword');
const swordUid = player.bag[swordIndex].uid;
assert.equal(act({
  type: 'use_item', index: swordIndex, itemId: 'iron_sword', uid: swordUid,
}, 2000).ok, true, 'server validates equipment changes');
assert.equal(player.equip.weapon.id, 'iron_sword', 'equipped weapon is authoritative');
assert.ok(player.atk > 14, 'server recalculates combat stats from authoritative equipment');

player.gold = 10_000;
addServerItem(player, { id: 'black_iron', qty: 1 });
const originalRandom = Math.random;
Math.random = () => 0;
try {
  assert.equal(act({ type: 'enhance_slot', slot: 'weapon' }, 2100).ok, true, 'server validates enhancement cost and roll');
} finally {
  Math.random = originalRandom;
}
assert.equal(player.equip.weapon.enhance, 1, 'enhancement result is stored on the server item instance');

player.equip.weapon.durability = 1;
const repairGold = player.gold;
assert.equal(act({ type: 'repair_all' }, 2200).ok, true, 'server validates town repair');
assert.equal(player.equip.weapon.durability, player.equip.weapon.maxDurability, 'server repair restores authoritative durability');
assert.ok(player.gold < repairGold, 'server repair charges authoritative currency');

addServerItem(player, { id: 'herb', qty: 3 });
const potionsBeforeCraft = player.bag.find((entry) => entry.id === 'hp_pot').qty;
assert.equal(act({ type: 'craft_recipe', recipeId: 'hp_bundle' }, 2300).ok, true, 'server validates crafting materials and currency');
assert.equal(player.bag.find((entry) => entry.id === 'hp_pot').qty, potionsBeforeCraft + 5, 'crafted output enters the authoritative inventory');
assert.equal(player.bag.some((entry) => entry.id === 'herb'), false, 'crafting consumes authoritative materials');

player.hp = 1;
player.mp = 0;
assert.equal(act({ type: 'heal_full' }, 2400).ok, true, 'server validates safe-zone healing');
assert.equal(player.hp, player.maxHp, 'safe-zone heal restores authoritative health');
assert.equal(player.mp, player.maxMp, 'safe-zone heal restores authoritative mana');

const self = worldSnapshot(state, session.token).self;
assert.equal(self.equip.weapon.id, 'iron_sword', 'private snapshot exposes the authoritative equipment ledger');
assert.equal(self.skills.slash.learned, true, 'private snapshot exposes authoritative skill progression');

console.log('server transactions: quests, shops, skills, equipment, enhancement, repair, crafting and healing are authoritative');
