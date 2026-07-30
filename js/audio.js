const STORAGE_KEY = 'ember_sound';
const VOLUME_STORAGE_KEY = 'ember_sound_volume';
const BUS_VOLUME_STORAGE_KEY = 'ember_sound_bus_volumes';
const DYNAMIC_RANGE_STORAGE_KEY = 'ember_sound_dynamic_range';
const SILENCE = 0.0001;
const MASTER_LEVEL = 0.68;
const MAX_ACTIVE_VOICES = 48;
const IDLE_SUSPEND_MS = 45000;
const NOISE_BUFFER_SECONDS = 3.4;
const REVERB_LEVEL = 0.16;
const USER_BUS_NAMES = ['music', 'ambience', 'combat', 'skill', 'ui', 'movement', 'reward'];
const MUSIC_EVENTS = {
  town: 'musicTown',
  wild: 'musicWild',
  dungeon: 'musicDungeon',
};
const MUSIC_CADENCE = {
  town: 5.18,
  wild: 5.42,
  dungeon: 5.34,
};
const MUSIC_REST_CADENCE = {
  town: 5,
  wild: 4,
  dungeon: 6,
};
const REVERB_PRESETS = {
  town: { duration: 0.24, decay: 4.2, smoothing: 0.12, level: 0.12 },
  wild: { duration: 0.38, decay: 3.25, smoothing: 0.28, level: 0.145 },
  dungeon: { duration: 0.72, decay: 2.55, smoothing: 0.56, level: 0.175 },
};
const DYNAMIC_RANGE_MODES = {
  balanced: {
    master: 1,
    threshold: -16,
    knee: 8,
    ratio: 8,
    attack: 0.003,
    release: 0.16,
    reverb: 1,
    buses: {},
  },
  wide: {
    master: 0.94,
    threshold: -9,
    knee: 5,
    ratio: 3.5,
    attack: 0.008,
    release: 0.12,
    reverb: 1.08,
    buses: { ambience: 0.94, music: 0.96 },
  },
  night: {
    master: 0.82,
    threshold: -26,
    knee: 16,
    ratio: 12,
    attack: 0.002,
    release: 0.28,
    reverb: 0.72,
    buses: {
      combat: 0.86,
      skill: 0.88,
      reward: 0.9,
      ui: 0.94,
      movement: 1.04,
      ambience: 1.08,
      music: 1.02,
      world: 0.88,
    },
  },
};
const REWARD_DUCK_LEVELS = {
  combat: 0.82,
  skill: 0.76,
  world: 0.84,
  movement: 0.68,
  ambience: 0.42,
  music: 0.58,
};

const tone = (frequency, duration, waveform = 'sine', gain = 0.08, extra = {}) => ({
  kind: 'tone',
  frequency,
  duration,
  waveform,
  gain,
  ...extra,
});

const noise = (duration, gain = 0.08, extra = {}) => ({
  kind: 'noise',
  duration,
  gain,
  ...extra,
});

const event = (category, gain, cooldown, maxInstances, priority, layers, extra = {}) => ({
  category,
  gain,
  cooldown,
  maxInstances,
  priority,
  layers,
  variationCents: 18,
  variationGain: 0.06,
  reverb: 0,
  ...extra,
});

// These sounds are deliberately original procedural designs. Short filtered-noise
// transients provide physical impact while restrained tonal layers carry identity.
const SOUND_EVENTS = {
  footstep: event('movement', 0.62, 0.085, 2, 1, [
    noise(0.075, 0.065, { color: 'brown', filter: 'bandpass', filterFrequency: 410, endFilterFrequency: 230, q: 0.7 }),
    tone(74, 0.055, 'sine', 0.035, { endFrequency: 48, delay: 0.006 }),
  ], {
    variationCents: 95,
    variationGain: 0.18,
    variants: [
      [
        noise(0.065, 0.062, { color: 'brown', filter: 'bandpass', filterFrequency: 520, endFilterFrequency: 290, q: 0.65 }),
        tone(82, 0.05, 'sine', 0.032, { endFrequency: 52, delay: 0.004 }),
      ],
      [
        noise(0.082, 0.058, { color: 'brown', filter: 'lowpass', filterFrequency: 680, endFilterFrequency: 260, q: 0.55 }),
        tone(67, 0.06, 'triangle', 0.026, { endFrequency: 45, delay: 0.008 }),
      ],
    ],
  }),
  footstepGrass: event('movement', 0.56, 0.085, 2, 1, [
    noise(0.085, 0.058, { color: 'brown', filter: 'bandpass', filterFrequency: 820, endFilterFrequency: 360, q: 0.52 }),
    noise(0.045, 0.035, { filter: 'highpass', filterFrequency: 2450, endFilterFrequency: 1200, delay: 0.008 }),
  ], { variationCents: 120, variationGain: 0.2 }),
  footstepStone: event('movement', 0.6, 0.085, 2, 1, [
    noise(0.045, 0.07, { filter: 'bandpass', filterFrequency: 1650, endFilterFrequency: 720, q: 1.1 }),
    tone(118, 0.065, 'triangle', 0.042, { endFrequency: 72, delay: 0.004 }),
  ], { variationCents: 80, variationGain: 0.16, reverb: 0.04 }),
  footstepCave: event('movement', 0.58, 0.09, 2, 1, [
    noise(0.075, 0.064, { color: 'brown', filter: 'bandpass', filterFrequency: 560, endFilterFrequency: 220, q: 0.8 }),
    tone(91, 0.085, 'sine', 0.038, { endFrequency: 51, delay: 0.006 }),
  ], { variationCents: 72, variationGain: 0.17, reverb: 0.18 }),
  swing: event('combat', 0.82, 0.045, 3, 3, [
    noise(0.105, 0.105, { filter: 'bandpass', filterFrequency: 2600, endFilterFrequency: 620, q: 0.8 }),
    tone(190, 0.07, 'sawtooth', 0.025, { endFrequency: 92, delay: 0.006 }),
  ], {
    variationCents: 55,
    variants: [
      [
        noise(0.09, 0.1, { filter: 'bandpass', filterFrequency: 3200, endFilterFrequency: 820, q: 0.72 }),
        tone(235, 0.06, 'triangle', 0.03, { endFrequency: 118 }),
      ],
      [
        noise(0.115, 0.09, { filter: 'bandpass', filterFrequency: 2100, endFilterFrequency: 540, q: 0.95 }),
        tone(165, 0.075, 'sawtooth', 0.022, { endFrequency: 78, delay: 0.008 }),
      ],
    ],
  }),
  monsterAttack: event('combat', 0.72, 0.055, 3, 2, [
    noise(0.11, 0.095, { color: 'brown', filter: 'bandpass', filterFrequency: 720, endFilterFrequency: 250, q: 0.85 }),
    tone(125, 0.1, 'sawtooth', 0.032, { endFrequency: 68 }),
  ], {
    variationCents: 110,
    variationGain: 0.16,
    variants: [
      [
        noise(0.085, 0.082, { filter: 'bandpass', filterFrequency: 1250, endFilterFrequency: 410, q: 0.75 }),
        tone(178, 0.08, 'triangle', 0.036, { endFrequency: 82 }),
      ],
      [
        noise(0.13, 0.09, { color: 'brown', filter: 'lowpass', filterFrequency: 620, endFilterFrequency: 180, q: 0.7 }),
        tone(92, 0.12, 'square', 0.022, { endFrequency: 54 }),
      ],
    ],
  }),
  beastAttack: event('combat', 0.72, 0.055, 3, 2, [
    noise(0.13, 0.1, { color: 'brown', filter: 'bandpass', filterFrequency: 880, endFilterFrequency: 290, q: 0.72 }),
    tone(156, 0.11, 'sawtooth', 0.028, { endFrequency: 74 }),
  ], { variationCents: 135, variationGain: 0.17 }),
  undeadAttack: event('combat', 0.7, 0.065, 3, 2, [
    noise(0.1, 0.08, { filter: 'bandpass', filterFrequency: 2100, endFilterFrequency: 640, q: 1.05 }),
    tone(104, 0.16, 'triangle', 0.04, { endFrequency: 63 }),
    tone(640, 0.09, 'square', 0.014, { endFrequency: 330, delay: 0.02 }),
  ], { variationCents: 95, reverb: 0.11 }),
  demonAttack: event('combat', 0.78, 0.065, 3, 3, [
    noise(0.16, 0.11, { color: 'brown', filter: 'lowpass', filterFrequency: 760, endFilterFrequency: 170, q: 0.74 }),
    tone(82, 0.17, 'sawtooth', 0.047, { endFrequency: 46 }),
    tone(238, 0.11, 'triangle', 0.022, { endFrequency: 116, delay: 0.025 }),
  ], { variationCents: 70, reverb: 0.14 }),
  hit: event('combat', 0.9, 0.035, 4, 5, [
    noise(0.075, 0.13, { filter: 'bandpass', filterFrequency: 1550, endFilterFrequency: 520, q: 0.7 }),
    tone(118, 0.085, 'triangle', 0.085, { endFrequency: 54, attack: 0.0015 }),
    noise(0.025, 0.055, { filter: 'highpass', filterFrequency: 3600 }),
  ], {
    variationCents: 45,
    variants: [
      [
        noise(0.065, 0.125, { filter: 'bandpass', filterFrequency: 1900, endFilterFrequency: 650, q: 0.8 }),
        tone(138, 0.075, 'sine', 0.09, { endFrequency: 62 }),
        noise(0.022, 0.05, { filter: 'highpass', filterFrequency: 4100 }),
      ],
      [
        noise(0.085, 0.115, { color: 'brown', filter: 'bandpass', filterFrequency: 980, endFilterFrequency: 390, q: 0.72 }),
        tone(96, 0.095, 'triangle', 0.088, { endFrequency: 48 }),
      ],
    ],
  }),
  playerHit: event('combat', 1, 0.055, 3, 7, [
    noise(0.105, 0.15, { color: 'brown', filter: 'bandpass', filterFrequency: 920, endFilterFrequency: 260, q: 0.85 }),
    tone(92, 0.13, 'sine', 0.125, { endFrequency: 39, attack: 0.0015 }),
    noise(0.038, 0.065, { filter: 'highpass', filterFrequency: 2600, endFilterFrequency: 1300 }),
  ], { variationCents: 28, variationGain: 0.08 }),
  playerDeath: event('combat', 0.92, 0.8, 1, 10, [
    noise(0.38, 0.15, { color: 'brown', filter: 'lowpass', filterFrequency: 720, endFilterFrequency: 110, q: 0.72 }),
    tone(164, 0.34, 'triangle', 0.07, { endFrequency: 46 }),
    tone(98, 0.42, 'sine', 0.065, { endFrequency: 32, delay: 0.12 }),
    noise(0.2, 0.045, { filter: 'bandpass', filterFrequency: 1550, endFilterFrequency: 430, delay: 0.08, q: 0.85 }),
  ], { variationCents: 9, variationGain: 0.03, reverb: 0.2 }),
  crit: event('combat', 1, 0.075, 3, 8, [
    noise(0.09, 0.17, { filter: 'bandpass', filterFrequency: 2200, endFilterFrequency: 620, q: 0.72 }),
    tone(156, 0.13, 'sawtooth', 0.055, { endFrequency: 61, attack: 0.001 }),
    tone(1180, 0.18, 'sine', 0.045, { endFrequency: 720, delay: 0.012, attack: 0.002 }),
    noise(0.035, 0.075, { filter: 'highpass', filterFrequency: 4800 }),
  ], { variationCents: 22, reverb: 0.1 }),
  kill: event('combat', 0.88, 0.1, 3, 7, [
    tone(165, 0.16, 'triangle', 0.085, { endFrequency: 54 }),
    noise(0.18, 0.105, { color: 'brown', filter: 'lowpass', filterFrequency: 820, endFilterFrequency: 170 }),
    tone(294, 0.12, 'sine', 0.035, { endFrequency: 196, delay: 0.065 }),
  ], { variationCents: 34, reverb: 0.12 }),
  bossDown: event('combat', 1, 0.8, 1, 10, [
    noise(0.48, 0.2, { color: 'brown', filter: 'lowpass', filterFrequency: 640, endFilterFrequency: 95, q: 0.8 }),
    tone(92, 0.42, 'sawtooth', 0.07, { endFrequency: 38 }),
    tone(147, 0.25, 'triangle', 0.065, { endFrequency: 98, delay: 0.13 }),
    tone(220, 0.3, 'sine', 0.055, { endFrequency: 330, delay: 0.27, attack: 0.012 }),
  ], { variationCents: 10, reverb: 0.28 }),

  skill: event('skill', 0.74, 0.06, 3, 4, [
    tone(360, 0.11, 'sine', 0.075, { endFrequency: 570 }),
    noise(0.1, 0.055, { filter: 'bandpass', filterFrequency: 1900, endFilterFrequency: 3200, q: 1.2 }),
  ], { reverb: 0.16 }),
  thrust: event('skill', 0.86, 0.08, 2, 6, [
    noise(0.12, 0.13, { filter: 'bandpass', filterFrequency: 3100, endFilterFrequency: 760, q: 0.95 }),
    tone(230, 0.1, 'sawtooth', 0.045, { endFrequency: 105 }),
    tone(640, 0.12, 'triangle', 0.032, { endFrequency: 310, delay: 0.018 }),
  ], { variationCents: 25, reverb: 0.06 }),
  fire_sword: event('skill', 0.9, 0.12, 2, 7, [
    noise(0.3, 0.12, { color: 'brown', filter: 'bandpass', filterFrequency: 620, endFilterFrequency: 1850, q: 0.7 }),
    tone(108, 0.2, 'sawtooth', 0.06, { endFrequency: 260 }),
    tone(390, 0.24, 'triangle', 0.04, { endFrequency: 610, delay: 0.035 }),
  ], { variationCents: 20, reverb: 0.14 }),
  rush: event('skill', 0.9, 0.12, 2, 7, [
    noise(0.19, 0.145, { color: 'brown', filter: 'bandpass', filterFrequency: 390, endFilterFrequency: 1350, q: 0.68 }),
    tone(88, 0.18, 'sawtooth', 0.055, { endFrequency: 176 }),
    noise(0.1, 0.075, { filter: 'highpass', filterFrequency: 1250, endFilterFrequency: 3100, delay: 0.04 }),
  ], { variationCents: 18 }),
  fireball: event('skill', 0.82, 0.065, 3, 5, [
    noise(0.2, 0.1, { color: 'brown', filter: 'bandpass', filterFrequency: 480, endFilterFrequency: 1700, q: 0.72 }),
    tone(185, 0.18, 'sawtooth', 0.045, { endFrequency: 470 }),
    tone(520, 0.15, 'sine', 0.035, { endFrequency: 760, delay: 0.028 }),
  ], { variationCents: 38, reverb: 0.12 }),
  lightning: event('skill', 0.92, 0.12, 2, 8, [
    noise(0.035, 0.19, { filter: 'highpass', filterFrequency: 3800, endFilterFrequency: 1700, attack: 0.0008 }),
    tone(1120, 0.055, 'square', 0.045, { endFrequency: 390, attack: 0.0008 }),
    noise(0.17, 0.105, { color: 'brown', filter: 'bandpass', filterFrequency: 690, endFilterFrequency: 180, delay: 0.018 }),
    tone(84, 0.15, 'sine', 0.08, { endFrequency: 43, delay: 0.015 }),
  ], { variationCents: 14, reverb: 0.2 }),
  burst: event('skill', 0.88, 0.16, 2, 7, [
    noise(0.3, 0.11, { filter: 'bandpass', filterFrequency: 2800, endFilterFrequency: 780, q: 1.1 }),
    tone(760, 0.24, 'triangle', 0.05, { endFrequency: 310 }),
    tone(1240, 0.16, 'sine', 0.033, { endFrequency: 620, delay: 0.055 }),
    noise(0.075, 0.07, { filter: 'highpass', filterFrequency: 4400, delay: 0.06 }),
  ], { variationCents: 22, reverb: 0.24 }),
  shield: event('skill', 0.78, 0.18, 2, 6, [
    tone(290, 0.28, 'sine', 0.055, { endFrequency: 590, attack: 0.018 }),
    tone(435, 0.3, 'sine', 0.04, { endFrequency: 870, delay: 0.03, attack: 0.025 }),
    noise(0.2, 0.045, { filter: 'bandpass', filterFrequency: 1300, endFilterFrequency: 3200, q: 1.4 }),
  ], { variationCents: 12, reverb: 0.3 }),
  heal: event('skill', 0.75, 0.12, 2, 6, [
    tone(392, 0.23, 'sine', 0.052, { endFrequency: 523, attack: 0.015 }),
    tone(523, 0.26, 'sine', 0.045, { endFrequency: 784, delay: 0.055, attack: 0.018 }),
    noise(0.2, 0.038, { filter: 'highpass', filterFrequency: 2600, endFilterFrequency: 4800 }),
  ], { variationCents: 10, reverb: 0.34 }),
  talisman: event('skill', 0.8, 0.07, 3, 5, [
    noise(0.045, 0.1, { filter: 'highpass', filterFrequency: 2400 }),
    tone(470, 0.11, 'square', 0.032, { endFrequency: 820 }),
    tone(940, 0.13, 'triangle', 0.03, { endFrequency: 560, delay: 0.022 }),
  ], { variationCents: 32, reverb: 0.12 }),
  poison: event('skill', 0.78, 0.12, 2, 6, [
    noise(0.24, 0.085, { color: 'brown', filter: 'bandpass', filterFrequency: 260, endFilterFrequency: 760, q: 1 }),
    tone(138, 0.22, 'sine', 0.05, { endFrequency: 214 }),
    tone(284, 0.2, 'triangle', 0.028, { endFrequency: 172, delay: 0.04 }),
  ], { variationCents: 22, reverb: 0.18 }),
  summon: event('skill', 0.88, 0.3, 1, 8, [
    noise(0.38, 0.12, { color: 'brown', filter: 'bandpass', filterFrequency: 180, endFilterFrequency: 960, q: 0.8 }),
    tone(82, 0.32, 'triangle', 0.075, { endFrequency: 164 }),
    tone(247, 0.3, 'sine', 0.052, { endFrequency: 494, delay: 0.08, attack: 0.025 }),
    tone(370, 0.24, 'sine', 0.032, { endFrequency: 740, delay: 0.17 }),
  ], { variationCents: 12, reverb: 0.32 }),

  gather: event('world', 0.72, 0.09, 2, 3, [
    noise(0.045, 0.12, { filter: 'bandpass', filterFrequency: 1250, endFilterFrequency: 640, q: 1.15 }),
    tone(185, 0.075, 'square', 0.038, { endFrequency: 112 }),
    tone(690, 0.1, 'triangle', 0.025, { endFrequency: 430, delay: 0.035 }),
  ], {
    variationCents: 75,
    variants: [
      [
        noise(0.055, 0.11, { filter: 'bandpass', filterFrequency: 980, endFilterFrequency: 480, q: 1 }),
        tone(148, 0.085, 'square', 0.036, { endFrequency: 91 }),
        tone(570, 0.09, 'triangle', 0.022, { endFrequency: 350, delay: 0.04 }),
      ],
    ],
  }),
  potion: event('reward', 0.68, 0.08, 2, 4, [
    noise(0.06, 0.045, { filter: 'highpass', filterFrequency: 2800 }),
    tone(510, 0.1, 'sine', 0.048, { endFrequency: 680 }),
    tone(760, 0.11, 'sine', 0.035, { endFrequency: 930, delay: 0.045 }),
  ], { variationCents: 20, reverb: 0.13 }),
  loot: event('reward', 0.72, 0.055, 3, 4, [
    tone(622, 0.07, 'triangle', 0.052, { endFrequency: 740 }),
    tone(831, 0.1, 'sine', 0.045, { endFrequency: 988, delay: 0.045 }),
    noise(0.035, 0.032, { filter: 'highpass', filterFrequency: 4200, delay: 0.02 }),
  ], { variationCents: 16, reverb: 0.16 }),
  buy: event('ui', 0.72, 0.065, 2, 3, [
    tone(520, 0.055, 'square', 0.038, { endFrequency: 610 }),
    tone(780, 0.075, 'triangle', 0.03, { endFrequency: 920, delay: 0.035 }),
  ], { variationCents: 22 }),
  equip: event('ui', 0.82, 0.065, 2, 4, [
    noise(0.035, 0.1, { filter: 'bandpass', filterFrequency: 1800, q: 1.2 }),
    tone(220, 0.065, 'square', 0.044, { endFrequency: 176 }),
    tone(440, 0.11, 'triangle', 0.032, { endFrequency: 330, delay: 0.035 }),
  ], { variationCents: 34, reverb: 0.05 }),
  portal: event('world', 0.82, 0.3, 1, 8, [
    noise(0.42, 0.07, { filter: 'bandpass', filterFrequency: 460, endFilterFrequency: 2300, q: 1.2 }),
    tone(145, 0.4, 'sine', 0.065, { endFrequency: 290, attack: 0.025 }),
    tone(290, 0.42, 'sine', 0.045, { endFrequency: 580, delay: 0.06, attack: 0.035 }),
    tone(580, 0.28, 'triangle', 0.03, { endFrequency: 1160, delay: 0.18 }),
  ], { variationCents: 8, reverb: 0.36 }),
  ambientTown: event('ambience', 0.26, 2.05, 2, 0, [
    noise(2.66, 0.034, { color: 'brown', loop: true, filter: 'bandpass', filterFrequency: 360, endFilterFrequency: 520, q: 0.38, attack: 0.24, release: 0.48 }),
    tone(196, 0.7, 'sine', 0.014, { endFrequency: 220, delay: 0.65, attack: 0.08 }),
  ], { variationCents: 18, variationGain: 0.08, reverb: 0.2, space: 'town' }),
  ambientWild: event('ambience', 0.25, 2.05, 2, 0, [
    noise(2.66, 0.038, { color: 'brown', loop: true, filter: 'bandpass', filterFrequency: 620, endFilterFrequency: 880, q: 0.32, attack: 0.24, release: 0.48 }),
    tone(1250, 0.16, 'sine', 0.012, { endFrequency: 980, delay: 1.1, attack: 0.03 }),
  ], { variationCents: 42, variationGain: 0.12, reverb: 0.26, space: 'wild' }),
  ambientDungeon: event('ambience', 0.28, 2.05, 2, 0, [
    noise(2.66, 0.04, { color: 'brown', loop: true, filter: 'lowpass', filterFrequency: 240, endFilterFrequency: 190, q: 0.55, attack: 0.24, release: 0.5 }),
    tone(64, 2.58, 'sine', 0.021, { endFrequency: 57, attack: 0.22, release: 0.5 }),
    tone(780, 0.28, 'sine', 0.014, { endFrequency: 510, delay: 1.34, attack: 0.01 }),
  ], { variationCents: 28, variationGain: 0.1, reverb: 0.38, space: 'dungeon' }),
  musicTown: event('music', 0.52, 4.55, 2, 1, [
    tone(196, 1.18, 'triangle', 0.018, { endFrequency: 220, delay: 0.08, attack: 0.16, release: 0.48 }),
    tone(293.66, 0.72, 'sine', 0.013, { endFrequency: 329.63, delay: 0.72, attack: 0.08, release: 0.28 }),
    tone(392, 0.74, 'sine', 0.014, { endFrequency: 440, delay: 1.62, attack: 0.07, release: 0.3 }),
    tone(329.63, 0.76, 'triangle', 0.012, { endFrequency: 293.66, delay: 2.72, attack: 0.09, release: 0.32 }),
    tone(261.63, 1.28, 'sine', 0.013, { endFrequency: 196, delay: 3.72, attack: 0.17, release: 0.52 }),
    tone(98, 1.2, 'sine', 0.007, { endFrequency: 110, delay: 4.0, attack: 0.2, release: 0.5 }),
  ], {
    variationCents: 3.5,
    variationGain: 0.05,
    reverb: 0.32,
    space: 'town',
    variants: [[
      tone(220, 1.1, 'triangle', 0.017, { endFrequency: 246.94, delay: 0.1, attack: 0.15, release: 0.44 }),
      tone(329.63, 0.68, 'sine', 0.012, { endFrequency: 392, delay: 0.78, attack: 0.08, release: 0.26 }),
      tone(440, 0.76, 'sine', 0.013, { endFrequency: 392, delay: 1.72, attack: 0.08, release: 0.3 }),
      tone(293.66, 0.84, 'triangle', 0.012, { endFrequency: 261.63, delay: 2.86, attack: 0.11, release: 0.34 }),
      tone(246.94, 1.22, 'sine', 0.013, { endFrequency: 196, delay: 3.78, attack: 0.18, release: 0.5 }),
      tone(110, 1.12, 'sine', 0.0065, { endFrequency: 98, delay: 4.06, attack: 0.2, release: 0.48 }),
    ]],
  }),
  musicWild: event('music', 0.48, 4.75, 2, 1, [
    tone(220, 0.92, 'sine', 0.015, { endFrequency: 246.94, delay: 0.24, attack: 0.12, release: 0.38 }),
    tone(329.63, 0.76, 'triangle', 0.011, { endFrequency: 392, delay: 1.16, attack: 0.1, release: 0.32 }),
    tone(493.88, 0.52, 'sine', 0.009, { endFrequency: 440, delay: 2.12, attack: 0.07, release: 0.24 }),
    tone(293.66, 0.96, 'sine', 0.012, { endFrequency: 329.63, delay: 3.08, attack: 0.14, release: 0.4 }),
    tone(164.81, 1.18, 'triangle', 0.008, { endFrequency: 146.83, delay: 4.02, attack: 0.2, release: 0.5 }),
  ], {
    variationCents: 5,
    variationGain: 0.07,
    reverb: 0.38,
    space: 'wild',
    variants: [[
      tone(246.94, 0.84, 'sine', 0.014, { endFrequency: 293.66, delay: 0.18, attack: 0.12, release: 0.34 }),
      tone(392, 0.7, 'triangle', 0.011, { endFrequency: 440, delay: 1.3, attack: 0.1, release: 0.3 }),
      tone(587.33, 0.48, 'sine', 0.008, { endFrequency: 493.88, delay: 2.28, attack: 0.06, release: 0.22 }),
      tone(329.63, 1.0, 'sine', 0.012, { endFrequency: 293.66, delay: 3.18, attack: 0.15, release: 0.42 }),
      tone(146.83, 1.14, 'triangle', 0.0075, { endFrequency: 164.81, delay: 4.12, attack: 0.2, release: 0.48 }),
    ]],
  }),
  musicDungeon: event('music', 0.5, 4.65, 2, 1, [
    tone(55, 1.42, 'sine', 0.018, { endFrequency: 61.74, delay: 0.08, attack: 0.22, release: 0.58 }),
    tone(82.41, 1.08, 'triangle', 0.011, { endFrequency: 73.42, delay: 1.14, attack: 0.17, release: 0.46 }),
    tone(110, 0.86, 'sine', 0.009, { endFrequency: 98, delay: 2.34, attack: 0.14, release: 0.36 }),
    tone(73.42, 1.34, 'triangle', 0.012, { endFrequency: 55, delay: 3.46, attack: 0.2, release: 0.54 }),
    tone(440, 0.34, 'sine', 0.0065, { endFrequency: 293.66, delay: 4.36, attack: 0.035, release: 0.18 }),
  ], {
    variationCents: 3,
    variationGain: 0.045,
    reverb: 0.46,
    space: 'dungeon',
    variants: [[
      tone(49, 1.5, 'sine', 0.018, { endFrequency: 55, delay: 0.06, attack: 0.24, release: 0.6 }),
      tone(73.42, 1.0, 'triangle', 0.011, { endFrequency: 82.41, delay: 1.28, attack: 0.16, release: 0.42 }),
      tone(98, 0.9, 'sine', 0.0085, { endFrequency: 110, delay: 2.46, attack: 0.14, release: 0.38 }),
      tone(65.41, 1.28, 'triangle', 0.012, { endFrequency: 49, delay: 3.56, attack: 0.2, release: 0.52 }),
      tone(392, 0.32, 'sine', 0.006, { endFrequency: 261.63, delay: 4.42, attack: 0.032, release: 0.17 }),
    ]],
  }),
  level: event('reward', 0.9, 0.5, 1, 9, [
    tone(330, 0.15, 'triangle', 0.06, { endFrequency: 392 }),
    tone(440, 0.17, 'triangle', 0.06, { endFrequency: 523, delay: 0.1 }),
    tone(659, 0.28, 'sine', 0.062, { endFrequency: 988, delay: 0.21, attack: 0.012 }),
    noise(0.12, 0.045, { filter: 'highpass', filterFrequency: 3500, endFilterFrequency: 6200, delay: 0.2 }),
  ], { variationCents: 5, reverb: 0.3 }),
  quest: event('reward', 0.8, 0.22, 2, 6, [
    tone(392, 0.13, 'triangle', 0.052, { endFrequency: 440 }),
    tone(523, 0.19, 'sine', 0.052, { endFrequency: 659, delay: 0.11 }),
  ], { variationCents: 8, reverb: 0.2 }),
  achievement: event('reward', 0.9, 0.6, 1, 9, [
    tone(523, 0.13, 'sine', 0.052, { endFrequency: 587 }),
    tone(659, 0.16, 'sine', 0.055, { endFrequency: 784, delay: 0.1 }),
    tone(784, 0.28, 'sine', 0.06, { endFrequency: 1047, delay: 0.22 }),
    noise(0.08, 0.045, { filter: 'highpass', filterFrequency: 4200, delay: 0.22 }),
  ], { variationCents: 4, reverb: 0.32 }),
  forge: event('world', 0.86, 0.14, 2, 6, [
    noise(0.035, 0.16, { filter: 'bandpass', filterFrequency: 1700, q: 1.35, attack: 0.0008 }),
    tone(132, 0.1, 'square', 0.048, { endFrequency: 82 }),
    tone(920, 0.22, 'triangle', 0.045, { endFrequency: 610, delay: 0.028 }),
  ], { variationCents: 46, reverb: 0.17 }),
  forgeFail: event('world', 0.82, 0.18, 2, 6, [
    noise(0.12, 0.1, { filter: 'bandpass', filterFrequency: 740, endFilterFrequency: 260, q: 0.8 }),
    tone(190, 0.18, 'sawtooth', 0.043, { endFrequency: 76 }),
    tone(118, 0.2, 'triangle', 0.04, { endFrequency: 54, delay: 0.09 }),
  ], { variationCents: 22, reverb: 0.08 }),
  warning: event('ui', 0.85, 0.32, 1, 8, [
    tone(138, 0.12, 'square', 0.052, { endFrequency: 116 }),
    tone(138, 0.12, 'square', 0.052, { endFrequency: 116, delay: 0.17 }),
  ], { variationCents: 0 }),
  explosion: event('world', 1, 0.16, 2, 9, [
    noise(0.44, 0.22, { color: 'brown', filter: 'lowpass', filterFrequency: 980, endFilterFrequency: 86, attack: 0.001 }),
    tone(73, 0.38, 'sawtooth', 0.075, { endFrequency: 31, attack: 0.001 }),
    noise(0.085, 0.12, { filter: 'highpass', filterFrequency: 2400, endFilterFrequency: 720 }),
  ], { variationCents: 26, reverb: 0.24 }),
  dodge: event('movement', 0.58, 0.06, 2, 3, [
    noise(0.075, 0.055, { filter: 'bandpass', filterFrequency: 2100, endFilterFrequency: 4800, q: 1 }),
    tone(680, 0.075, 'sine', 0.027, { endFrequency: 1100 }),
  ], { variationCents: 58, variationGain: 0.1 }),
  uiOpen: event('ui', 0.58, 0.045, 2, 2, [
    noise(0.018, 0.035, { filter: 'highpass', filterFrequency: 3200 }),
    tone(260, 0.05, 'triangle', 0.036, { endFrequency: 390 }),
    tone(390, 0.075, 'sine', 0.026, { endFrequency: 520, delay: 0.03 }),
  ], { variationCents: 9 }),
  uiClose: event('ui', 0.54, 0.045, 2, 2, [
    tone(370, 0.045, 'sine', 0.032, { endFrequency: 270 }),
    tone(235, 0.065, 'triangle', 0.025, { endFrequency: 180, delay: 0.025 }),
  ], { variationCents: 9 }),
};

const BUS_LEVELS = {
  music: 0.58,
  combat: 0.9,
  skill: 0.84,
  reward: 0.72,
  ui: 0.58,
  world: 0.76,
  movement: 0.56,
  ambience: 0.64,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function readEnabledPreference() {
  try {
    return globalThis.window?.localStorage?.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeEnabledPreference(enabled) {
  try {
    globalThis.window?.localStorage?.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Storage can be denied in private contexts; sound must continue to work.
  }
}

function readVolumePreference() {
  try {
    const raw = globalThis.window?.localStorage?.getItem(VOLUME_STORAGE_KEY);
    if (raw === null || raw === undefined || raw === '') return 0.8;
    const stored = Number(raw);
    return Number.isFinite(stored) && stored >= 0 ? clamp(stored, 0, 1) : 0.8;
  } catch {
    return 0.8;
  }
}

function writeVolumePreference(volume) {
  try {
    globalThis.window?.localStorage?.setItem(VOLUME_STORAGE_KEY, String(volume));
  } catch {
    // Storage can be denied without affecting the active mix.
  }
}

function readBusVolumePreferences() {
  const defaults = Object.fromEntries(USER_BUS_NAMES.map((name) => [name, 1]));
  try {
    const raw = globalThis.window?.localStorage?.getItem(BUS_VOLUME_STORAGE_KEY);
    if (!raw) return defaults;
    const stored = JSON.parse(raw);
    for (const name of USER_BUS_NAMES) {
      const value = Number(stored?.[name]);
      if (Number.isFinite(value)) defaults[name] = clamp(value, 0, 1);
    }
  } catch {
    // Corrupt or unavailable storage falls back to the calibrated mix.
  }
  return defaults;
}

function writeBusVolumePreferences(volumes) {
  try {
    const serialized = Object.fromEntries(USER_BUS_NAMES.map((name) => [name, volumes[name]]));
    globalThis.window?.localStorage?.setItem(BUS_VOLUME_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Storage can be denied without affecting the active mix.
  }
}

function normalizeDynamicRange(mode) {
  if (mode === 'standard' || mode === 'normal') return 'balanced';
  return Object.prototype.hasOwnProperty.call(DYNAMIC_RANGE_MODES, mode) ? mode : null;
}

function readDynamicRangePreference() {
  try {
    return normalizeDynamicRange(globalThis.window?.localStorage?.getItem(DYNAMIC_RANGE_STORAGE_KEY)) || 'balanced';
  } catch {
    return 'balanced';
  }
}

function writeDynamicRangePreference(mode) {
  try {
    globalThis.window?.localStorage?.setItem(DYNAMIC_RANGE_STORAGE_KEY, mode);
  } catch {
    // Storage can be denied without affecting the active mix.
  }
}

function setParam(param, value, time) {
  if (!param) return;
  if (typeof param.setValueAtTime === 'function') param.setValueAtTime(value, time);
  else param.value = value;
}

function rampParam(param, value, time, exponential = false) {
  if (!param) return;
  const method = exponential ? 'exponentialRampToValueAtTime' : 'linearRampToValueAtTime';
  if (typeof param[method] === 'function') param[method](value, time);
  else param.value = value;
}

function holdParam(param, time, fallback = SILENCE) {
  if (!param) return;
  if (typeof param.cancelAndHoldAtTime === 'function') {
    try {
      param.cancelAndHoldAtTime(time);
      return;
    } catch {
      // Old WebKit exposes the method before fully implementing it.
    }
  }
  const current = Number.isFinite(Number(param.value)) ? Number(param.value) : fallback;
  param.cancelScheduledValues?.(time);
  setParam(param, current, time);
}

export class SoundSystem {
  constructor() {
    this.enabled = readEnabledPreference();
    this.volume = readVolumePreference();
    this.busVolumes = readBusVolumePreferences();
    this.dynamicRange = readDynamicRangePreference();
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.buses = new Map();
    this.reverb = null;
    this.reverbGain = null;
    this.reverbs = new Map();
    this.regionSpace = 'wild';
    this.noiseBuffers = new Map();
    this.activeVoices = [];
    this.activeEvents = new Map();
    this.lastPlayed = new Map();
    this.lastVariant = new Map();
    this.unlockTarget = null;
    this.unlockHandler = null;
    this.visibilityHandler = null;
    this.idleTimer = null;
    this.suspendTimer = null;
    this.musicRegion = null;
    this.musicTimer = null;
    this.musicNextTime = null;
    this.musicTickRunning = false;
    this.musicNeedsResync = false;
    this.musicPhraseCount = 0;
    // Prime WebAudio on the first trusted interaction so movement sounds that
    // originate in the next animation frame also work on iOS/Safari.
    this._installUnlockHandlers();
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    writeEnabledPreference(this.enabled);
    if (!this.enabled) {
      this._clearMusicTimer();
      this._fadeCategoryVoices('music', this.ctx?.currentTime || 0, 0.055);
      this._clearMusicEventState();
      this.musicNextTime = null;
      this.musicPhraseCount = 0;
    }
    if (this.enabled && this.musicRegion && this.busVolumes.music > 0 && !this.ctx) this.ensure();
    if (!this.ctx || !this.master) return;

    const now = this.ctx.currentTime || 0;
    const gain = this.master.gain;
    holdParam(gain, now, SILENCE);
    rampParam(gain, this.enabled ? this._masterTarget() : SILENCE, now + 0.055, true);

    if (this.enabled) {
      if (this.suspendTimer) clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
      this._resumeContext();
      this._touchIdleTimer();
      this.musicNextTime = null;
      this.musicPhraseCount = 0;
      this._queueMusicTick(0);
      return;
    }

    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = null;
      if (!this.enabled && this.ctx?.state === 'running') {
        Promise.resolve(this.ctx.suspend?.()).catch(() => {});
      }
    }, 80);
    this.suspendTimer?.unref?.();
  }

  setVolume(volume) {
    const numericVolume = Number(volume);
    if (!Number.isFinite(numericVolume)) return;
    this.volume = clamp(numericVolume, 0, 1);
    writeVolumePreference(this.volume);
    if (!this.master || !this.ctx) return;
    const now = this.ctx.currentTime || 0;
    const gain = this.master.gain;
    holdParam(gain, now, SILENCE);
    rampParam(
      gain,
      this.enabled ? this._masterTarget() : SILENCE,
      now + 0.045,
      true,
    );
  }

  setBusVolume(name, volume) {
    if (!USER_BUS_NAMES.includes(name)) return false;
    const numericVolume = Number(volume);
    if (!Number.isFinite(numericVolume)) return false;
    this.busVolumes[name] = clamp(numericVolume, 0, 1);
    writeBusVolumePreferences(this.busVolumes);

    if (this.ctx) {
      const now = this.ctx.currentTime || 0;
      const categories = name === 'ambience' ? ['ambience', 'world'] : [name];
      for (const category of categories) {
        const bus = this.buses.get(category);
        if (!bus?.gain) continue;
        holdParam(bus.gain, now, this._busTarget(category));
        rampParam(bus.gain, this._busTarget(category), now + 0.055, true);
      }
    }
    if (name === 'music') {
      if (this.busVolumes.music <= 0) {
        this._clearMusicTimer();
        this._fadeCategoryVoices('music', this.ctx?.currentTime || 0, 0.18);
        this._clearMusicEventState();
        this.musicNextTime = null;
        this.musicPhraseCount = 0;
      } else {
        this.musicNextTime = null;
        this.musicPhraseCount = 0;
        this._queueMusicTick(0);
      }
    }
    return true;
  }

  getBusVolume(name) {
    return USER_BUS_NAMES.includes(name) ? this.busVolumes[name] : null;
  }

  setDynamicRange(mode) {
    const normalized = normalizeDynamicRange(mode);
    if (!normalized) return false;
    this.dynamicRange = normalized;
    writeDynamicRangePreference(normalized);
    if (this.ctx) this._applyMixProfile(this.ctx.currentTime || 0, 0.085);
    return true;
  }

  getDynamicRange() {
    return this.dynamicRange;
  }

  setRegionSpace(region) {
    if (!Object.prototype.hasOwnProperty.call(REVERB_PRESETS, region)) return false;
    this.regionSpace = region;
    return true;
  }

  setRegionMusic(region) {
    if (region === null || region === undefined || region === false) {
      this.stopRegionMusic();
      return true;
    }
    if (!Object.prototype.hasOwnProperty.call(MUSIC_EVENTS, region)) return false;
    const changed = this.musicRegion !== region;
    this.regionSpace = region;
    if (!changed) {
      if (this.enabled && this.busVolumes.music > 0 && !this.ctx) this.ensure();
      this._queueMusicTick(0);
      return true;
    }

    const now = this.ctx?.currentTime || 0;
    this._clearMusicTimer();
    this._fadeCategoryVoices('music', now, 0.28);
    this._clearMusicEventState();
    this.musicRegion = region;
    this.musicNextTime = null;
    this.musicPhraseCount = 0;
    if (this.enabled && this.busVolumes.music > 0) {
      this.ensure();
      this._queueMusicTick(0);
    }
    return true;
  }

  stopRegionMusic() {
    this._clearMusicTimer();
    this._fadeCategoryVoices('music', this.ctx?.currentTime || 0, 0.28);
    this._clearMusicEventState();
    this.musicRegion = null;
    this.musicNextTime = null;
    this.musicPhraseCount = 0;
    return true;
  }

  getRegionMusic() {
    return this.musicRegion;
  }

  getRegionSpace() {
    return this.regionSpace;
  }

  ensure() {
    if (!this.enabled) return null;
    if (this.ctx?.state === 'closed') this._resetGraphReferences();
    if (!this.ctx) {
      const AudioContext = globalThis.AudioContext
        || globalThis.webkitAudioContext
        || globalThis.window?.AudioContext
        || globalThis.window?.webkitAudioContext;
      if (!AudioContext) return null;
      try {
        try {
          this.ctx = new AudioContext({ latencyHint: 'interactive' });
        } catch {
          this.ctx = new AudioContext();
        }
        this._buildGraph();
      } catch {
        const failedContext = this.ctx;
        this._resetGraphReferences();
        if (failedContext?.state !== 'closed') Promise.resolve(failedContext?.close?.()).catch(() => {});
        return null;
      }
    }
    this._resumeContext();
    this._touchIdleTimer();
    return this.ctx;
  }

  /**
   * Plays a named event. Existing play(name) calls remain valid. Optional future
   * spatial wiring may pass { gain, pan, detune, emitter, space, when }.
   */
  play(name, options = {}) {
    const definition = SOUND_EVENTS[name];
    if (!definition || !this.enabled) return false;
    const ctx = this.ensure();
    if (!ctx || !this.master) return false;

    const now = Math.max(0, ctx.currentTime || 0);
    const requestedTime = Number(options?.when);
    const eventTime = Number.isFinite(requestedTime) ? Math.max(now, requestedTime) : now;
    this._pruneVoices(now);
    const eventKey = options?.emitter ? `${name}:${options.emitter}` : name;
    const lastTime = this.lastPlayed.get(eventKey);
    if (lastTime !== undefined && eventTime - lastTime < definition.cooldown) return false;

    const active = (this.activeEvents.get(name) || []).filter((endTime) => endTime > now);
    if (active.length >= definition.maxInstances) {
      this.activeEvents.set(name, active);
      return false;
    }

    const layers = this._chooseLayers(name, definition);
    const eventHandle = this._createEventRoute(name, definition, options, eventTime);
    if (!eventHandle) return false;
    const detune = (Math.random() * 2 - 1) * definition.variationCents
      + clamp(Number(options?.detune) || 0, -1200, 1200);
    let endTime = now;
    for (const layer of layers) {
      const scheduledEnd = this._scheduleLayer(layer, eventHandle.input, eventTime, detune, definition.priority, eventHandle);
      if (scheduledEnd) endTime = Math.max(endTime, scheduledEnd);
    }
    eventHandle.sealed = true;
    if (!eventHandle.remaining) this._cleanupEventRoute(eventHandle);
    if (endTime <= now) return false;
    if (definition.category === 'reward' && definition.priority >= 6) this._duckForReward(now);

    this.lastPlayed.set(eventKey, eventTime);
    active.push(endTime);
    this.activeEvents.set(name, active);
    this._touchIdleTimer();
    return true;
  }

  dispose() {
    this._clearMusicTimer();
    this.musicRegion = null;
    this.musicNextTime = null;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.idleTimer = null;
    this.suspendTimer = null;
    this._removeUnlockHandlers();
    this._removeVisibilityHandler();
    const now = this.ctx?.currentTime || 0;
    for (const voice of [...this.activeVoices]) this._stopVoice(voice, now, true);
    const context = this.ctx;
    this._resetGraphReferences();
    if (context?.state !== 'closed') Promise.resolve(context?.close?.()).catch(() => {});
  }

  _masterTarget() {
    const profile = DYNAMIC_RANGE_MODES[this.dynamicRange] || DYNAMIC_RANGE_MODES.balanced;
    return Math.max(SILENCE, MASTER_LEVEL * this.volume * profile.master);
  }

  _busTarget(category) {
    const profile = DYNAMIC_RANGE_MODES[this.dynamicRange] || DYNAMIC_RANGE_MODES.balanced;
    const preferenceName = category === 'world' ? 'ambience' : category;
    const userVolume = this.busVolumes[preferenceName] ?? 1;
    const profileScale = profile.buses[category] ?? 1;
    return Math.max(SILENCE, (BUS_LEVELS[category] || 1) * userVolume * profileScale);
  }

  _reverbTarget(space) {
    const profile = DYNAMIC_RANGE_MODES[this.dynamicRange] || DYNAMIC_RANGE_MODES.balanced;
    return Math.max(SILENCE, (REVERB_PRESETS[space]?.level || REVERB_LEVEL) * profile.reverb);
  }

  _applyMixProfile(now, duration = 0.08) {
    if (this.master?.gain) {
      holdParam(this.master.gain, now, this._masterTarget());
      rampParam(this.master.gain, this.enabled ? this._masterTarget() : SILENCE, now + duration, true);
    }
    const profile = DYNAMIC_RANGE_MODES[this.dynamicRange] || DYNAMIC_RANGE_MODES.balanced;
    if (this.compressor) {
      for (const [param, value] of [
        [this.compressor.threshold, profile.threshold],
        [this.compressor.knee, profile.knee],
        [this.compressor.ratio, profile.ratio],
        [this.compressor.attack, profile.attack],
        [this.compressor.release, profile.release],
      ]) {
        holdParam(param, now, value);
        rampParam(param, value, now + duration);
      }
    }
    for (const [name, bus] of this.buses) {
      if (!bus?.gain) continue;
      holdParam(bus.gain, now, this._busTarget(name));
      rampParam(bus.gain, this._busTarget(name), now + duration, true);
    }
    for (const [space, reverb] of this.reverbs) {
      if (!reverb.gain?.gain) continue;
      holdParam(reverb.gain.gain, now, this._reverbTarget(space));
      rampParam(reverb.gain.gain, this._reverbTarget(space), now + duration, true);
    }
  }

  _buildGraph() {
    const ctx = this.ctx;
    const profile = DYNAMIC_RANGE_MODES[this.dynamicRange];
    this.master = ctx.createGain();
    setParam(this.master.gain, this._masterTarget(), ctx.currentTime || 0);

    let tail = this.master;
    if (typeof ctx.createBiquadFilter === 'function') {
      const dcBlock = ctx.createBiquadFilter();
      dcBlock.type = 'highpass';
      setParam(dcBlock.frequency, 28, ctx.currentTime || 0);
      setParam(dcBlock.Q, 0.55, ctx.currentTime || 0);
      tail.connect(dcBlock);
      tail = dcBlock;
    }
    if (typeof ctx.createDynamicsCompressor === 'function') {
      this.compressor = ctx.createDynamicsCompressor();
      setParam(this.compressor.threshold, profile.threshold, ctx.currentTime || 0);
      setParam(this.compressor.knee, profile.knee, ctx.currentTime || 0);
      setParam(this.compressor.ratio, profile.ratio, ctx.currentTime || 0);
      setParam(this.compressor.attack, profile.attack, ctx.currentTime || 0);
      setParam(this.compressor.release, profile.release, ctx.currentTime || 0);
      tail.connect(this.compressor);
      tail = this.compressor;
    }
    tail.connect(ctx.destination);

    for (const name of Object.keys(BUS_LEVELS)) {
      const bus = ctx.createGain();
      setParam(bus.gain, this._busTarget(name), ctx.currentTime || 0);
      bus.connect(this.master);
      this.buses.set(name, bus);
    }
    this._buildReverb();
    this._installVisibilityHandler();
  }

  _buildReverb() {
    const ctx = this.ctx;
    if (typeof ctx.createConvolver !== 'function' || typeof ctx.createBuffer !== 'function') return;
    const sampleRate = clamp(ctx.sampleRate || 44100, 22050, 96000);
    for (const [name, preset] of Object.entries(REVERB_PRESETS)) {
      try {
        const length = Math.floor(sampleRate * preset.duration);
        const impulse = ctx.createBuffer(2, length, sampleRate);
        let seed = 0x51f15e ^ (name.charCodeAt(0) << 16);
        for (let channel = 0; channel < 2; channel++) {
          const data = impulse.getChannelData(channel);
          let previous = 0;
          for (let index = 0; index < length; index++) {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            const white = (seed / 0xffffffff) * 2 - 1;
            previous = previous * preset.smoothing + white * (1 - preset.smoothing);
            const envelope = (1 - index / length) ** preset.decay;
            data[index] = previous * envelope * 0.68;
          }
        }
        const convolver = ctx.createConvolver();
        convolver.buffer = impulse;
        const gain = ctx.createGain();
        setParam(gain.gain, this._reverbTarget(name), ctx.currentTime || 0);
        convolver.connect(gain).connect(this.master);
        this.reverbs.set(name, { convolver, gain, baseLevel: preset.level });
      } catch {
        // One unsupported impulse must not remove dry audio or other spaces.
      }
    }
    const fallback = this.reverbs.get('wild') || this.reverbs.values().next().value;
    this.reverb = fallback?.convolver || null;
    this.reverbGain = fallback?.gain || null;
  }

  _createEventRoute(name, definition, options, now) {
    try {
      const eventGain = this.ctx.createGain();
      const randomGain = 1 + (Math.random() * 2 - 1) * definition.variationGain;
      const requestedGain = options?.gain === undefined ? 1 : Number(options.gain);
      const optionGain = Number.isFinite(requestedGain) ? clamp(requestedGain, 0, 2) : 1;
      setParam(eventGain.gain, definition.gain * randomGain * optionGain, now);

      const nodes = [eventGain];
      let input = eventGain;
      let output = eventGain;
      if (typeof this.ctx.createStereoPanner === 'function') {
        const panner = this.ctx.createStereoPanner();
        setParam(panner.pan, clamp(Number(options?.pan) || 0, -1, 1), now);
        eventGain.connect(panner);
        output = panner;
        nodes.push(panner);
      }
      output.connect(this.buses.get(definition.category) || this.master);
      const requestedSpace = options?.space || definition.space || this.regionSpace;
      const space = Object.prototype.hasOwnProperty.call(REVERB_PRESETS, requestedSpace) ? requestedSpace : 'wild';
      const reverb = this.reverbs.get(space)?.convolver || this.reverb;
      if (definition.reverb > 0 && reverb) {
        const send = this.ctx.createGain();
        setParam(send.gain, definition.reverb, now);
        output.connect(send).connect(reverb);
        nodes.push(send);
      }
      return {
        input,
        nodes,
        remaining: 0,
        sealed: false,
        cleaned: false,
        category: definition.category,
        eventName: name,
        space,
      };
    } catch {
      return null;
    }
  }

  _duckForReward(now) {
    for (const category of Object.keys(REWARD_DUCK_LEVELS)) {
      const bus = this.buses.get(category);
      const level = this._busTarget(category);
      if (!bus?.gain || !level) continue;
      holdParam(bus.gain, now, level);
      rampParam(bus.gain, Math.max(SILENCE, level * REWARD_DUCK_LEVELS[category]), now + 0.022);
      rampParam(bus.gain, level, now + 0.42);
    }
    for (const [space, reverb] of this.reverbs) {
      const level = this._reverbTarget(space);
      if (!reverb.gain?.gain) continue;
      holdParam(reverb.gain.gain, now, level);
      rampParam(reverb.gain.gain, level * 0.66, now + 0.026);
      rampParam(reverb.gain.gain, level, now + 0.46);
    }
  }

  _clearMusicTimer() {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  _clearMusicEventState() {
    for (const eventName of Object.values(MUSIC_EVENTS)) {
      this.activeEvents.delete(eventName);
      for (const key of [...this.lastPlayed.keys()]) {
        if (key === eventName || key.startsWith(`${eventName}:`)) this.lastPlayed.delete(key);
      }
    }
  }

  _queueMusicTick(delayMs = 0) {
    if (
      this.musicTimer
      || !this.musicRegion
      || !this.enabled
      || this.busVolumes.music <= 0
      || !this.ctx
      || this.ctx.state !== 'running'
    ) return;
    this.musicTimer = setTimeout(() => {
      this.musicTimer = null;
      this._musicTick();
    }, Math.max(0, delayMs));
    this.musicTimer?.unref?.();
  }

  _musicTick() {
    if (
      !this.musicRegion
      || !this.enabled
      || this.busVolumes.music <= 0
      || !this.ctx
      || this.ctx.state !== 'running'
    ) return;
    const now = Math.max(0, this.ctx.currentTime || 0);
    const eventName = MUSIC_EVENTS[this.musicRegion];
    const cadence = MUSIC_CADENCE[this.musicRegion];
    if (!eventName || !cadence) return;
    if (!Number.isFinite(this.musicNextTime) || this.musicNextTime < now - 0.24) {
      this.musicNextTime = now + 0.045;
    }

    if (this.musicNextTime <= now + 0.72) {
      this.musicPhraseCount += 1;
      const restEvery = MUSIC_REST_CADENCE[this.musicRegion] || 5;
      const isBreathBar = this.musicPhraseCount % restEvery === 0;
      let scheduled = isBreathBar;
      if (!isBreathBar) {
        this.musicTickRunning = true;
        try {
          scheduled = this.play(eventName, {
            emitter: `region-music:${this.musicRegion}`,
            gain: 0.86,
            pan: 0,
            space: this.musicRegion,
            when: this.musicNextTime,
          });
        } finally {
          this.musicTickRunning = false;
        }
      }
      this.musicNextTime += cadence;
      if (!scheduled && this.musicNextTime < now + 0.2) this.musicNextTime = now + cadence;
    }
    const nextCheckMs = clamp((this.musicNextTime - now - 0.62) * 1000, 140, 850);
    this._queueMusicTick(nextCheckMs);
  }

  _fadeCategoryVoices(category, now, duration) {
    for (const voice of [...this.activeVoices]) {
      if (voice.eventHandle?.category === category) this._stopVoice(voice, now, false, duration);
    }
  }

  _resyncMusicIfNeeded() {
    if (!this.musicNeedsResync || !this.ctx) return;
    this.musicNeedsResync = false;
    this._fadeCategoryVoices('music', this.ctx.currentTime || 0, 0.18);
    this._clearMusicEventState();
    this.musicNextTime = null;
    this.musicPhraseCount = 0;
  }

  _chooseLayers(name, definition) {
    const choices = [definition.layers, ...(definition.variants || [])];
    if (choices.length === 1) return definition.layers;
    const previous = this.lastVariant.get(name);
    let index = Math.floor(Math.random() * choices.length);
    if (index === previous) index = (index + 1 + Math.floor(Math.random() * (choices.length - 1))) % choices.length;
    this.lastVariant.set(name, index);
    return choices[index];
  }

  _scheduleLayer(layer, destination, eventTime, detune, priority, eventHandle) {
    const now = this.ctx.currentTime || 0;
    if (!this._reserveVoice(priority, now)) return 0;
    const when = Math.max(now + 0.003, eventTime + Math.max(0, layer.delay || 0));
    const duration = Math.max(0.012, layer.duration || 0.05);
    const endTime = when + duration;
    let source;
    let envelope;
    let filter;
    let voice;
    try {
      if (layer.kind === 'noise') {
        source = this.ctx.createBufferSource();
        const buffer = this._getNoiseBuffer(layer.color || 'white');
        if (!buffer) {
          source.disconnect?.();
          return 0;
        }
        source.buffer = buffer;
        source.loop = !!layer.loop;
        if (source.playbackRate) setParam(source.playbackRate, clamp(1 + detune / 7200, 0.82, 1.18), when);
      } else {
        source = this.ctx.createOscillator();
        source.type = layer.waveform || 'sine';
        const ratio = 2 ** (detune / 1200);
        const startFrequency = Math.max(20, layer.frequency * ratio);
        const endFrequency = Math.max(20, (layer.endFrequency || layer.frequency) * ratio);
        setParam(source.frequency, startFrequency, when);
        if (endFrequency !== startFrequency) rampParam(source.frequency, endFrequency, endTime, true);
        if (source.detune) setParam(source.detune, Number(layer.layerDetune) || 0, when);
      }

      if (layer.filter && typeof this.ctx.createBiquadFilter === 'function') {
        filter = this.ctx.createBiquadFilter();
        filter.type = layer.filter;
        const filterFrequency = Math.max(20, layer.filterFrequency || 1200);
        const endFilterFrequency = Math.max(20, layer.endFilterFrequency || filterFrequency);
        setParam(filter.frequency, filterFrequency, when);
        if (endFilterFrequency !== filterFrequency) rampParam(filter.frequency, endFilterFrequency, endTime, true);
        setParam(filter.Q, Math.max(0.001, layer.q || 0.7), when);
        source.connect(filter);
      }

      envelope = this.ctx.createGain();
      const attack = clamp(layer.attack ?? 0.003, 0.0008, duration * 0.45);
      const releaseStart = Math.max(when + attack, endTime - Math.max(0.008, layer.release || duration * 0.72));
      setParam(envelope.gain, SILENCE, when);
      rampParam(envelope.gain, Math.max(SILENCE, layer.gain), when + attack);
      setParam(envelope.gain, Math.max(SILENCE, layer.gain * 0.9), releaseStart);
      rampParam(envelope.gain, SILENCE, endTime, true);
      (filter || source).connect(envelope).connect(destination);

      voice = this._trackVoice(source, envelope, priority, endTime + 0.03, eventHandle, filter ? [filter] : []);
      if (layer.kind === 'noise') {
        const playbackRate = Math.max(0.82, Number(source.playbackRate?.value) || 1);
        const consumedBufferTime = duration * playbackRate;
        const maxOffset = Math.max(0, (source.buffer?.duration || 0) - consumedBufferTime - 0.025);
        source.start(when, Math.random() * maxOffset);
      } else {
        source.start(when);
      }
      source.stop(endTime + 0.015);
      return endTime;
    } catch {
      if (voice) this._finishVoice(voice);
      try { source?.disconnect?.(); } catch {}
      try { filter?.disconnect?.(); } catch {}
      try { envelope?.disconnect?.(); } catch {}
      return 0;
    }
  }

  _getNoiseBuffer(color) {
    if (this.noiseBuffers.has(color)) return this.noiseBuffers.get(color);
    if (typeof this.ctx.createBuffer !== 'function') return null;
    try {
      const sampleRate = clamp(this.ctx.sampleRate || 44100, 22050, 96000);
      const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * NOISE_BUFFER_SECONDS), sampleRate);
      const data = buffer.getChannelData(0);
      let seed = color === 'brown' ? 0x7a3c59 : 0x2f6e2b;
      let brown = 0;
      for (let index = 0; index < data.length; index++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const white = (seed / 0xffffffff) * 2 - 1;
        if (color === 'brown') {
          brown = (brown + white * 0.055) / 1.035;
          data[index] = brown * 3.1;
        } else {
          data[index] = white;
        }
      }
      this.noiseBuffers.set(color, buffer);
      return buffer;
    } catch {
      return null;
    }
  }

  _trackVoice(source, gain, priority, endTime, eventHandle, cleanupNodes = []) {
    const voice = {
      source,
      gain,
      priority,
      endTime,
      eventHandle,
      cleanupNodes,
      finished: false,
      stopping: false,
    };
    eventHandle.remaining += 1;
    this.activeVoices.push(voice);
    source.onended = () => this._finishVoice(voice);
    return voice;
  }

  _finishVoice(voice) {
    if (!voice || voice.finished) return;
    voice.finished = true;
    const index = this.activeVoices.indexOf(voice);
    if (index >= 0) this.activeVoices.splice(index, 1);
    try { voice.source?.disconnect?.(); } catch {}
    try { voice.gain?.disconnect?.(); } catch {}
    for (const node of voice.cleanupNodes || []) {
      try { node?.disconnect?.(); } catch {}
    }
    const handle = voice.eventHandle;
    if (handle) {
      handle.remaining = Math.max(0, handle.remaining - 1);
      if (handle.sealed && !handle.remaining) this._cleanupEventRoute(handle);
    }
  }

  _cleanupEventRoute(handle) {
    if (!handle || handle.cleaned) return;
    handle.cleaned = true;
    for (const node of handle.nodes) {
      try { node.disconnect?.(); } catch {}
    }
  }

  _pruneVoices(now) {
    for (const voice of [...this.activeVoices]) {
      if (voice.endTime <= now) this._finishVoice(voice);
    }
    for (const [name, endTimes] of this.activeEvents) {
      const active = endTimes.filter((endTime) => endTime > now);
      if (active.length) this.activeEvents.set(name, active);
      else this.activeEvents.delete(name);
    }
  }

  _reserveVoice(priority, now) {
    this._pruneVoices(now);
    if (this.activeVoices.length < MAX_ACTIVE_VOICES) return true;
    let victim = this.activeVoices[0];
    for (const voice of this.activeVoices) {
      if (voice.priority < victim.priority || (voice.priority === victim.priority && voice.endTime < victim.endTime)) {
        victim = voice;
      }
    }
    if (!victim || priority <= victim.priority) return false;
    this._stopVoice(victim, now);
    return true;
  }

  _stopVoice(voice, now, immediate = false, fadeDuration = 0.012) {
    if (!voice || voice.finished) return;
    const index = this.activeVoices.indexOf(voice);
    if (index >= 0) this.activeVoices.splice(index, 1);
    if (immediate) {
      try { voice.source?.stop?.(now); } catch {}
      this._finishVoice(voice);
      return;
    }
    if (voice.stopping) return;
    voice.stopping = true;
    try {
      const fade = clamp(fadeDuration, 0.008, 0.6);
      holdParam(voice.gain?.gain, now, 0.01);
      rampParam(voice.gain?.gain, SILENCE, now + fade, true);
      voice.source?.stop?.(now + fade + 0.004);
    } catch {
      this._finishVoice(voice);
    }
  }

  _resumeContext() {
    if (!this.ctx || this.ctx.state === 'running') {
      this._removeUnlockHandlers();
      if (this.ctx) {
        this._resyncMusicIfNeeded();
        if (!this.musicTickRunning) this._queueMusicTick(0);
      }
      return;
    }
    if (this.ctx.state === 'closed') return;
    try {
      const resumed = this.ctx.resume?.();
      if (resumed?.then) {
        resumed.then(() => {
          if (this.ctx?.state === 'running') {
            this._removeUnlockHandlers();
            this._resyncMusicIfNeeded();
            this._queueMusicTick(0);
          }
        }).catch(() => this._installUnlockHandlers());
      }
    } catch {
      // A later trusted pointer/key event will retry the resume on mobile.
    }
    if (this.ctx.state !== 'running') this._installUnlockHandlers();
  }

  _installUnlockHandlers() {
    if (this.unlockHandler) return;
    const target = globalThis.window || globalThis;
    if (typeof target?.addEventListener !== 'function') return;
    this.unlockTarget = target;
    this.unlockHandler = () => {
      if (!this.ctx && this.enabled) this.ensure();
      else this._resumeContext();
    };
    for (const type of ['pointerdown', 'touchend', 'keydown']) {
      target.addEventListener(type, this.unlockHandler, { capture: true, passive: true });
    }
  }

  _removeUnlockHandlers() {
    if (!this.unlockHandler || !this.unlockTarget) return;
    for (const type of ['pointerdown', 'touchend', 'keydown']) {
      this.unlockTarget.removeEventListener?.(type, this.unlockHandler, { capture: true });
    }
    this.unlockHandler = null;
    this.unlockTarget = null;
  }

  _installVisibilityHandler() {
    const doc = globalThis.document;
    if (this.visibilityHandler || typeof doc?.addEventListener !== 'function') return;
    this.visibilityHandler = () => {
      if (doc.hidden && this.ctx?.state === 'running') {
        this._clearMusicTimer();
        this.musicNeedsResync = true;
        Promise.resolve(this.ctx.suspend?.()).catch(() => {});
      } else if (!doc.hidden && this.enabled && this.ctx?.state !== 'running') {
        this._installUnlockHandlers();
      }
    };
    doc.addEventListener('visibilitychange', this.visibilityHandler);
  }

  _removeVisibilityHandler() {
    if (!this.visibilityHandler) return;
    globalThis.document?.removeEventListener?.('visibilitychange', this.visibilityHandler);
    this.visibilityHandler = null;
  }

  _touchIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.ctx?.state === 'running' && !this.activeVoices.length) {
        Promise.resolve(this.ctx.suspend?.()).catch(() => {});
      }
    }, IDLE_SUSPEND_MS);
    this.idleTimer?.unref?.();
  }

  _resetGraphReferences() {
    this._clearMusicTimer();
    this.musicNextTime = null;
    this.musicTickRunning = false;
    this.musicNeedsResync = false;
    this.musicPhraseCount = 0;
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.buses.clear();
    this.reverb = null;
    this.reverbGain = null;
    this.reverbs.clear();
    this.noiseBuffers.clear();
    this.activeVoices.length = 0;
    this.activeEvents.clear();
    this.lastPlayed.clear();
  }
}
