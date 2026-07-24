/**
 * Headless simulation of shipped Game class (real module, mock canvas).
 * Run: node tests/sim.test.mjs
 */
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// minimal browser globals
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.window = globalThis;

function mockImage() {
  return { width: 64, height: 64 };
}

function mockCanvas() {
  const calls = [];
  const ctx = {
    setTransform() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    drawImage() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    fillText() {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    globalAlpha: 1,
  };
  return {
    width: 0,
    height: 0,
    style: {},
    getContext: () => ctx,
    _calls: calls,
  };
}

const gameUrl = pathToFileURL(join(ROOT, 'js/game.js')).href;
const { Game } = await import(gameUrl);
const { MAPS, WORLD } = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);

const assets = {
  units: { warrior: mockImage(), wizard: mockImage(), taoist: mockImage() },
  portraits: {},
  avatars: {},
  anim: {
    warrior: { idle: [mockImage()], walk: [mockImage(), mockImage()], attack: [mockImage()] },
    wizard: { idle: [mockImage()], walk: [mockImage()], attack: [mockImage()] },
    taoist: { idle: [mockImage()], walk: [mockImage()], attack: [mockImage()] },
  },
  mobs: {
    deer: mockImage(), zombie: mockImage(), skeleton: mockImage(),
    orc: mockImage(), bat: mockImage(), guardian: mockImage(),
  },
  npc: { healer: mockImage(), merchant: mockImage(), warehouse: mockImage() },
  maps: { town: mockImage(), field: mockImage(), temple: mockImage() },
};

const canvas = mockCanvas();
const hints = [];
const game = new Game(canvas, assets, {
  classId: 'warrior',
  name: 'Sim',
  onHint: (m) => hints.push(m),
  onDeath: () => {},
  onQuest: () => {},
});

assert.equal(game.mapId, 'bich', 'start in bich');
assert.ok(game.map.safe, 'start safe');
assert.ok(game.player.alive);

// collision: wall should block
const wallX = 6 * WORLD.tile + 24;
const wallY = 6 * WORLD.tile + 24;
assert.equal(game.blocked(wallX, wallY), true, 'building tile blocked');
const openX = 18 * WORLD.tile;
const openY = 14 * WORLD.tile;
assert.equal(game.blocked(openX, openY), false, 'road open');

// travel to field via portal API
game.loadMap('field', 5, 14);
assert.equal(game.mapId, 'field');
assert.ok(game.monsters.length > 10, 'field has monsters');
assert.ok(game.monsters.some((m) => m.kind === 'deer'), 'has deer');

// combat tick: damage a deer
const deer = game.monsters.find((m) => m.kind === 'deer' && m.alive);
assert.ok(deer, 'deer exists');
const hp0 = deer.hp;
game.player.x = deer.x;
game.player.y = deer.y;
game.applyDamage(game.player, deer, 30, false);
assert.ok(deer.hp < hp0 || !deer.alive, 'damage applied');

// kill and loot
deer.hp = 1;
game.applyDamage(game.player, deer, 50, false);
assert.equal(deer.alive, false, 'deer dead');
assert.ok(game.player.killCounts.deer >= 1, 'kill counted');

// temple map + boss
game.loadMap('temple', 5, 14);
assert.equal(game.mapId, 'temple');
assert.ok(game.monsters.some((m) => m.kind === 'guardian'), 'boss spawned');
assert.ok(game.monsters.some((m) => m.kind === 'bat'), 'bats spawned');

// skills
game.player.mp = 100;
game.castSkill(1); // thrust boost
assert.ok(game.player.boost?.id === 'thrust', 'thrust boost armed');

// update loop doesn't throw
for (let i = 0; i < 30; i++) game.update(0.05);
game.render();

// persist
game.persist();
assert.ok(store.size >= 1, 'save written');

// quest talk complete intro
game.loadMap('bich');
game.player.questId = 'q_intro';
game.talkQuest('captain');
assert.ok(
  game.player.completedQuests.includes('q_intro') || game.player.questId === 'q_deer',
  'intro quest advances',
);

// potion hotkey path
const potsBefore = game.player.countItem('hp_pot');
game.player.hp = 10;
game.useHotPotion('hp');
assert.ok(game.player.hp > 10, 'potion healed');
assert.ok(game.player.countItem('hp_pot') < potsBefore || potsBefore === 0, 'potion consumed');

// three maps reachable
const ids = new Set(['bich', 'field', 'temple']);
for (const id of ids) {
  game.loadMap(id);
  assert.equal(game.mapId, id, `load ${id}`);
  assert.ok(MAPS[id].bg.includes('assets/game/map/'), `map bg asset ${id}`);
}

// animation frames referenced exist for warrior walk (shipped)
const walk0 = join(ROOT, 'assets/game/anim/warrior/walk/00.png');
assert.ok(readFileSync(walk0).length > 100, 'walk frame bytes');

console.log('sim: all assertions passed');
console.log('  maps exercised: bich, field, temple');
console.log('  combat, quest, save, potion, skills OK');
