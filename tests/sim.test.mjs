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
    rotate() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    ellipse() {},
    setLineDash() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
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
const {
  MAPS, SCENERY, WORLD, isWorldPositionOpen,
} = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);
const { findTilePath } = await import(pathToFileURL(join(ROOT, 'js/navigation.js')).href);

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
  zoneGround: Object.fromEntries(Object.keys(MAPS).map((id) => [id, mockImage()])),
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

// Pointer input stays in the same logical coordinate space as the DPR-scaled renderer.
canvas.width = 1834;
canvas.height = 1137;
canvas.getBoundingClientRect = () => ({ left: 21, top: 13, width: 1223, height: 758 });
game.viewW = 1223;
game.viewH = 758;
assert.deepEqual(
  game.pointerToView(1051, 363),
  { x: 1030, y: 350 },
  'Retina pointer coordinates subtract the canvas offset without double-applying DPR',
);
canvas.getBoundingClientRect = () => ({ left: 10, top: 8, width: 611.5, height: 379 });
assert.deepEqual(
  game.pointerToView(525, 183),
  { x: 1030, y: 350 },
  'CSS-scaled canvas pointer coordinates normalize into the logical game viewport',
);

// Invisible dead remote players must never intercept ground clicks.
const clickState = {
  remotes: game.remotePlayers,
  monsters: game.monsters,
  npcs: game.npcs,
  portals: game.portals,
  nodes: game.gatherNodes,
  drops: game.drops,
};
game.remotePlayers = [{
  id: 'dead-remote',
  name: 'Ghost',
  alive: false,
  x: game.player.x,
  y: game.player.y,
}];
game.monsters = [];
game.npcs = [];
game.portals = [];
game.gatherNodes = [];
game.drops = [];
game.player.target = null;
game.player.moveGoal = null;
game.cam.x = game.player.x;
game.cam.y = game.player.y;
game.onClick(game.viewW / 2, game.viewH / 2);
assert.notEqual(game.player.target, game.remotePlayers[0], 'dead remote cannot intercept a ground click');
assert.ok(
  Math.abs(game.player.moveGoal.x - game.player.x) < 1
  && Math.abs(game.player.moveGoal.y - game.player.y) < 1,
  'ground click still resolves through an invisible dead remote',
);
game.remotePlayers = clickState.remotes;
game.monsters = clickState.monsters;
game.npcs = clickState.npcs;
game.portals = clickState.portals;
game.gatherNodes = clickState.nodes;
game.drops = clickState.drops;

// collision: wall should block
const wallX = 6 * WORLD.layoutScale * WORLD.tile + 24;
const wallY = 6 * WORLD.layoutScale * WORLD.tile + 24;
assert.equal(game.blocked(wallX, wallY), true, 'building tile blocked');
const openX = 18 * WORLD.layoutScale * WORLD.tile;
const openY = 14 * WORLD.layoutScale * WORLD.tile;
assert.equal(game.blocked(openX, openY), false, 'road open');

// travel to field via portal API
game.loadMap('field', MAPS.field.playerStart.x, MAPS.field.playerStart.y);
assert.equal(game.mapId, 'field');
assert.ok(game.monsters.length > 10, 'field has monsters');
assert.ok(game.monsters.some((m) => m.kind === 'deer'), 'has deer');
const visibleFieldDecors = game.decors.filter((decor) => (
  game.worldPointInView(decor.x, decor.y, Math.max(96, decor.h + 36))
));
assert.ok(game.decors.length >= 850, 'expanded field keeps commercial vegetation density');
assert.ok(game.minimapForestDecors.length >= 200, 'minimap retains the field forest silhouette');
assert.ok(visibleFieldDecors.length < game.decors.length * 0.4, 'offscreen vegetation is culled before depth sorting and drawing');
for (const portal of game.portals) {
  const path = findTilePath(game.walkGrid, game.player.x, game.player.y, portal.x, portal.y, WORLD.tile);
  assert.ok(
    path.length > 0,
    `field vegetation preserves a walkable route to ${portal.to} from ${game.player.x},${game.player.y}`,
  );
  assert.ok(
    path.every((waypoint) => !game.blocked(waypoint.x, waypoint.y)),
    `field route to ${portal.to} contains only shared-collision-safe waypoints`,
  );
}
const blockingFieldDecor = MAPS.field.decors.find((decor) => SCENERY[decor.id]?.block);
assert.ok(blockingFieldDecor, 'field contains blocking tree ecology');
game.loadMap('field', blockingFieldDecor.x, blockingFieldDecor.y);
assert.equal(game.blocked(game.player.x, game.player.y), false, 'local saves inside new vegetation relocate to the nearest open tile');

// Dense overlapping canopy keeps the local player readable with capped alpha and a top-layer outline ghost.
game.loadMap('field');
const occludingFieldDecor = game.decors.find((decor) => (
  SCENERY[decor.id]?.block
  && (decor.id.startsWith('tree_') || decor.id.startsWith('grove_') || decor.id.startsWith('pine_'))
));
assert.ok(occludingFieldDecor, 'field contains an occluding canopy');
game.player.x = occludingFieldDecor.x;
game.player.y = occludingFieldDecor.y - Math.min(110, occludingFieldDecor.h * 0.55);
game.cam.x = game.player.x;
game.cam.y = game.player.y;
game.render();
assert.equal(
  game.playerOccludedByDecor,
  true,
  'large visual canopy triggers a readable silhouette beyond the legacy foot-radius test',
);
const gameSource = readFileSync(join(ROOT, 'js/game.js'), 'utf8');
assert.match(gameSource, /isGrove \? 0\.1 : treeFamily \? 0\.16 : 0\.22/, 'canopy opacity stays below the compounded-occlusion threshold');
assert.match(gameSource, /shadowColor = 'rgba\(255,222,145,0\.96\)'/, 'occluded player receives a top-layer outline');

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
assert.ok(game.monsters.some((m) => m.kind === 'orc_shaman'), 'temple caster pack spawned');

// skills
game.player.mp = 100;
game.player.level = 25;
game.player.learnSkill('thrust');
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

// classic NPC approach + dialogue callback
const captain = game.npcs.find((npc) => npc.id === 'captain');
let talkedTo = null;
game.onNpc = (npc) => { talkedTo = npc.id; };
game.player.x = captain.x + 180;
game.player.y = captain.y;
game.approachNpc(captain);
assert.equal(game.pendingNpc, captain, 'distant NPC becomes pending interaction');
assert.ok(game.player.moveGoal, 'distant NPC creates approach goal');
for (let i = 0; i < 80 && !talkedTo; i++) game.update(0.05);
assert.equal(talkedTo, 'captain', 'approach opens NPC dialogue at interaction range');
assert.equal(game.pendingNpc, null, 'pending NPC clears after interaction');

// potion hotkey path
const potsBefore = game.player.countItem('hp_pot');
game.player.hp = 10;
game.useHotPotion('hp');
assert.ok(game.player.hp > 10, 'potion healed');
assert.ok(game.player.countItem('hp_pot') < potsBefore || potsBefore === 0, 'potion consumed');

// every authored region loads, updates, and renders with its unique ground layer
const ids = Object.keys(MAPS);
for (const id of ids) {
  game.loadMap(id);
  assert.equal(game.mapId, id, `load ${id}`);
  assert.ok(MAPS[id].bg.includes('assets/game/map/'), `map bg asset ${id}`);
  for (const portal of game.portals) {
    const path = findTilePath(
      game.walkGrid,
      game.player.x,
      game.player.y,
      portal.x,
      portal.y,
      WORLD.tile,
    );
    assert.ok(path.length > 0, `${id} keeps a footprint-safe route to ${portal.to}`);
    assert.ok(
      path.every((waypoint) => isWorldPositionOpen(
        id,
        waypoint.x,
        waypoint.y,
        game.player.r * 0.6,
      )),
      `${id} route to ${portal.to} keeps the full player footprint open`,
    );
  }
  game.update(0.016);
  game.render();
}

// every authored feedback family completes a render pass
const effectKinds = [
  'hit', 'crit_hit', 'magic_hit', 'dodge', 'death', 'rush', 'level',
  'lightning', 'slash', 'ice', 'heal', 'poison', 'summon', 'fire', 'shield', 'ring',
];
for (const kind of effectKinds) game.spawnEffect(game.player.x, game.player.y, 52, '#f4cf7e', 0.8, kind, 0.45);
game.render();
assert.ok(effectKinds.every((kind) => game.effects.some((effect) => effect.kind === kind)), 'all feedback effect families rendered');

// animation frames referenced exist for warrior walk (shipped)
const walk0 = join(ROOT, 'assets/game/anim/warrior/walk/00.png');
assert.ok(readFileSync(walk0).length > 100, 'walk frame bytes');

console.log('sim: all assertions passed');
console.log(`  maps exercised: ${ids.join(', ')}`);
console.log('  combat, quest, save, potion, skills OK');
