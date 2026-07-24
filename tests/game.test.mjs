/**
 * Structural + behavioral tests for mini-legend core loop.
 * Run: node tests/game.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function ok(cond, msg) {
  assert.ok(cond, msg);
  console.log('  ✓', msg);
}

// --- Asset existence (generated pipeline outputs) ---
console.log('assets');
const required = [
  'assets/game/unit/warrior.png',
  'assets/game/unit/wizard.png',
  'assets/game/unit/taoist.png',
  'assets/game/mob/deer.png',
  'assets/game/mob/zombie.png',
  'assets/game/mob/skeleton.png',
  'assets/game/mob/orc.png',
  'assets/game/mob/bat.png',
  'assets/game/mob/guardian.png',
  'assets/game/npc/healer.png',
  'assets/game/npc/merchant.png',
  'assets/game/npc/warehouse.png',
  'assets/game/map/town.jpg',
  'assets/game/map/field.jpg',
  'assets/game/map/temple.jpg',
  'assets/game/anim/warrior/walk/00.png',
  'assets/game/anim/warrior/run/00.png',
  'assets/game/anim/warrior/jump/00.png',
  'assets/game/anim/warrior/idle/00.png',
  'assets/game/anim/warrior/attack/01.png',
  'assets/game/anim/wizard/walk/00.png',
  'assets/game/anim/wizard/run/01.png',
  'assets/game/anim/taoist/jump/01.png',
  'assets/game/anim/taoist/attack/01.png',
  'assets/game/manifest.json',
  'assets/game/ui/title-cover.png',
];
for (const rel of required) {
  ok(existsSync(join(ROOT, rel)), `exists ${rel}`);
}

// --- Config: 3 maps, quests, classes ---
const configUrl = pathToFileURL(join(ROOT, 'js/config.js')).href;
const { MAPS, QUESTS, CLASSES, MONSTERS, ITEMS, WORLD } = await import(configUrl);

console.log('config');
ok(Object.keys(MAPS).length >= 3, 'at least 3 maps');
ok(MAPS.bich && MAPS.field && MAPS.temple, 'bich/field/temple present');
ok(MAPS.bich.safe === true, 'town is safe');
ok(MAPS.field.safe === false && MAPS.temple.safe === false, 'field/temple unsafe');
ok(MAPS.bich.portals.some((p) => p.to === 'field'), 'town portals to field');
ok(MAPS.field.portals.some((p) => p.to === 'cave'), 'field portals to cave');
ok(MAPS.cave.portals.some((p) => p.to === 'temple'), 'cave portals to temple');
ok(MAPS.temple.portals.some((p) => p.to === 'cave'), 'temple portals back');
ok(MAPS.temple.portals.some((p) => p.to === 'sanctum'), 'temple portals to sanctum');
ok(QUESTS.length >= 3, 'quest chain length');
ok(Object.keys(CLASSES).length === 3, '3 classes');
ok(Object.keys(MONSTERS).length >= 6, '>=6 monster types');
ok(MAPS.bich.grid.length === WORLD.rows, 'town grid rows');
ok(MAPS.bich.grid[0].length === WORLD.cols, 'town grid cols');
ok(MAPS.bich.grid.flat().some((v) => v === 1), 'town has collision walls');
ok(MAPS.temple.spawns.some((s) => s.monster === 'guardian'), 'temple has boss spawn');
ok(MAPS.sanctum.spawns.some((s) => s.monster === 'lord'), 'sanctum has final boss spawn');

// --- Entities: player level/xp/item ---
const entUrl = pathToFileURL(join(ROOT, 'js/entities.js')).href;
const { Player, Monster } = await import(entUrl);

console.log('entities');
const p = new Player('warrior', '测', 100, 100);
ok(p.hp === p.maxHp && p.level === 1, 'player starts full hp lv1');
const need = p.xpNeed();
p.addXp(need);
ok(p.level === 2, 'level up on xp threshold');
ok(p.addItem('hp_pot', 2), 'add consumable');
ok(p.countItem('hp_pot') >= 12, 'stacked pots'); // started with 10
ok(p.addItem('iron_sword', 1), 'add weapon');
p.equip.weapon = 'iron_sword';
const atkBefore = p.atk;
p.recalc();
ok(p.atk > CLASSES.warrior.base.atk, 'equip boosts atk');
void atkBefore;

const m = new Monster('deer', 0, 0);
const loot = m.rollDrop();
ok(typeof loot.gold === 'number' && loot.gold >= 0, 'monster gold roll');
ok(Array.isArray(loot.items), 'monster item roll array');

// --- Save helpers ---
const saveUrl = pathToFileURL(join(ROOT, 'js/save.js')).href;
const { saveGame, loadGame, clearSave, SAVE_KEY } = await import(saveUrl).catch(async () => {
  // save.js exports SAVE_KEY from config — re-export check via config
  const mod = await import(saveUrl);
  return mod;
});

console.log('save');
// jsdom-less localStorage polyfill
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { saveGame: sg, loadGame: lg, clearSave: cs } = await import(saveUrl);
const payload = { player: p.serialize(), mapId: 'field', px: 200, py: 300 };
ok(sg(payload) === true, 'saveGame returns true');
const loaded = lg();
ok(loaded && loaded.mapId === 'field', 'loadGame mapId');
ok(loaded.player.level === 2, 'loadGame player level');
cs();
ok(lg() === null, 'clearSave works');

// --- Game logic pure bits via config quests ---
console.log('quest chain');
let qid = QUESTS[0].id;
const seen = new Set();
while (qid) {
  ok(!seen.has(qid), `no cycle at ${qid}`);
  seen.add(qid);
  const q = QUESTS.find((x) => x.id === qid);
  ok(q, `quest ${qid} exists`);
  qid = q.next;
}
ok(seen.size >= 3, 'quest chain depth >= 3');

// --- index / package identity ---
console.log('project identity');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
ok(html.includes('玛法余烬'), 'html title brand');
ok(html.includes('js/main.js'), 'module entry');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
ok(pkg.name === 'mini-legend', 'package name mini-legend');

console.log('\nAll tests passed.');
