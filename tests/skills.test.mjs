/**
 * Skill book, level gate, proficiency and legacy-save regression tests.
 * Run: node tests/skills.test.mjs
 */
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.innerWidth = 960;
globalThis.innerHeight = 640;
globalThis.window = globalThis;

const mockImage = () => ({ width: 64, height: 64 });
const mockCanvas = () => ({
  width: 0,
  height: 0,
  style: {},
  getContext: () => ({
    setTransform() {}, clearRect() {}, fillRect() {}, strokeRect() {}, drawImage() {},
    beginPath() {}, arc() {}, fill() {}, stroke() {}, save() {}, restore() {},
    translate() {}, scale() {}, fillText() {},
  }),
});

const config = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);
const { Player, Monster } = await import(pathToFileURL(join(ROOT, 'js/entities.js')).href);
const { Game } = await import(pathToFileURL(join(ROOT, 'js/game.js')).href);

const img = mockImage();
const playerAnim = Object.fromEntries(
  ['idle', 'walk', 'run', 'jump', 'attack'].map((action) => [action, [img]]),
);
const mobAnim = Object.fromEntries(
  Object.keys(config.MONSTERS).map((id) => [
    id,
    Object.fromEntries(['idle', 'walk', 'attack', 'death'].map((action) => [action, [img]])),
  ]),
);
const assets = {
  units: { warrior: img, wizard: img, taoist: img },
  portraits: {},
  avatars: {},
  anim: { warrior: playerAnim, wizard: playerAnim, taoist: playerAnim },
  mobs: Object.fromEntries(Object.keys(config.MONSTERS).map((id) => [id, img])),
  mobAnim,
  npc: { healer: img, merchant: img, warehouse: img, captain: img },
  npcAnim: Object.fromEntries(['healer', 'merchant', 'warehouse', 'captain'].map((id) => [id, { idle: [img] }])),
  maps: { town: img, field: img, temple: img },
  scenery: {},
  tiles: {},
};

const wizard = new Player('wizard', '学徒', 0, 0);
assert.equal(wizard.skillState('fireball').learned, false, 'new player has no free skill');
assert.equal(wizard.learnSkill('fireball').reason, 'level', 'level gate blocks early learning');
wizard.level = 7;
assert.equal(wizard.learnSkill('fireball').ok, true, 'eligible skill book can be learned');
assert.equal(wizard.skillLevel('fireball'), 1);
wizard.gainSkillExp('fireball', config.SKILL_LEVEL_XP[2]);
assert.equal(wizard.skillLevel('fireball'), 2, 'proficiency promotes skill to level 2');
wizard.gainSkillExp('fireball', config.SKILL_LEVEL_XP[3]);
assert.equal(wizard.skillLevel('fireball'), 3, 'proficiency promotes skill to level 3');

const legacy = wizard.serialize();
delete legacy.skills;
legacy.level = 35;
const migrated = Player.fromSave(legacy, 0, 0);
assert.ok(migrated.def.skills.every((skill) => migrated.skillState(skill.id).learned), 'legacy high-level save migrates previously available skills');

const hints = [];
const game = new Game(mockCanvas(), assets, {
  classId: 'wizard',
  name: '读书人',
  onHint: (message) => hints.push(message),
});
game.player.addItem('book_fireball', 1);
game.player.selectedBag = game.player.bag.findIndex((entry) => entry.id === 'book_fireball');
game.useSelectedItem();
assert.equal(game.player.skillLevel('fireball'), 0, 'book remains blocked below required level');
assert.ok(hints.some((message) => message.includes('需要 7 级')));

game.player.level = 7;
game.useSelectedItem();
assert.equal(game.player.skillLevel('fireball'), 1, 'using book learns the skill');
assert.equal(game.player.countItem('book_fireball'), 0, 'successful learning consumes one book');

game.loadMap('field', 20, 14);
const target = new Monster('deer', game.player.x + 40, game.player.y);
game.monsters = [target];
game.player.target = target;
game.player.mp = 999;
const expBefore = game.player.skillState('fireball').exp;
game.castSkill(0);
assert.ok(game.player.skillState('fireball').exp > expBefore, 'successful cast grants proficiency');

const warrior = new Player('warrior', '剑士', 0, 0);
warrior.level = 7;
warrior.learnSkill('slash');
const dummy = new Monster('deer', 20, 0);
game.player = warrior;
game.monsters = [dummy];
game.applyDamage(warrior, dummy, 10, false);
assert.ok(warrior.skillState('slash').exp > 0, 'learned basic sword gains proficiency on hit');

console.log('skills: book learning, level gates, mastery and legacy migration OK');
