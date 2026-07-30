import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);
const { Game } = await import(pathToFileURL(join(ROOT, 'js/game.js')).href);
const {
  Player, createItemEntry, normalizeItemEntry,
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

assert.equal(config.EQUIP_SLOTS.length, 8, 'classic equipment layout has eight physical slots');
assert.equal(config.SLOT_TYPES.ringLeft, 'ring', 'left ring accepts ring items');
assert.equal(config.SLOT_TYPES.ringRight, 'ring', 'right ring accepts ring items');

const firstSword = createItemEntry('iron_sword', { rollAffix: false });
const secondSword = createItemEntry('iron_sword', { rollAffix: false });
assert.notEqual(firstSword.uid, secondSword.uid, 'same item type creates distinct equipment instances');
assert.equal(firstSword.durability, config.ITEMS.iron_sword.durability, 'new equipment starts at full durability');

const originalRandom = Math.random;
Math.random = () => 0;
const excellentSword = createItemEntry('iron_sword');
Math.random = originalRandom;
assert.equal(excellentSword.bonus.atk, 1, 'equipment drops can roll a deterministic excellent stat');

const legacySword = normalizeItemEntry('iron_sword');
assert.ok(legacySword.uid && legacySword.maxDurability > 0, 'legacy string equipment migrates to an instance');

const game = new Game(canvas, assets, { classId: 'warrior', name: 'EquipmentTest' });
game.player.level = 20;
game.player.bag = [
  createItemEntry('power_ring', { rollAffix: false }),
  createItemEntry('power_ring', { rollAffix: false }),
];
game.player.selectedBag = 0;
game.useSelectedItem();
game.player.selectedBag = 0;
game.useSelectedItem();
assert.equal(game.player.equip.ringLeft.id, 'power_ring', 'first ring equips to left slot');
assert.equal(game.player.equip.ringRight.id, 'power_ring', 'second ring equips to right slot');

const armor = createItemEntry('cloth', { rollAffix: false });
game.player.equip.armor = armor;
game.player.recalc();
const defenseWithArmor = game.player.defense;
game.damageDurability('armor', armor.maxDurability);
assert.equal(armor.durability, 0, 'durability damage can break equipment');
assert.ok(game.player.defense < defenseWithArmor, 'broken equipment no longer grants stats');

game.player.gold = 10_000;
const repair = game.repairAll();
assert.equal(repair.ok, true, 'safe-zone repair succeeds');
assert.equal(armor.durability, armor.maxDurability, 'repair restores full durability');
assert.ok(game.player.defense >= defenseWithArmor, 'repaired equipment restores stats');

game.player.equip.weapon = createItemEntry('iron_sword', { rollAffix: false });
game.player.bag = [{ id: 'blessing_oil', qty: 1 }];
game.player.selectedBag = 0;
Math.random = () => 0;
game.useSelectedItem();
Math.random = originalRandom;
assert.equal(game.player.equip.weapon.luck, 1, 'blessing oil increases equipped weapon luck on success');
assert.equal(game.player.countItem('blessing_oil'), 0, 'blessing oil is consumed');

game.player.gold = 10_000;
game.player.addItem('black_iron', 20);
Math.random = () => 0;
const enhanced = game.enhanceSlot('weapon');
Math.random = originalRandom;
assert.equal(enhanced.ok, true, 'equipment enhancement succeeds with guaranteed roll');
assert.equal(game.player.equip.weapon.enhance, 1, 'enhancement belongs to the equipment instance');
game.unequip('weapon');
const storedWeapon = game.player.bag.find((entry) => entry.id === 'iron_sword');
assert.equal(storedWeapon.enhance, 1, 'unequipping preserves instance enhancement');
assert.equal(storedWeapon.luck, 1, 'unequipping preserves weapon luck');

const saved = game.player.serialize();
const restored = Player.fromSave(saved, 0, 0);
const restoredWeapon = restored.bag.find((entry) => entry.uid === storedWeapon.uid);
assert.equal(restoredWeapon.enhance, 1, 'save/load preserves instance enhancement');
assert.equal(restoredWeapon.luck, 1, 'save/load preserves instance luck');

const legacySave = {
  ...saved,
  equip: { weapon: 'iron_sword', ring: 'power_ring' },
  enhance: { weapon: 3, ring: 2 },
};
const migrated = Player.fromSave(legacySave, 0, 0);
assert.equal(migrated.equip.weapon.enhance, 3, 'legacy slot enhancement migrates onto weapon instance');
assert.equal(migrated.equip.ringLeft.id, 'power_ring', 'legacy single ring migrates to left ring slot');
assert.equal(migrated.equip.ringLeft.enhance, 2, 'legacy ring enhancement migrates with the item');

console.log('equipment: instances, dual slots, affixes, durability, repair, luck and migration OK');
