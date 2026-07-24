/**
 * Anim packs + shipped pickPlayerAnim / load path.
 * Run: node tests/anim.test.mjs
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH = '/var/folders/96/l70q12vj1yg7ct4x6p96ry9c0000gn/T/grok-goal-e57942fad429/implementer';
const CLASSES = ['warrior', 'wizard', 'taoist'];
const ACTIONS = ['idle', 'walk', 'run', 'jump', 'attack'];
const MOTION = new Set(['walk', 'run', 'jump', 'attack']);

mkdirSync(join(SCRATCH, 'evidence'), { recursive: true });

const invLines = [];
for (const cls of CLASSES) {
  for (const act of ACTIONS) {
    const dir = join(ROOT, 'assets/game/anim', cls, act);
    assert.ok(existsSync(dir), `pack dir missing ${cls}/${act}`);
    const frames = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
    const min = MOTION.has(act) ? 2 : 1;
    assert.ok(frames.length >= min, `${cls}/${act} need ≥${min} frames, got ${frames.length}`);
    invLines.push(`${cls}/${act}: ${frames.length} [${frames.join(', ')}]`);
  }
}
writeFileSync(join(SCRATCH, 'anim_inventory.txt'), invLines.join('\n') + '\n');
console.log('inventory ok\n' + invLines.join('\n'));

// alpha via dynamic import of python-free check using png parse — use child or sharp?
// Use pure node: read PNG IHDR/IDAT is hard; shell out to venv PIL once
const { execFileSync } = await import('node:child_process');
const alphaScript = `
from pathlib import Path
import numpy as np
from PIL import Image
root = Path(${JSON.stringify(ROOT)})
lines = []
bad = 0
for cls in ${JSON.stringify(CLASSES)}:
  for act in ${JSON.stringify(ACTIONS)}:
    d = root / 'assets/game/anim' / cls / act
    for p in sorted(d.glob('*.png'))[:3]:
      a = np.asarray(Image.open(p).convert('RGBA'))[:,:,3]
      corners = [int(a[0,0]), int(a[0,-1]), int(a[-1,0]), int(a[-1,-1])]
      fg = float((a>20).mean())
      ok = all(c==0 for c in corners) and 0.05 < fg < 0.85
      if not ok: bad += 1
      lines.append(f"{p.relative_to(root)} corners={corners} fg={fg:.3f} ok={ok}")
print("\\n".join(lines))
print(f"BAD={bad}")
raise SystemExit(1 if bad else 0)
`;
const alphaOut = execFileSync(join(ROOT, '.venv/bin/python'), ['-c', alphaScript], { encoding: 'utf8' });
writeFileSync(join(SCRATCH, 'alpha_check.txt'), alphaOut);
assert.ok(!alphaOut.includes('BAD=') || /BAD=0/.test(alphaOut), 'alpha check failed:\n' + alphaOut);
console.log('alpha ok');

// shipped anim picker
const animUrl = pathToFileURL(join(ROOT, 'js/anim.js')).href;
const { pickPlayerAnim, ANIM_ACTIONS } = await import(animUrl);
assert.deepEqual([...ANIM_ACTIONS].sort(), [...ACTIONS].sort());
assert.equal(pickPlayerAnim({}), 'idle');
assert.equal(pickPlayerAnim({ moving: true }), 'walk');
assert.equal(pickPlayerAnim({ moving: true, running: true }), 'run');
assert.equal(pickPlayerAnim({ attacking: true, moving: true }), 'attack');
assert.equal(pickPlayerAnim({ jumping: true, attacking: true, moving: true, running: true }), 'jump');
console.log('pickPlayerAnim ok');

// Game loadAssets would need browser Image — structural: paths match load convention
const gameSrc = (await import('node:fs')).readFileSync(join(ROOT, 'js/game.js'), 'utf8');
assert.ok(gameSrc.includes('ANIM_ACTIONS'), 'game uses ANIM_ACTIONS');
assert.ok(gameSrc.includes('pickPlayerAnim'), 'game uses pickPlayerAnim');
assert.ok(gameSrc.includes('tryJump'), 'game has tryJump');
assert.ok(gameSrc.includes('setRun'), 'game has setRun');
assert.ok(gameSrc.includes("missing anim pack"), 'loadAssets fails loud on missing pack');

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
    beginPath() {}, arc() {}, fill() {}, stroke() {}, save() {}, restore() {},
    translate() {}, scale() {}, fillText() {},
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', globalAlpha: 1,
  };
  return { width: 0, height: 0, style: {}, getContext: () => ctx };
}
const packs = {};
for (const act of ACTIONS) packs[act] = [mockImg(), mockImg(), mockImg()];
const assets = {
  units: { warrior: mockImg(), wizard: mockImg(), taoist: mockImg() },
  portraits: {}, avatars: {},
  anim: { warrior: { ...packs }, wizard: { ...packs }, taoist: { ...packs } },
  mobs: { deer: mockImg(), zombie: mockImg(), skeleton: mockImg(), orc: mockImg(), bat: mockImg(), guardian: mockImg() },
  npc: { healer: mockImg(), merchant: mockImg(), warehouse: mockImg() },
  maps: { town: mockImg(), field: mockImg(), temple: mockImg() },
};
const { Game } = await import(pathToFileURL(join(ROOT, 'js/game.js')).href);
const g = new Game(mockCanvas(), assets, { classId: 'warrior', name: 'AnimTest' });
assert.equal(g.player.anim, 'idle');
g.player.moveGoal = { x: g.player.x + 200, y: g.player.y };
g.update(0.05);
assert.equal(g.player.anim, 'walk', 'moving -> walk');
g.setRun(true);
g.update(0.05);
assert.equal(g.player.anim, 'run', 'run+move -> run');
g.setRun(false);
assert.ok(g.tryJump());
assert.equal(g.player.anim, 'jump');
g.update(0.05);
assert.equal(g.player.anim, 'jump', 'still jumping');
// finish jump
g.player.jumpT = 0; g.player.jumpY = 0; g.player.moveGoal = null;
g.player.attacking = true; g.player.animT = 0.2;
g.update(0.016);
assert.equal(g.player.anim, 'attack');
console.log('Game anim state machine ok');

console.log('\nAll anim tests passed.');
