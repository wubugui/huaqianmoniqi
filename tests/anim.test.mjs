/**
 * Anim packs + shipped pickPlayerAnim / load path.
 * Run: node tests/anim.test.mjs
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH = join(tmpdir(), 'mini-legend-anim-qa');
const CLASSES = ['warrior', 'wizard', 'taoist'];
const ACTIONS = ['idle', 'walk', 'run', 'jump', 'attack'];
const PLAYER_FRAME_COUNTS = { idle: 6, walk: 10, run: 10, jump: 6, attack: 6 };
const MOB_ACTIONS = ['idle', 'walk', 'attack', 'death'];
const MOBS = ['deer', 'zombie', 'skeleton', 'bat', 'wolf', 'centipede', 'boar', 'orc', 'guardian', 'lord'];
const NPCS = ['healer', 'merchant', 'warehouse', 'captain'];
const DIRECTIONS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
const DIRECTIONAL_MOBS = ['deer', 'wolf'];
const DIRECTIONAL_PLAYER_COUNTS = {
  warrior: Object.fromEntries(['idle', 'walk', 'run', 'attack'].map((action) => [
    action,
    Object.fromEntries(DIRECTIONS.map((direction) => [direction, 6])),
  ])),
  wizard: Object.fromEntries(['idle', 'walk', 'run', 'attack'].map((action) => [
    action,
    Object.fromEntries(DIRECTIONS.map((direction) => [direction, 6])),
  ])),
  taoist: Object.fromEntries(['idle', 'walk', 'run', 'attack'].map((action) => [
    action,
    Object.fromEntries(DIRECTIONS.map((direction) => [direction, 6])),
  ])),
};
const DIRECTIONAL_PLAYER_FRAME_SIZES = {
  warrior: [256, 256],
  wizard: [256, 256],
  taoist: [256, 256],
};
const FOUR_FRAME_MOB_DIRECTION_COUNTS = Object.fromEntries(
  MOB_ACTIONS.map((action) => [
    action,
    Object.fromEntries(DIRECTIONS.map((direction) => [direction, 4])),
  ]),
);

mkdirSync(join(SCRATCH, 'evidence'), { recursive: true });

const invLines = [];
for (const cls of CLASSES) {
  for (const act of ACTIONS) {
    const dir = join(ROOT, 'assets/game/anim', cls, act);
    assert.ok(existsSync(dir), `pack dir missing ${cls}/${act}`);
    const frames = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
    assert.equal(frames.length, PLAYER_FRAME_COUNTS[act], `${cls}/${act} frame count drift`);
    invLines.push(`${cls}/${act}: ${frames.length} [${frames.join(', ')}]`);
  }
}
for (const mob of MOBS) {
  for (const act of MOB_ACTIONS) {
    const dir = join(ROOT, 'assets/game/anim/mob', mob, act);
    assert.ok(existsSync(dir), `mob pack dir missing ${mob}/${act}`);
    const frames = readdirSync(dir).filter((file) => file.endsWith('.png')).sort();
    assert.equal(frames.length, 4, `${mob}/${act} needs exactly 4 frames`);
    invLines.push(`mob/${mob}/${act}: ${frames.length} [${frames.join(', ')}]`);
  }
}
for (const npc of NPCS) {
  const dir = join(ROOT, 'assets/game/anim/npc', npc, 'idle');
  assert.ok(existsSync(dir), `npc pack dir missing ${npc}/idle`);
  const frames = readdirSync(dir).filter((file) => file.endsWith('.png')).sort();
  assert.equal(frames.length, 4, `${npc}/idle needs exactly 4 frames`);
  invLines.push(`npc/${npc}/idle: ${frames.length} [${frames.join(', ')}]`);
}
for (const [classId, actionCounts] of Object.entries(DIRECTIONAL_PLAYER_COUNTS)) {
  for (const direction of DIRECTIONS) {
    for (const action of ['idle', 'walk', 'run', 'attack']) {
      const dir = join(ROOT, 'assets/game/anim/directional', classId, direction, action);
      assert.ok(existsSync(dir), `authored ${classId} direction missing ${direction}/${action}`);
      const frames = readdirSync(dir).filter((file) => /^[0-9]{2}\.png$/.test(file)).sort();
      assert.equal(
        frames.length,
        actionCounts[action][direction],
        `${classId} ${direction}/${action} frame count drift`,
      );
      invLines.push(`directional/${classId}/${direction}/${action}: ${frames.length}`);
    }
  }
}
for (const mob of DIRECTIONAL_MOBS) {
  for (const direction of DIRECTIONS) {
    for (const action of MOB_ACTIONS) {
      const dir = join(ROOT, 'assets/game/anim/directional/mob', mob, direction, action);
      assert.ok(existsSync(dir), `authored ${mob} direction missing ${direction}/${action}`);
      const frames = readdirSync(dir).filter((file) => /^[0-9]{2}\.png$/.test(file)).sort();
      assert.equal(
        frames.length,
        FOUR_FRAME_MOB_DIRECTION_COUNTS[action][direction],
        `${mob} ${direction}/${action} frame count drift`,
      );
      invLines.push(`directional/mob/${mob}/${direction}/${action}: ${frames.length}`);
    }
  }
}
writeFileSync(join(SCRATCH, 'anim_inventory.txt'), invLines.join('\n') + '\n');
console.log('inventory ok\n' + invLines.join('\n'));

// Pixel-level QA: frame dimensions, atlas parity, transparency, clipping,
// periodic root/contact stability, cadence, and loop seams across every runtime frame.
const { execFileSync } = await import('node:child_process');
const alphaScript = `
from pathlib import Path
import json
import numpy as np
from PIL import Image
root = Path(${JSON.stringify(ROOT)})
lines = []
issues = []
border_paths = []
pack_metrics = []
packs = []
for cls in ${JSON.stringify(CLASSES)}:
  for act in ${JSON.stringify(ACTIONS)}:
    packs.append(('player', cls, act, root / 'assets/game/anim' / cls / act, (256, 256)))
for role_type, roles, acts in [
  ('mob', ${JSON.stringify(MOBS)}, ${JSON.stringify(MOB_ACTIONS)}),
  ('npc', ${JSON.stringify(NPCS)}, ['idle']),
]:
  for role in roles:
    for act in acts:
      packs.append((role_type, role, act, root / 'assets/game/anim' / role_type / role / act, (384, 256)))
directional_player_sizes = ${JSON.stringify(DIRECTIONAL_PLAYER_FRAME_SIZES)}
for class_id, frame_size in directional_player_sizes.items():
  for direction in ${JSON.stringify(DIRECTIONS)}:
    for act in ('idle', 'walk', 'run', 'attack'):
      packs.append((
        'directional-player',
        f'{class_id}/{direction}',
        act,
        root / 'assets/game/anim/directional' / class_id / direction / act,
        tuple(frame_size),
      ))
for mob in ${JSON.stringify(DIRECTIONAL_MOBS)}:
  for direction in ${JSON.stringify(DIRECTIONS)}:
    for act in ${JSON.stringify(MOB_ACTIONS)}:
      packs.append((
        'directional-mob',
        f'{mob}/{direction}',
        act,
        root / 'assets/game/anim/directional/mob' / mob / direction / act,
        (384, 256),
      ))

for role_type, role, act, d, expected_size in packs:
  paths = sorted(d.glob('[0-9][0-9].png'))
  frames = []
  roots = []
  feet = []
  for p in paths:
    rgba = np.asarray(Image.open(p).convert('RGBA'), dtype=np.uint8)
    frames.append(rgba)
    height, width = rgba.shape[:2]
    if (width, height) != expected_size:
      issues.append(f"{p.relative_to(root)} size={(width, height)} expected={expected_size}")
    alpha = rgba[:,:,3]
    corners = [int(alpha[0,0]), int(alpha[0,-1]), int(alpha[-1,0]), int(alpha[-1,-1])]
    ys, xs = np.nonzero(alpha > 18)
    fg = float((alpha > 18).mean())
    min_fg = 0.04 if role_type in ('player', 'directional-player') else 0.008
    if any(corners) or not min_fg < fg < 0.75 or not len(xs):
      issues.append(f"{p.relative_to(root)} corners={corners} fg={fg:.4f}")
      continue
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    if x0 < 2 or y0 < 2 or x1 > width - 2 or y1 > height - 2:
      border_paths.append(str(p.relative_to(root / 'assets/game/anim')))
    if role_type == 'directional-player' and role.startswith('warrior/') and act == 'attack':
      rgb = rgba[:,:,:3].astype(np.int16)
      baked_trail = (
        (alpha > 18)
        & (rgb[:,:,0] > 170)
        & (rgb[:,:,2] > 150)
        & ((rgb[:,:,0] + rgb[:,:,2]) > (rgb[:,:,1] * 2 + 35))
      )
      baked_pixels = int(baked_trail.sum())
      if baked_pixels > 32:
        issues.append(f"{p.relative_to(root)} possible baked pink/purple slash pixels={baked_pixels}>32")
    body_h = max(1, y1 - y0)
    band_top, band_bottom = ((0.38, 0.58) if act == 'idle' else (0.42, 0.64))
    band = (ys >= y0 + body_h * band_top) & (ys <= y0 + body_h * band_bottom)
    roots.append(float(np.median(xs[band])) if np.any(band) else float(np.median(xs)))
    lower = ys[ys >= y0 + body_h * 0.58]
    feet.append(float(np.percentile(lower if len(lower) else ys, 99.2)))
    lines.append(f"{p.relative_to(root)} corners={corners} fg={fg:.4f} bbox={(x0,y0,x1,y1)}")

  atlas_path = d.parent / f"{act}_sheet.png"
  atlas = np.asarray(Image.open(atlas_path).convert('RGBA'), dtype=np.uint8)
  expected_atlas = np.concatenate(frames, axis=1)
  if atlas.shape != expected_atlas.shape or not np.array_equal(atlas, expected_atlas):
    issues.append(f"{atlas_path.relative_to(root)} does not exactly match packed frames")

  composed = []
  for rgba in frames:
    alpha = rgba[:,:,3:4].astype(np.float32) / 255.0
    composed.append(rgba[:,:,:3].astype(np.float32) * alpha + 72.0 * (1.0 - alpha))
  adjacent = [float(np.mean(np.abs(a - b))) for a, b in zip(composed, composed[1:])]
  seam = float(np.mean(np.abs(composed[-1] - composed[0])))
  seam_ratio = seam / max(0.001, float(np.mean(adjacent)))
  min_motion_ratio = min(adjacent) / max(0.001, float(np.median(adjacent)))
  periodic = act in ('idle', 'walk') or (
    role_type in ('player', 'directional-player') and act == 'run'
  )
  if not roots or not feet:
    issues.append(f"{role_type}/{role}/{act} no-valid-frames-for-anchor-metrics")
    continue
  root_range = max(roots) - min(roots)
  foot_range = max(feet) - min(feet)
  if periodic:
    root_limit = 18.0 if role_type in ('player', 'directional-player') else 2.0
    foot_limit = 6.0 if role_type in ('player', 'directional-player') else 1.1
    if root_range > root_limit:
      issues.append(f"{role_type}/{role}/{act} rootRange={root_range:.3f}>{root_limit}")
    if foot_range > foot_limit:
      issues.append(f"{role_type}/{role}/{act} footRange={foot_range:.3f}>{foot_limit}")
    if seam_ratio > 1.5:
      issues.append(f"{role_type}/{role}/{act} seamRatio={seam_ratio:.3f}>1.5")
  motion_floor = 0.18 if act == 'idle' else 0.30
  if min_motion_ratio < motion_floor:
    issues.append(f"{role_type}/{role}/{act} duplicate-phase ratio={min_motion_ratio:.3f}")
  pack_metrics.append({
    'pack': f"{role_type}/{role}/{act}",
    'frameCount': len(frames),
    'rootRange': round(root_range, 3),
    'footRange': round(foot_range, 3),
    'loopSeamRatio': round(seam_ratio, 4) if periodic else None,
    'minMotionRatio': round(min_motion_ratio, 4),
  })

print("\\n".join(lines))
print("SUMMARY=" + json.dumps({
  'frameCount': sum(len(sorted(d.glob('[0-9][0-9].png'))) for _,_,_,d,_ in packs),
  'sheetCount': len(packs),
  'borderPaths': border_paths,
  'issues': issues,
  'packs': pack_metrics,
}, separators=(',', ':')))
`;
const alphaOut = execFileSync(join(ROOT, '.venv/bin/python'), ['-c', alphaScript], { encoding: 'utf8' });
writeFileSync(join(SCRATCH, 'alpha_check.txt'), alphaOut);
const assetSummary = JSON.parse(alphaOut.match(/^SUMMARY=(.+)$/m)?.[1] || '{}');
const directionalPlayerFrameTotal = Object.values(DIRECTIONAL_PLAYER_COUNTS)
  .reduce((classTotal, actions) => classTotal + Object.values(actions)
    .reduce((actionTotal, directions) => actionTotal
      + Object.values(directions).reduce((sum, count) => sum + count, 0), 0), 0);
const expectedRuntimeFrameCount = (
  CLASSES.length * Object.values(PLAYER_FRAME_COUNTS).reduce((sum, count) => sum + count, 0)
  + MOBS.length * MOB_ACTIONS.length * 4
  + NPCS.length * 4
  + directionalPlayerFrameTotal
  + DIRECTIONAL_MOBS.length * DIRECTIONS.length * MOB_ACTIONS.length * 4
);
const expectedRuntimeSheetCount = (
  CLASSES.length * ACTIONS.length
  + MOBS.length * MOB_ACTIONS.length
  + NPCS.length
  + Object.keys(DIRECTIONAL_PLAYER_COUNTS).length * DIRECTIONS.length * 4
  + DIRECTIONAL_MOBS.length * DIRECTIONS.length * MOB_ACTIONS.length
);
assert.equal(assetSummary.frameCount, expectedRuntimeFrameCount, 'runtime independent-frame inventory drift');
assert.equal(assetSummary.sheetCount, expectedRuntimeSheetCount, 'runtime atlas inventory drift');
const unexpectedBorders = assetSummary.borderPaths.filter((path) => {
  // Legacy exception plus directional attack frames where weapons may graze the cell edge.
  if (path === 'warrior/attack/03.png') return false;
  if (/^directional\/(warrior|wizard|taoist)\/[a-z]+\/attack\//.test(path)) return false;
  return true;
});
assert.deepEqual(
  unexpectedBorders,
  [],
  `unexpected clipped alpha edges:\n${unexpectedBorders.join('\n')}`,
);
assert.deepEqual(assetSummary.issues, [], `animation pixel QA failed:\n${assetSummary.issues?.join('\n')}`);
console.log('all-frame pixel/atlas/anchor/loop QA ok');

// shipped anim picker
const animUrl = pathToFileURL(join(ROOT, 'js/anim.js')).href;
const {
  pickPlayerAnim, pickMonsterAnim, monsterAnimFps, ANIM_ACTIONS, MOB_ANIM_ACTIONS,
  direction8, animFps, isLoopingAnim, advanceAnimFrame, PLAYER_ANIM_PROFILES,
  PLAYER_DIRECTIONAL_SPECS, MOB_DIRECTIONAL_SPECS,
  directionalFrameCount, mobDirectionalFrameCount, contactFramesFor, contactFrameCrossings,
} = await import(animUrl);
assert.deepEqual([...ANIM_ACTIONS].sort(), [...ACTIONS].sort());
assert.equal(pickPlayerAnim({}), 'idle');
assert.equal(pickPlayerAnim({ moving: true }), 'walk');
assert.equal(pickPlayerAnim({ moving: true, running: true }), 'run');
assert.equal(pickPlayerAnim({ attacking: true, moving: true }), 'attack');
assert.equal(pickPlayerAnim({ jumping: true, attacking: true, moving: true, running: true }), 'jump');
console.log('pickPlayerAnim ok');
assert.deepEqual([...MOB_ANIM_ACTIONS], MOB_ACTIONS);
assert.equal(pickMonsterAnim({ alive: true }), 'idle');
assert.equal(pickMonsterAnim({ alive: true, moving: true }), 'walk');
assert.equal(pickMonsterAnim({ alive: true, moving: true, attacking: true }), 'attack');
assert.equal(pickMonsterAnim({ alive: false, attacking: true }), 'death');
assert.equal(pickMonsterAnim({}), 'idle', 'missing alive flag must not silently select death');
assert.ok(monsterAnimFps('attack', 'zombie') > monsterAnimFps('walk', 'zombie'));
console.log('pickMonsterAnim ok');
assert.equal(direction8(1, 0), 'e');
assert.equal(direction8(1, 1), 'se');
assert.equal(direction8(0, 1), 's');
assert.equal(direction8(-1, -1), 'nw');
assert.equal(direction8(0, -1), 'n');
assert.equal(direction8(Number.NaN, 1, 'sw'), 'sw');
assert.equal(direction8(0, 0, 'invalid'), 's');
console.log('direction8 ok');
assert.equal(animFps('walk'), PLAYER_ANIM_PROFILES.walk.fps);
assert.equal(isLoopingAnim('run'), true);
assert.equal(isLoopingAnim('attack'), false);
assert.equal(advanceAnimFrame(9.5, 0.1, 'run', 10, 10), 0.5, 'cyclic state wraps');
assert.equal(advanceAnimFrame(4.5, 1, 'attack', 6, 10), 5, 'one-shot holds final frame');
assert.equal(advanceAnimFrame(2, -1, 'walk', 10, 10), 2, 'negative dt cannot rewind');
assert.deepEqual(PLAYER_ANIM_PROFILES.run.contactFrames, [0, 5]);
assert.deepEqual(contactFramesFor('walk', 10), [0, 5]);
assert.deepEqual(contactFramesFor('walk', 6), [0, 3]);
assert.equal(contactFrameCrossings(0, 3, 6, [0, 3]), 1, 'first foot contact fires once');
assert.equal(contactFrameCrossings(3, 6, 6, [0, 3]), 1, 'loop contact fires once');
assert.equal(contactFrameCrossings(0, 6, 6, [0, 3]), 2, 'six-frame gait has two contacts per loop');
assert.equal(contactFrameCrossings(2.6, 6.2, 6, [0, 3]), 2, 'dropped frames retain both contacts');
assert.equal(contactFrameCrossings(6, 6.2, 6, [0, 3]), 0, 'contact boundary is not repeated');
assert.equal(contactFrameCrossings(0, 3, 6, [0, 3], false), 0, 'state entry cannot replay contact');
assert.equal(directionalFrameCount('warrior', 'walk', 'n'), 6);
assert.equal(directionalFrameCount('warrior', 'walk', 'e'), 6);
assert.equal(directionalFrameCount('taoist', 'walk', 'n'), 6);
assert.equal(directionalFrameCount('taoist', 'walk', 'e'), 6);
assert.equal(directionalFrameCount('taoist', 'idle', 'sw'), 6);
assert.equal(directionalFrameCount('taoist', 'attack', 'ne'), 6);
assert.equal(directionalFrameCount('wizard', 'walk', 'n'), 6);
assert.equal(directionalFrameCount('wizard', 'walk', 'w'), 6);
assert.deepEqual(Object.keys(PLAYER_DIRECTIONAL_SPECS.warrior).sort(), ['attack', 'idle', 'run', 'walk']);
assert.deepEqual(Object.keys(PLAYER_DIRECTIONAL_SPECS.taoist).sort(), ['attack', 'idle', 'run', 'walk']);
assert.equal(mobDirectionalFrameCount('wolf', 'walk', 'n'), 4);
assert.equal(mobDirectionalFrameCount('wolf', 'death', 'sw'), 4);
assert.equal(mobDirectionalFrameCount('deer', 'walk', 'n'), 4);
assert.equal(mobDirectionalFrameCount('zombie', 'walk', 'n'), 0, 'legacy-only mob stays explicit fallback');
assert.deepEqual(Object.keys(MOB_DIRECTIONAL_SPECS.wolf).sort(), [...MOB_ACTIONS].sort());
assert.deepEqual(Object.keys(MOB_DIRECTIONAL_SPECS.deer).sort(), [...MOB_ACTIONS].sort());
console.log('animation timing contract ok');

// Game loadAssets would need browser Image — structural: paths match load convention
const gameSrc = (await import('node:fs')).readFileSync(join(ROOT, 'js/game.js'), 'utf8');
assert.ok(gameSrc.includes('ANIM_ACTIONS'), 'game uses ANIM_ACTIONS');
assert.ok(gameSrc.includes('pickPlayerAnim'), 'game uses pickPlayerAnim');
assert.ok(gameSrc.includes('pickMonsterAnim'), 'game uses pickMonsterAnim');
assert.ok(gameSrc.includes('MOB_ANIM_ACTIONS'), 'game loads monster animation actions');
assert.ok(gameSrc.includes('tryJump'), 'game has tryJump');
assert.ok(gameSrc.includes('setRun'), 'game has setRun');
assert.ok(gameSrc.includes("missing anim pack"), 'loadAssets fails loud on missing pack');
assert.ok(gameSrc.includes('directionalAnim'), 'game loads authored directional packs');
assert.ok(gameSrc.includes('directionalMobAnim'), 'game loads authored directional mob packs');
assert.ok(gameSrc.includes('authoredDirection'), 'render path distinguishes authored direction from fallback');
assert.ok(
  gameSrc.includes("d.id.startsWith('tree_')") && gameSrc.includes("d.id.startsWith('pine_')"),
  'authored tree/pine variants retain player-occlusion fading',
);
assert.ok(!gameSrc.includes('p.footstepT = p.running'), 'player footsteps are no longer timer-driven');

// sim with mock: anim state through update
globalThis.innerWidth = 800;
globalThis.innerHeight = 600;
globalThis.window = globalThis;
globalThis.localStorage = {
  _s: new Map(),
  getItem(k) { return this._s.has(k) ? this._s.get(k) : null; },
  setItem(k, v) { this._s.set(k, String(v)); },
  removeItem(k) { this._s.delete(k); },
};
function mockImg() { return { width: 64, height: 64 }; }
function mockCanvas() {
  const ctx = {
    setTransform() {}, clearRect() {}, fillRect() {}, strokeRect() {}, drawImage() {},
    beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {}, save() {}, restore() {},
    translate() {}, scale() {}, rotate() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    closePath() {}, setLineDash() {}, fillText() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', globalAlpha: 1,
  };
  return { width: 0, height: 0, style: {}, getContext: () => ctx };
}
const packs = {};
for (const act of ACTIONS) packs[act] = [mockImg(), mockImg(), mockImg()];
function mockDirectionalPlayer(classId, actionCounts) {
  return Object.fromEntries(Object.entries(actionCounts).map(([action, directionCounts]) => [
    action,
    Object.fromEntries(Object.entries(directionCounts).map(([direction, count]) => [
      direction,
      Array.from({ length: count }, (_, frame) => ({
        width: DIRECTIONAL_PLAYER_FRAME_SIZES[classId][0],
        height: DIRECTIONAL_PLAYER_FRAME_SIZES[classId][1],
        classId,
        action,
        direction,
        frame,
      })),
    ])),
  ]));
}
const assets = {
  units: { warrior: mockImg(), wizard: mockImg(), taoist: mockImg() },
  portraits: {}, avatars: {},
  anim: { warrior: { ...packs }, wizard: { ...packs }, taoist: { ...packs } },
  directionalAnim: {
    warrior: mockDirectionalPlayer('warrior', DIRECTIONAL_PLAYER_COUNTS.warrior),
    wizard: mockDirectionalPlayer('wizard', DIRECTIONAL_PLAYER_COUNTS.wizard),
    taoist: mockDirectionalPlayer('taoist', DIRECTIONAL_PLAYER_COUNTS.taoist),
  },
  directionalMobAnim: {
    ...Object.fromEntries(DIRECTIONAL_MOBS.map((kind) => [
      kind,
      Object.fromEntries(MOB_ACTIONS.map((action) => [
        action,
        Object.fromEntries(DIRECTIONS.map((direction, index) => [
          direction,
          Array.from({ length: 4 }, (_, frame) => ({
            width: 384,
            height: 256,
            kind,
            action,
            direction,
            index,
            frame,
          })),
        ])),
      ])),
    ])),
  },
  mobs: {
    deer: mockImg(), zombie: mockImg(), skeleton: mockImg(), orc: mockImg(),
    bat: mockImg(), wolf: mockImg(), centipede: mockImg(), boar: mockImg(),
    guardian: mockImg(), lord: mockImg(),
  },
  npc: { healer: mockImg(), merchant: mockImg(), warehouse: mockImg(), captain: mockImg() },
  maps: { town: mockImg(), field: mockImg(), temple: mockImg() },
};
const { Game } = await import(pathToFileURL(join(ROOT, 'js/game.js')).href);
const g = new Game(mockCanvas(), assets, { classId: 'warrior', name: 'AnimTest' });
assert.equal(g.player.anim, 'idle');
for (const [classId, actionCounts] of Object.entries(DIRECTIONAL_PLAYER_COUNTS)) {
  for (const [action, directionCounts] of Object.entries(actionCounts)) {
    for (const [direction, count] of Object.entries(directionCounts)) {
      const selected = g._playerAnimSelection(classId, action, count - 1, direction);
      assert.equal(selected.img.classId, classId, `live selection keeps ${classId} identity`);
      assert.equal(selected.img.action, action, `live ${classId} selection keeps ${action} chronology`);
      assert.equal(selected.img.direction, direction, `live ${classId} switches to ${direction} authored pixels`);
      assert.equal(selected.img.frame, count - 1, `live ${classId} uses the requested ${direction} frame`);
      assert.equal(selected.frameCount, count, `live ${classId} reports the authored ${direction} frame count`);
      assert.equal(selected.authoredDirection, true);
    }
  }
}
for (const kind of DIRECTIONAL_MOBS) {
  for (const direction of DIRECTIONS) {
    const selected = g._mobAnimSelection(kind, 'walk', 2, direction);
    assert.equal(selected.img.kind, kind, `live ${kind} selection has authored ${direction} pixels`);
    assert.equal(selected.img.direction, direction, `live ${kind} selection switches to ${direction} view`);
    assert.equal(selected.img.frame, 2, `live ${kind} selection keeps ${direction} gait chronology`);
    assert.equal(selected.authoredDirection, true);
  }
}
assert.equal(
  g._mobAnimSelection('wolf', 'death', 99, 'nw').img.frame,
  3,
  'authored death is a one-shot that holds the final corpse',
);
assert.equal(
  g._mobAnimSelection('wolf', 'attack', 99, 'se').img.frame,
  3,
  'authored attack cannot wrap back to anticipation',
);
const authoredOps = [];
const authoredCtx = {
  save() {},
  restore() {},
  translate(...args) { authoredOps.push(['translate', ...args]); },
  scale(...args) { authoredOps.push(['scale', ...args]); },
  drawImage(...args) { authoredOps.push(['drawImage', ...args]); },
};
g._drawSprite(
  authoredCtx,
  { width: 256, height: 256 },
  g.player.x,
  g.player.y,
  96,
  -1,
  0.92,
  'n',
  true,
);
assert.equal(
  authoredOps.some(([operation]) => operation === 'scale'),
  false,
  'authored direction bypasses the legacy facing mirror',
);
const authoredDraw = authoredOps.find(([operation]) => operation === 'drawImage');
assert.equal(authoredDraw[4], 96, 'authored north frame bypasses the legacy 0.84 perspective squeeze');
g.networkPlayerId = 'self';
g.showChatMessage({ id: 'chat-1', fromId: 'self', channel: 'nearby', text: '看得见的气泡' });
assert.equal(g.player.chatBubble.text, '看得见的气泡', 'own chat message creates a visible actor bubble');
g.player.moveGoal = { x: g.player.x + 200, y: g.player.y };
g.update(0.05);
assert.equal(g.player.anim, 'walk', 'moving -> walk');
g.setRun(true);
g.update(0.05);
assert.equal(g.player.anim, 'run', 'run+move -> run');
g.setRun(false);
assert.equal(g.tryJump(), false, 'classic ground combat has no free jump');
g.player.moveGoal = null;
g.player.attacking = true; g.player.animT = 0.2;
g.update(0.016);
assert.equal(g.player.anim, 'attack');
console.log('Game anim state machine ok');

// Use the map's scaled, protected road spawn. Hard-coded authoring-space
// coordinates became a blocked forest cell after the 96×72 world expansion.
g.loadMap('field');
const deer = g.monsters.find((monster) => monster.kind === 'deer');
g.player.attacking = false;
g.player.animT = 0;
g.player.attackCd = 0;
deer.x = g.player.x + 20;
deer.y = g.player.y;
deer.stun = 10;
const deerHpBeforeSwing = deer.hp;
const playerXBeforeSwing = g.player.x;
g.tryAttack(g.player, deer);
assert.equal(deer.hp, deerHpBeforeSwing, 'starting an attack does not deal pre-frame damage');
g.setMoveVector(1, 0);
g.update(0.1);
assert.equal(deer.hp, deerHpBeforeSwing, 'damage has not landed before the configured hit frame');
assert.equal(g.player.x, playerXBeforeSwing, 'attack recovery locks movement instead of allowing slide attacks');
g.update(0.1);
assert.ok(deer.hp < deerHpBeforeSwing, 'damage lands on the attack hit frame');
g.setMoveVector(0, 0);
g.player.combatAction = null;
g.player.attacking = false;
g.player.animT = 0;
deer.stun = 0;

deer.x = g.player.x + 180;
deer.y = g.player.y;
deer.home = { x: deer.x, y: deer.y };
deer.target = null;
deer.wanderT = 99;
deer.moveGoal = { x: deer.x + 40, y: deer.y };
g.update(0.05);
assert.equal(deer.anim, 'walk', 'wandering monster -> walk');
deer.x = g.player.x + 20;
deer.y = g.player.y;
deer.target = g.player;
deer.attackCd = 0;
g.update(0.05);
assert.equal(deer.anim, 'attack', 'attacking monster -> attack');
g.kill(g.player, deer);
assert.equal(deer.anim, 'death', 'killed monster -> death');
assert.ok(deer.deathUntil > g.time, 'death animation remains visible briefly');
console.log('Game monster animation state machine ok');

deer.alive = true;
deer.hp = deer.maxHp;
deer.networkMonster = true;
deer.serverX = deer.x - 48;
deer.serverY = deer.y;
deer.serverAnim = 'walk';
g.monsters = [deer];
g.multiplayerActive = true;
g.update(0.05);
assert.equal(deer.direction, 'w', 'network monster interpolation derives westward direction');
assert.equal(deer.facing, -1, 'network monster moving left mirrors toward travel direction');
console.log('Network monster facing ok');

console.log('\nAll anim tests passed.');
