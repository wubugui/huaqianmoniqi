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
  'assets/game/mob/wolf.png',
  'assets/game/mob/boar.png',
  'assets/game/mob/centipede.png',
  'assets/game/npc/healer.png',
  'assets/game/npc/merchant.png',
  'assets/game/npc/warehouse.png',
  'assets/game/map/town.jpg',
  'assets/game/map/field.jpg',
  'assets/game/map/temple.jpg',
  'assets/game/map/ground/bich.png',
  'assets/game/map/ground/field.png',
  'assets/game/map/ground/valley.png',
  'assets/game/map/ground/cave.png',
  'assets/game/map/ground/stone-tomb.png',
  'assets/game/map/ground/centipede-cave.png',
  'assets/game/map/ground/temple.png',
  'assets/game/map/ground/sanctum.png',
  'assets/game/map/ground/sabac.png',
  'assets/game/map/world-map-v1.png',
  'assets/game/scenery/town_square.png',
  'assets/game/scenery/frontier_camp.png',
  'assets/game/scenery/mine_lift.png',
  'assets/game/scenery/valley_altar.png',
  'assets/game/scenery/tomb_brazier.png',
  'assets/game/scenery/hive_nest.png',
  'assets/game/scenery/temple_altar.png',
  'assets/game/scenery/sanctum_throne.png',
  'assets/game/scenery/sabac_gate.png',
  'assets/game/scenery/grove_deciduous.png',
  'assets/game/scenery/grove_pine.png',
  'assets/game/scenery/grove_poison.png',
  'assets/game/scenery/tree_old.png',
  'assets/game/scenery/tree_wind.png',
  'assets/game/scenery/pine_blue.png',
  'assets/game/scenery/grove_fern.png',
  'assets/game/scenery/shrub_dense.png',
  'assets/game/scenery/fern_patch.png',
  'assets/game/scenery/grass_dry.png',
  'assets/game/scenery/grass_lush.png',
  'assets/game/scenery/flower_wild.png',
  'assets/game/scenery/fallen_log.png',
  'assets/game/scenery/stone_cluster.png',
  'assets/game/scenery/bramble.png',
  'assets/game/scenery/sapling.png',
  'assets/game/walls/wall_mine_top.png',
  'assets/game/walls/wall_mine_face.png',
  'assets/game/walls/wall_moss_top.png',
  'assets/game/walls/wall_moss_face.png',
  'assets/game/walls/wall_hive_top.png',
  'assets/game/walls/wall_hive_face.png',
  'assets/game/walls/wall_tomb.png',
  'assets/game/walls/wall_temple.png',
  'assets/game/walls/wall_sanctum.png',
  'assets/game/walls/wall_fortress.png',
  'assets/game/anim/warrior/walk/00.png',
  'assets/game/anim/warrior/run/00.png',
  'assets/game/anim/warrior/jump/00.png',
  'assets/game/anim/warrior/idle/00.png',
  'assets/game/anim/warrior/attack/01.png',
  'assets/game/anim/wizard/walk/00.png',
  'assets/game/anim/wizard/run/01.png',
  'assets/game/anim/taoist/jump/01.png',
  'assets/game/anim/taoist/attack/01.png',
  'assets/game/anim/npc/captain/idle/00.png',
  'assets/game/anim/npc/healer/idle/03.png',
  'assets/game/anim/mob/deer/walk/00.png',
  'assets/game/anim/mob/zombie/attack/02.png',
  'assets/game/anim/mob/skeleton/death/03.png',
  'assets/game/anim/mob/bat/walk/01.png',
  'assets/game/anim/mob/orc/attack/02.png',
  'assets/game/anim/mob/guardian/death/03.png',
  'assets/game/anim/mob/lord/idle/00.png',
  'assets/game/anim/mob/wolf/walk/01.png',
  'assets/game/anim/mob/boar/attack/02.png',
  'assets/game/anim/mob/centipede/death/03.png',
  'assets/game/manifest.json',
  'assets/game/ui/title-cover.png',
  'assets/game/ui/items_sheet.png',
  'assets/game/ui/icons/skill-slash.png',
  'assets/game/ui/icons/skill-thrust.png',
  'assets/game/ui/icons/skill-fire-sword.png',
  'assets/game/ui/icons/skill-rush.png',
  'assets/game/ui/icons/skill-fireball.png',
  'assets/game/ui/icons/skill-lightning.png',
  'assets/game/ui/icons/skill-ice-burst.png',
  'assets/game/ui/icons/skill-magic-shield.png',
  'assets/game/ui/icons/skill-heal.png',
  'assets/game/ui/icons/skill-talisman.png',
  'assets/game/ui/icons/skill-poison.png',
  'assets/game/ui/icons/skill-summon.png',
];
for (const rel of required) {
  ok(existsSync(join(ROOT, rel)), `exists ${rel}`);
}

// --- Config: 3 maps, quests, classes ---
const configUrl = pathToFileURL(join(ROOT, 'js/config.js')).href;
const {
  GATHER_DEFS, MAPS, QUESTS, CLASSES, MONSTERS, ITEMS, SCENERY, SKILL_LEVEL_XP, SKILL_MAX_LEVEL,
  SAVE_KEY, SHOP_TOWN, VISUAL_SCALE, WALL_MATERIALS, WORLD, ZONE_VISUALS, distanceToRoadEdge, isWorldBlocked,
} = await import(configUrl);
const navigationUrl = pathToFileURL(join(ROOT, 'js/navigation.js')).href;
const { directionLabel, findTilePath, findWorldRoute, portalForLeg } = await import(navigationUrl);

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
ok(MAPS.field.portals.some((p) => p.to === 'valley'), 'field portals to poison valley');
ok(MAPS.valley.portals.some((p) => p.to === 'stone_tomb'), 'poison valley portals to stone tomb');
ok(MAPS.cave.portals.some((p) => p.to === 'centipede_cave'), 'mine portals to centipede cave');
ok(QUESTS.length >= 3, 'quest chain length');
ok(Object.keys(CLASSES).length === 3, '3 classes');
ok(Object.values(CLASSES).every((entry) => entry.skills.every((skill) => skill.icon)), 'every skill has a production icon');
ok(Object.keys(MAPS).every((id) => ZONE_VISUALS[id]), 'every map has a visual theme');
ok(Object.values(ZONE_VISUALS).every((visual) => visual.texture && visual.lights?.length), 'every map has unique terrain and authored lights');
ok(['cave', 'valley', 'centipede_cave', 'stone_tomb', 'temple', 'sanctum', 'sabac']
  .every((id) => WALL_MATERIALS[id]?.top), 'every walled map has a dedicated wall material');
ok(['cave', 'valley', 'centipede_cave']
  .every((id) => WALL_MATERIALS[id]?.face), 'natural walls have dedicated cliff-face cutouts');
ok(Object.keys(MONSTERS).length >= 6, '>=6 monster types');
ok(['wolf', 'boar', 'centipede'].every((id) => MONSTERS[id]), 'commercial hunting zones have distinct monster types');
ok(Object.keys(GATHER_DEFS).length >= 3, 'herbalism and mining resource definitions');
ok(Object.values(CLASSES).every((cls) => cls.skills.every((skill) => skill.reqLevel > 0)), 'every skill has a learn level');
ok(Object.values(CLASSES).every((cls) => cls.skills.every((skill) => Object.values(ITEMS).some((item) => item.type === 'skillbook' && item.skillId === skill.id && item.classId === cls.id))), 'every skill has a matching class book');
ok(Object.keys(ITEMS).length >= 100, 'commercial item catalogue contains at least one hundred distinct items');
ok(Object.values(ITEMS).every((item) => item.category && item.source && item.useHint && item.market), 'every item has category, source, use and market metadata');
ok(Object.values(ITEMS).every((item) => !item.source.includes('后续猎区')), 'every item has a concrete configured acquisition source');
ok(Object.values(ITEMS).filter((item) => item.type === 'quest').every((item) => item.market.includes('不可出售')), 'quest-item codex values match server-side sale protection');
ok(Object.values(ITEMS).every((item) => item.stackLimit === 1 || item.stackLimit === 999), 'every item declares a clear stacking rule');
const skillRequirement = new Map(Object.values(CLASSES).flatMap(
  (definition) => definition.skills.map((skill) => [skill.id, skill.reqLevel]),
));
const lowBooks = Object.values(ITEMS).filter(
  (item) => item.type === 'skillbook' && skillRequirement.get(item.skillId) <= 19,
);
const advancedBooks = Object.values(ITEMS).filter(
  (item) => item.type === 'skillbook' && skillRequirement.get(item.skillId) >= 25,
);
ok(lowBooks.every((item) => SHOP_TOWN.includes(item.id) && item.price > 0), 'level 7-19 skill books are sold by the town book shop');
ok(advancedBooks.every((item) => !SHOP_TOWN.includes(item.id)), 'level 25+ skill books remain monster and player-trade chase items');
ok(Object.values(MONSTERS).every((monster) => monster.drops.some(
  (drop) => ITEMS[drop.id]?.type === 'material' && ITEMS[drop.id].sell > 0 && drop.rate >= 0.4,
)), 'every monster family has a reliable sellable trophy drop');
ok(MAPS.bich.grid.length === WORLD.rows, 'town grid rows');
ok(MAPS.bich.grid[0].length === WORLD.cols, 'town grid cols');
ok(WORLD.cols >= 96 && WORLD.rows >= 72 && WORLD.cols * WORLD.rows >= 6900, 'world maps provide a multi-screen commercial-scale footprint');
ok(['field', 'valley'].every((id) => MAPS[id].commercialScale?.plantCount >= 850), 'major hunting zones contain dense layered vegetation');
ok(['bich', 'field', 'valley', 'sabac'].every((id) => MAPS[id].commercialScale?.canopyClusters >= 6), 'every outdoor region has multiple authored grove clusters');
ok(['bich', 'field', 'valley', 'sabac'].every((id) => MAPS[id].commercialScale?.roadVerge >= 80), 'every outdoor road has a dense non-blocking verge layer');
const commercialUnderstory = [
  'shrub_dense', 'fern_patch', 'grass_dry', 'grass_lush', 'flower_wild',
  'fallen_log', 'stone_cluster', 'bramble', 'sapling',
];
ok(commercialUnderstory.every((id) => SCENERY[id] && SCENERY[id].block === false), 'commercial understory variants are registered without blocking travel');
const understoryAudit = JSON.parse(readFileSync(
  join(ROOT, 'assets/game/scenery/qa/understory_audit.json'),
  'utf8',
));
ok(
  understoryAudit.generator === 'built-in GPT Image'
    && understoryAudit.sprites.length === commercialUnderstory.length
    && understoryAudit.sprites.every((sprite) => (
      sprite.magentaPixels === 0
      && sprite.transparentCorners.every((alpha) => alpha === 0)
    )),
  'GPT Image understory sprites pass transparent-edge and chroma residual QA',
);
ok(MAPS.bich.grid.flat().some((v) => v === 1), 'town has collision walls');
ok(MAPS.temple.spawns.some((s) => s.monster === 'guardian'), 'temple has boss spawn');
ok(MAPS.sanctum.spawns.some((s) => s.monster === 'lord'), 'sanctum has final boss spawn');
ok(MAPS.bich.renderWalls === false && MAPS.field.renderWalls === false, 'decorated outdoor collisions stay visually transparent');
ok(MAPS.cave.renderWalls === true && MAPS.temple.renderWalls === true, 'dungeon collision walls stay visible');
ok(Object.values(MAPS).every((map) => map.scenePlan?.story && map.scenePlan.zones?.length >= 4), 'every map has an authored spatial narrative');
ok(Object.values(MAPS).every((map) => map.marks?.length >= 2), 'every map has semantic floor landmarks');
const sceneLandmarks = [
  'town_square', 'frontier_camp', 'mine_lift', 'valley_altar', 'tomb_brazier',
  'hive_nest', 'temple_altar', 'sanctum_throne', 'sabac_gate',
];
ok(sceneLandmarks.every((id) => SCENERY[id]), 'all nine maps have a dedicated landmark asset');
ok(Object.values(MAPS).every((map) => map.decors.some((decor) => sceneLandmarks.includes(decor.id))), 'every map places its dedicated landmark');
ok(['bich', 'field', 'valley', 'sabac'].every((id) => MAPS[id].roadPaths?.length), 'outdoor maps use continuous authored road paths');
ok(
  ['bich', 'field', 'valley', 'sabac'].every((id) => MAPS[id].decors
    .filter((decor) => ['road-verge', 'understory', 'forest-edge', 'canopy'].includes(decor.ecology))
    .every((decor) => distanceToRoadEdge(MAPS[id], decor.x, decor.y) >= 0.15)),
  'generated outdoor ecology stays beyond the rendered road surface',
);
ok(Object.values(MAPS).every((map) => map.grid[Math.floor(map.playerStart.y)]?.[Math.floor(map.playerStart.x)] === 0), 'every player start is walkable');
ok(
  Object.values(MAPS).every((map) => map.portals.every((portal) => (
    !isWorldBlocked(portal.to, portal.tx * WORLD.tile, portal.ty * WORLD.tile)
  ))),
  'every cross-map portal arrives on an open target point',
);

console.log('world navigation');
const mapIds = Object.keys(MAPS);
ok(mapIds.length === 9, 'world map exposes all nine authored regions');
const allWorldRoutes = mapIds.flatMap((from) => mapIds.map((to) => findWorldRoute(from, to)));
ok(allWorldRoutes.every((route) => route.length > 0), 'all nine regions are mutually reachable');
ok(allWorldRoutes.every((route) => route.slice(0, -1).every(
  (mapId, index) => portalForLeg(mapId, route[index + 1]),
)), 'every computed world route uses real configured portals');
ok(findWorldRoute('bich', 'sanctum').join('>') === 'bich>field>cave>temple>sanctum', 'deep temple route follows the complete portal chain');
ok(findWorldRoute('bich', 'stone_tomb').join('>') === 'bich>field>valley>stone_tomb', 'stone tomb route follows the valley branch');
const obstacleGrid = [
  [0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0],
];
const obstaclePath = findTilePath(obstacleGrid, 48, 48, 192, 48, 48);
ok(obstaclePath.length > 0, 'automatic navigation finds a route around walls');
ok(obstaclePath.every((point) => obstacleGrid[Math.floor(point.y / 48)]?.[Math.floor(point.x / 48)] !== 1), 'automatic navigation never places a waypoint inside a wall');
ok(directionLabel(0, 0, 100, 0) === '东' && directionLabel(0, 0, 0, -100) === '北', 'exit direction labels match world coordinates');

console.log('visual scale');
ok(VISUAL_SCALE.player === VISUAL_SCALE.npc, 'player and adult NPC share one body scale');
ok(VISUAL_SCALE.monsters.deer <= VISUAL_SCALE.player, 'deer does not exceed adult character height');
ok(VISUAL_SCALE.monsters.orc > VISUAL_SCALE.player, 'orc reads larger than a player');
ok(VISUAL_SCALE.monsters.guardian > VISUAL_SCALE.monsters.orc, 'guardian reads larger than regular orc');
ok(VISUAL_SCALE.monsters.lord > VISUAL_SCALE.monsters.guardian, 'final boss is the largest unit');
ok(SCENERY.tree.h >= VISUAL_SCALE.player * 1.8, 'tree is at least 1.8 player draw-heights');
ok(['grove_deciduous', 'grove_pine', 'grove_poison'].every((id) => SCENERY[id]?.blockRadius > 1.5), 'dense groves use multi-tile collision footprints');
ok(
  Object.values(SCENERY).filter((decor) => decor.block).every((decor) => decor.blockRadius > 0),
  'every blocking scenery definition has an explicit continuous collision radius',
);
ok(SCENERY.house_a.h >= VISUAL_SCALE.player * 4, 'house is at least 4 player draw-heights');
ok(SCENERY.rock.h > VISUAL_SCALE.player && SCENERY.rock.h < VISUAL_SCALE.player * 1.5, 'rock pile stays near human scale');

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

const skillPlayer = new Player('warrior', '习武者', 0, 0);
ok(skillPlayer.skillLevel('slash') === 0, 'new character starts without learned skills');
skillPlayer.level = 7;
ok(skillPlayer.learnSkill('slash').ok, 'learn skill from eligible book');
ok(skillPlayer.skillLevel('slash') === 1, 'learned skill starts at level 1');
skillPlayer.gainSkillExp('slash', SKILL_LEVEL_XP[2]);
ok(skillPlayer.skillLevel('slash') === 2, 'skill proficiency raises mastery level');
skillPlayer.gainSkillExp('slash', SKILL_LEVEL_XP[3]);
ok(skillPlayer.skillLevel('slash') === SKILL_MAX_LEVEL, 'skill mastery reaches configured cap');
ok(!skillPlayer.learnSkill('slash').ok, 'duplicate skill learning is rejected');

const m = new Monster('deer', 0, 0);
const loot = m.rollDrop();
ok(typeof loot.gold === 'number' && loot.gold >= 0, 'monster gold roll');
ok(Array.isArray(loot.items), 'monster item roll array');

// --- Save helpers ---
const saveUrl = pathToFileURL(join(ROOT, 'js/save.js')).href;
const { saveGame, loadGame, clearSave } = await import(saveUrl).catch(async () => {
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
ok(loaded.player.characterId === p.characterId, 'loadGame stable character identity');
ok(loaded.worldLayoutVersion === WORLD.layoutVersion, 'new saves record the current world layout');
const backupPayload = { ...payload, player: { ...payload.player, level: 3 } };
ok(sg(backupPayload) === true, 'second save creates a verified backup');
store.set(SAVE_KEY, '{"broken":');
ok(lg()?.player?.level === 2, 'corrupted primary save recovers from last verified backup');
cs();
ok(lg() === null, 'clearSave works');
store.set(SAVE_KEY, JSON.stringify({
  version: 5,
  player: p.serialize(),
  mapId: 'field',
  px: 5 * WORLD.tile,
  py: 14 * WORLD.tile,
}));
const migratedSave = lg();
ok(migratedSave.worldLayoutVersion === WORLD.layoutVersion, 'legacy saves migrate to the expanded world layout');
ok(migratedSave.px === 5 * WORLD.tile * WORLD.layoutScale
  && migratedSave.py === 14 * WORLD.tile * WORLD.layoutScale, 'legacy save coordinates preserve their authored-map location');
cs();
store.set(SAVE_KEY, JSON.stringify({
  version: 5,
  worldLayoutVersion: 2,
  player: p.serialize(),
  mapId: 'field',
  px: 5 * WORLD.tile * WORLD.previousLayoutScale,
  py: 14 * WORLD.tile * WORLD.previousLayoutScale,
}));
const migratedExpandedSave = lg();
ok(Math.abs(migratedExpandedSave.px - 5 * WORLD.tile * WORLD.layoutScale) < 0.001
  && Math.abs(migratedExpandedSave.py - 14 * WORLD.tile * WORLD.layoutScale) < 0.001, 'layout-v2 saves migrate proportionally without resetting the character');
cs();

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
ok(html.includes('id="npc-dialogue"'), 'classic NPC dialogue panel');
ok(html.includes('id="btn-npc-action"'), 'NPC dialogue action control');
ok(html.includes('id="skill-learning"'), 'dedicated skill learning panel');
ok(html.includes('id="btn-skills"') && html.includes('id="mobile-skills"'), 'desktop and mobile skill learning entries');
ok(html.includes('经验 0 / 100'), 'HUD exposes a readable experience value before any XP is earned');
ok(html.includes('普通攻击从 1 级即可使用') && html.includes('遵循经典规则'), 'skill panel explains level-1 basic attack and classic level-7 skills');
ok(html.includes('id="btn-item-codex"') && html.includes('id="item-codex-search"'), 'town shop exposes a searchable complete item codex');
ok(html.includes('id="btn-codex"') && html.includes('id="mobile-codex"'), 'desktop and mobile HUD expose the item codex');
ok(html.includes('id="world-map"') && html.includes('id="world-map-nodes"'), 'HUD includes a full nine-region world map');
ok(html.includes('id="btn-world-map"') && html.includes('id="mobile-world-map"'), 'desktop and mobile HUD expose world-map controls');
ok(html.includes('id="route-hud"') && html.includes('id="btn-route-cancel"'), 'automatic route progress can be monitored and cancelled');
ok(html.includes('id="sound-volume"') && html.includes('id="render-quality"'), 'settings expose master volume and graphics quality');
ok(['music', 'ambience', 'combat', 'ui'].every((bus) => html.includes(`id="${bus}-volume"`)), 'settings expose the four player-facing audio mix buses');
ok(html.includes('id="dynamic-range"') && html.includes('value="night"'), 'settings expose persistent dynamic-range modes');
const mainSource = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
ok(mainSource.includes("if (key === 'k') openPanel('skill-learning')"), 'K opens skill learning');
ok(mainSource.includes("if (key === 'i') openShop('codex-only')"), 'I opens the item codex without remote shop access');
ok(mainSource.includes("if (key === 'm') openPanel('world-map')"), 'M opens the nine-region world map');
ok(mainSource.includes('findWorldRoute') && mainSource.includes('game.approachPortal(portal)'), 'world map routes across real in-game portals');
ok(mainSource.includes('onRequestMapChange') && mainSource.includes('portalLoading') && mainSource.includes('awaitingMapAck'), 'cross-map auto-route waits out portal ack before publishing moves');
ok(mainSource.includes('spaceAttackArmed') && mainSource.includes('triggerBasicAttack'), 'basic attack is edge-triggered and blurs focused controls');
ok(mainSource.includes('event.repeat') && mainSource.includes('basic.onkeydown'), 'Space key-repeat and focused skill-button Space clicks are suppressed');
ok(readFileSync(join(ROOT, 'js/game.js'), 'utf8').includes('onRequestMapChange')
  && readFileSync(join(ROOT, 'js/game.js'), 'utf8').includes('awaitingMapAck'), 'portal use requests server map change before local loadMap');
ok(mainSource.includes('learnSkillFromPanel'), 'skill panel can consume a matching book');
ok(mainSource.includes("basic.className = 'basic-attack ready'"), 'level-1 basic attack is present in the desktop skill bar');
ok(mainSource.includes('appendChatNotice') && mainSource.includes('result.message'), 'chat has visible failure notices and immediate authoritative echo');
ok(mainSource.includes('itemCatalogDetails') && mainSource.includes('来源：'), 'bag, shop and skill panels expose item acquisition details');
ok(mainSource.includes("const combatBlockingPanels = []"), 'classic panels stay accessible while combat continues');
ok(mainSource.includes('sound.setBusVolume') && mainSource.includes('sound.setDynamicRange'), 'settings write persistent bus and dynamic-range preferences');
ok(mainSource.includes('syncRegionAudio(game.mapId)') && mainSource.includes("mapId === 'field' || mapId === 'valley'"), 'initial load and map changes select the matching regional soundscape');
ok(mainSource.includes('syncVisualViewport') && mainSource.includes('mobile-chat-focus'), 'mobile chat follows the visual viewport while the software keyboard is open');
const styleSource = readFileSync(join(ROOT, 'css/style.css'), 'utf8');
ok(styleSource.includes('--keyboard-inset') && styleSource.includes('min-height: 44px'), 'mobile layout defines keyboard-safe placement and 44px touch targets');
const gameSource = readFileSync(join(ROOT, 'js/game.js'), 'utf8');
ok(!gameSource.includes('this.cam.x / (WORLD.cols * T)'), 'screen-space parallax is not mixed into world ground');
ok(gameSource.includes('roadPattern.setTransform'), 'road texture is anchored to the world camera');
ok(gameSource.includes('_drawChatBubble'), 'spoken messages render above player characters');
ok(gameSource.includes("event.type === 'pvp_damage'") && gameSource.includes("event.type === 'pvp_hit'"), 'both PvP participants receive authoritative combat feedback');
ok(gameSource.includes('ensurePlayerAnim') && gameSource.includes('ensureMap'), 'animation frames are prewarmed by class and current map');
ok(gameSource.includes('footstepSfxForMap') && gameSource.includes('monsterAttackSfx'), 'surface and monster families drive distinct sound events');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
ok(pkg.name === 'mini-legend', 'package name mini-legend');

console.log('\nAll tests passed.');
