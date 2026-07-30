/** 玛法余烬 · 沙城纪元 — 深度循环配置 */

const AUTHORING_WORLD = Object.freeze({ cols: 40, rows: 30 });
export const WORLD = Object.freeze({
  tile: 48,
  cols: 96,
  rows: 72,
  authoringCols: AUTHORING_WORLD.cols,
  authoringRows: AUTHORING_WORLD.rows,
  layoutScale: 2.4,
  previousLayoutScale: 1.8,
  layoutVersion: 3,
});

/** 统一的世界物体绘制高度（包含素材透明边距），用于维持角色、怪物与场景的比例。 */
export const VISUAL_SCALE = {
  player: 82,
  npc: 82,
  pet: 68,
  monsters: {
    deer: 78,
    zombie: 82,
    skeleton: 84,
    bat: 94,
    orc: 94,
    guardian: 122,
    lord: 154,
    wolf: 82,
    boar: 94,
    centipede: 88,
  },
};
export const SAVE_KEY = 'ember_legend_save_v5';
export const SAVE_VERSION = 5;

export const RARITIES = {
  common: { name: '普通', color: '#c8c0ad', power: 1 },
  fine: { name: '精良', color: '#58b5ff', power: 1.12 },
  rare: { name: '稀有', color: '#b983ff', power: 1.28 },
  epic: { name: '史诗', color: '#ffb02e', power: 1.5 },
  legendary: { name: '传说', color: '#ff5a48', power: 1.85 },
};

export const ITEM_TYPE_NAMES = {
  consumable: '补给与卷轴',
  weapon: '武器',
  armor: '衣服',
  helmet: '头盔',
  necklace: '项链',
  bracelet: '手镯与手套',
  ring: '戒指',
  skillbook: '技能书',
  material: '材料与战利品',
  quest: '关键物品',
};

export const EQUIP_SLOTS = [
  'weapon', 'armor', 'helmet', 'necklace',
  'braceletLeft', 'braceletRight', 'ringLeft', 'ringRight',
];
export const SLOT_NAMES = {
  weapon: '武器',
  armor: '衣服',
  helmet: '头盔',
  necklace: '项链',
  braceletLeft: '左手镯',
  braceletRight: '右手镯',
  ringLeft: '左戒指',
  ringRight: '右戒指',
};
export const SLOT_TYPES = {
  weapon: 'weapon',
  armor: 'armor',
  helmet: 'helmet',
  necklace: 'necklace',
  braceletLeft: 'bracelet',
  braceletRight: 'bracelet',
  ringLeft: 'ring',
  ringRight: 'ring',
};
export const ENHANCE_MAX = 7;
export const SKILL_MAX_LEVEL = 3;
export const SKILL_LEVEL_XP = [0, 0, 80, 360];
export const COMBAT_RULES = Object.freeze({
  basicRange: 72,
  playerBodyRadius: 18,
  monsterBodyRadius: 16,
  attackWindup: 0.18,
  attackRecovery: 0.46,
  attackLeeway: 14,
});
export const SKILL_COMBAT = Object.freeze({
  slash: { magical: false, multiplier: 1.08, mastery: 1 },
  thrust: { magical: false, multiplier: 1.48, ignoreDefense: 0.72, mastery: 2 },
  fire_sword: { magical: false, multiplier: 2.25, mastery: 5 },
  rush: { magical: false, multiplier: 0.9, range: 180, stun: 0.9, mastery: 3 },
  fireball: { magical: true, multiplier: 1.16, range: 320, mastery: 1 },
  lightning: { magical: true, multiplier: 1.82, range: 340, mastery: 2 },
  burst: { magical: true, multiplier: 1.28, range: 300, radius: 120, mastery: 4 },
  talisman: { magical: true, multiplier: 1.22, range: 300, mastery: 1 },
  poison: { magical: true, multiplier: 0.42, range: 280, poisonSeconds: 8, mastery: 2 },
  heal: { mastery: 3 },
  shield: { mastery: 4 },
  summon: { mastery: 4 },
});

export function enhanceCost(level) {
  const rates = [1, 0.9, 0.78, 0.62, 0.46, 0.31, 0.18];
  const resolved = Math.max(0, Math.min(ENHANCE_MAX - 1, Math.floor(Number(level) || 0)));
  return {
    gold: Math.floor(180 * (resolved + 1) ** 1.65),
    ore: resolved + 1,
    rate: rates[resolved],
    destroysOnFailure: resolved >= 3,
  };
}

export const CLASSES = {
  warrior: {
    id: 'warrior',
    name: '战士',
    desc: '近战肉盾。刺杀、烈火、野蛮冲撞。适合冲锋打怪。',
    portrait: 'assets/game/portrait/warrior_face.png',
    avatar: 'assets/game/portrait/warrior_128.png',
    unit: 'assets/game/unit/warrior.png',
    color: '#d35400',
    base: { hp: 140, mp: 35, atk: 14, mag: 0, def: 6, magDef: 2, crit: 0.08, dodge: 0.03, lifesteal: 0.02, range: 58, ms: 168, as: 1.05 },
    gain: { hp: 22, mp: 3, atk: 2.6, mag: 0, def: 1.4, magDef: 0.3, crit: 0.001, dodge: 0.0005 },
    skills: [
      { id: 'slash', name: '基本剑术', key: '1', type: 'passive', mana: 0, cd: 0, reqLevel: 7, icon: 'assets/game/ui/icons/skill-slash.png', desc: '提升普通攻击命中与伤害。' },
      { id: 'thrust', name: '刺杀剑术', key: '2', type: 'boost', mana: 0, cd: 0.5, reqLevel: 25, icon: 'assets/game/ui/icons/skill-thrust.png', desc: '下一刀穿透防御造成重击。' },
      { id: 'fire_sword', name: '烈火剑法', key: '3', type: 'boost', mana: 10, cd: 7, reqLevel: 35, icon: 'assets/game/ui/icons/skill-fire-sword.png', desc: '凝聚烈火，强化下一次攻击。' },
      { id: 'rush', name: '野蛮冲撞', key: '4', type: 'dash', mana: 12, cd: 10, range: 180, reqLevel: 30, icon: 'assets/game/ui/icons/skill-rush.png', desc: '冲向目标并造成短暂僵直。' },
    ],
  },
  wizard: {
    id: 'wizard',
    name: '法师',
    desc: '远程法术。火球、雷电、冰咆哮清怪。',
    portrait: 'assets/game/portrait/wizard_face.png',
    avatar: 'assets/game/portrait/wizard_128.png',
    unit: 'assets/game/unit/wizard.png',
    color: '#3498db',
    base: { hp: 75, mp: 130, atk: 3, mag: 16, def: 1, magDef: 4, crit: 0.1, dodge: 0.06, lifesteal: 0.01, range: 58, ms: 155, as: 0.95 },
    gain: { hp: 9, mp: 14, atk: 0.3, mag: 3.0, def: 0.3, magDef: 0.9, crit: 0.0015, dodge: 0.0008 },
    skills: [
      { id: 'fireball', name: '火球术', key: '1', type: 'missile', mana: 6, cd: 1.0, range: 320, reqLevel: 7, icon: 'assets/game/ui/icons/skill-fireball.png', desc: '发射火球造成魔法伤害。' },
      { id: 'lightning', name: '雷电术', key: '2', type: 'target', mana: 14, cd: 3.2, range: 340, reqLevel: 17, icon: 'assets/game/ui/icons/skill-lightning.png', desc: '召唤雷电攻击单个目标。' },
      { id: 'burst', name: '冰咆哮', key: '3', type: 'aoe', mana: 24, cd: 8, range: 300, radius: 120, reqLevel: 35, icon: 'assets/game/ui/icons/skill-ice-burst.png', desc: '制造持续冰暴伤害区域。' },
      { id: 'shield', name: '魔法盾', key: '4', type: 'buff', mana: 20, cd: 20, reqLevel: 31, icon: 'assets/game/ui/icons/skill-magic-shield.png', desc: '以魔力吸收所受伤害。' },
    ],
  },
  taoist: {
    id: 'taoist',
    name: '道士',
    desc: '续航辅助。治愈、火符、施毒、召唤骷髅。',
    portrait: 'assets/game/portrait/taoist_face.png',
    avatar: 'assets/game/portrait/taoist_128.png',
    unit: 'assets/game/unit/taoist.png',
    color: '#27ae60',
    base: { hp: 100, mp: 100, atk: 7, mag: 11, def: 3, magDef: 5, crit: 0.07, dodge: 0.05, lifesteal: 0.03, range: 58, ms: 160, as: 1.0 },
    gain: { hp: 14, mp: 11, atk: 0.9, mag: 2.1, def: 0.8, magDef: 1.1, crit: 0.001, dodge: 0.0007 },
    skills: [
      { id: 'heal', name: '治愈术', key: '1', type: 'heal', mana: 12, cd: 3.5, reqLevel: 7, icon: 'assets/game/ui/icons/skill-heal.png', desc: '运用精神力恢复生命。' },
      { id: 'talisman', name: '灵魂火符', key: '2', type: 'missile', mana: 8, cd: 1.2, range: 300, reqLevel: 18, icon: 'assets/game/ui/icons/skill-talisman.png', desc: '以护身符攻击远处目标。' },
      { id: 'poison', name: '施毒术', key: '3', type: 'target', mana: 12, cd: 5, range: 280, reqLevel: 14, icon: 'assets/game/ui/icons/skill-poison.png', desc: '使目标持续中毒并削弱恢复。' },
      { id: 'summon', name: '召唤骷髅', key: '4', type: 'summon', mana: 30, cd: 25, reqLevel: 19, icon: 'assets/game/ui/icons/skill-summon.png', desc: '召唤可成长的骷髅协助战斗。' },
    ],
  },
};

export const MONSTERS = {
  deer: {
    id: 'deer', name: '鹿', unit: 'assets/game/mob/deer.png',
    hp: 50, atk: 5, def: 0, magDef: 0, ms: 95, range: 48, xp: 14, gold: [2, 6], aggro: 140, level: 1,
    behavior: 'passive',
    drops: [
      { id: 'hp_pot', rate: 0.16 }, { id: 'wood_sword', rate: 0.015 }, { id: 'bronze_sword', rate: 0.012 },
      { id: 'leather_helmet', rate: 0.016 }, { id: 'traditional_necklace', rate: 0.012 },
      { id: 'deer_meat', rate: 0.35 }, { id: 'deer_hide', rate: 0.65 }, { id: 'random_scroll', rate: 0.04 },
      { id: 'book_slash', rate: 0.008 }, { id: 'book_fireball', rate: 0.008 }, { id: 'book_heal', rate: 0.008 },
    ],
  },
  zombie: {
    id: 'zombie', name: '僵尸', unit: 'assets/game/mob/zombie.png',
    hp: 110, atk: 11, def: 3, magDef: 1, ms: 72, range: 50, xp: 32, gold: [4, 12], aggro: 190, level: 5,
    behavior: 'ambush',
    drops: [
      { id: 'hp_pot', rate: 0.18 }, { id: 'iron_sword', rate: 0.018 }, { id: 'bronze_axe', rate: 0.012 },
      { id: 'cloth', rate: 0.03 }, { id: 'light_armor', rate: 0.012 }, { id: 'large_bracelet', rate: 0.012 },
      { id: 'zombie_arm', rate: 0.25 }, { id: 'grave_dust', rate: 0.55 }, { id: 'random_scroll', rate: 0.035 },
      { id: 'book_poison', rate: 0.006 }, { id: 'book_lightning', rate: 0.004 },
    ],
  },
  skeleton: {
    id: 'skeleton', name: '骷髅', unit: 'assets/game/mob/skeleton.png',
    hp: 160, atk: 16, def: 5, magDef: 2, ms: 100, range: 52, xp: 52, gold: [7, 20], aggro: 210, level: 10,
    behavior: 'ambush',
    drops: [
      { id: 'mp_pot', rate: 0.16 }, { id: 'iron_sword', rate: 0.018 }, { id: 'magic_ring', rate: 0.009 },
      { id: 'iron_bracelet', rate: 0.014 }, { id: 'large_bracelet', rate: 0.016 }, { id: 'magic_helmet', rate: 0.01 },
      { id: 'blue_crystal_ring', rate: 0.008 }, { id: 'necklace', rate: 0.008 }, { id: 'soul_breaker', rate: 0.006 },
      { id: 'bone', rate: 0.3 }, { id: 'grave_dust', rate: 0.48 }, { id: 'black_iron', rate: 0.025 },
      { id: 'book_talisman', rate: 0.007 }, { id: 'book_summon', rate: 0.005 },
    ],
  },
  bat: {
    id: 'bat', name: '洞穴蝙蝠', unit: 'assets/game/mob/bat.png',
    hp: 90, atk: 14, def: 2, magDef: 3, ms: 130, range: 46, xp: 40, gold: [5, 15], aggro: 240, level: 12,
    behavior: 'swarm',
    drops: [
      { id: 'mp_pot', rate: 0.14 }, { id: 'wing_dust', rate: 0.22 }, { id: 'bat_wing', rate: 0.58 },
      { id: 'magic_ring', rate: 0.006 }, { id: 'ebony_necklace', rate: 0.012 }, { id: 'magnifier', rate: 0.004 },
      { id: 'random_scroll', rate: 0.045 },
    ],
  },
  wolf: {
    id: 'wolf', name: '森林雪狼', unit: 'assets/game/mob/wolf.png',
    hp: 135, atk: 14, def: 3, magDef: 1, ms: 125, range: 50, xp: 46, gold: [5, 16], aggro: 250, level: 8,
    behavior: 'pack',
    drops: [
      { id: 'wolf_pelt', rate: 0.42 }, { id: 'hp_pot', rate: 0.14 }, { id: 'iron_bracelet', rate: 0.008 },
      { id: 'wolf_fang', rate: 0.68 }, { id: 'horn_ring', rate: 0.018 }, { id: 'tiger_tooth_necklace', rate: 0.012 },
      { id: 'sturdy_glove', rate: 0.01 }, { id: 'book_poison', rate: 0.004 },
    ],
  },
  boar: {
    id: 'boar', name: '红野猪', unit: 'assets/game/mob/boar.png',
    hp: 360, atk: 29, def: 10, magDef: 5, ms: 92, range: 58, xp: 115, gold: [16, 42], aggro: 260, level: 20,
    behavior: 'charger',
    drops: [
      { id: 'boar_tusk', rate: 0.35 }, { id: 'boar_hide', rate: 0.72 }, { id: 'hp_pot_l', rate: 0.12 },
      { id: 'sun_potion', rate: 0.025 }, { id: 'medium_armor', rate: 0.012 }, { id: 'heavy_armor', rate: 0.012 },
      { id: 'power_ring', rate: 0.008 }, { id: 'coral_ring', rate: 0.012 }, { id: 'death_glove', rate: 0.008 },
      { id: 'horse_chopper', rate: 0.007 }, { id: 'black_iron', rate: 0.04 },
    ],
  },
  centipede: {
    id: 'centipede', name: '巨型蜈蚣', unit: 'assets/game/mob/centipede.png',
    hp: 245, atk: 23, def: 7, magDef: 8, ms: 108, range: 54, xp: 82, gold: [10, 28], aggro: 270, level: 16,
    behavior: 'venom',
    drops: [
      { id: 'centipede_shell', rate: 0.38 }, { id: 'venom_sac', rate: 0.62 },
      { id: 'mp_pot_b', rate: 0.1 }, { id: 'mp_pot_l', rate: 0.08 }, { id: 'sun_potion', rate: 0.018 },
      { id: 'mystic_bracelet', rate: 0.007 }, { id: 'ghost_glove', rate: 0.01 }, { id: 'taoist_helmet', rate: 0.008 },
      { id: 'pearl_ring', rate: 0.012 }, { id: 'phoenix_necklace', rate: 0.008 },
      { id: 'black_iron', rate: 0.045 }, { id: 'book_talisman', rate: 0.004 },
    ],
  },
  orc: {
    id: 'orc', name: '沃玛战士', unit: 'assets/game/mob/orc.png',
    hp: 280, atk: 26, def: 9, magDef: 4, ms: 105, range: 56, xp: 95, gold: [12, 34], aggro: 250, level: 18,
    behavior: 'soldier',
    drops: [
      { id: 'crescent_blade', rate: 0.009 }, { id: 'apprentice_staff', rate: 0.008 }, { id: 'spirit_sword', rate: 0.008 },
      { id: 'heavy_armor', rate: 0.008 }, { id: 'mage_robe', rate: 0.008 }, { id: 'soul_robe', rate: 0.008 },
      { id: 'mystic_bracelet', rate: 0.009 }, { id: 'red_gem_ring', rate: 0.004 }, { id: 'platinum_ring', rate: 0.004 },
      { id: 'life_necklace', rate: 0.0035 }, { id: 'soul_necklace', rate: 0.0035 },
      { id: 'recall', rate: 0.08 }, { id: 'dungeon_scroll', rate: 0.07 },
      { id: 'orc_tooth', rate: 0.2 }, { id: 'orc_badge', rate: 0.7 }, { id: 'black_iron', rate: 0.05 },
      { id: 'book_rush', rate: 0.006 }, { id: 'book_shield', rate: 0.006 },
    ],
  },
  guardian: {
    id: 'guardian', name: '沃玛卫士', unit: 'assets/game/mob/guardian.png',
    hp: 900, atk: 38, def: 14, magDef: 8, ms: 90, range: 64, xp: 320, gold: [45, 110], aggro: 320, level: 25,
    elite: true, behavior: 'cleave',
    drops: [
      { id: 'steel_sword', rate: 0.05 }, { id: 'silver_serpent', rate: 0.045 },
      { id: 'heavy_armor', rate: 0.035 }, { id: 'mage_robe', rate: 0.035 }, { id: 'soul_robe', rate: 0.035 },
      { id: 'war_god_armor', rate: 0.012 }, { id: 'demon_robe', rate: 0.012 }, { id: 'ghost_robe', rate: 0.012 },
      { id: 'black_iron_helmet', rate: 0.025 }, { id: 'dragon_ring', rate: 0.02 },
      { id: 'dragon_bracelet', rate: 0.02 }, { id: 'three_eye_bracelet', rate: 0.02 }, { id: 'green_necklace', rate: 0.018 },
      { id: 'dragon_blade', rate: 0.003 },
      { id: 'temple_token', rate: 1 }, { id: 'guardian_core', rate: 1 }, { id: 'recall', rate: 0.18 },
      { id: 'hp_pot_b', rate: 0.3 }, { id: 'hp_pot_l', rate: 0.45 }, { id: 'mp_pot_l', rate: 0.36 },
      { id: 'sun_potion', rate: 0.18 }, { id: 'strong_sun_potion', rate: 0.035 }, { id: 'black_iron', rate: 0.22 },
      { id: 'book_thrust', rate: 0.03 }, { id: 'book_fire_sword', rate: 0.025 }, { id: 'book_burst', rate: 0.025 },
    ],
  },
  lord: {
    id: 'lord', name: '沃玛教主', unit: 'assets/game/mob/guardian.png',
    hp: 2400, atk: 52, def: 20, magDef: 16, ms: 96, range: 68, xp: 1200, gold: [260, 520], aggro: 420, level: 32,
    elite: true, boss: true, behavior: 'boss_caster',
    drops: [
      { id: 'dragon_blade', rate: 0.012 }, { id: 'dragon_staff', rate: 0.012 }, { id: 'celestial_talisman', rate: 0.012 },
      { id: 'judgement', rate: 0.018 }, { id: 'bone_staff', rate: 0.018 }, { id: 'dragon_pattern_sword', rate: 0.018 },
      { id: 'war_god_armor', rate: 0.028 }, { id: 'demon_robe', rate: 0.028 }, { id: 'ghost_robe', rate: 0.028 },
      { id: 'black_iron_helmet', rate: 0.04 }, { id: 'dragon_ring', rate: 0.035 },
      { id: 'dragon_bracelet', rate: 0.035 }, { id: 'three_eye_bracelet', rate: 0.035 }, { id: 'green_necklace', rate: 0.03 },
      { id: 'lord_seal', rate: 1 }, { id: 'lord_crystal', rate: 1 }, { id: 'strong_sun_potion', rate: 0.35 },
      { id: 'blessing_oil', rate: 0.18 }, { id: 'black_iron', rate: 0.35 },
      { id: 'book_fire_sword', rate: 0.045 }, { id: 'book_burst', rate: 0.045 },
    ],
  },
  zombie_miner: {
    id: 'zombie_miner', name: '尸矿工', unit: 'assets/game/mob/zombie.png', animKey: 'zombie',
    hp: 180, atk: 17, def: 5, magDef: 2, ms: 68, range: 52, xp: 58, gold: [6, 18], aggro: 210, level: 11,
    behavior: 'ambush',
    drops: [
      { id: 'zombie_arm', rate: 0.22 }, { id: 'copper_ore', rate: 0.14 }, { id: 'silver_ore', rate: 0.035 },
      { id: 'grave_dust', rate: 0.48 }, { id: 'bronze_axe', rate: 0.018 }, { id: 'large_bracelet', rate: 0.012 },
      { id: 'random_scroll', rate: 0.05 }, { id: 'black_iron', rate: 0.012 }, { id: 'helmet', rate: 0.008 },
    ],
  },
  wolf_alpha: {
    id: 'wolf_alpha', name: '雪狼头领', unit: 'assets/game/mob/wolf.png', animKey: 'wolf',
    hp: 520, atk: 31, def: 9, magDef: 4, ms: 132, range: 56, xp: 190, gold: [24, 58], aggro: 300, level: 18,
    elite: true, behavior: 'pack',
    drops: [
      { id: 'wolf_pelt', rate: 1 }, { id: 'wolf_fang', rate: 1 }, { id: 'tiger_tooth_necklace', rate: 0.055 },
      { id: 'sturdy_glove', rate: 0.045 }, { id: 'power_ring', rate: 0.025 }, { id: 'magic_ring', rate: 0.025 },
      { id: 'phoenix_necklace', rate: 0.018 }, { id: 'book_poison', rate: 0.012 }, { id: 'blessing_oil', rate: 0.008 },
    ],
  },
  boar_king: {
    id: 'boar_king', name: '石墓猪王', unit: 'assets/game/mob/boar.png', animKey: 'boar',
    hp: 1450, atk: 48, def: 18, magDef: 9, ms: 104, range: 64, xp: 520, gold: [70, 150], aggro: 330, level: 28,
    elite: true, behavior: 'charger',
    drops: [
      { id: 'boar_tusk', rate: 1 }, { id: 'boar_hide', rate: 1 }, { id: 'hp_pot_l', rate: 0.45 },
      { id: 'sun_potion', rate: 0.18 }, { id: 'medium_armor', rate: 0.055 }, { id: 'heavy_armor', rate: 0.045 },
      { id: 'steel_sword', rate: 0.035 }, { id: 'horse_chopper', rate: 0.035 },
      { id: 'skull_helmet', rate: 0.035 }, { id: 'coral_ring', rate: 0.045 }, { id: 'death_glove', rate: 0.035 },
      { id: 'black_iron', rate: 0.28 }, { id: 'book_thrust', rate: 0.022 },
      { id: 'book_rush', rate: 0.018 }, { id: 'blessing_oil', rate: 0.015 },
    ],
  },
  venom_centipede: {
    id: 'venom_centipede', name: '触龙毒虫', unit: 'assets/game/mob/centipede.png', animKey: 'centipede',
    hp: 1050, atk: 41, def: 15, magDef: 16, ms: 112, range: 60, xp: 410, gold: [55, 125], aggro: 340, level: 26,
    elite: true, behavior: 'venom',
    drops: [
      { id: 'centipede_shell', rate: 1 }, { id: 'venom_sac', rate: 1 }, { id: 'mp_pot_l', rate: 0.42 },
      { id: 'sun_potion', rate: 0.16 }, { id: 'mystic_bracelet', rate: 0.035 }, { id: 'ghost_glove', rate: 0.04 },
      { id: 'three_eye_bracelet', rate: 0.012 }, { id: 'platinum_ring', rate: 0.025 },
      { id: 'silver_serpent', rate: 0.026 }, { id: 'black_iron', rate: 0.3 },
      { id: 'book_talisman', rate: 0.018 }, { id: 'book_summon', rate: 0.012 }, { id: 'blessing_oil', rate: 0.015 },
    ],
  },
  orc_shaman: {
    id: 'orc_shaman', name: '沃玛火祭司', unit: 'assets/game/mob/guardian.png', animKey: 'guardian',
    hp: 460, atk: 20, mag: 34, def: 8, magDef: 14, ms: 82, range: 220, xp: 175, gold: [22, 52], aggro: 310, level: 23,
    behavior: 'ranged_caster',
    drops: [
      { id: 'mp_pot_b', rate: 0.16 }, { id: 'crescent_staff', rate: 0.015 }, { id: 'spirit_sword', rate: 0.015 },
      { id: 'orc_badge', rate: 0.75 }, { id: 'mp_pot_l', rate: 0.22 }, { id: 'sun_potion', rate: 0.06 },
      { id: 'wand', rate: 0.025 }, { id: 'infinity_staff', rate: 0.025 },
      { id: 'red_gem_ring', rate: 0.022 }, { id: 'platinum_ring', rate: 0.022 },
      { id: 'life_necklace', rate: 0.016 }, { id: 'soul_necklace', rate: 0.016 },
      { id: 'book_lightning', rate: 0.012 }, { id: 'book_shield', rate: 0.009 }, { id: 'black_iron', rate: 0.08 },
    ],
  },
};

export const ITEMS = {
  hp_pot: { id: 'hp_pot', name: '金创药(小)', type: 'consumable', price: 25, sell: 8, desc: '恢复 80 生命', use: { hp: 80 }, hotkey: 'f1' },
  hp_pot_b: { id: 'hp_pot_b', name: '金创药(中)', type: 'consumable', price: 80, sell: 25, desc: '恢复 200 生命', use: { hp: 200 }, hotkey: 'f1' },
  mp_pot: { id: 'mp_pot', name: '魔法药(小)', type: 'consumable', price: 30, sell: 10, desc: '恢复 70 魔法', use: { mp: 70 }, hotkey: 'f2' },
  mp_pot_b: { id: 'mp_pot_b', name: '魔法药(中)', type: 'consumable', price: 90, sell: 28, desc: '恢复 180 魔法', use: { mp: 180 }, hotkey: 'f2' },
  recall: { id: 'recall', name: '回城卷', type: 'consumable', price: 60, sell: 18, desc: '立刻回到比奇城', use: { town: true } },
  wood_sword: { id: 'wood_sword', name: '木剑', type: 'weapon', slot: 'weapon', price: 50, sell: 15, desc: '攻击 +5', stats: { atk: 5 } },
  iron_sword: { id: 'iron_sword', name: '铁剑', type: 'weapon', slot: 'weapon', price: 220, sell: 60, desc: '攻击 +12', stats: { atk: 12 } },
  crescent_blade: { id: 'crescent_blade', name: '修罗', type: 'weapon', slot: 'weapon', price: 780, sell: 180, desc: '战士武器 · 攻击 +18', stats: { atk: 18 }, classes: ['warrior'] },
  steel_sword: { id: 'steel_sword', name: '炼狱', type: 'weapon', slot: 'weapon', price: 1800, sell: 420, desc: '战士重兵 · 攻击 +26', stats: { atk: 26 }, classes: ['warrior'] },
  dragon_blade: { id: 'dragon_blade', name: '屠龙', type: 'weapon', slot: 'weapon', price: 5000, sell: 900, desc: '攻击 +42 生命+60', stats: { atk: 42, hp: 60 } },
  apprentice_staff: { id: 'apprentice_staff', name: '海魂', type: 'weapon', slot: 'weapon', price: 520, sell: 120, desc: '法师武器 · 魔法 +12', stats: { mag: 12, mp: 22 }, classes: ['wizard'] },
  crescent_staff: { id: 'crescent_staff', name: '偃月', type: 'weapon', slot: 'weapon', price: 980, sell: 220, desc: '法师武器 · 魔法 +20', stats: { mag: 20, mp: 38 }, classes: ['wizard'] },
  dragon_staff: { id: 'dragon_staff', name: '龙牙法杖', type: 'weapon', slot: 'weapon', price: 5200, sell: 960, desc: '法师传说武器 · 魔法 +46', stats: { mag: 46, mp: 90, crit: 0.04 }, classes: ['wizard'] },
  spirit_sword: { id: 'spirit_sword', name: '降魔', type: 'weapon', slot: 'weapon', price: 720, sell: 160, desc: '道士武器 · 道术 +18', stats: { mag: 18, hp: 30 }, classes: ['taoist'] },
  silver_serpent: { id: 'silver_serpent', name: '银蛇', type: 'weapon', slot: 'weapon', price: 1600, sell: 380, desc: '道士武器 · 道术 +27 生命+40', stats: { mag: 27, hp: 40 }, classes: ['taoist'] },
  celestial_talisman: { id: 'celestial_talisman', name: '逍遥扇', type: 'weapon', slot: 'weapon', price: 5200, sell: 960, desc: '道士传说武器 · 道术 +42', stats: { mag: 42, hp: 80, lifesteal: 0.05 }, classes: ['taoist'] },
  cloth: { id: 'cloth', name: '布衣', type: 'armor', slot: 'armor', price: 80, sell: 22, desc: '防御 +4', stats: { def: 4 } },
  heavy_armor: { id: 'heavy_armor', name: '重盔甲', type: 'armor', slot: 'armor', price: 900, sell: 200, desc: '战士衣服 · 防御 +14 生命+50', stats: { def: 14, hp: 50 }, classes: ['warrior'] },
  mage_robe: { id: 'mage_robe', name: '魔法长袍', type: 'armor', slot: 'armor', price: 900, sell: 200, desc: '法师衣服 · 防御+8 魔法+6 魔力+45', stats: { def: 8, mag: 6, mp: 45 }, classes: ['wizard'] },
  soul_robe: { id: 'soul_robe', name: '灵魂战衣', type: 'armor', slot: 'armor', price: 900, sell: 200, desc: '道士衣服 · 防御+9 道术+6 生命+35', stats: { def: 9, mag: 6, hp: 35 }, classes: ['taoist'] },
  magic_ring: { id: 'magic_ring', name: '魔法戒指', type: 'ring', slot: 'ring', price: 450, sell: 110, durability: 7, desc: '魔法 +10', stats: { mag: 10 } },
  power_ring: { id: 'power_ring', name: '力量戒指', type: 'ring', slot: 'ring', price: 450, sell: 110, durability: 7, desc: '攻击 +8', stats: { atk: 8 } },
  necklace: { id: 'necklace', name: '金色项链', type: 'necklace', slot: 'necklace', price: 600, sell: 150, desc: '生命+40 魔防+3', stats: { hp: 40, magDef: 3 } },
  helmet: { id: 'helmet', name: '青铜头盔', type: 'helmet', slot: 'helmet', price: 350, sell: 90, desc: '防御 +5', stats: { def: 5 } },
  skull_helmet: { id: 'skull_helmet', name: '骷髅头盔', type: 'helmet', slot: 'helmet', price: 820, sell: 190, desc: '防御+8 魔防+4', stats: { def: 8, magDef: 4 } },
  iron_bracelet: { id: 'iron_bracelet', name: '铁手镯', type: 'bracelet', slot: 'bracelet', price: 240, sell: 60, durability: 9, desc: '防御 +2', stats: { def: 2 } },
  mystic_bracelet: { id: 'mystic_bracelet', name: '思贝儿手镯', type: 'bracelet', slot: 'bracelet', price: 760, sell: 180, durability: 8, reqLevel: 18, classes: ['wizard', 'taoist'], desc: '魔法与道术 +7', stats: { mag: 7, magDef: 2 } },
  pickaxe: { id: 'pickaxe', name: '鹤嘴锄', type: 'weapon', slot: 'weapon', price: 120, sell: 30, durability: 28, gatherTool: 'mining', desc: '采矿工具 · 攻击 +2', stats: { atk: 2 } },
  deer_meat: { id: 'deer_meat', name: '鹿肉', type: 'quest', price: 0, sell: 2, desc: '任务物品' },
  wolf_pelt: { id: 'wolf_pelt', name: '雪狼皮', type: 'quest', price: 0, sell: 6, desc: '毒蛇山谷雪狼掉落的任务物品' },
  zombie_arm: { id: 'zombie_arm', name: '僵尸臂', type: 'quest', price: 0, sell: 3, desc: '任务物品' },
  bone: { id: 'bone', name: '骷髅骨', type: 'quest', price: 0, sell: 4, desc: '任务物品' },
  wing_dust: { id: 'wing_dust', name: '蝠翼粉', type: 'quest', price: 0, sell: 5, desc: '任务物品' },
  boar_tusk: { id: 'boar_tusk', name: '红野猪獠牙', type: 'quest', price: 0, sell: 10, desc: '石墓红野猪掉落的任务物品' },
  centipede_shell: { id: 'centipede_shell', name: '蜈蚣甲壳', type: 'quest', price: 0, sell: 8, desc: '巨型蜈蚣掉落的任务物品' },
  orc_tooth: { id: 'orc_tooth', name: '沃玛号角', type: 'quest', price: 0, sell: 8, desc: '任务物品' },
  temple_token: { id: 'temple_token', name: '寺庙令牌', type: 'quest', price: 0, sell: 50, desc: '击败卫士的证明' },
  lord_seal: { id: 'lord_seal', name: '教主印记', type: 'quest', price: 0, sell: 120, desc: '击败沃玛教主的证明' },
  herb: { id: 'herb', name: '药草', type: 'material', price: 16, sell: 4, desc: '野外采集的药材' },
  copper_ore: { id: 'copper_ore', name: '铜矿石', type: 'material', price: 32, sell: 8, desc: '矿洞采集的基础矿石' },
  silver_ore: { id: 'silver_ore', name: '银矿石', type: 'material', price: 70, sell: 18, desc: '矿洞深处的稀有矿石' },
  black_iron: { id: 'black_iron', name: '黑铁矿石', type: 'material', price: 180, sell: 45, desc: '升级武器的核心材料；冲击 +4 起失败会碎裂武器' },
  blessing_oil: { id: 'blessing_oil', name: '祝福油', type: 'consumable', price: 600, sell: 150, desc: '为当前武器提升幸运，失败可能增加诅咒', use: { weaponLuck: true } },
  book_slash: { id: 'book_slash', name: '《基本剑术》', type: 'skillbook', classId: 'warrior', skillId: 'slash', price: 120, sell: 30, desc: '战士7级技能书' },
  book_thrust: { id: 'book_thrust', name: '《刺杀剑术》', type: 'skillbook', classId: 'warrior', skillId: 'thrust', price: 0, sell: 120, desc: '战士25级技能书' },
  book_fire_sword: { id: 'book_fire_sword', name: '《烈火剑法》', type: 'skillbook', classId: 'warrior', skillId: 'fire_sword', price: 0, sell: 420, desc: '战士35级高级技能书' },
  book_rush: { id: 'book_rush', name: '《野蛮冲撞》', type: 'skillbook', classId: 'warrior', skillId: 'rush', price: 0, sell: 220, desc: '战士30级技能书' },
  book_fireball: { id: 'book_fireball', name: '《火球术》', type: 'skillbook', classId: 'wizard', skillId: 'fireball', price: 120, sell: 30, desc: '法师7级技能书' },
  book_lightning: { id: 'book_lightning', name: '《雷电术》', type: 'skillbook', classId: 'wizard', skillId: 'lightning', price: 420, sell: 90, desc: '法师17级技能书' },
  book_burst: { id: 'book_burst', name: '《冰咆哮》', type: 'skillbook', classId: 'wizard', skillId: 'burst', price: 0, sell: 420, desc: '法师35级高级技能书' },
  book_shield: { id: 'book_shield', name: '《魔法盾》', type: 'skillbook', classId: 'wizard', skillId: 'shield', price: 0, sell: 240, desc: '法师31级技能书' },
  book_heal: { id: 'book_heal', name: '《治愈术》', type: 'skillbook', classId: 'taoist', skillId: 'heal', price: 120, sell: 30, desc: '道士7级技能书' },
  book_talisman: { id: 'book_talisman', name: '《灵魂火符》', type: 'skillbook', classId: 'taoist', skillId: 'talisman', price: 440, sell: 90, desc: '道士18级技能书' },
  book_poison: { id: 'book_poison', name: '《施毒术》', type: 'skillbook', classId: 'taoist', skillId: 'poison', price: 320, sell: 70, desc: '道士14级技能书' },
  book_summon: { id: 'book_summon', name: '《召唤骷髅》', type: 'skillbook', classId: 'taoist', skillId: 'summon', price: 520, sell: 110, desc: '道士19级技能书' },

  // 完整补给层：商店解决基础续航，大型药与太阳水保留为狩猎收益。
  hp_pot_l: {
    id: 'hp_pot_l', name: '金创药(大)', type: 'consumable', price: 0, sell: 55,
    rarity: 'fine', icon: 0, desc: '恢复 450 生命；高级猎区补给', use: { hp: 450 }, hotkey: 'f1',
  },
  mp_pot_l: {
    id: 'mp_pot_l', name: '魔法药(大)', type: 'consumable', price: 0, sell: 60,
    rarity: 'fine', icon: 1, desc: '恢复 420 魔法；高级猎区补给', use: { mp: 420 }, hotkey: 'f2',
  },
  sun_potion: {
    id: 'sun_potion', name: '太阳水', type: 'consumable', price: 0, sell: 75,
    rarity: 'rare', icon: 0, desc: '同时恢复 180 生命与 120 魔法', use: { hp: 180, mp: 120 },
  },
  strong_sun_potion: {
    id: 'strong_sun_potion', name: '强效太阳水', type: 'consumable', price: 0, sell: 180,
    rarity: 'epic', icon: 0, desc: '同时恢复 420 生命与 300 魔法', use: { hp: 420, mp: 300 },
  },
  random_scroll: {
    id: 'random_scroll', name: '随机传送卷', type: 'consumable', price: 75, sell: 20,
    rarity: 'common', icon: 2, desc: '脱离当前坐标，随机传送到本地图可行走区域', use: { randomTeleport: true },
  },
  dungeon_scroll: {
    id: 'dungeon_scroll', name: '地牢逃脱卷', type: 'consumable', price: 110, sell: 32,
    rarity: 'fine', icon: 2, desc: '从危险猎区撤回最近的安全出口', use: { dungeonEscape: true },
  },

  // 武器成长梯度：每个职业都有新手、过渡、沃玛与首领级目标。
  bronze_sword: {
    id: 'bronze_sword', name: '青铜剑', type: 'weapon', slot: 'weapon', price: 110, sell: 32,
    rarity: 'common', icon: 4, reqLevel: 3, durability: 20, desc: '新手近战兵器 · 攻击 +8', stats: { atk: 8 },
  },
  bronze_axe: {
    id: 'bronze_axe', name: '青铜斧', type: 'weapon', slot: 'weapon', price: 0, sell: 68,
    rarity: 'fine', icon: 4, reqLevel: 8, durability: 24, desc: '沉重短斧 · 攻击 +14', stats: { atk: 14 },
  },
  soul_breaker: {
    id: 'soul_breaker', name: '破魂', type: 'weapon', slot: 'weapon', price: 0, sell: 115,
    rarity: 'fine', icon: 4, reqLevel: 12, classes: ['warrior'], durability: 25,
    desc: '战士过渡武器 · 攻击 +16 暴击 +1%', stats: { atk: 16, crit: 0.01 },
  },
  horse_chopper: {
    id: 'horse_chopper', name: '斩马刀', type: 'weapon', slot: 'weapon', price: 0, sell: 165,
    rarity: 'rare', icon: 4, reqLevel: 15, classes: ['warrior'], durability: 28,
    desc: '战士重刃 · 攻击 +19 生命 +24', stats: { atk: 19, hp: 24 },
  },
  judgement: {
    id: 'judgement', name: '裁决之杖', type: 'weapon', slot: 'weapon', price: 0, sell: 820,
    rarity: 'epic', icon: 4, reqLevel: 35, classes: ['warrior'], durability: 32,
    desc: '首领级战士神兵 · 攻击 +34 暴击 +3%', stats: { atk: 34, crit: 0.03 },
  },
  ebony_sword: {
    id: 'ebony_sword', name: '乌木剑', type: 'weapon', slot: 'weapon', price: 150, sell: 40,
    rarity: 'common', icon: 4, reqLevel: 6, classes: ['wizard'], durability: 18,
    desc: '法师入门武器 · 魔法 +7 魔力 +14', stats: { mag: 7, mp: 14 },
  },
  wand: {
    id: 'wand', name: '魔杖', type: 'weapon', slot: 'weapon', price: 0, sell: 310,
    rarity: 'rare', icon: 4, reqLevel: 26, classes: ['wizard'], durability: 19,
    desc: '沃玛级法师武器 · 魔法 +25 魔力 +50', stats: { mag: 25, mp: 50 },
  },
  bone_staff: {
    id: 'bone_staff', name: '骨玉权杖', type: 'weapon', slot: 'weapon', price: 0, sell: 820,
    rarity: 'epic', icon: 4, reqLevel: 35, classes: ['wizard'], durability: 22,
    desc: '首领级法师权杖 · 魔法 +34 魔力 +70 暴击 +2%', stats: { mag: 34, mp: 70, crit: 0.02 },
  },
  half_moon: {
    id: 'half_moon', name: '半月', type: 'weapon', slot: 'weapon', price: 170, sell: 45,
    rarity: 'common', icon: 4, reqLevel: 6, classes: ['taoist'], durability: 20,
    desc: '道士入门兵刃 · 道术 +8 生命 +12', stats: { mag: 8, hp: 12 },
  },
  infinity_staff: {
    id: 'infinity_staff', name: '无极棍', type: 'weapon', slot: 'weapon', price: 0, sell: 330,
    rarity: 'rare', icon: 4, reqLevel: 25, classes: ['taoist'], durability: 25,
    desc: '沃玛级道士兵器 · 道术 +25 生命 +45', stats: { mag: 25, hp: 45 },
  },
  dragon_pattern_sword: {
    id: 'dragon_pattern_sword', name: '龙纹剑', type: 'weapon', slot: 'weapon', price: 0, sell: 820,
    rarity: 'epic', icon: 4, reqLevel: 35, classes: ['taoist'], durability: 28,
    desc: '首领级道士神兵 · 道术 +33 生命 +75 吸血 +3%', stats: { mag: 33, hp: 75, lifesteal: 0.03 },
  },

  // 衣服梯度。
  light_armor: {
    id: 'light_armor', name: '轻型盔甲', type: 'armor', slot: 'armor', price: 260, sell: 70,
    rarity: 'common', icon: 5, reqLevel: 7, durability: 24, desc: '通用轻甲 · 防御 +7 生命 +18', stats: { def: 7, hp: 18 },
  },
  medium_armor: {
    id: 'medium_armor', name: '中型盔甲', type: 'armor', slot: 'armor', price: 0, sell: 150,
    rarity: 'fine', icon: 5, reqLevel: 14, durability: 27, desc: '通用战甲 · 防御 +10 魔防 +3 生命 +30', stats: { def: 10, magDef: 3, hp: 30 },
  },
  war_god_armor: {
    id: 'war_god_armor', name: '战神盔甲', type: 'armor', slot: 'armor', price: 0, sell: 620,
    rarity: 'epic', icon: 5, reqLevel: 30, classes: ['warrior'], durability: 34,
    desc: '战士高阶重甲 · 防御 +22 生命 +110', stats: { def: 22, hp: 110 },
  },
  demon_robe: {
    id: 'demon_robe', name: '恶魔长袍', type: 'armor', slot: 'armor', price: 0, sell: 620,
    rarity: 'epic', icon: 5, reqLevel: 30, classes: ['wizard'], durability: 26,
    desc: '法师高阶长袍 · 防御 +14 魔防 +9 魔法 +10 魔力 +90', stats: { def: 14, magDef: 9, mag: 10, mp: 90 },
  },
  ghost_robe: {
    id: 'ghost_robe', name: '幽灵战衣', type: 'armor', slot: 'armor', price: 0, sell: 620,
    rarity: 'epic', icon: 5, reqLevel: 30, classes: ['taoist'], durability: 28,
    desc: '道士高阶战衣 · 防御 +15 魔防 +8 道术 +10 生命 +70', stats: { def: 15, magDef: 8, mag: 10, hp: 70 },
  },

  // 戒指梯度。
  bronze_ring: {
    id: 'bronze_ring', name: '古铜戒指', type: 'ring', slot: 'ring', price: 90, sell: 24,
    rarity: 'common', icon: 1, reqLevel: 3, durability: 8, desc: '基础戒指 · 防御 +1 生命 +8', stats: { def: 1, hp: 8 },
  },
  horn_ring: {
    id: 'horn_ring', name: '牛角戒指', type: 'ring', slot: 'ring', price: 0, sell: 40,
    rarity: 'common', icon: 1, reqLevel: 7, durability: 8, desc: '近战戒指 · 攻击 +3', stats: { atk: 3 },
  },
  blue_crystal_ring: {
    id: 'blue_crystal_ring', name: '蓝色水晶戒指', type: 'ring', slot: 'ring', price: 0, sell: 58,
    rarity: 'fine', icon: 1, reqLevel: 10, durability: 8, classes: ['wizard'],
    desc: '法师戒指 · 魔法 +4 魔力 +12', stats: { mag: 4, mp: 12 },
  },
  pearl_ring: {
    id: 'pearl_ring', name: '珍珠戒指', type: 'ring', slot: 'ring', price: 0, sell: 58,
    rarity: 'fine', icon: 1, reqLevel: 10, durability: 8, classes: ['taoist'],
    desc: '道士戒指 · 道术 +4 生命 +15', stats: { mag: 4, hp: 15 },
  },
  coral_ring: {
    id: 'coral_ring', name: '珊瑚戒指', type: 'ring', slot: 'ring', price: 0, sell: 135,
    rarity: 'rare', icon: 1, reqLevel: 20, durability: 7, classes: ['warrior'],
    desc: '战士戒指 · 攻击 +7 生命 +18', stats: { atk: 7, hp: 18 },
  },
  red_gem_ring: {
    id: 'red_gem_ring', name: '红宝石戒指', type: 'ring', slot: 'ring', price: 0, sell: 230,
    rarity: 'rare', icon: 1, reqLevel: 25, durability: 7, classes: ['wizard'],
    desc: '沃玛级法师戒指 · 魔法 +9 暴击 +1%', stats: { mag: 9, crit: 0.01 },
  },
  platinum_ring: {
    id: 'platinum_ring', name: '铂金戒指', type: 'ring', slot: 'ring', price: 0, sell: 230,
    rarity: 'rare', icon: 1, reqLevel: 25, durability: 7, classes: ['taoist'],
    desc: '沃玛级道士戒指 · 道术 +9 魔防 +3', stats: { mag: 9, magDef: 3 },
  },
  dragon_ring: {
    id: 'dragon_ring', name: '龙之戒指', type: 'ring', slot: 'ring', price: 0, sell: 360,
    rarity: 'epic', icon: 1, reqLevel: 30, durability: 7, classes: ['warrior'],
    desc: '高阶战士戒指 · 攻击 +11 暴击 +2%', stats: { atk: 11, crit: 0.02 },
  },

  // 项链梯度。
  traditional_necklace: {
    id: 'traditional_necklace', name: '传统项链', type: 'necklace', slot: 'necklace', price: 95, sell: 26,
    rarity: 'common', icon: 2, reqLevel: 3, durability: 8, desc: '基础项链 · 生命 +16', stats: { hp: 16 },
  },
  ebony_necklace: {
    id: 'ebony_necklace', name: '黑檀项链', type: 'necklace', slot: 'necklace', price: 0, sell: 45,
    rarity: 'common', icon: 2, reqLevel: 7, durability: 8, classes: ['wizard'],
    desc: '法师项链 · 魔法 +3 魔力 +12', stats: { mag: 3, mp: 12 },
  },
  tiger_tooth_necklace: {
    id: 'tiger_tooth_necklace', name: '白色虎齿项链', type: 'necklace', slot: 'necklace', price: 0, sell: 75,
    rarity: 'fine', icon: 2, reqLevel: 12, durability: 8,
    desc: '灵巧项链 · 魔防 +3 闪避 +2%', stats: { magDef: 3, dodge: 0.02 },
  },
  phoenix_necklace: {
    id: 'phoenix_necklace', name: '凤凰明珠', type: 'necklace', slot: 'necklace', price: 0, sell: 105,
    rarity: 'fine', icon: 2, reqLevel: 15, durability: 8, classes: ['taoist'],
    desc: '道士项链 · 道术 +5 生命 +28', stats: { mag: 5, hp: 28 },
  },
  magnifier: {
    id: 'magnifier', name: '放大镜', type: 'necklace', slot: 'necklace', price: 0, sell: 105,
    rarity: 'fine', icon: 2, reqLevel: 18, durability: 8, classes: ['wizard'],
    desc: '法师项链 · 魔法 +6 魔力 +28', stats: { mag: 6, mp: 28 },
  },
  life_necklace: {
    id: 'life_necklace', name: '生命项链', type: 'necklace', slot: 'necklace', price: 0, sell: 270,
    rarity: 'rare', icon: 2, reqLevel: 25, durability: 8, classes: ['wizard'],
    desc: '沃玛级法师项链 · 魔法 +9 魔力 +55', stats: { mag: 9, mp: 55 },
  },
  soul_necklace: {
    id: 'soul_necklace', name: '灵魂项链', type: 'necklace', slot: 'necklace', price: 0, sell: 270,
    rarity: 'rare', icon: 2, reqLevel: 25, durability: 8, classes: ['taoist'],
    desc: '沃玛级道士项链 · 道术 +9 生命 +55', stats: { mag: 9, hp: 55 },
  },
  green_necklace: {
    id: 'green_necklace', name: '绿色项链', type: 'necklace', slot: 'necklace', price: 0, sell: 390,
    rarity: 'epic', icon: 2, reqLevel: 30, durability: 8, classes: ['warrior'],
    desc: '高阶战士项链 · 攻击 +11 生命 +60', stats: { atk: 11, hp: 60 },
  },

  // 头盔梯度。
  leather_helmet: {
    id: 'leather_helmet', name: '皮制头盔', type: 'helmet', slot: 'helmet', price: 80, sell: 22,
    rarity: 'common', icon: 5, reqLevel: 3, durability: 11, desc: '基础头盔 · 防御 +2', stats: { def: 2 },
  },
  magic_helmet: {
    id: 'magic_helmet', name: '魔法头盔', type: 'helmet', slot: 'helmet', price: 0, sell: 75,
    rarity: 'fine', icon: 5, reqLevel: 12, durability: 12, desc: '轻型法盔 · 防御 +4 魔防 +3 魔力 +12', stats: { def: 4, magDef: 3, mp: 12 },
  },
  taoist_helmet: {
    id: 'taoist_helmet', name: '道士头盔', type: 'helmet', slot: 'helmet', price: 0, sell: 95,
    rarity: 'fine', icon: 5, reqLevel: 15, durability: 12, classes: ['taoist'],
    desc: '道士法冠 · 防御 +4 魔防 +4 道术 +3', stats: { def: 4, magDef: 4, mag: 3 },
  },
  black_iron_helmet: {
    id: 'black_iron_helmet', name: '黑铁头盔', type: 'helmet', slot: 'helmet', price: 0, sell: 380,
    rarity: 'epic', icon: 5, reqLevel: 28, durability: 18,
    desc: '高阶重盔 · 防御 +13 魔防 +7 生命 +55', stats: { def: 13, magDef: 7, hp: 55 },
  },

  // 手镯与手套梯度。
  silver_bracelet: {
    id: 'silver_bracelet', name: '银手镯', type: 'bracelet', slot: 'bracelet', price: 75, sell: 20,
    rarity: 'common', icon: 1, reqLevel: 3, durability: 9, desc: '基础手镯 · 魔防 +1 魔力 +5', stats: { magDef: 1, mp: 5 },
  },
  large_bracelet: {
    id: 'large_bracelet', name: '大手镯', type: 'bracelet', slot: 'bracelet', price: 0, sell: 45,
    rarity: 'fine', icon: 1, reqLevel: 8, durability: 10, desc: '防御手镯 · 防御 +3', stats: { def: 3 },
  },
  sturdy_glove: {
    id: 'sturdy_glove', name: '坚固手套', type: 'bracelet', slot: 'bracelet', price: 0, sell: 72,
    rarity: 'fine', icon: 1, reqLevel: 12, durability: 12, desc: '耐用手套 · 防御 +4 生命 +18', stats: { def: 4, hp: 18 },
  },
  death_glove: {
    id: 'death_glove', name: '死神手套', type: 'bracelet', slot: 'bracelet', price: 0, sell: 145,
    rarity: 'rare', icon: 1, reqLevel: 20, durability: 10, classes: ['warrior'],
    desc: '战士手套 · 攻击 +6 防御 +2', stats: { atk: 6, def: 2 },
  },
  ghost_glove: {
    id: 'ghost_glove', name: '幽灵手套', type: 'bracelet', slot: 'bracelet', price: 0, sell: 145,
    rarity: 'rare', icon: 1, reqLevel: 20, durability: 9, classes: ['taoist'],
    desc: '道士手套 · 道术 +5 魔防 +3', stats: { mag: 5, magDef: 3 },
  },
  three_eye_bracelet: {
    id: 'three_eye_bracelet', name: '三眼手镯', type: 'bracelet', slot: 'bracelet', price: 0, sell: 330,
    rarity: 'epic', icon: 1, reqLevel: 28, durability: 9, classes: ['taoist'],
    desc: '高阶道士手镯 · 道术 +8 生命 +38', stats: { mag: 8, hp: 38 },
  },
  dragon_bracelet: {
    id: 'dragon_bracelet', name: '龙之手镯', type: 'bracelet', slot: 'bracelet', price: 0, sell: 330,
    rarity: 'epic', icon: 1, reqLevel: 28, durability: 9, classes: ['wizard'],
    desc: '高阶法师手镯 · 魔法 +8 暴击 +1%', stats: { mag: 8, crit: 0.01 },
  },

  // 可出售战利品，让每个猎区都有稳定的现金流，而不只依赖极低概率装备。
  deer_hide: { id: 'deer_hide', name: '完整鹿皮', type: 'material', price: 0, sell: 5, rarity: 'common', icon: 3, desc: '鹿类战利品；药铺与裁缝收购' },
  wolf_fang: { id: 'wolf_fang', name: '锋利狼牙', type: 'material', price: 0, sell: 9, rarity: 'common', icon: 3, desc: '山谷战利品；可直接卖店换取补给' },
  grave_dust: { id: 'grave_dust', name: '墓穴磷粉', type: 'material', price: 0, sell: 7, rarity: 'common', icon: 3, desc: '不死生物残留；药铺收购' },
  bat_wing: { id: 'bat_wing', name: '完整蝠翼', type: 'material', price: 0, sell: 8, rarity: 'common', icon: 3, desc: '洞穴蝙蝠战利品；杂货铺收购' },
  boar_hide: { id: 'boar_hide', name: '厚实猪皮', type: 'material', price: 0, sell: 18, rarity: 'fine', icon: 3, desc: '石墓战利品；制作重甲的皮料' },
  venom_sac: { id: 'venom_sac', name: '毒囊', type: 'material', price: 0, sell: 22, rarity: 'fine', icon: 3, desc: '蜈蚣类战利品；炼药师高价收购' },
  orc_badge: { id: 'orc_badge', name: '沃玛徽记', type: 'material', price: 0, sell: 30, rarity: 'fine', icon: 3, desc: '沃玛战士身份徽记；城防军收购' },
  guardian_core: { id: 'guardian_core', name: '卫士核心', type: 'material', price: 0, sell: 85, rarity: 'rare', icon: 3, desc: '沃玛卫士精华；高级锻造材料' },
  lord_crystal: { id: 'lord_crystal', name: '教主结晶', type: 'material', price: 0, sell: 240, rarity: 'epic', icon: 3, desc: '沃玛教主凝结的力量；极高价值战利品' },
};

Object.assign(ITEMS.wood_sword, { rarity: 'common', icon: 3 });
Object.assign(ITEMS.pickaxe, { rarity: 'common', icon: 4 });
Object.assign(ITEMS.iron_sword, { rarity: 'fine', icon: 4, reqLevel: 5 });
Object.assign(ITEMS.crescent_blade, { rarity: 'rare', icon: 4, reqLevel: 18 });
Object.assign(ITEMS.steel_sword, { rarity: 'epic', icon: 4, reqLevel: 26 });
Object.assign(ITEMS.dragon_blade, { rarity: 'legendary', icon: 4, reqLevel: 35, classes: ['warrior'], stats: { atk: 42, hp: 60, crit: 0.04 } });
Object.assign(ITEMS.apprentice_staff, { rarity: 'rare', icon: 4, reqLevel: 15 });
Object.assign(ITEMS.crescent_staff, { rarity: 'epic', icon: 4, reqLevel: 20 });
Object.assign(ITEMS.dragon_staff, { rarity: 'legendary', icon: 4, reqLevel: 35 });
Object.assign(ITEMS.spirit_sword, { rarity: 'rare', icon: 4, reqLevel: 20 });
Object.assign(ITEMS.silver_serpent, { rarity: 'epic', icon: 4, reqLevel: 26 });
Object.assign(ITEMS.celestial_talisman, { rarity: 'legendary', icon: 2, reqLevel: 35 });
Object.assign(ITEMS.cloth, { rarity: 'common', icon: 5 });
Object.assign(ITEMS.heavy_armor, { rarity: 'epic', icon: 5, reqLevel: 22 });
Object.assign(ITEMS.mage_robe, { rarity: 'epic', icon: 5, reqLevel: 22 });
Object.assign(ITEMS.soul_robe, { rarity: 'epic', icon: 5, reqLevel: 22 });
Object.assign(ITEMS.magic_ring, { rarity: 'rare', icon: 1, reqLevel: 10, stats: { mag: 10, crit: 0.02 } });
Object.assign(ITEMS.power_ring, { rarity: 'rare', icon: 1, reqLevel: 10, stats: { atk: 8, crit: 0.02 } });
Object.assign(ITEMS.necklace, { rarity: 'fine', icon: 2, reqLevel: 8 });
Object.assign(ITEMS.helmet, { rarity: 'fine', icon: 5, reqLevel: 6 });
Object.assign(ITEMS.skull_helmet, { rarity: 'rare', icon: 5, reqLevel: 20 });
Object.assign(ITEMS.iron_bracelet, { rarity: 'fine', icon: 1 });
Object.assign(ITEMS.mystic_bracelet, { rarity: 'rare', icon: 1 });
Object.assign(ITEMS.hp_pot, { rarity: 'common', icon: 0 });
Object.assign(ITEMS.hp_pot_b, { rarity: 'fine', icon: 0 });
Object.assign(ITEMS.mp_pot, { rarity: 'common', icon: 1 });
Object.assign(ITEMS.mp_pot_b, { rarity: 'fine', icon: 1 });
Object.assign(ITEMS.recall, { rarity: 'fine', icon: 2 });
Object.assign(ITEMS.herb, { rarity: 'common', icon: 3 });
Object.assign(ITEMS.copper_ore, { rarity: 'common', icon: 4 });
Object.assign(ITEMS.silver_ore, { rarity: 'fine', icon: 4 });
Object.assign(ITEMS.black_iron, { rarity: 'rare', icon: 4 });
Object.assign(ITEMS.blessing_oil, { rarity: 'epic', icon: 0 });
for (const item of Object.values(ITEMS)) {
  if (item.slot && !item.durability) {
    item.durability = item.slot === 'weapon' ? 18 : item.slot === 'armor' ? 22 : item.slot === 'helmet' ? 12 : 8;
  }
}
for (const item of Object.values(ITEMS)) {
  if (item.type === 'skillbook') Object.assign(item, { rarity: item.skillId === 'fire_sword' || item.skillId === 'burst' ? 'epic' : 'rare', icon: 2 });
}
for (const item of Object.values(ITEMS)) item.rarity ||= item.type === 'quest' ? 'fine' : 'common';

export const SHOP_TOWN = [
  'hp_pot', 'hp_pot_b', 'mp_pot', 'mp_pot_b', 'recall', 'random_scroll', 'dungeon_scroll',
  'wood_sword', 'bronze_sword', 'pickaxe', 'iron_sword', 'ebony_sword', 'half_moon',
  'cloth', 'light_armor', 'leather_helmet', 'helmet',
  'silver_bracelet', 'iron_bracelet', 'traditional_necklace', 'bronze_ring',
  'book_slash', 'book_fireball', 'book_heal', 'book_poison', 'book_lightning', 'book_talisman', 'book_summon',
];

/** 可重复采集资源。资源点耗尽后在本地地图内定时刷新。 */
export const GATHER_DEFS = {
  herb: {
    id: 'herb', name: '药草丛', scenery: 'bush', tool: null,
    charges: 2, respawn: 24, gatherTime: 0.7,
    loot: [{ id: 'herb', chance: 1, min: 1, max: 2 }],
  },
  copper: {
    id: 'copper', name: '铜矿脉', scenery: 'rock_small', tool: 'mining',
    charges: 3, respawn: 34, gatherTime: 1.1,
    loot: [
      { id: 'copper_ore', chance: 1, min: 1, max: 2 },
      { id: 'silver_ore', chance: 0.16, min: 1, max: 1 },
    ],
  },
  black_iron: {
    id: 'black_iron', name: '黑铁矿脉', scenery: 'rock', tool: 'mining',
    charges: 2, respawn: 52, gatherTime: 1.35,
    loot: [
      { id: 'silver_ore', chance: 0.72, min: 1, max: 2 },
      { id: 'black_iron', chance: 0.22, min: 1, max: 1 },
    ],
  },
};

/** 生活制造把野外采集材料接回补给与强化循环。 */
export const RECIPES = {
  hp_bundle: {
    id: 'hp_bundle', name: '熬制金创药', gold: 20,
    materials: [{ id: 'herb', qty: 3 }],
    outputs: [{ id: 'hp_pot', qty: 5 }],
  },
  mp_bundle: {
    id: 'mp_bundle', name: '熬制魔法药', gold: 30,
    materials: [{ id: 'herb', qty: 3 }, { id: 'copper_ore', qty: 1 }],
    outputs: [{ id: 'mp_pot', qty: 5 }],
  },
  refine_black_iron: {
    id: 'refine_black_iron', name: '精炼黑铁矿', gold: 90,
    materials: [{ id: 'copper_ore', qty: 5 }, { id: 'silver_ore', qty: 2 }],
    outputs: [{ id: 'black_iron', qty: 1 }],
  },
  distill_blessing: {
    id: 'distill_blessing', name: '调制祝福油', gold: 260,
    materials: [{ id: 'herb', qty: 4 }, { id: 'silver_ore', qty: 3 }, { id: 'black_iron', qty: 1 }],
    outputs: [{ id: 'blessing_oil', qty: 1 }],
  },
  large_hp_bundle: {
    id: 'large_hp_bundle', name: '炼制大金创药', gold: 75,
    materials: [{ id: 'herb', qty: 6 }, { id: 'boar_hide', qty: 1 }],
    outputs: [{ id: 'hp_pot_l', qty: 3 }],
  },
  large_mp_bundle: {
    id: 'large_mp_bundle', name: '炼制大魔法药', gold: 85,
    materials: [{ id: 'herb', qty: 5 }, { id: 'venom_sac', qty: 1 }],
    outputs: [{ id: 'mp_pot_l', qty: 3 }],
  },
  brew_sun_potion: {
    id: 'brew_sun_potion', name: '调制太阳水', gold: 120,
    materials: [{ id: 'herb', qty: 5 }, { id: 'venom_sac', qty: 2 }, { id: 'silver_ore', qty: 1 }],
    outputs: [{ id: 'sun_potion', qty: 2 }],
  },
  stitch_light_armor: {
    id: 'stitch_light_armor', name: '缝制轻型盔甲', gold: 95,
    materials: [{ id: 'deer_hide', qty: 6 }, { id: 'wolf_fang', qty: 2 }],
    outputs: [{ id: 'light_armor', qty: 1 }],
  },
  forge_sturdy_glove: {
    id: 'forge_sturdy_glove', name: '打造坚固手套', gold: 135,
    materials: [{ id: 'boar_hide', qty: 3 }, { id: 'copper_ore', qty: 3 }],
    outputs: [{ id: 'sturdy_glove', qty: 1 }],
  },
};

/**
 * 物品图鉴元数据。来源从真实配置反向生成，避免界面说明和掉落表各写一套后逐渐失真。
 * 每件物品都会得到分类、用途、来源、市场价值和堆叠上限。
 */
for (const item of Object.values(ITEMS)) {
  const monsterSources = Object.values(MONSTERS)
    .filter((monster) => monster.drops?.some((drop) => drop.id === item.id))
    .map((monster) => monster.name);
  const recipeSources = Object.values(RECIPES)
    .filter((recipe) => recipe.outputs.some((output) => output.id === item.id))
    .map((recipe) => recipe.name);
  const gatherSources = Object.values(GATHER_DEFS)
    .filter((node) => node.loot.some((drop) => drop.id === item.id))
    .map((node) => `采集·${node.name}`);
  const sources = [
    SHOP_TOWN.includes(item.id) ? '比奇商店' : null,
    ...monsterSources.slice(0, 4),
    ...gatherSources.slice(0, 2),
    ...recipeSources.slice(0, 2),
  ].filter(Boolean);
  if (monsterSources.length > 4) sources.push(`另有 ${monsterSources.length - 4} 类怪物`);
  item.category = ITEM_TYPE_NAMES[item.type] || '其他';
  item.stackLimit = ['consumable', 'quest', 'material'].includes(item.type) ? 999 : 1;
  item.source = sources.length
    ? [...new Set(sources)].join('、')
    : item.type === 'quest'
      ? '主线任务、首领证明或特殊玩法'
      : '任务奖励、玩家交易或后续猎区';
  item.useHint = item.type === 'skillbook'
    ? `达到对应等级后由${item.classId === 'warrior' ? '战士' : item.classId === 'wizard' ? '法师' : '道士'}研读，技能书消耗 1 本`
    : item.slot
      ? `${item.reqLevel ? `需要 Lv.${item.reqLevel}` : '无等级限制'}${item.classes?.length ? ` · 限${item.classes.map((id) => CLASSES[id]?.name || id).join('/')}` : ' · 三职业通用'}`
      : item.type === 'material'
        ? '可卖店换取金币；部分材料还能用于生活制造或武器强化'
        : item.type === 'quest'
          ? '用于任务、行会、攻城或首领资格，受系统保护且不可出售'
          : '双击背包格或使用对应快捷键立即使用';
  item.market = item.type === 'quest'
    ? '关键物品 · 不可出售'
    : SHOP_TOWN.includes(item.id)
    ? `商店 ${item.price} 金 · 回售 ${item.sell || 0} 金`
    : item.sell > 0
      ? `怪物产出 · 回售 ${item.sell} 金`
      : '不可从常规商店购买';
}

/** 主线结束后的循环悬赏只提供成长材料，不直接出售或赠送毕业装备。 */
export const BOUNTIES = [
  {
    id: 'bounty_undead', name: '尸王悬赏', monster: 'zombie_miner', count: 18, reqLevel: 12,
    reward: { xp: 720, gold: 320, items: [{ id: 'black_iron', qty: 1 }] },
  },
  {
    id: 'bounty_hive', name: '蜈蚣清剿', monster: 'centipede', count: 16, reqLevel: 16,
    reward: { xp: 980, gold: 460, items: [{ id: 'silver_ore', qty: 2 }] },
  },
  {
    id: 'bounty_boar', name: '石墓围猎', monster: 'boar', count: 14, reqLevel: 20,
    reward: { xp: 1280, gold: 620, items: [{ id: 'black_iron', qty: 2 }] },
  },
  {
    id: 'bounty_woma', name: '沃玛讨伐', monster: 'orc', count: 18, reqLevel: 23,
    reward: { xp: 1680, gold: 780, items: [{ id: 'black_iron', qty: 2 }, { id: 'hp_pot_b', qty: 3 }] },
  },
  {
    id: 'bounty_guardian', name: '卫士猎令', monster: 'guardian', count: 2, reqLevel: 26,
    reward: { xp: 2200, gold: 980, items: [{ id: 'black_iron', qty: 3 }] },
  },
];

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: '初战告捷', desc: '击败第一只怪物', check: (p) => p.totalKills >= 1, reward: 50 },
  { id: 'hunter', name: '百战猎人', desc: '累计击败 50 只怪物', check: (p) => p.totalKills >= 50, reward: 300 },
  { id: 'level_10', name: '初窥门径', desc: '角色达到 10 级', check: (p) => p.level >= 10, reward: 300 },
  { id: 'level_20', name: '独当一面', desc: '角色达到 20 级', check: (p) => p.level >= 20, reward: 700 },
  { id: 'level_35', name: '宗师之境', desc: '角色达到 35 级', check: (p) => p.level >= 35, reward: 1800 },
  { id: 'rich', name: '腰缠万贯', desc: '持有 2,000 金币', check: (p) => p.gold >= 2000, reward: 500 },
  { id: 'geared', name: '全副武装', desc: '穿满八个装备部位', check: (p) => EQUIP_SLOTS.every((s) => !!p.equip[s]), reward: 500 },
  { id: 'forge_5', name: '铁匠之友', desc: '武器升级到 +5', check: (p) => (p.enhance.weapon || 0) >= 5, reward: 800 },
  { id: 'lord_slayer', name: '沃玛终结者', desc: '击败沃玛教主', check: (p) => (p.killCounts.lord || 0) >= 1, reward: 1500 },
  { id: 'lord_hunter', name: '教主梦魇', desc: '累计击败沃玛教主 10 次', check: (p) => (p.killCounts.lord || 0) >= 10, reward: 3200 },
  { id: 'luck_7', name: '刀刀上限', desc: '拥有幸运 +7 的武器', check: (p) => (p.equip?.weapon?.luck || 0) >= 7, reward: 1600 },
  { id: 'bounty_10', name: '玛法猎人', desc: '完成 10 轮循环悬赏', check: (p) => (p.bountyCompletions || 0) >= 10, reward: 2200 },
  { id: 'sabac_win', name: '沙城荣耀', desc: '随行会占领沙巴克', check: (p) => (p.sabacWins || 0) >= 1, reward: 3000 },
  { id: 'skill_master', name: '技艺精通', desc: '任意技能修炼到3级', check: (p) => Object.values(p.skills || {}).some((skill) => skill.level >= SKILL_MAX_LEVEL), reward: 900 },
];

export const LEVEL_XP = (() => {
  const a = [0];
  for (let i = 1; i <= 50; i++) a.push(Math.floor(50 + i * 40 + i * i * 10));
  return a;
})();

/** 场景布局以 40×30 逻辑稿编写，导出时扩展为商业跑图尺度。1=实体结构 0=可行走。 */
function blankMap(fill = 0) {
  return Array.from(
    { length: AUTHORING_WORLD.rows },
    () => Array(AUTHORING_WORLD.cols).fill(fill),
  );
}
function ringWalls(grid, margin = 0) {
  const g = grid.map((r) => r.slice());
  for (let y = 0; y < AUTHORING_WORLD.rows; y++) {
    for (let x = 0; x < AUTHORING_WORLD.cols; x++) {
      if (
        x <= margin
        || y <= margin
        || x >= AUTHORING_WORLD.cols - 1 - margin
        || y >= AUTHORING_WORLD.rows - 1 - margin
      ) g[y][x] = 1;
    }
  }
  return g;
}
function rect(g, x0, y0, x1, y1, v = 1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && g[y][x] !== undefined) g[y][x] = v;
}
function disk(g, cx, cy, radius, v = 0) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if (g[y]?.[x] === undefined) continue;
      if (Math.hypot(x - cx, y - cy) <= radius) g[y][x] = v;
    }
  }
}
function strokeGrid(g, points, radius = 1, v = 0) {
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 3;
    for (let s = 0; s <= steps; s++) {
      const t = steps ? s / steps : 0;
      disk(g, ax + (bx - ax) * t, ay + (by - ay) * t, radius, v);
    }
  }
}
function pathTiles(points, radius = 1) {
  const g = blankMap(1);
  strokeGrid(g, points, radius, 0);
  const out = [];
  for (let y = 1; y < AUTHORING_WORLD.rows - 1; y++) {
    for (let x = 1; x < AUTHORING_WORLD.cols - 1; x++) {
      if (g[y][x] === 0) out.push({ x, y });
    }
  }
  return out;
}

// 比奇城：建筑围绕市政广场，东西主街与南门轴线保持畅通。
const townGrid = ringWalls(blankMap(0), 0);
rect(townGrid, 4, 4, 11, 9, 1);
rect(townGrid, 28, 4, 35, 9, 1);
rect(townGrid, 4, 20, 12, 25, 1);
rect(townGrid, 27, 20, 35, 25, 1);
rect(townGrid, 7, 9, 9, 9, 0);
rect(townGrid, 30, 9, 32, 9, 0);
rect(townGrid, 8, 20, 10, 20, 0);
rect(townGrid, 30, 20, 32, 20, 0);

// 盟重省：岩脊留出一条由城门通往边境营地、墓地与矿洞的 S 形商道。
const fieldGrid = ringWalls(blankMap(0), 0);
rect(fieldGrid, 8, 4, 11, 7, 1);
rect(fieldGrid, 18, 20, 22, 23, 1);
rect(fieldGrid, 29, 5, 33, 8, 1);
rect(fieldGrid, 29, 22, 34, 25, 1);

// 废弃矿洞：入口前室 → 支护巷道 → 升降机井 → 东侧深矿层。
const caveGrid = blankMap(1);
rect(caveGrid, 1, 11, 8, 18, 0);
strokeGrid(caveGrid, [[7, 14], [13, 14], [17, 10], [22, 10], [25, 14], [31, 14], [37, 14]], 2, 0);
disk(caveGrid, 17, 9, 4, 0);
disk(caveGrid, 23, 20, 5, 0);
disk(caveGrid, 33, 8, 4, 0);
strokeGrid(caveGrid, [[23, 14], [23, 20], [30, 25]], 2, 0);
rect(caveGrid, 36, 12, 38, 16, 0);

// 毒蛇山谷：两道潮湿岩脊夹出蛇形谷路，南北各有生态缓冲区。
const valleyGrid = ringWalls(blankMap(0), 0);
strokeGrid(valleyGrid, [[10, 3], [14, 8], [12, 13], [17, 18], [14, 26]], 2, 1);
strokeGrid(valleyGrid, [[29, 3], [25, 8], [28, 14], [23, 19], [27, 26]], 2, 1);
strokeGrid(valleyGrid, [[2, 14], [8, 14], [13, 16], [19, 14], [25, 16], [31, 14], [37, 14]], 2, 0);
disk(valleyGrid, 8, 22, 4, 0);
disk(valleyGrid, 32, 7, 4, 0);

// 石墓阵：外回廊、四座耳室和中央陪葬庭院构成真正的墓葬结构。
const tombGrid = blankMap(1);
rect(tombGrid, 2, 11, 10, 18, 0);
rect(tombGrid, 8, 6, 31, 23, 0);
rect(tombGrid, 12, 9, 27, 20, 1);
rect(tombGrid, 16, 11, 23, 18, 0);
rect(tombGrid, 8, 13, 16, 16, 0);
rect(tombGrid, 23, 13, 31, 16, 0);
rect(tombGrid, 18, 6, 21, 12, 0);
rect(tombGrid, 18, 18, 21, 23, 0);
disk(tombGrid, 10, 8, 3, 0);
disk(tombGrid, 29, 8, 3, 0);
disk(tombGrid, 10, 21, 3, 0);
disk(tombGrid, 29, 21, 3, 0);

// 蜈蚣洞：天然巢室以弯曲洞道相连，中心母巢与外围矿脉互不混叠。
const centipedeGrid = blankMap(1);
const centipedeRooms = [[4, 14, 4], [11, 9, 4], [17, 17, 5], [25, 9, 5], [32, 18, 5], [36, 25, 3]];
for (const [x, y, r] of centipedeRooms) disk(centipedeGrid, x, y, r, 0);
strokeGrid(centipedeGrid, [[4, 14], [11, 9], [17, 17], [25, 9], [32, 18], [36, 25]], 2, 0);

// 沃玛寺庙：门厅、双翼礼拜室、仪式长廊与东端主祭坛严格对称。
const templeGrid = blankMap(1);
rect(templeGrid, 1, 11, 8, 18, 0);
rect(templeGrid, 7, 9, 15, 20, 0);
rect(templeGrid, 14, 12, 31, 17, 0);
rect(templeGrid, 18, 5, 27, 11, 0);
rect(templeGrid, 18, 18, 27, 24, 0);
rect(templeGrid, 30, 8, 38, 21, 0);
rect(templeGrid, 36, 12, 38, 17, 0);
// 柱列不是整块房间墙，刻意留下视线与战斗通道。
for (const x of [17, 22, 27]) {
  rect(templeGrid, x, 10, x, 11, 1);
  rect(templeGrid, x, 18, x, 19, 1);
}

// 沃玛内殿：收束式献祭长廊通往孤立王座平台，Boss 不再与杂兵堆叠。
const sanctumGrid = blankMap(1);
rect(sanctumGrid, 1, 11, 11, 18, 0);
strokeGrid(sanctumGrid, [[10, 14], [18, 14], [24, 14], [29, 14]], 2, 0);
disk(sanctumGrid, 17, 14, 5, 0);
disk(sanctumGrid, 29, 14, 7, 0);
rect(sanctumGrid, 34, 11, 38, 17, 0);
for (const [x, y] of [[12, 9], [12, 20], [23, 8], [23, 21]]) disk(sanctumGrid, x, y, 2, 0);

// 沙巴克：南门、外瓮城、军市、内宫与皇旗轴线层层递进。
const sabacGrid = ringWalls(blankMap(0), 0);
rect(sabacGrid, 5, 5, 34, 6, 1);
rect(sabacGrid, 5, 6, 6, 26, 1);
rect(sabacGrid, 33, 6, 34, 26, 1);
rect(sabacGrid, 5, 25, 34, 26, 1);
rect(sabacGrid, 18, 25, 21, 26, 0);
rect(sabacGrid, 12, 8, 27, 9, 1);
rect(sabacGrid, 12, 9, 13, 17, 1);
rect(sabacGrid, 26, 9, 27, 17, 1);
rect(sabacGrid, 12, 16, 27, 17, 1);
rect(sabacGrid, 18, 16, 21, 17, 0);
rect(sabacGrid, 18, 8, 21, 9, 0);

/** 场景装饰图集（脚底锚点精灵 / 地表贴图） */
export const SCENERY = {
  // 高度按透明像素主体而非 256×256 外框标定：成年人可见高度约 72px。
  house_a: { src: 'assets/game/scenery/house_a.png', h: 330, anchor: 0.94, block: false },
  house_b: { src: 'assets/game/scenery/house_b.png', h: 360, anchor: 0.94, block: false },
  wall: { src: 'assets/game/scenery/wall.png', h: 104, anchor: 0.95, block: false },
  tree: { src: 'assets/game/scenery/tree.png', h: 150, anchor: 0.96, block: true, blockRadius: 0.68 },
  pine: { src: 'assets/game/scenery/pine.png', h: 164, anchor: 0.96, block: true, blockRadius: 0.65 },
  tree_old: {
    src: 'assets/game/scenery/tree_old.png', h: 186, anchor: 0.965, block: true,
    blockRadius: 0.72, shadowW: 58,
  },
  tree_wind: {
    src: 'assets/game/scenery/tree_wind.png', h: 176, anchor: 0.965, block: true,
    blockRadius: 0.68, shadowW: 60,
  },
  pine_blue: {
    src: 'assets/game/scenery/pine_blue.png', h: 190, anchor: 0.97, block: true,
    blockRadius: 0.7, shadowW: 52,
  },
  bush: { src: 'assets/game/scenery/bush.png', h: 48, anchor: 0.94, block: false },
  rock: { src: 'assets/game/scenery/rock.png', h: 92, anchor: 0.94, block: true, blockRadius: 0.58 },
  rock_small: { src: 'assets/game/scenery/rock_small.png', h: 52, anchor: 0.94, block: false },
  grass: { src: 'assets/game/scenery/grass.png', h: 40, anchor: 0.94, block: false },
  flower: { src: 'assets/game/scenery/flower.png', h: 34, anchor: 0.94, block: false },
  shrub_dense: {
    src: 'assets/game/scenery/shrub_dense.png', h: 70, anchor: 0.95, block: false, shadowW: 25,
  },
  fern_patch: {
    src: 'assets/game/scenery/fern_patch.png', h: 60, anchor: 0.95, block: false, shadowW: 24,
  },
  grass_dry: {
    src: 'assets/game/scenery/grass_dry.png', h: 52, anchor: 0.95, block: false, shadowW: 17,
  },
  grass_lush: {
    src: 'assets/game/scenery/grass_lush.png', h: 44, anchor: 0.95, block: false, shadowW: 18,
  },
  flower_wild: {
    src: 'assets/game/scenery/flower_wild.png', h: 43, anchor: 0.95, block: false, shadowW: 17,
  },
  fallen_log: {
    src: 'assets/game/scenery/fallen_log.png', h: 58, anchor: 0.95, block: false, shadowW: 34,
  },
  stone_cluster: {
    src: 'assets/game/scenery/stone_cluster.png', h: 82, anchor: 0.95, block: false, shadowW: 29,
  },
  bramble: {
    src: 'assets/game/scenery/bramble.png', h: 60, anchor: 0.95, block: false, shadowW: 25,
  },
  sapling: {
    src: 'assets/game/scenery/sapling.png', h: 96, anchor: 0.96, block: false, shadowW: 20,
  },
  town_square: { src: 'assets/game/scenery/town_square.png', h: 230, anchor: 0.94, block: false, fadeRadius: 82 },
  frontier_camp: { src: 'assets/game/scenery/frontier_camp.png', h: 225, anchor: 0.94, block: false, fadeRadius: 86 },
  mine_lift: { src: 'assets/game/scenery/mine_lift.png', h: 245, anchor: 0.95, block: false, fadeRadius: 84 },
  valley_altar: { src: 'assets/game/scenery/valley_altar.png', h: 185, anchor: 0.94, block: false, fadeRadius: 70 },
  tomb_brazier: { src: 'assets/game/scenery/tomb_brazier.png', h: 175, anchor: 0.94, block: false, fadeRadius: 68 },
  hive_nest: { src: 'assets/game/scenery/hive_nest.png', h: 210, anchor: 0.94, block: false, fadeRadius: 78 },
  temple_altar: { src: 'assets/game/scenery/temple_altar.png', h: 220, anchor: 0.95, block: false, fadeRadius: 80 },
  sanctum_throne: { src: 'assets/game/scenery/sanctum_throne.png', h: 250, anchor: 0.96, block: false, fadeRadius: 90 },
  sabac_gate: { src: 'assets/game/scenery/sabac_gate.png', h: 310, anchor: 0.96, block: false, fadeRadius: 112 },
  grove_deciduous: {
    src: 'assets/game/scenery/grove_deciduous.png', h: 315, anchor: 0.96, block: true,
    blockRadius: 1.8, fadeRadius: 170, shadowW: 108,
  },
  grove_pine: {
    src: 'assets/game/scenery/grove_pine.png', h: 330, anchor: 0.97, block: true,
    blockRadius: 1.7, fadeRadius: 165, shadowW: 104,
  },
  grove_poison: {
    src: 'assets/game/scenery/grove_poison.png', h: 325, anchor: 0.96, block: true,
    blockRadius: 1.9, fadeRadius: 175, shadowW: 112,
  },
  grove_fern: {
    src: 'assets/game/scenery/grove_fern.png', h: 294, anchor: 0.965, block: true,
    blockRadius: 1.35, fadeRadius: 148, shadowW: 96,
  },
};

export const TILES = {
  road: 'assets/game/tiles/road.png',
  grass: 'assets/game/tiles/grass.png',
  dirt: 'assets/game/tiles/dirt.png',
};

/** 真正的墙体美术图元：顶部连续材质 + 朝玩家的结构前脸。 */
export const WALL_MATERIALS = {
  valley: {
    top: 'assets/game/walls/wall_moss_top.png',
    face: 'assets/game/walls/wall_moss_face.png',
  },
  cave: {
    top: 'assets/game/walls/wall_mine_top.png',
    face: 'assets/game/walls/wall_mine_face.png',
  },
  centipede_cave: {
    top: 'assets/game/walls/wall_hive_top.png',
    face: 'assets/game/walls/wall_hive_face.png',
  },
  stone_tomb: { top: 'assets/game/walls/wall_tomb.png' },
  temple: { top: 'assets/game/walls/wall_temple.png' },
  sanctum: { top: 'assets/game/walls/wall_sanctum.png' },
  sabac: { top: 'assets/game/walls/wall_fortress.png' },
};

/**
 * 区域视觉导演表：逻辑地图保持稳定，表现层通过统一主题描述驱动。
 * 颜色均服务于 Canvas 地表过渡、氛围粒子、传送门与屏幕调色。
 */
export const ZONE_VISUALS = {
  bich: {
    bg: 'town', texture: 'bich', atmosphere: 'leaves', ground: '#53633b', groundDark: '#344026',
    road: '#756b5a', roadEdge: '#302b22', wall: '#51463a', wallTop: '#8b765e',
    accent: '#e8b85c', fog: 'rgba(219,184,112,0.035)', vignette: 0.22,
    portal: ['#ffe19a', '#d49032'], detail: 'town', structure: 'city',
    lights: [
      { x: 9, y: 10, color: '#ffbc63', r: 116 }, { x: 29, y: 9, color: '#ffbc63', r: 128 },
      { x: 20, y: 22, color: '#f2a94f', r: 104 },
    ],
  },
  field: {
    bg: 'field', texture: 'field', atmosphere: 'dust', ground: '#4c5c30', groundDark: '#2d381e',
    road: '#756147', roadEdge: '#382d20', wall: '#4c463b', wallTop: '#847861',
    accent: '#d4a85b', fog: 'rgba(188,151,80,0.045)', vignette: 0.26,
    portal: ['#f3cf6c', '#a9652d'], detail: 'field', structure: 'cliff',
    lights: [{ x: 19, y: 19, color: '#e77a32', r: 92 }],
  },
  valley: {
    bg: 'field', texture: 'valley', atmosphere: 'spores', ground: '#244637', groundDark: '#102a24',
    road: '#405645', roadEdge: '#172a22', wall: '#374e44', wallTop: '#668b74',
    accent: '#76d3a2', fog: 'rgba(37,122,91,0.10)', vignette: 0.38,
    portal: ['#8cf0bc', '#2e8d6a'], detail: 'valley', structure: 'moss_cliff',
    lights: [
      { x: 12, y: 18, color: '#55d88d', r: 86 }, { x: 28, y: 11, color: '#55d88d', r: 78 },
      { x: 30, y: 23, color: '#8bcf5d', r: 72 },
    ],
  },
  cave: {
    bg: 'temple', texture: 'cave', atmosphere: 'embers', ground: '#332d2b', groundDark: '#171518',
    road: '#4b4038', roadEdge: '#191519', wall: '#302c33', wallTop: '#77645b',
    accent: '#e88a44', fog: 'rgba(33,20,37,0.18)', vignette: 0.48,
    portal: ['#ffb15f', '#8e3d28'], detail: 'cave', structure: 'mine_rock',
    lights: [
      { x: 5, y: 14, color: '#ff9b43', r: 104 }, { x: 20, y: 15, color: '#ff8b36', r: 92 },
      { x: 34, y: 10, color: '#ff9b43', r: 96 },
    ],
  },
  stone_tomb: {
    bg: 'temple', texture: 'stone-tomb', atmosphere: 'ash', ground: '#3b2924', groundDark: '#1d1211',
    road: '#50362e', roadEdge: '#241411', wall: '#493029', wallTop: '#8c5b42',
    accent: '#ef6f42', fog: 'rgba(92,31,20,0.13)', vignette: 0.46,
    portal: ['#ff9a52', '#a63225'], detail: 'tomb', structure: 'tomb_masonry',
    lights: [
      { x: 8, y: 8, color: '#ff663c', r: 88 }, { x: 20, y: 15, color: '#ff5a38', r: 110 },
      { x: 32, y: 22, color: '#ff663c', r: 88 },
    ],
  },
  centipede_cave: {
    bg: 'temple', texture: 'centipede-cave', atmosphere: 'spores', ground: '#29351d', groundDark: '#12190d',
    road: '#394228', roadEdge: '#161b10', wall: '#303b25', wallTop: '#64784a',
    accent: '#a7df5f', fog: 'rgba(81,121,38,0.12)', vignette: 0.50,
    portal: ['#c6f46b', '#587d24'], detail: 'hive', structure: 'organic',
    lights: [
      { x: 9, y: 20, color: '#a8e85a', r: 82 }, { x: 24, y: 9, color: '#84d34b', r: 94 },
      { x: 33, y: 20, color: '#b6e866', r: 78 },
    ],
  },
  temple: {
    bg: 'temple', texture: 'temple', atmosphere: 'embers', ground: '#282437', groundDark: '#11101d',
    road: '#393148', roadEdge: '#171323', wall: '#332c45', wallTop: '#705d88',
    accent: '#b997ff', fog: 'rgba(55,32,95,0.15)', vignette: 0.54,
    portal: ['#d6b2ff', '#7949bd'], detail: 'temple', structure: 'temple_masonry',
    lights: [
      { x: 8, y: 14, color: '#b778ff', r: 96 }, { x: 20, y: 8, color: '#ff783d', r: 84 },
      { x: 32, y: 15, color: '#b778ff', r: 104 },
    ],
  },
  sanctum: {
    bg: 'temple', texture: 'sanctum', atmosphere: 'souls', ground: '#2c181e', groundDark: '#12080c',
    road: '#44252b', roadEdge: '#1d0c10', wall: '#40242c', wallTop: '#8a4d58',
    accent: '#ff776d', fog: 'rgba(113,16,35,0.16)', vignette: 0.60,
    portal: ['#ff9a86', '#b12e44'], detail: 'sanctum', structure: 'sanctum_masonry',
    lights: [
      { x: 12, y: 9, color: '#d84662', r: 108 }, { x: 20, y: 15, color: '#f04c59', r: 136 },
      { x: 29, y: 21, color: '#b33e79', r: 96 },
    ],
  },
  sabac: {
    bg: 'town', texture: 'sabac', atmosphere: 'ash', ground: '#4b3525', groundDark: '#241811',
    road: '#6f5037', roadEdge: '#2d1d14', wall: '#584032', wallTop: '#9c7656',
    accent: '#f0a545', fog: 'rgba(104,47,19,0.10)', vignette: 0.40,
    portal: ['#ffc263', '#b44c24'], detail: 'war', structure: 'fortress',
    lights: [
      { x: 9, y: 8, color: '#ed6c32', r: 90 }, { x: 20, y: 15, color: '#f28d37', r: 116 },
      { x: 32, y: 21, color: '#df5b2d', r: 98 },
    ],
  },
};

const townRoads = [
  ...pathTiles([[2, 14], [12, 14], [20, 14], [29, 14], [37, 14]], 1),
  ...pathTiles([[20, 27], [20, 20], [20, 14], [20, 3]], 1),
];
const fieldRoads = pathTiles([[2, 14], [8, 14], [13, 17], [19, 18], [25, 15], [31, 14], [36, 18]], 1);
const valleyRoads = pathTiles([[2, 14], [8, 14], [13, 17], [19, 14], [25, 17], [31, 14], [37, 14]], 1);
const sabacRoads = [
  ...pathTiles([[20, 28], [20, 23], [18, 20], [20, 17], [20, 12], [20, 7]], 1),
  ...pathTiles([[8, 20], [14, 20], [20, 20], [26, 20], [32, 20]], 1),
];

export const MAPS = {
  bich: {
    id: 'bich',
    name: '比奇城',
    safe: true,
    recommendedLevel: [1, 50],
    bg: 'assets/game/map/town.jpg',
    ground: 'grass',
    renderWalls: false,
    grid: townGrid,
    roads: townRoads,
    roadPaths: [
      { points: [[2, 14], [12, 14], [20, 14], [29, 14], [37, 14]], width: 2.65 },
      { points: [[20, 27], [20, 20], [20, 14], [20, 3]], width: 2.65 },
    ],
    scenePlan: {
      story: '四个功能街区围合市政广场，东西商路与南北仪仗轴线在石井交会。',
      zones: ['西北药坊', '东北商行', '中央议事广场', '南侧工坊与仓储', '东门驿道'],
    },
    marks: [
      { kind: 'plaza', x: 20, y: 15, r: 5.2 },
      { kind: 'gate', x: 35.5, y: 14, r: 2.4 },
    ],
    decors: [
      { id: 'house_a', x: 8, y: 9.8, h: 260 },
      { id: 'house_b', x: 31.5, y: 9.8, h: 280 },
      { id: 'house_b', x: 8.5, y: 25.4, h: 260 },
      { id: 'house_a', x: 31.5, y: 25.2, h: 265 },
      { id: 'town_square', x: 20, y: 16.2, h: 215 },
      { id: 'grove_deciduous', x: 14, y: 9.4, h: 238, blockRadius: 1.25 },
      { id: 'grove_deciduous', x: 26, y: 9.4, h: 238, blockRadius: 1.25 },
      { id: 'grove_deciduous', x: 14, y: 21.5, h: 245, blockRadius: 1.3 },
      { id: 'grove_deciduous', x: 26, y: 21.5, h: 245, blockRadius: 1.3 },
      { id: 'bush', x: 15.5, y: 12 }, { id: 'bush', x: 24.5, y: 12 },
      { id: 'flower', x: 16.5, y: 18.5 }, { id: 'flower', x: 23.5, y: 18.5 },
      { id: 'wall', x: 36, y: 12.4, h: 94 }, { id: 'wall', x: 36, y: 16.5, h: 94 },
    ],
    spawns: [],
    portals: [
      { x: 36, y: 14, to: 'field', tx: 3, ty: 14, label: '去盟重省' },
    ],
    npcs: [
      { id: 'healer', name: '药店老板', x: 9, y: 11, action: 'heal', sprite: 'healer' },
      { id: 'merchant', name: '杂货商', x: 31, y: 11, action: 'shop', sprite: 'merchant' },
      { id: 'warehouse', name: '仓库管理员', x: 9, y: 19, action: 'warehouse', sprite: 'warehouse' },
      { id: 'captain', name: '卫士队长', x: 18, y: 12.5, action: 'quest', sprite: 'captain' },
      { id: 'blacksmith', name: '比奇铁匠', x: 31, y: 19, action: 'craft', sprite: 'merchant' },
    ],
    playerStart: { x: 20, y: 19 },
    tint: 'rgba(40,50,35,0.08)',
  },
  field: {
    id: 'field',
    name: '盟重省',
    safe: false,
    recommendedLevel: [1, 10],
    bg: 'assets/game/map/field.jpg',
    ground: 'grass',
    renderWalls: false,
    grid: fieldGrid,
    roads: fieldRoads,
    roadPaths: [
      { points: [[2, 14], [8, 14], [13, 17], [19, 18], [25, 15], [31, 14], [36, 18]], width: 2.45 },
    ],
    scenePlan: {
      story: '城门商道穿过鹿群草甸，在烧毁商队营地分岔至矿洞、毒谷和沙巴克。',
      zones: ['西部安全缓冲', '北部鹿群草甸', '中央边境营地', '东北乱葬岗', '东南掠夺者高地'],
    },
    marks: [
      { kind: 'meadow', x: 10, y: 9, r: 4.5 },
      { kind: 'camp', x: 19, y: 18, r: 4 },
      { kind: 'graveyard', x: 30, y: 10, r: 4.2 },
    ],
    decors: [
      { id: 'frontier_camp', x: 19, y: 18.8, h: 225 },
      { id: 'grove_deciduous', x: 3.5, y: 9, h: 300 },
      { id: 'grove_pine', x: 11.5, y: 8.7, h: 310 },
      { id: 'grove_deciduous', x: 20, y: 8.4, h: 288 },
      { id: 'grove_pine', x: 29.5, y: 8.7, h: 310 },
      { id: 'grove_deciduous', x: 37, y: 9, h: 300 },
      { id: 'grove_deciduous', x: 4, y: 26.5, h: 310 },
      { id: 'grove_pine', x: 12.5, y: 27.5, h: 320 },
      { id: 'grove_deciduous', x: 27.5, y: 27.2, h: 310 },
      { id: 'grove_pine', x: 37, y: 25.8, h: 315 },
      { id: 'rock', x: 10, y: 7.8, h: 108 }, { id: 'rock', x: 20, y: 23.8, h: 116 },
      { id: 'rock', x: 31, y: 8.8, h: 112 }, { id: 'rock', x: 31.5, y: 25.8, h: 120 },
      { id: 'rock_small', x: 27.5, y: 10.5 }, { id: 'rock_small', x: 33, y: 12 },
      { id: 'bush', x: 10, y: 12 }, { id: 'grass', x: 14, y: 11 }, { id: 'flower', x: 8, y: 10 },
      { id: 'bush', x: 24, y: 19.5 }, { id: 'grass', x: 26, y: 17 },
    ],
    spawns: [
      { monster: 'deer', count: 6, x: 10, y: 10, r: 4.5 },
      { monster: 'zombie', count: 6, x: 29, y: 11, r: 3.4 },
      { monster: 'skeleton', count: 4, x: 33, y: 22, r: 2.8 },
    ],
    gathers: [
      { type: 'herb', x: 8, y: 11 }, { type: 'herb', x: 13, y: 9 },
      { type: 'herb', x: 24, y: 21 }, { type: 'herb', x: 35, y: 16 },
    ],
    portals: [
      { x: 2, y: 14, to: 'bich', tx: 34, ty: 14, label: '回比奇城' },
      { x: 36, y: 20, to: 'cave', tx: 4, ty: 14, label: '废弃矿洞', reqLevel: 3 },
      { x: 36, y: 8, to: 'valley', tx: 3, ty: 14, label: '毒蛇山谷', reqLevel: 4 },
      { x: 20, y: 27, to: 'sabac', tx: 20, ty: 26, label: '沙巴克城', reqLevel: 20 },
    ],
    npcs: [],
    playerStart: { x: 5, y: 14 },
    tint: 'rgba(20,40,20,0.12)',
  },
  cave: {
    id: 'cave',
    name: '废弃矿洞',
    safe: false,
    recommendedLevel: [6, 16],
    bg: 'assets/game/map/temple.jpg',
    ground: 'dirt',
    renderWalls: true,
    grid: caveGrid,
    roads: [],
    scenePlan: {
      story: '废弃支护巷道由西侧入口层层深入升降机井，支洞矿脉与亡灵巢点分离。',
      zones: ['入口前室', '木梁支护巷道', '旧升降机井', '塌方尸坑', '深层矿脉'],
    },
    marks: [
      { kind: 'shaft', x: 17, y: 9.5, r: 3.2 },
      { kind: 'rail', x: 12, y: 14, r: 8 },
      { kind: 'collapse', x: 23, y: 20, r: 4.2 },
    ],
    decors: [
      { id: 'mine_lift', x: 17, y: 10.3, h: 235 },
      { id: 'rock', x: 9, y: 12 }, { id: 'rock_small', x: 13, y: 16.5 },
      { id: 'rock', x: 22, y: 23.5 }, { id: 'rock_small', x: 27, y: 17 },
      { id: 'rock', x: 33, y: 10.8 },
    ],
    spawns: [
      { monster: 'zombie', count: 5, x: 22, y: 20, r: 3.2 },
      { monster: 'zombie_miner', count: 6, x: 17, y: 9, r: 3.2 },
      { monster: 'skeleton', count: 4, x: 27, y: 14, r: 3 },
      { monster: 'bat', count: 4, x: 33, y: 8, r: 2.8 },
    ],
    gathers: [
      { type: 'copper', x: 12, y: 13 }, { type: 'copper', x: 20, y: 22 },
      { type: 'copper', x: 31, y: 7 }, { type: 'black_iron', x: 35, y: 10 },
    ],
    portals: [
      { x: 3, y: 14, to: 'field', tx: 34, ty: 20, label: '回盟重省' },
      { x: 36, y: 14, to: 'temple', tx: 4, ty: 14, label: '沃玛寺庙', reqLevel: 18 },
      { x: 30, y: 26, to: 'centipede_cave', tx: 4, ty: 14, label: '蜈蚣洞', reqLevel: 12 },
    ],
    npcs: [],
    playerStart: { x: 5, y: 14 },
    tint: 'rgba(14,8,20,0.34)',
  },
  valley: {
    id: 'valley',
    name: '毒蛇山谷',
    safe: false,
    recommendedLevel: [4, 18],
    bg: 'assets/game/map/field.jpg',
    ground: 'grass',
    grid: valleyGrid,
    roads: valleyRoads,
    renderWalls: true,
    roadPaths: [
      { points: [[2, 14], [8, 14], [13, 17], [19, 14], [25, 17], [31, 14], [37, 14]], width: 2.25 },
    ],
    scenePlan: {
      story: '双岩脊夹成蜿蜒湿谷，中央蛇祭坛控制视线，鹿群与狼群分处不同海拔。',
      zones: ['西部哨岗', '南部药草湿地', '中央蛇祭坛', '北部鹿群台地', '东部狼脊'],
    },
    marks: [
      { kind: 'ritual', x: 20, y: 14.5, r: 4 },
      { kind: 'swamp', x: 10, y: 21, r: 4.4 },
      { kind: 'meadow', x: 31, y: 7, r: 3.8 },
    ],
    decors: [
      { id: 'valley_altar', x: 20, y: 15.5, h: 180 },
      { id: 'grove_poison', x: 3.5, y: 9, h: 305 },
      { id: 'grove_poison', x: 9.5, y: 8.6, h: 315 },
      { id: 'grove_poison', x: 18.5, y: 8, h: 290 },
      { id: 'grove_poison', x: 29, y: 8.7, h: 315 },
      { id: 'grove_poison', x: 37, y: 9.4, h: 305 },
      { id: 'grove_poison', x: 3.8, y: 25.5, h: 310 },
      { id: 'grove_poison', x: 12, y: 27.2, h: 325 },
      { id: 'grove_poison', x: 27.5, y: 27, h: 325 },
      { id: 'grove_poison', x: 37, y: 24.5, h: 310 },
      { id: 'rock', x: 13, y: 10 }, { id: 'rock', x: 26, y: 19 },
      { id: 'bush', x: 10, y: 20 }, { id: 'bush', x: 15, y: 22 },
      { id: 'flower', x: 12, y: 23 }, { id: 'grass', x: 30, y: 9 },
    ],
    spawns: [
      { monster: 'wolf', count: 9, x: 29, y: 20, r: 4.5 },
      { monster: 'wolf_alpha', count: 1, x: 32, y: 22, r: 0.8 },
      { monster: 'deer', count: 5, x: 32, y: 7, r: 2.8 },
    ],
    gathers: [
      { type: 'herb', x: 9, y: 20 }, { type: 'herb', x: 13, y: 23 },
      { type: 'herb', x: 24, y: 18 }, { type: 'herb', x: 31, y: 9 },
    ],
    portals: [
      { x: 2, y: 14, to: 'field', tx: 34.5, ty: 7.5, label: '回盟重省' },
      { x: 36, y: 14, to: 'stone_tomb', tx: 4, ty: 14, label: '石墓阵', reqLevel: 18 },
    ],
    npcs: [
      { id: 'valley_guard', name: '山谷守卫', x: 6, y: 12, action: 'guide', sprite: 'captain' },
    ],
    playerStart: { x: 4, y: 14 },
    tint: 'rgba(10,45,30,0.18)',
  },
  stone_tomb: {
    id: 'stone_tomb',
    name: '石墓阵',
    safe: false,
    recommendedLevel: [18, 30],
    bg: 'assets/game/map/temple.jpg',
    ground: 'dirt',
    renderWalls: true,
    grid: tombGrid,
    roads: [],
    scenePlan: {
      story: '外回廊绕行四座陪葬耳室，四向甬道最终汇入中央封印火庭。',
      zones: ['西侧墓门', '四座陪葬耳室', '环形回廊', '中央封印火庭'],
    },
    marks: [
      { kind: 'tomb_ring', x: 20, y: 15, r: 5 },
      { kind: 'crypt', x: 10, y: 8, r: 3 },
      { kind: 'crypt', x: 29, y: 21, r: 3 },
    ],
    decors: [
      { id: 'tomb_brazier', x: 20, y: 16, h: 170 },
      { id: 'rock', x: 10, y: 9 }, { id: 'rock', x: 29, y: 9 },
      { id: 'rock', x: 10, y: 22 }, { id: 'rock', x: 29, y: 22 },
      { id: 'rock_small', x: 14, y: 15 }, { id: 'rock_small', x: 26, y: 15 },
    ],
    spawns: [
      { monster: 'boar', count: 9, x: 10, y: 20, r: 2.6 },
      { monster: 'skeleton', count: 6, x: 28, y: 10, r: 2.8 },
      { monster: 'boar_king', count: 1, x: 20, y: 15, r: 0.8 },
    ],
    gathers: [
      { type: 'copper', x: 10, y: 8 }, { type: 'black_iron', x: 29, y: 21 },
    ],
    portals: [
      { x: 3, y: 14, to: 'valley', tx: 34, ty: 14, label: '回毒蛇山谷' },
    ],
    npcs: [],
    playerStart: { x: 4, y: 14 },
    tint: 'rgba(75,20,15,0.25)',
  },
  centipede_cave: {
    id: 'centipede_cave',
    name: '蜈蚣洞',
    safe: false,
    recommendedLevel: [12, 28],
    bg: 'assets/game/map/temple.jpg',
    ground: 'dirt',
    renderWalls: true,
    grid: centipedeGrid,
    roads: [],
    scenePlan: {
      story: '天然巢室沿弯曲洞道串联，母巢占据中央，蝙蝠高穴和矿脉位于外围死路。',
      zones: ['入口矿工营位', '铜矿支洞', '中央母巢', '黑铁矿脉', '蝙蝠高穴'],
    },
    marks: [
      { kind: 'nest', x: 17, y: 17, r: 5 },
      { kind: 'slime', x: 25, y: 9, r: 4 },
      { kind: 'bones', x: 32, y: 18, r: 3.5 },
    ],
    decors: [
      { id: 'hive_nest', x: 17, y: 18.2, h: 205 },
      { id: 'rock', x: 10, y: 10 }, { id: 'rock', x: 25, y: 10 },
      { id: 'rock_small', x: 20, y: 13 }, { id: 'rock_small', x: 32, y: 20 },
      { id: 'grass', x: 24, y: 8 }, { id: 'grass', x: 30, y: 17 },
    ],
    spawns: [
      { monster: 'centipede', count: 7, x: 24, y: 9, r: 3.2 },
      { monster: 'centipede', count: 6, x: 30, y: 17, r: 2.8 },
      { monster: 'venom_centipede', count: 1, x: 17, y: 17, r: 0.8 },
      { monster: 'bat', count: 4, x: 34, y: 20, r: 2.6 },
    ],
    gathers: [
      { type: 'copper', x: 10, y: 8 }, { type: 'copper', x: 13, y: 11 },
      { type: 'black_iron', x: 27, y: 7 }, { type: 'black_iron', x: 35, y: 20 },
    ],
    portals: [
      { x: 3, y: 14, to: 'cave', tx: 28, ty: 25, label: '回废弃矿洞' },
    ],
    npcs: [
      { id: 'miner', name: '老矿工', x: 6, y: 14, action: 'guide', sprite: 'merchant' },
    ],
    playerStart: { x: 4, y: 14 },
    tint: 'rgba(25,45,8,0.3)',
  },
  temple: {
    id: 'temple',
    name: '沃玛寺庙',
    safe: false,
    recommendedLevel: [18, 32],
    bg: 'assets/game/map/temple.jpg',
    ground: 'dirt',
    renderWalls: true,
    grid: templeGrid,
    roads: [],
    scenePlan: {
      story: '西侧门厅连接双翼礼拜室，对称柱列导向东端主祭坛与内殿门。',
      zones: ['西部门厅', '北礼拜翼', '南墓葬翼', '中央仪式长廊', '东端主祭坛'],
    },
    marks: [
      { kind: 'ritual', x: 33.5, y: 14.5, r: 4.5 },
      { kind: 'aisle', x: 23, y: 14.5, r: 9 },
      { kind: 'crypt', x: 23, y: 21, r: 3.5 },
    ],
    decors: [
      { id: 'temple_altar', x: 33, y: 16, h: 215 },
      { id: 'rock', x: 17, y: 11.8, h: 84 }, { id: 'rock', x: 22, y: 11.8, h: 84 },
      { id: 'rock', x: 27, y: 11.8, h: 84 }, { id: 'rock', x: 17, y: 19.5, h: 84 },
      { id: 'rock', x: 22, y: 19.5, h: 84 }, { id: 'rock', x: 27, y: 19.5, h: 84 },
      { id: 'rock_small', x: 10, y: 18 }, { id: 'rock_small', x: 24, y: 23 },
    ],
    spawns: [
      { monster: 'orc', count: 7, x: 12, y: 17, r: 3.4 },
      { monster: 'orc_shaman', count: 3, x: 23, y: 7, r: 2.6 },
      { monster: 'orc_shaman', count: 2, x: 23, y: 22, r: 2.2 },
      { monster: 'guardian', count: 1, x: 32, y: 14, r: 0.8 },
    ],
    portals: [
      { x: 3, y: 14, to: 'cave', tx: 34, ty: 14, label: '回废弃矿洞' },
      { x: 36, y: 14, to: 'sanctum', tx: 4, ty: 14, label: '沃玛内殿', reqLevel: 25 },
    ],
    npcs: [],
    playerStart: { x: 5, y: 14 },
    tint: 'rgba(10,5,20,0.28)',
  },
  sanctum: {
    id: 'sanctum',
    name: '沃玛内殿',
    safe: false,
    recommendedLevel: [25, 40],
    bg: 'assets/game/map/temple.jpg',
    ground: 'dirt',
    renderWalls: true,
    grid: sanctumGrid,
    roads: [],
    scenePlan: {
      story: '西侧献祭长廊逐步收束，在血印前分出守卫侧室，最终进入孤立王座厅。',
      zones: ['献祭入口', '守卫侧室', '中央血印', '王座前庭', '教主高台'],
    },
    marks: [
      { kind: 'throne', x: 31, y: 14.5, r: 5.5 },
      { kind: 'sigil', x: 24, y: 14.5, r: 4.5 },
      { kind: 'blood_aisle', x: 16, y: 14.5, r: 8 },
    ],
    decors: [
      { id: 'sanctum_throne', x: 32, y: 15.5, h: 245 },
      { id: 'rock', x: 12, y: 10, h: 82 }, { id: 'rock', x: 12, y: 21, h: 82 },
      { id: 'rock', x: 23, y: 9, h: 82 }, { id: 'rock', x: 23, y: 22, h: 82 },
      { id: 'rock', x: 17, y: 10 }, { id: 'rock', x: 17, y: 20 },
    ],
    spawns: [
      { monster: 'orc', count: 4, x: 13, y: 10, r: 2.2 },
      { monster: 'orc_shaman', count: 4, x: 13, y: 20, r: 2.2 },
      { monster: 'guardian', count: 2, x: 24, y: 14, r: 1.8 },
      { monster: 'lord', count: 1, x: 30, y: 16.5, r: 0.5 },
    ],
    portals: [
      { x: 3, y: 14, to: 'temple', tx: 34, ty: 14, label: '回沃玛寺庙' },
    ],
    npcs: [],
    playerStart: { x: 5, y: 14 },
    tint: 'rgba(35,3,3,0.3)',
  },
  sabac: {
    id: 'sabac',
    name: '沙巴克城',
    safe: false,
    recommendedLevel: [20, 50],
    bg: 'assets/game/map/town.jpg',
    ground: 'dirt',
    renderWalls: true,
    grid: sabacGrid,
    roads: sabacRoads,
    roadPaths: [
      { points: [[20, 28], [20, 23], [18, 20], [20, 17], [20, 12], [20, 7]], width: 2.55 },
      { points: [[8, 20], [14, 20], [20, 20], [26, 20], [32, 20]], width: 2.55 },
    ],
    scenePlan: {
      story: '南门瓮城进入军市横街，穿越被攻破的内宫门后才抵达皇旗占领庭院。',
      zones: ['南门瓮城', '军市横街', '左右驻军区', '内宫门楼', '皇旗占领庭院'],
    },
    marks: [
      { kind: 'gate', x: 20, y: 17.5, r: 4.2 },
      { kind: 'capture', x: 20, y: 12, r: 4.5 },
      { kind: 'siege', x: 20, y: 23, r: 4.5 },
      { kind: 'market', x: 12, y: 20, r: 4 },
    ],
    decors: [
      { id: 'sabac_gate', x: 20, y: 17.8, h: 300 },
      { id: 'house_a', x: 10, y: 23, h: 220 }, { id: 'house_b', x: 30, y: 23, h: 225 },
      { id: 'rock', x: 14, y: 22 }, { id: 'rock', x: 26, y: 22 },
    ],
    spawns: [],
    portals: [
      { x: 20, y: 27, to: 'field', tx: 20, ty: 25, label: '返回盟重省' },
    ],
    npcs: [],
    playerStart: { x: 20, y: 26 },
    tint: 'rgba(55,25,8,0.2)',
    captureZone: { x: 20, y: 11.5, r: 3.2 },
    siegeGate: { x: 20, y: 17.8, r: 3.4, maxHp: 2800 },
  },
};

const MAP_SCALE_X = WORLD.cols / AUTHORING_WORLD.cols;
const MAP_SCALE_Y = WORLD.rows / AUTHORING_WORLD.rows;

function scaleGridToWorld(grid) {
  return Array.from({ length: WORLD.rows }, (_, y) => {
    const sourceY = Math.min(
      AUTHORING_WORLD.rows - 1,
      Math.floor(y / MAP_SCALE_Y),
    );
    return Array.from({ length: WORLD.cols }, (_, x) => {
      const sourceX = Math.min(
        AUTHORING_WORLD.cols - 1,
        Math.floor(x / MAP_SCALE_X),
      );
      return grid[sourceY]?.[sourceX] ?? 1;
    });
  });
}

function scaleRoadTiles(roads = []) {
  const tiles = new Map();
  for (const road of roads) {
    const x0 = Math.floor(road.x * MAP_SCALE_X);
    const y0 = Math.floor(road.y * MAP_SCALE_Y);
    const x1 = Math.ceil((road.x + 1) * MAP_SCALE_X) - 1;
    const y1 = Math.ceil((road.y + 1) * MAP_SCALE_Y) - 1;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x > 0 && y > 0 && x < WORLD.cols - 1 && y < WORLD.rows - 1) {
          tiles.set(`${x},${y}`, { x, y });
        }
      }
    }
  }
  return [...tiles.values()];
}

function scaleMapPoint(point, radiusScale = 1) {
  point.x *= MAP_SCALE_X;
  point.y *= MAP_SCALE_Y;
  if (Number.isFinite(point.r)) point.r *= radiusScale;
  return point;
}

function scaleAuthoredMap(map) {
  map.grid = scaleGridToWorld(map.grid);
  map.roads = scaleRoadTiles(map.roads);
  map.roadPaths = (map.roadPaths || []).map((path) => ({
    ...path,
    points: path.points.map(([x, y]) => [x * MAP_SCALE_X, y * MAP_SCALE_Y]),
    width: path.width * 1.08,
  }));
  map.marks = (map.marks || []).map((mark) => scaleMapPoint(mark, 1.35));
  map.decors = (map.decors || []).map((decor) => scaleMapPoint(decor));
  map.spawns = (map.spawns || []).map((spawn) => ({
    ...scaleMapPoint(spawn, 1.55),
    count: MONSTERS[spawn.monster]?.boss
      ? spawn.count
      : Math.max(spawn.count, Math.round(spawn.count * (map.safe ? 1 : 2.2))),
  }));
  map.gathers = (map.gathers || []).map((node) => scaleMapPoint(node));
  map.portals = (map.portals || []).map((portal) => ({
    ...scaleMapPoint(portal),
    tx: portal.tx * MAP_SCALE_X,
    ty: portal.ty * MAP_SCALE_Y,
  }));
  map.npcs = (map.npcs || []).map((npc) => scaleMapPoint(npc));
  map.playerStart = scaleMapPoint(map.playerStart);
  if (map.captureZone) scaleMapPoint(map.captureZone, 1.35);
  if (map.siegeGate) scaleMapPoint(map.siegeGate, 1.35);
  map.commercialScale = {
    cols: WORLD.cols,
    rows: WORLD.rows,
    areaTiles: WORLD.cols * WORLD.rows,
    linearScale: WORLD.layoutScale,
  };
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seedText) {
  let state = hashSeed(seedText) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq
    ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
    : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function distanceToRoad(map, x, y) {
  let nearest = Infinity;
  for (const path of map.roadPaths || []) {
    for (let index = 0; index < path.points.length - 1; index++) {
      const [ax, ay] = path.points[index];
      const [bx, by] = path.points[index + 1];
      nearest = Math.min(nearest, pointSegmentDistance(x, y, ax, ay, bx, by));
    }
  }
  return nearest;
}

export function distanceToRoadEdge(map, x, y) {
  let nearest = Infinity;
  for (const path of map.roadPaths || []) {
    const halfWidth = (path.width || 0) * 0.5;
    for (let index = 0; index < path.points.length - 1; index++) {
      const [ax, ay] = path.points[index];
      const [bx, by] = path.points[index + 1];
      nearest = Math.min(
        nearest,
        pointSegmentDistance(x, y, ax, ay, bx, by) - halfWidth,
      );
    }
  }
  return nearest;
}

function enrichOutdoorVegetation(map, profile) {
  const random = seededRandom(`flora:${map.id}:v3`);
  // Retire the early prototype tree silhouettes from outdoor runtime maps.
  // The authored placement remains intact while the commercial GPT Image
  // variants provide a consistent palette and material treatment.
  map.decors = (map.decors || []).map((decor, index) => {
    if (decor.id === 'tree') {
      return { ...decor, id: index % 2 ? 'tree_old' : 'tree_wind', facing: index % 3 ? 1 : -1 };
    }
    if (decor.id === 'pine') return { ...decor, id: 'pine_blue', facing: index % 2 ? 1 : -1 };
    return decor;
  });
  const originalDecors = map.decors.slice();
  const incomingPortalTargets = Object.values(MAPS).flatMap((sourceMap) => (
    (sourceMap.portals || [])
      .filter((portal) => portal.to === map.id)
      .map((portal) => ({ x: portal.tx, y: portal.ty }))
  ));
  const protectedPoints = [
    map.playerStart,
    ...map.portals,
    ...incomingPortalTargets,
    ...map.npcs,
    ...map.marks,
    ...originalDecors.filter((decor) => (
      decor.id.startsWith('house_')
      || ['town_square', 'frontier_camp', 'valley_altar', 'sabac_gate'].includes(decor.id)
    )),
  ];
  const canopy = [];
  const clusterCenters = [];
  const openAt = (x, y) => {
    const col = Math.floor(x);
    const row = Math.floor(y);
    return col > 1
      && row > 1
      && col < WORLD.cols - 2
      && row < WORLD.rows - 2
      && map.grid[row]?.[col] === 0;
  };
  const clearOfProtected = (x, y, radius) => protectedPoints.every(
    (point) => Math.hypot(x - point.x, y - point.y) >= radius,
  );
  const validCanopy = (x, y, minSpacing = 1.35) => openAt(x, y)
    && clearOfProtected(x, y, 3.4)
    && distanceToRoadEdge(map, x, y) > 2.05
    && canopy.every((point) => Math.hypot(x - point.x, y - point.y) >= minSpacing);

  for (let cluster = 0; cluster < profile.clusters; cluster++) {
    let center = null;
    for (let attempt = 0; attempt < 220 && !center; attempt++) {
      const x = 3 + random() * (WORLD.cols - 6);
      const y = 3 + random() * (WORLD.rows - 6);
      if (
        validCanopy(x, y, 5.2)
        && clusterCenters.every((point) => Math.hypot(x - point.x, y - point.y) >= 6.2)
      ) center = { x, y };
    }
    if (!center) continue;
    clusterCenters.push(center);
    const groveId = profile.groveIds[cluster % profile.groveIds.length];
    const grove = {
      id: groveId,
      x: center.x,
      y: center.y,
      h: Math.round(285 + random() * 58),
      blockRadius: 1.45 + random() * 0.28,
      facing: random() < 0.5 ? -1 : 1,
      ecology: 'canopy',
    };
    map.decors.push(grove);
    canopy.push(grove);

    for (let member = 1; member < profile.canopyPerCluster; member++) {
      let placed = false;
      for (let attempt = 0; attempt < 80 && !placed; attempt++) {
        const angle = random() * Math.PI * 2;
        const radius = 2 + random() * 5.8;
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius * 0.72;
        if (!validCanopy(x, y)) continue;
        const decor = {
          id: profile.treeIds[Math.floor(random() * profile.treeIds.length)],
          x,
          y,
          h: Math.round(138 + random() * 38),
          facing: random() < 0.5 ? -1 : 1,
          ecology: 'canopy',
        };
        map.decors.push(decor);
        canopy.push(decor);
        placed = true;
      }
    }
  }

  let scatteredTreesAdded = 0;
  for (
    let attempt = 0;
    attempt < (profile.scatteredTrees || 0) * 40 && scatteredTreesAdded < (profile.scatteredTrees || 0);
    attempt++
  ) {
    const x = 2.5 + random() * (WORLD.cols - 5);
    const y = 2.5 + random() * (WORLD.rows - 5);
    if (
      !openAt(x, y)
      || !clearOfProtected(x, y, 3.2)
      || distanceToRoadEdge(map, x, y) < 1.05
      || canopy.some((point) => Math.hypot(x - point.x, y - point.y) < 2.15)
    ) continue;
    const decor = {
      id: profile.treeIds[Math.floor(random() * profile.treeIds.length)],
      x,
      y,
      h: Math.round(142 + random() * 48),
      facing: random() < 0.5 ? -1 : 1,
      ecology: 'forest-edge',
    };
    map.decors.push(decor);
    canopy.push(decor);
    scatteredTreesAdded += 1;
  }

  let understoryAdded = 0;
  for (let attempt = 0; attempt < profile.understory * 18 && understoryAdded < profile.understory; attempt++) {
    const clustered = clusterCenters.length && random() < 0.72;
    const center = clustered
      ? clusterCenters[Math.floor(random() * clusterCenters.length)]
      : { x: WORLD.cols * 0.5, y: WORLD.rows * 0.5 };
    const angle = random() * Math.PI * 2;
    const radius = clustered ? 1.8 + random() * 8.5 : random() * Math.max(WORLD.cols, WORLD.rows) * 0.52;
    const x = clustered ? center.x + Math.cos(angle) * radius : 2 + random() * (WORLD.cols - 4);
    const y = clustered ? center.y + Math.sin(angle) * radius * 0.72 : 2 + random() * (WORLD.rows - 4);
    if (!openAt(x, y) || !clearOfProtected(x, y, 1.75) || distanceToRoadEdge(map, x, y) < 0.16) continue;
    const id = profile.understoryIds[Math.floor(random() * profile.understoryIds.length)];
    map.decors.push({
      id,
      x,
      y,
      h: Math.round((SCENERY[id]?.h || 40) * (0.82 + random() * 0.38)),
      facing: random() < 0.5 ? -1 : 1,
      ecology: 'understory',
    });
    understoryAdded += 1;
  }

  // A dedicated road-verge pass gives every travelling viewport a readable
  // mid/low-height ecology layer without obstructing the route itself.
  let vergeAdded = 0;
  for (let attempt = 0; attempt < profile.verge * 35 && vergeAdded < profile.verge; attempt++) {
    const x = 2 + random() * (WORLD.cols - 4);
    const y = 2 + random() * (WORLD.rows - 4);
    const roadClearance = distanceToRoadEdge(map, x, y);
    if (
      !openAt(x, y)
      || !clearOfProtected(x, y, 1.55)
      || roadClearance < 0.16
      || roadClearance > 1.5
    ) continue;
    const id = profile.vergeIds[Math.floor(random() * profile.vergeIds.length)];
    map.decors.push({
      id,
      x,
      y,
      h: Math.round((SCENERY[id]?.h || 46) * (0.76 + random() * 0.42)),
      facing: random() < 0.5 ? -1 : 1,
      ecology: 'road-verge',
    });
    vergeAdded += 1;
  }

  map.commercialScale.plantCount = map.decors.filter((decor) => (
    [
      'tree', 'pine', 'bush', 'grass', 'flower', 'shrub_dense', 'fern_patch',
      'grass_dry', 'grass_lush', 'flower_wild', 'bramble', 'sapling',
    ].includes(decor.id)
    || decor.id.startsWith('tree_')
    || decor.id.startsWith('pine_')
    || decor.id.startsWith('grove_')
  )).length;
  map.commercialScale.canopyClusters = clusterCenters.length;
  map.commercialScale.canopyCount = canopy.length;
  map.commercialScale.scatteredTrees = scatteredTreesAdded;
  map.commercialScale.understory = understoryAdded;
  map.commercialScale.roadVerge = vergeAdded;
}

function enrichDungeonDetails(map, count = 44) {
  const random = seededRandom(`dungeon-detail:${map.id}:v2`);
  const protectedPoints = [map.playerStart, ...map.portals, ...map.marks];
  let added = 0;
  for (let attempt = 0; attempt < count * 30 && added < count; attempt++) {
    const x = 2 + random() * (WORLD.cols - 4);
    const y = 2 + random() * (WORLD.rows - 4);
    const col = Math.floor(x);
    const row = Math.floor(y);
    if (map.grid[row]?.[col] !== 0) continue;
    if (protectedPoints.some((point) => Math.hypot(x - point.x, y - point.y) < 2.5)) continue;
    const organic = map.id === 'centipede_cave' && random() < 0.42;
    const id = organic ? 'grass' : 'rock_small';
    map.decors.push({
      id,
      x,
      y,
      h: Math.round((SCENERY[id]?.h || 48) * (0.72 + random() * 0.42)),
      ecology: organic ? 'cave-growth' : 'rubble',
    });
    added += 1;
  }
  map.commercialScale.detailCount = added;
}

for (const map of Object.values(MAPS)) scaleAuthoredMap(map);
for (const visual of Object.values(ZONE_VISUALS)) {
  visual.lights = (visual.lights || []).map((light) => ({
    ...light,
    x: light.x * MAP_SCALE_X,
    y: light.y * MAP_SCALE_Y,
    r: light.r * 1.35,
  }));
}

enrichOutdoorVegetation(MAPS.bich, {
  clusters: 7,
  canopyPerCluster: 6,
  scatteredTrees: 55,
  understory: 240,
  verge: 120,
  groveIds: ['grove_deciduous', 'grove_fern'],
  treeIds: ['tree_old', 'tree_wind', 'pine_blue'],
  understoryIds: [
    'bush', 'grass', 'flower', 'shrub_dense', 'fern_patch', 'grass_dry',
    'grass_lush', 'flower_wild', 'fallen_log', 'stone_cluster', 'bramble', 'sapling',
  ],
  vergeIds: ['grass', 'flower', 'fern_patch', 'grass_lush', 'flower_wild', 'sapling'],
});
enrichOutdoorVegetation(MAPS.field, {
  clusters: 16,
  canopyPerCluster: 7,
  scatteredTrees: 135,
  understory: 460,
  verge: 220,
  groveIds: ['grove_deciduous', 'grove_pine', 'grove_fern'],
  treeIds: ['tree_old', 'tree_wind', 'pine_blue'],
  understoryIds: [
    'bush', 'grass', 'shrub_dense', 'fern_patch', 'grass_dry', 'grass_lush',
    'flower_wild', 'fallen_log', 'stone_cluster', 'bramble', 'sapling',
  ],
  vergeIds: [
    'grass', 'flower', 'fern_patch', 'grass_dry', 'grass_lush', 'flower_wild', 'bramble',
  ],
});
enrichOutdoorVegetation(MAPS.valley, {
  clusters: 18,
  canopyPerCluster: 7,
  scatteredTrees: 150,
  understory: 500,
  verge: 220,
  groveIds: ['grove_poison', 'grove_fern'],
  treeIds: ['tree_old', 'tree_wind', 'pine_blue', 'pine_blue'],
  understoryIds: [
    'bush', 'shrub_dense', 'fern_patch', 'grass_dry', 'grass_lush',
    'flower_wild', 'fallen_log', 'stone_cluster', 'bramble', 'sapling',
  ],
  vergeIds: ['grass', 'fern_patch', 'grass_dry', 'grass_lush', 'flower_wild', 'bramble'],
});
enrichOutdoorVegetation(MAPS.sabac, {
  clusters: 6,
  canopyPerCluster: 5,
  scatteredTrees: 30,
  understory: 170,
  verge: 80,
  groveIds: ['grove_deciduous', 'grove_fern'],
  treeIds: ['tree_old', 'tree_wind', 'pine_blue'],
  understoryIds: [
    'bush', 'grass', 'fern_patch', 'grass_dry', 'grass_lush',
    'fallen_log', 'stone_cluster', 'bramble', 'sapling',
  ],
  vergeIds: ['grass', 'fern_patch', 'grass_dry', 'grass_lush', 'bramble'],
});

for (const mapId of ['cave', 'stone_tomb', 'centipede_cave', 'temple', 'sanctum']) {
  enrichDungeonDetails(MAPS[mapId], mapId === 'centipede_cave' ? 58 : 44);
}

const collisionBucketsByMap = new Map();

function collisionBuckets(mapId) {
  if (collisionBucketsByMap.has(mapId)) return collisionBucketsByMap.get(mapId);
  const buckets = Array.from({ length: WORLD.cols * WORLD.rows }, () => null);
  for (const decor of MAPS[mapId]?.decors || []) {
    const definition = SCENERY[decor.id];
    if (!definition?.block) continue;
    const radius = (decor.blockRadius || definition.blockRadius || 0) * WORLD.tile;
    if (radius <= 0) continue;
    const entry = { x: decor.x * WORLD.tile, y: decor.y * WORLD.tile, radius };
    const minCol = Math.max(0, Math.floor((entry.x - radius) / WORLD.tile));
    const maxCol = Math.min(WORLD.cols - 1, Math.floor((entry.x + radius) / WORLD.tile));
    const minRow = Math.max(0, Math.floor((entry.y - radius) / WORLD.tile));
    const maxRow = Math.min(WORLD.rows - 1, Math.floor((entry.y + radius) / WORLD.tile));
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const index = row * WORLD.cols + col;
        (buckets[index] ||= []).push(entry);
      }
    }
  }
  collisionBucketsByMap.set(mapId, buckets);
  return buckets;
}

/** Shared continuous collision used by both the local client and authoritative server. */
export function isWorldBlocked(mapId, x, y) {
  const map = MAPS[mapId];
  const col = Math.floor(x / WORLD.tile);
  const row = Math.floor(y / WORLD.tile);
  if (!map?.grid
    || row < 0 || col < 0 || row >= WORLD.rows || col >= WORLD.cols
    || map.grid[row][col] === 1) return true;
  const candidates = collisionBuckets(mapId)[row * WORLD.cols + col] || [];
  for (const decor of candidates) {
    if (Math.hypot(x - decor.x, y - decor.y) <= decor.radius) return true;
  }
  return false;
}

export function isWorldPositionOpen(mapId, x, y, radius = 0) {
  const r = Math.max(0, radius);
  return !isWorldBlocked(mapId, x, y)
    && !isWorldBlocked(mapId, x + r, y)
    && !isWorldBlocked(mapId, x - r, y)
    && !isWorldBlocked(mapId, x, y + r)
    && !isWorldBlocked(mapId, x, y - r);
}

export const QUESTS = [
  {
    id: 'q_intro',
    name: '初入玛法',
    giver: 'captain',
    desc: '与比奇卫士队长对话，了解局势。',
    steps: [{ type: 'talk', npc: 'captain', text: '盟重省有野兽出没，先去猎 8 只鹿练手！' }],
    reward: { xp: 40, gold: 50, items: [{ id: 'hp_pot', qty: 5 }] },
    next: 'q_deer',
  },
  {
    id: 'q_deer',
    name: '猎鹿练级',
    giver: 'captain',
    desc: '在盟重省击杀 8 只鹿，回来复命。',
    steps: [{ type: 'kill', monster: 'deer', count: 8 }],
    reward: { xp: 120, gold: 120, items: [{ id: 'iron_sword', qty: 1 }, { id: 'hp_pot', qty: 5 }] },
    next: 'q_wolf',
  },
  {
    id: 'q_wolf',
    name: '山谷狼患',
    giver: 'captain',
    desc: '前往毒蛇山谷击杀 10 只森林雪狼，并带回 4 张雪狼皮。',
    steps: [
      { type: 'kill', monster: 'wolf', count: 10 },
      { type: 'collect', item: 'wolf_pelt', count: 4 },
    ],
    reward: { xp: 190, gold: 180, items: [{ id: 'helmet', qty: 1 }, { id: 'pickaxe', qty: 1 }] },
    next: 'q_zombie',
  },
  {
    id: 'q_zombie',
    name: '清剿僵尸',
    giver: 'captain',
    desc: '深入废弃矿洞，击杀 10 只僵尸。',
    steps: [{ type: 'kill', monster: 'zombie', count: 10 }],
    reward: { xp: 220, gold: 200, items: [{ id: 'cloth', qty: 1 }, { id: 'mp_pot', qty: 5 }] },
    next: 'q_mining',
  },
  {
    id: 'q_mining',
    name: '矿工的生计',
    giver: 'captain',
    desc: '装备鹤嘴锄，在废弃矿洞采集 8 块铜矿石，回来交给卫士队长。',
    steps: [{ type: 'collect', item: 'copper_ore', count: 8 }],
    reward: { xp: 300, gold: 260, items: [{ id: 'black_iron', qty: 2 }, { id: 'iron_bracelet', qty: 1 }] },
    next: 'q_skeleton',
  },
  {
    id: 'q_skeleton',
    name: '矿洞白骨',
    giver: 'captain',
    desc: '清理矿洞中的 12 具骷髅，搜集强化用的黑铁矿石。',
    steps: [{ type: 'kill', monster: 'skeleton', count: 12 }],
    reward: { xp: 420, gold: 350, items: [{ id: 'black_iron', qty: 3 }, { id: 'helmet', qty: 1 }] },
    next: 'q_centipede',
  },
  {
    id: 'q_centipede',
    name: '蜈蚣洞异变',
    giver: 'captain',
    desc: '深入蜈蚣洞击杀 12 只巨型蜈蚣，并带回 5 枚蜈蚣甲壳。',
    steps: [
      { type: 'kill', monster: 'centipede', count: 12 },
      { type: 'collect', item: 'centipede_shell', count: 5 },
    ],
    reward: { xp: 540, gold: 460, items: [{ id: 'silver_ore', qty: 3 }, { id: 'magic_ring', qty: 1 }] },
    next: 'q_boar',
  },
  {
    id: 'q_boar',
    name: '石墓红影',
    giver: 'captain',
    desc: '进入石墓阵击杀 10 只红野猪，并带回 4 枚红野猪獠牙。',
    steps: [
      { type: 'kill', monster: 'boar', count: 10 },
      { type: 'collect', item: 'boar_tusk', count: 4 },
    ],
    reward: { xp: 680, gold: 580, items: [{ id: 'power_ring', qty: 1 }, { id: 'hp_pot_b', qty: 5 }] },
    next: 'q_orc',
  },
  {
    id: 'q_orc',
    name: '沃玛先锋',
    giver: 'captain',
    desc: '击杀 8 名沃玛战士，打开寺庙深处的道路。',
    steps: [{ type: 'kill', monster: 'orc', count: 8 }],
    reward: { xp: 620, gold: 500, items: [{ id: 'necklace', qty: 1 }, { id: 'hp_pot_b', qty: 5 }] },
    next: 'q_temple',
  },
  {
    id: 'q_temple',
    name: '寺庙危机',
    giver: 'captain',
    desc: '进入沃玛寺庙，击杀沃玛卫士并带回寺庙令牌。',
    steps: [
      { type: 'kill', monster: 'guardian', count: 1 },
      { type: 'collect', item: 'temple_token', count: 1 },
    ],
    reward: { xp: 800, gold: 800, items: [{ id: 'necklace', qty: 1 }, { id: 'hp_pot_b', qty: 5 }] },
    next: 'q_lord',
  },
  {
    id: 'q_lord',
    name: '余烬中的教主',
    giver: 'captain',
    desc: '挑战沃玛寺庙最深处的沃玛教主，并带回教主印记。',
    steps: [
      { type: 'kill', monster: 'lord', count: 1 },
      { type: 'collect', item: 'lord_seal', count: 1 },
    ],
    reward: { xp: 1800, gold: 2000, items: [{ id: 'blessing_oil', qty: 2 }, { id: 'black_iron', qty: 8 }] },
    next: null,
  },
];
