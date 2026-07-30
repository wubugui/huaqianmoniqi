import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);
const { Game } = await import(pathToFileURL(join(ROOT, 'js/game.js')).href);
const {
  Drop, Monster, Player, createItemEntry,
} = await import(pathToFileURL(join(ROOT, 'js/entities.js')).href);

globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.window = globalThis;
globalThis.localStorage = {
  _data: new Map(),
  getItem(key) { return this._data.get(key) || null; },
  setItem(key, value) { this._data.set(key, String(value)); },
  removeItem(key) { this._data.delete(key); },
};

const ctx = {
  setTransform() {}, clearRect() {}, fillRect() {}, strokeRect() {}, drawImage() {},
  beginPath() {}, arc() {}, fill() {}, stroke() {}, save() {}, restore() {}, translate() {},
  scale() {}, fillText() {},
};
const canvas = { style: {}, getContext: () => ctx };
const img = { width: 64, height: 64 };
const assets = {
  units: { warrior: img, wizard: img, taoist: img },
  anim: Object.fromEntries(Object.keys(config.CLASSES).map((id) => [
    id,
    Object.fromEntries(['idle', 'walk', 'run', 'jump', 'attack'].map((action) => [action, [img]])),
  ])),
  mobs: Object.fromEntries(Object.keys(config.MONSTERS).map((id) => [id, img])),
  npc: { healer: img, merchant: img, warehouse: img, captain: img },
  maps: { town: img, field: img, temple: img },
  scenery: {},
  tiles: {},
};

const game = new Game(canvas, assets, { classId: 'warrior', name: 'LootTest' });
game.loadMap('field', 20, 14);

const manualDrop = new Drop(game.player.x, game.player.y, 'iron_sword', 0, {
  ownerId: game.player.id,
  protectedUntil: game.time + 10,
  entry: createItemEntry('iron_sword', { rollAffix: false }),
});
game.drops = [manualDrop];
game.update(0.016);
assert.equal(manualDrop.alive, true, 'walking over a drop does not auto-pick it up');
assert.equal(game.pickupDrop(manualDrop), true, 'owner can manually pick up protected loot');
assert.equal(manualDrop.alive, false, 'manual pickup removes the ground drop');

const foreign = new Drop(game.player.x, game.player.y, null, 25, {
  ownerId: 999,
  protectedUntil: game.time + 8,
});
game.drops = [foreign];
const goldBefore = game.player.gold;
assert.equal(game.pickupDrop(foreign), false, 'non-owner cannot pick up protected loot');
assert.equal(game.player.gold, goldBefore, 'blocked pickup grants no gold');
game.time = foreign.protectedUntil;
assert.equal(game.pickupDrop(foreign), true, 'loot becomes public when ownership protection expires');
assert.equal(game.player.gold, goldBefore + 25, 'public gold pickup grants its value');

const monster = new Monster('deer', game.player.x, game.player.y);
monster.rollDrop = () => ({ gold: 7, items: ['wood_sword'] });
game.kill(game.player, monster);
const monsterDrops = game.drops.filter((drop) => drop.alive);
assert.equal(monsterDrops.length, 2, 'monster kill creates ground gold and item drops');
assert.ok(monsterDrops.every((drop) => drop.ownerId === game.player.id), 'monster loot is assigned to the killer');
assert.ok(monsterDrops.every((drop) => drop.protectedUntil > game.time), 'killer loot receives a protection timer');

const victim = game.player;
victim.bag = [
  { id: 'hp_pot', qty: 3 },
  createItemEntry('iron_sword', { rollAffix: false }),
  { id: 'deer_meat', qty: 1 },
];
victim.equip.armor = createItemEntry('cloth', { rollAffix: false });
victim.pkPoints = 100;
victim.gold = 1000;
const random = Math.random;
Math.random = () => 0;
const deathDrops = game.dropPlayerLoot(victim);
Math.random = random;
assert.ok(deathDrops.some((drop) => drop.itemId === 'hp_pot' || drop.itemId === 'iron_sword'), 'red-name death drops bag loot');
assert.ok(deathDrops.some((drop) => drop.itemId === 'cloth'), 'red-name death can drop equipped gear');
assert.ok(deathDrops.some((drop) => drop.gold > 0), 'death drops a percentage of carried gold');
assert.ok(victim.bag.some((entry) => entry.id === 'deer_meat'), 'quest items are protected from death drops');

game.loadMap('bich');
const safeBagCount = victim.bag.length;
assert.deepEqual(game.dropPlayerLoot(victim), [], 'safe-zone death creates no loot');
assert.equal(victim.bag.length, safeBagCount, 'safe-zone death preserves inventory');

const attacker = new Player('warrior', 'Attacker', 0, 0);
const target = new Player('wizard', 'Target', 10, 0);
game.player = attacker;
assert.equal(game.canAttackPlayer(attacker, target), false, 'safe zone blocks player attacks');
game.loadMap('field', 20, 14);
attacker.pkMode = 'peace';
assert.equal(game.canAttackPlayer(attacker, target), false, 'peace mode blocks player attacks');
attacker.pkMode = 'all';
assert.equal(game.canAttackPlayer(attacker, target), true, 'all mode permits attacks outside safe zones');
game.registerPlayerKill(attacker, target);
assert.equal(attacker.pkPoints, 100, 'unjustified player kill adds PK points');
assert.equal(game.pkStatus(attacker).id, 'red', '100 PK points changes the name to red');
const redPoints = attacker.pkPoints;
target.pkPoints = 100;
game.registerPlayerKill(attacker, target);
assert.equal(attacker.pkPoints, redPoints, 'defeating a red-name player adds no crime points');

const restored = Player.fromSave(attacker.serialize(), 0, 0);
assert.equal(restored.pkMode, 'all', 'save/load preserves PK mode');
assert.equal(restored.pkPoints, 100, 'save/load preserves PK points');
assert.equal(restored.playerKills, 2, 'save/load preserves player kill count');

console.log('loot/pk: ownership, manual pickup, death drops, safe zones and red-name rules OK');
