/**
 * Pure anim state selection — shipped path used by Game.update.
 * Priority: jump > attack > run > walk > idle
 */
export const ANIM_ACTIONS = ['idle', 'walk', 'run', 'jump', 'attack'];

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
  switch (action) {
    case 'run': return 14;
    case 'walk': return 12;
    case 'attack': return 14;
    case 'jump': return 12;
    case 'idle': return 6;
    default: return 8;
  }
}
