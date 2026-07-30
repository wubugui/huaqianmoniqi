import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.innerWidth = 960;
globalThis.innerHeight = 640;
globalThis.window = globalThis;
globalThis.localStorage = {
  _data: new Map(),
  getItem(key) { return this._data.get(key) || null; },
  setItem(key, value) { this._data.set(key, String(value)); },
  removeItem(key) { this._data.delete(key); },
};

const mockImage = () => ({ width: 64, height: 64 });
const context = {
  setTransform() {}, clearRect() {}, fillRect() {}, strokeRect() {}, drawImage() {},
  beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {}, save() {}, restore() {},
  translate() {}, scale() {}, rotate() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
  closePath() {}, setLineDash() {}, fillText() {},
  createLinearGradient() { return { addColorStop() {} }; },
  createRadialGradient() { return { addColorStop() {} }; },
  fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', globalAlpha: 1,
};
const canvas = { width: 0, height: 0, style: {}, getContext: () => context };
const { MONSTERS, QUESTS } = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);
const imageMap = Object.fromEntries(Object.keys(MONSTERS).map((id) => [id, mockImage()]));
const assets = {
  units: { warrior: mockImage(), wizard: mockImage(), taoist: mockImage() },
  portraits: {}, avatars: {}, anim: {}, mobs: imageMap, mobAnim: {},
  npc: { healer: mockImage(), merchant: mockImage(), warehouse: mockImage(), captain: mockImage() },
  npcAnim: {}, maps: { town: mockImage(), field: mockImage(), temple: mockImage() },
  scenery: {
    tree: mockImage(), pine: mockImage(), bush: mockImage(), rock: mockImage(),
    rock_small: mockImage(), grass: mockImage(), flower: mockImage(), wall: mockImage(),
    house_a: mockImage(), house_b: mockImage(),
  },
  tiles: { grass: mockImage(), dirt: mockImage(), road: mockImage() },
};
const { Game } = await import(pathToFileURL(join(ROOT, 'js/game.js')).href);
const game = new Game(canvas, assets, { classId: 'warrior', name: '采集测试' });

assert.ok(QUESTS.some((quest) => quest.id === 'q_wolf'), 'wolf quest is in main chain');
assert.ok(QUESTS.some((quest) => quest.id === 'q_mining'), 'mining quest is in main chain');
assert.ok(QUESTS.some((quest) => quest.id === 'q_centipede'), 'centipede quest is in main chain');
assert.ok(QUESTS.some((quest) => quest.id === 'q_boar'), 'boar quest is in main chain');
assert.ok(game.npcs.some((npc) => npc.id === 'blacksmith' && npc.action === 'craft'), 'town has an animated crafting NPC');

game.player.questId = 'q_deer';
game.player.questProgress = { deer: 8 };
game.checkQuestComplete();
assert.equal(game.player.questReady, true, 'finished objective becomes ready to hand in');
assert.equal(game.player.completedQuests.includes('q_deer'), false, 'quest does not auto-reward in the field');
game.talkQuest('captain');
assert.equal(game.player.completedQuests.includes('q_deer'), true, 'captain dialogue hands quest in');
assert.equal(game.player.questId, 'q_wolf', 'hand-in advances the main quest');

game.loadMap('field', 10, 15);
const herb = game.gatherNodes.find((node) => node.type === 'herb');
assert.ok(herb?.active, 'field creates active herb nodes');
game.player.x = herb.x + 40;
game.player.y = herb.y;
const herbsBefore = game.player.countItem('herb');
assert.equal(game.tryGather(herb), true, 'herb gathering starts without a tool');
game.update(0.8);
assert.ok(game.player.countItem('herb') > herbsBefore, 'herb gathering yields material');

game.player.addItem('pickaxe', 1);
const pickaxeIndex = game.player.bag.findIndex((entry) => entry.id === 'pickaxe');
const pickaxe = game.player.bag.splice(pickaxeIndex, 1)[0];
game.player.equip.weapon = pickaxe;
game.player.recalc();
game.loadMap('cave', 8, 8);
const copper = game.gatherNodes.find((node) => node.type === 'copper');
game.player.x = copper.x + 40;
game.player.y = copper.y;
const durabilityBefore = pickaxe.durability;
const copperBefore = game.player.countItem('copper_ore');
assert.equal(game.tryGather(copper), true, 'equipped pickaxe starts mining');
game.update(1.2);
assert.ok(game.player.countItem('copper_ore') > copperBefore, 'mining yields copper ore');
assert.equal(pickaxe.durability, durabilityBefore - 1, 'mining consumes pickaxe durability');
assert.ok(game.player.gatheringCount >= 2, 'gathering mastery tracks successful actions');

game.player.equip.weapon = null;
game.player.recalc();
assert.equal(game.tryGather(copper), false, 'mining is blocked without an equipped pickaxe');

const herbBeforeCraft = game.player.countItem('herb');
game.player.addItem('herb', 3);
game.player.gold = 100;
const hpBeforeCraft = game.player.countItem('hp_pot');
assert.equal(game.craftRecipe('hp_bundle'), true, 'gathered herbs can be crafted into supplies');
assert.equal(game.player.countItem('herb'), herbBeforeCraft, 'crafting consumes materials atomically');
assert.equal(game.player.countItem('hp_pot'), hpBeforeCraft + 5, 'crafting grants the configured output');

console.log('content/gathering: maps, animated monster quest chain, manual hand-in, mastery and crafting OK');
