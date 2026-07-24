import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);
const { Game } = await import(pathToFileURL(join(ROOT, 'js/game.js')).href);
const { Player } = await import(pathToFileURL(join(ROOT, 'js/entities.js')).href);

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
const mobs = Object.fromEntries(Object.keys(config.MONSTERS).map((id) => [id, img]));
const assets = {
  units: { warrior: img, wizard: img, taoist: img },
  anim: Object.fromEntries(Object.keys(config.CLASSES).map((id) => [id, Object.fromEntries(['idle', 'walk', 'run', 'jump', 'attack'].map((action) => [action, [img]]))])),
  mobs,
  npc: { healer: img, merchant: img, warehouse: img },
  maps: { town: img, field: img, temple: img },
  scenery: {},
  tiles: {},
};

const player = new Player('warrior', 'Forge', 0, 0);
player.addItem('black_iron', 2);
player.addItem('black_iron', 3);
assert.equal(player.countItem('black_iron'), 5, 'materials stack');
assert.ok(player.combatPower() > 0, 'combat power calculated');

const game = new Game(canvas, assets, { classId: 'warrior', name: 'SystemTest' });
game.player.equip.weapon = 'iron_sword';
game.player.gold = 10_000;
game.player.addItem('black_iron', 10);
game.player.recalc();
const powerBefore = game.player.combatPower();
const originalRandom = Math.random;
Math.random = () => 0;
const result = game.enhanceSlot('weapon');
Math.random = originalRandom;
assert.equal(result.ok, true, 'enhancement can succeed');
assert.equal(game.player.enhance.weapon, 1, 'enhancement level persists');
assert.ok(game.player.combatPower() > powerBefore, 'enhancement raises combat power');

game.player.totalKills = 1;
game.checkAchievements();
assert.ok(game.player.achievements.includes('first_blood'), 'achievement unlocks');
const goldBefore = game.player.gold;
assert.equal(game.claimAchievement('first_blood'), true, 'achievement reward claim');
assert.ok(game.player.gold > goldBefore, 'achievement reward grants gold');

game.loadMap('sanctum');
const boss = game.monsters.find((monster) => monster.boss);
assert.ok(boss, 'sanctum contains final boss');
game.player.x = boss.x;
game.player.y = boss.y;
boss.abilityCd = 0;
game.update(0.016);
assert.ok(game.hazards.length > 0, 'boss schedules telegraphed area attack');

assert.ok(config.MAPS.field.portals.some((portal) => portal.to === 'cave'), 'five-zone route begins at cave');
assert.ok(config.MAPS.temple.portals.some((portal) => portal.to === 'sanctum'), 'five-zone route reaches sanctum');
assert.equal(config.QUESTS.at(-1).id, 'q_lord', 'main quest ends at final boss');
assert.ok(config.enhanceCost(8).rate < config.enhanceCost(1).rate, 'high enhancement has lower success rate');

console.log('progression: enhancement, achievements, five-zone route and boss mechanics OK');
