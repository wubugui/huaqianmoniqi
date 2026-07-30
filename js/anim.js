/**
 * Pure anim state selection — shipped path used by Game.update.
 * Priority: jump > attack > run > walk > idle
 */
export const ANIM_ACTIONS = ['idle', 'walk', 'run', 'jump', 'attack'];
export const MOB_ANIM_ACTIONS = ['idle', 'walk', 'attack', 'death'];
export const DIRECTIONS_8 = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];

const VALID_DIRECTIONS = new Set(DIRECTIONS_8);
const WARRIOR_DIRECTION_COUNTS = Object.freeze({
  idle: Object.freeze(Object.fromEntries(DIRECTIONS_8.map((direction) => [direction, 6]))),
  walk: Object.freeze(Object.fromEntries(DIRECTIONS_8.map((direction) => [direction, direction === 'e' ? 10 : 6]))),
  run: Object.freeze(Object.fromEntries(DIRECTIONS_8.map((direction) => [direction, direction === 'e' ? 10 : 6]))),
  attack: Object.freeze(Object.fromEntries(DIRECTIONS_8.map((direction) => [direction, 6]))),
});
const TAOIST_DIRECTION_COUNTS = Object.freeze({
  idle: Object.freeze(Object.fromEntries(DIRECTIONS_8.map((direction) => [direction, 6]))),
  walk: Object.freeze(Object.fromEntries(DIRECTIONS_8.map((direction) => [direction, direction === 'e' ? 10 : 6]))),
  run: Object.freeze(Object.fromEntries(DIRECTIONS_8.map((direction) => [direction, direction === 'e' ? 10 : 6]))),
  attack: Object.freeze(Object.fromEntries(DIRECTIONS_8.map((direction) => [direction, 6]))),
});
const FOUR_FRAME_MOB_DIRECTION_COUNTS = Object.freeze(
  Object.fromEntries(
    MOB_ANIM_ACTIONS.map((action) => [
      action,
      Object.freeze(Object.fromEntries(DIRECTIONS_8.map((direction) => [direction, 4]))),
    ]),
  ),
);

/**
 * Explicit authored-direction inventory. Missing class/action/direction entries
 * are deliberately treated as legacy fallbacks; they must never be advertised
 * as authored just because the renderer can mirror an east-facing sprite.
 */
export const PLAYER_DIRECTIONAL_SPECS = Object.freeze({
  warrior: WARRIOR_DIRECTION_COUNTS,
  taoist: TAOIST_DIRECTION_COUNTS,
});

/** Explicit original monster views; absent kinds stay on the legacy fallback path. */
export const MOB_DIRECTIONAL_SPECS = Object.freeze({
  deer: FOUR_FRAME_MOB_DIRECTION_COUNTS,
  wolf: FOUR_FRAME_MOB_DIRECTION_COUNTS,
});

/** Quantize an arbitrary movement/aim vector to the eight directions used by classic ARPG controls. */
export function direction8(dx, dy, fallback = 's', deadZone = 0.01) {
  const safeFallback = VALID_DIRECTIONS.has(fallback) ? fallback : 's';
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return safeFallback;
  if (Math.hypot(dx, dy) < Math.max(0, deadZone)) return safeFallback;
  const angle = Math.atan2(dy, dx);
  const index = Math.round(angle / (Math.PI / 4));
  return DIRECTIONS_8[(index + 8) % 8];
}

/** Return the authored frame count, or zero when a direction is only a fallback. */
export function directionalFrameCount(classId, action, direction) {
  if (!VALID_DIRECTIONS.has(direction)) return 0;
  const count = PLAYER_DIRECTIONAL_SPECS[classId]?.[action]?.[direction];
  return Number.isInteger(count) && count > 0 ? count : 0;
}

/** Return the authored monster frame count, or zero for a legacy-only view. */
export function mobDirectionalFrameCount(kind, action, direction) {
  if (!VALID_DIRECTIONS.has(direction)) return 0;
  const count = MOB_DIRECTIONAL_SPECS[kind]?.[action]?.[direction];
  return Number.isInteger(count) && count > 0 ? count : 0;
}

/**
 * Playback metadata is kept next to state selection so gameplay, QA, and audio
 * can share one timing contract. `contactFrames` are the two locomotion poses
 * that should drive future frame-locked footstep events.
 */
export const PLAYER_ANIM_PROFILES = Object.freeze({
  idle: Object.freeze({ fps: 5, loop: true, resetOnEnter: false, contactFrames: [] }),
  walk: Object.freeze({ fps: 9, loop: true, resetOnEnter: false, contactFrames: [0, 5] }),
  run: Object.freeze({ fps: 10, loop: true, resetOnEnter: false, contactFrames: [0, 5] }),
  jump: Object.freeze({ fps: 12, loop: false, resetOnEnter: true, contactFrames: [] }),
  attack: Object.freeze({ fps: 13, loop: false, resetOnEnter: true, contactFrames: [] }),
});

/**
 * @param {{ jumping?: boolean, attacking?: boolean, moving?: boolean, running?: boolean }} s
 * @returns {'idle'|'walk'|'run'|'jump'|'attack'}
 */
export function pickPlayerAnim(s) {
  if (s.jumping) return 'jump';
  if (s.attacking) return 'attack';
  if (s.moving && s.running) return 'run';
  if (s.moving) return 'walk';
  return 'idle';
}

/** Frame advance rate (frames per second of sequence index) per action */
export function animFps(action) {
  return PLAYER_ANIM_PROFILES[action]?.fps ?? 8;
}

/** True only for states whose final frame is expected to wrap to frame zero. */
export function isLoopingAnim(action) {
  return PLAYER_ANIM_PROFILES[action]?.loop === true;
}

/**
 * Pure, seconds-based frame advancement for deterministic tests and renderers.
 * One-shots hold their last frame instead of wrapping back to their wind-up.
 */
export function advanceAnimFrame(frame, dt, action, frameCount, fps = animFps(action)) {
  const count = Math.max(1, Math.floor(Number.isFinite(frameCount) ? frameCount : 1));
  const current = Number.isFinite(frame) ? Math.max(0, frame) : 0;
  const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  const next = current + elapsed * Math.max(0, Number.isFinite(fps) ? fps : 0);
  return isLoopingAnim(action) ? next % count : Math.min(count - 1, next);
}

/**
 * Convert the canonical ten-frame gait markers to the active pack length.
 * Authored six-frame locomotion therefore lands on [0, 3], while the legacy
 * ten-frame pack remains [0, 5].
 */
export function contactFramesFor(action, frameCount) {
  const count = Math.max(1, Math.floor(Number.isFinite(frameCount) ? frameCount : 1));
  const canonical = PLAYER_ANIM_PROFILES[action]?.contactFrames || [];
  if (!canonical.length) return [];
  const mapped = canonical.map((frame) => Math.round((frame / 10) * count) % count);
  return [...new Set(mapped)].sort((a, b) => a - b);
}

/**
 * Count contact poses crossed in the half-open interval (previous, next].
 * Continuous, unwrapped frame positions make dropped-frame and loop-wrap
 * handling deterministic. State entry should pass `sameState=false` so it
 * cannot replay the first footfall.
 */
export function contactFrameCrossings(
  previous,
  next,
  frameCount,
  contactFrames,
  sameState = true,
) {
  if (!sameState || !Number.isFinite(previous) || !Number.isFinite(next) || next <= previous) return 0;
  const count = Math.max(1, Math.floor(Number.isFinite(frameCount) ? frameCount : 1));
  const contacts = new Set(
    (contactFrames || [])
      .filter(Number.isFinite)
      .map((frame) => ((Math.round(frame) % count) + count) % count),
  );
  if (!contacts.size) return 0;
  let crossings = 0;
  const firstBoundary = Math.floor(previous) + 1;
  const lastBoundary = Math.floor(next);
  // A single simulation tick should never traverse this many frames, but cap
  // malformed deltas so an audio callback cannot be turned into a long loop.
  const cappedLast = Math.min(lastBoundary, firstBoundary + count * 2 - 1);
  for (let boundary = firstBoundary; boundary <= cappedLast; boundary += 1) {
    const phase = ((boundary % count) + count) % count;
    if (contacts.has(phase)) crossings += 1;
  }
  return crossings;
}

/**
 * @param {{ alive?: boolean, attacking?: boolean, moving?: boolean }} state
 * @returns {'idle'|'walk'|'attack'|'death'}
 */
export function pickMonsterAnim(state) {
  if (state.alive === false) return 'death';
  if (state.attacking) return 'attack';
  if (state.moving) return 'walk';
  return 'idle';
}

/** Compact four-frame monster packs use deliberately weighty playback rates. */
export function monsterAnimFps(action, kind = '') {
  if (action === 'death') return kind === 'guardian' || kind === 'lord' ? 5 : 6;
  if (action === 'attack') return kind === 'guardian' || kind === 'lord' ? 7 : 9;
  if (action === 'walk') return kind === 'zombie' ? 5 : kind === 'guardian' || kind === 'lord' ? 6 : 7;
  return kind === 'bat' ? 6 : 4;
}
