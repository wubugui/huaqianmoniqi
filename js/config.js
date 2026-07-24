/** 玛法余烬 · 沙城纪元 — 深度循环配置 */

export const WORLD = { tile: 48, cols: 40, rows: 30 };
export const SAVE_KEY = 'ember_legend_save_v3';
export const SAVE_VERSION = 3;

export const RARITIES = {
  common: { name: '普通', color: '#c8c0ad', power: 1 },
  fine: { name: '精良', color: '#58b5ff', power: 1.12 },
  rare: { name: '稀有', color: '#b983ff', power: 1.28 },
  epic: { name: '史诗', color: '#ffb02e', power: 1.5 },
  legendary: { name: '传说', color: '#ff5a48', power: 1.85 },
};

export const EQUIP_SLOTS = ['weapon', 'armor', 'helmet', 'necklace', 'ring'];
export const SLOT_NAMES = { weapon: '武器', armor: '衣服', helmet: '头盔', necklace: '项链', ring: '戒指' };
export const ENHANCE_MAX = 12;

export function enhanceCost(level) {
  return {
    gold: Math.floor(120 * (level + 1) ** 1.7),
    ore: level < 3 ? 0 : Math.ceil((level - 1) / 2),
    rate: Math.max(0.38, 1 - level * 0.065),
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
      { id: 'slash', name: '基本剑术', key: '1', type: 'passive', mana: 0, cd: 0, desc: '普攻伤害 +8%。' },
      { id: 'thrust', name: '刺杀剑术', key: '2', type: 'boost', mana: 0, cd: 0.5, desc: '下一刀破甲重击。' },
      { id: 'fire_sword', name: '烈火剑法', key: '3', type: 'boost', mana: 10, cd: 7, desc: '下一刀烈火爆发。' },
      { id: 'rush', name: '野蛮冲撞', key: '4', type: 'dash', mana: 12, cd: 10, range: 180, desc: '冲向目标并眩晕。' },
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
    base: { hp: 75, mp: 130, atk: 3, mag: 16, def: 1, magDef: 4, crit: 0.1, dodge: 0.06, lifesteal: 0.01, range: 280, ms: 155, as: 0.95 },
    gain: { hp: 9, mp: 14, atk: 0.3, mag: 3.0, def: 0.3, magDef: 0.9, crit: 0.0015, dodge: 0.0008 },
    skills: [
      { id: 'fireball', name: '火球术', key: '1', type: 'missile', mana: 6, cd: 1.0, range: 320, desc: '火球魔法伤害。' },
      { id: 'lightning', name: '雷电术', key: '2', type: 'target', mana: 14, cd: 3.2, range: 340, desc: '单体落雷。' },
      { id: 'burst', name: '冰咆哮', key: '3', type: 'aoe', mana: 24, cd: 8, range: 300, radius: 120, desc: '范围冰爆。' },
      { id: 'shield', name: '魔法盾', key: '4', type: 'buff', mana: 20, cd: 20, desc: '减伤护盾 8 秒。' },
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
    base: { hp: 100, mp: 100, atk: 7, mag: 11, def: 3, magDef: 5, crit: 0.07, dodge: 0.05, lifesteal: 0.03, range: 230, ms: 160, as: 1.0 },
    gain: { hp: 14, mp: 11, atk: 0.9, mag: 2.1, def: 0.8, magDef: 1.1, crit: 0.001, dodge: 0.0007 },
    skills: [
      { id: 'heal', name: '治愈术', key: '1', type: 'heal', mana: 12, cd: 3.5, desc: '恢复生命。' },
      { id: 'talisman', name: '灵魂火符', key: '2', type: 'missile', mana: 8, cd: 1.2, range: 300, desc: '火符远程。' },
      { id: 'poison', name: '施毒术', key: '3', type: 'target', mana: 12, cd: 5, range: 280, desc: '持续中毒。' },
      { id: 'summon', name: '召唤骷髅', key: '4', type: 'summon', mana: 30, cd: 25, desc: '召唤骷髅助战。' },
    ],
  },
};

export const MONSTERS = {
  deer: {
    id: 'deer', name: '鹿', unit: 'assets/game/mob/deer.png',
    hp: 50, atk: 5, def: 0, magDef: 0, ms: 95, range: 48, xp: 14, gold: [3, 8], aggro: 140, level: 1,
    drops: [{ id: 'hp_pot', rate: 0.28 }, { id: 'wood_sword', rate: 0.06 }, { id: 'deer_meat', rate: 0.35 }],
  },
  zombie: {
    id: 'zombie', name: '僵尸', unit: 'assets/game/mob/zombie.png',
    hp: 110, atk: 11, def: 3, magDef: 1, ms: 72, range: 50, xp: 32, gold: [6, 16], aggro: 190, level: 5,
    drops: [{ id: 'hp_pot', rate: 0.3 }, { id: 'iron_sword', rate: 0.07 }, { id: 'cloth', rate: 0.12 }, { id: 'zombie_arm', rate: 0.25 }],
  },
  skeleton: {
    id: 'skeleton', name: '骷髅', unit: 'assets/game/mob/skeleton.png',
    hp: 160, atk: 16, def: 5, magDef: 2, ms: 100, range: 52, xp: 52, gold: [12, 28], aggro: 210, level: 10,
    drops: [{ id: 'mp_pot', rate: 0.28 }, { id: 'iron_sword', rate: 0.1 }, { id: 'magic_ring', rate: 0.06 }, { id: 'bone', rate: 0.3 }, { id: 'black_iron', rate: 0.08 }],
  },
  bat: {
    id: 'bat', name: '洞穴蝙蝠', unit: 'assets/game/mob/bat.png',
    hp: 90, atk: 14, def: 2, magDef: 3, ms: 130, range: 46, xp: 40, gold: [8, 20], aggro: 220, level: 12,
    drops: [{ id: 'mp_pot', rate: 0.25 }, { id: 'wing_dust', rate: 0.22 }, { id: 'magic_ring', rate: 0.04 }],
  },
  orc: {
    id: 'orc', name: '沃玛战士', unit: 'assets/game/mob/orc.png',
    hp: 280, atk: 26, def: 9, magDef: 4, ms: 105, range: 56, xp: 95, gold: [22, 50], aggro: 240, level: 18,
    drops: [
      { id: 'steel_sword', rate: 0.06 }, { id: 'apprentice_staff', rate: 0.05 }, { id: 'spirit_sword', rate: 0.05 },
      { id: 'heavy_armor', rate: 0.07 }, { id: 'recall', rate: 0.15 }, { id: 'orc_tooth', rate: 0.2 }, { id: 'black_iron', rate: 0.16 },
    ],
  },
  guardian: {
    id: 'guardian', name: '沃玛卫士', unit: 'assets/game/mob/guardian.png',
    hp: 900, atk: 38, def: 14, magDef: 8, ms: 90, range: 60, xp: 320, gold: [80, 160], aggro: 300, level: 25,
    elite: true,
    drops: [
      { id: 'steel_sword', rate: 0.35 }, { id: 'heavy_armor', rate: 0.3 }, { id: 'dragon_blade', rate: 0.12 },
      { id: 'temple_token', rate: 1 }, { id: 'recall', rate: 0.4 }, { id: 'hp_pot_b', rate: 0.5 }, { id: 'black_iron', rate: 0.5 },
    ],
  },
  lord: {
    id: 'lord', name: '沃玛教主', unit: 'assets/game/mob/guardian.png',
    hp: 2400, atk: 52, def: 20, magDef: 16, ms: 96, range: 68, xp: 1200, gold: [260, 520], aggro: 420, level: 32,
    elite: true, boss: true,
    drops: [
      { id: 'dragon_blade', rate: 0.22 }, { id: 'dragon_staff', rate: 0.22 }, { id: 'celestial_talisman', rate: 0.22 },
      { id: 'lord_seal', rate: 1 }, { id: 'blessing_oil', rate: 0.65 }, { id: 'black_iron', rate: 0.9 },
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
  steel_sword: { id: 'steel_sword', name: '裁决之杖', type: 'weapon', slot: 'weapon', price: 1200, sell: 280, desc: '攻击 +26', stats: { atk: 26 } },
  dragon_blade: { id: 'dragon_blade', name: '屠龙', type: 'weapon', slot: 'weapon', price: 5000, sell: 900, desc: '攻击 +42 生命+60', stats: { atk: 42, hp: 60 } },
  apprentice_staff: { id: 'apprentice_staff', name: '海魂法杖', type: 'weapon', slot: 'weapon', price: 720, sell: 160, desc: '法师武器 · 魔法 +18', stats: { mag: 18, mp: 35 }, classes: ['wizard'] },
  dragon_staff: { id: 'dragon_staff', name: '龙牙法杖', type: 'weapon', slot: 'weapon', price: 5200, sell: 960, desc: '法师传说武器 · 魔法 +46', stats: { mag: 46, mp: 90, crit: 0.04 }, classes: ['wizard'] },
  spirit_sword: { id: 'spirit_sword', name: '降魔', type: 'weapon', slot: 'weapon', price: 720, sell: 160, desc: '道士武器 · 道术 +18', stats: { mag: 18, hp: 30 }, classes: ['taoist'] },
  celestial_talisman: { id: 'celestial_talisman', name: '逍遥扇', type: 'weapon', slot: 'weapon', price: 5200, sell: 960, desc: '道士传说武器 · 道术 +42', stats: { mag: 42, hp: 80, lifesteal: 0.05 }, classes: ['taoist'] },
  cloth: { id: 'cloth', name: '布衣', type: 'armor', slot: 'armor', price: 80, sell: 22, desc: '防御 +4', stats: { def: 4 } },
  heavy_armor: { id: 'heavy_armor', name: '重盔甲', type: 'armor', slot: 'armor', price: 900, sell: 200, desc: '防御 +14 生命+50', stats: { def: 14, hp: 50 } },
  magic_ring: { id: 'magic_ring', name: '魔法戒指', type: 'ring', slot: 'ring', price: 450, sell: 110, desc: '魔法 +10', stats: { mag: 10 } },
  power_ring: { id: 'power_ring', name: '力量戒指', type: 'ring', slot: 'ring', price: 450, sell: 110, desc: '攻击 +8', stats: { atk: 8 } },
  necklace: { id: 'necklace', name: '金色项链', type: 'necklace', slot: 'necklace', price: 600, sell: 150, desc: '生命+40 魔防+3', stats: { hp: 40, magDef: 3 } },
  helmet: { id: 'helmet', name: '青铜头盔', type: 'helmet', slot: 'helmet', price: 350, sell: 90, desc: '防御 +5', stats: { def: 5 } },
  deer_meat: { id: 'deer_meat', name: '鹿肉', type: 'quest', price: 0, sell: 2, desc: '任务物品' },
  zombie_arm: { id: 'zombie_arm', name: '僵尸臂', type: 'quest', price: 0, sell: 3, desc: '任务物品' },
  bone: { id: 'bone', name: '骷髅骨', type: 'quest', price: 0, sell: 4, desc: '任务物品' },
  wing_dust: { id: 'wing_dust', name: '蝠翼粉', type: 'quest', price: 0, sell: 5, desc: '任务物品' },
  orc_tooth: { id: 'orc_tooth', name: '沃玛号角', type: 'quest', price: 0, sell: 8, desc: '任务物品' },
  temple_token: { id: 'temple_token', name: '寺庙令牌', type: 'quest', price: 0, sell: 50, desc: '击败卫士的证明' },
  lord_seal: { id: 'lord_seal', name: '教主印记', type: 'quest', price: 0, sell: 120, desc: '击败沃玛教主的证明' },
  black_iron: { id: 'black_iron', name: '黑铁矿石', type: 'material', price: 180, sell: 45, desc: '强化 +4 以上装备所需材料' },
  blessing_oil: { id: 'blessing_oil', name: '祝福油', type: 'consumable', price: 600, sell: 150, desc: '获得 10 分钟祝福：暴击 +5%', use: { blessing: 600 } },
};

Object.assign(ITEMS.wood_sword, { rarity: 'common', icon: 3 });
Object.assign(ITEMS.iron_sword, { rarity: 'fine', icon: 4, reqLevel: 5 });
Object.assign(ITEMS.steel_sword, { rarity: 'epic', icon: 4, reqLevel: 8, classes: ['warrior'] });
Object.assign(ITEMS.dragon_blade, { rarity: 'legendary', icon: 4, reqLevel: 28, classes: ['warrior'], stats: { atk: 42, hp: 60, crit: 0.04 } });
Object.assign(ITEMS.apprentice_staff, { rarity: 'rare', icon: 4, reqLevel: 8 });
Object.assign(ITEMS.dragon_staff, { rarity: 'legendary', icon: 4, reqLevel: 28 });
Object.assign(ITEMS.spirit_sword, { rarity: 'rare', icon: 4, reqLevel: 8 });
Object.assign(ITEMS.celestial_talisman, { rarity: 'legendary', icon: 2, reqLevel: 28 });
Object.assign(ITEMS.cloth, { rarity: 'common', icon: 5 });
Object.assign(ITEMS.heavy_armor, { rarity: 'epic', icon: 5, reqLevel: 18 });
Object.assign(ITEMS.magic_ring, { rarity: 'rare', icon: 1, reqLevel: 10, stats: { mag: 10, crit: 0.02 } });
Object.assign(ITEMS.power_ring, { rarity: 'rare', icon: 1, reqLevel: 10, stats: { atk: 8, crit: 0.02 } });
Object.assign(ITEMS.necklace, { rarity: 'fine', icon: 2, reqLevel: 8 });
Object.assign(ITEMS.helmet, { rarity: 'fine', icon: 5, reqLevel: 6 });
Object.assign(ITEMS.hp_pot, { rarity: 'common', icon: 0 });
Object.assign(ITEMS.hp_pot_b, { rarity: 'fine', icon: 0 });
Object.assign(ITEMS.mp_pot, { rarity: 'common', icon: 1 });
Object.assign(ITEMS.mp_pot_b, { rarity: 'fine', icon: 1 });
Object.assign(ITEMS.recall, { rarity: 'fine', icon: 2 });
Object.assign(ITEMS.black_iron, { rarity: 'rare', icon: 4 });
Object.assign(ITEMS.blessing_oil, { rarity: 'epic', icon: 0 });
for (const item of Object.values(ITEMS)) item.rarity ||= item.type === 'quest' ? 'fine' : 'common';

export const SHOP_TOWN = [
  'hp_pot', 'hp_pot_b', 'mp_pot', 'mp_pot_b', 'recall', 'blessing_oil',
  'wood_sword', 'iron_sword', 'apprentice_staff', 'spirit_sword',
  'cloth', 'helmet', 'magic_ring', 'power_ring', 'necklace',
];

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: '初战告捷', desc: '击败第一只怪物', check: (p) => p.totalKills >= 1, reward: 50 },
  { id: 'hunter', name: '百战猎人', desc: '累计击败 50 只怪物', check: (p) => p.totalKills >= 50, reward: 300 },
  { id: 'level_10', name: '初窥门径', desc: '角色达到 10 级', check: (p) => p.level >= 10, reward: 300 },
  { id: 'rich', name: '腰缠万贯', desc: '持有 2,000 金币', check: (p) => p.gold >= 2000, reward: 500 },
  { id: 'geared', name: '全副武装', desc: '穿满五件装备', check: (p) => EQUIP_SLOTS.every((s) => !!p.equip[s]), reward: 500 },
  { id: 'forge_5', name: '铁匠之友', desc: '任意装备强化到 +5', check: (p) => Object.values(p.enhance).some((v) => v >= 5), reward: 800 },
  { id: 'lord_slayer', name: '沃玛终结者', desc: '击败沃玛教主', check: (p) => (p.killCounts.lord || 0) >= 1, reward: 1500 },
];

export const LEVEL_XP = (() => {
  const a = [0];
  for (let i = 1; i <= 50; i++) a.push(Math.floor(50 + i * 40 + i * i * 10));
  return a;
})();

/** 简易碰撞：1=墙 0=可行走。40x30 格 */
function blankMap(fill = 0) {
  return Array.from({ length: WORLD.rows }, () => Array(WORLD.cols).fill(fill));
}
function ringWalls(grid, margin = 0) {
  const g = grid.map((r) => r.slice());
  for (let y = 0; y < WORLD.rows; y++) {
    for (let x = 0; x < WORLD.cols; x++) {
      if (x <= margin || y <= margin || x >= WORLD.cols - 1 - margin || y >= WORLD.rows - 1 - margin) g[y][x] = 1;
    }
  }
  return g;
}
function rect(g, x0, y0, x1, y1, v = 1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && g[y][x] !== undefined) g[y][x] = v;
}

const townGrid = ringWalls(blankMap(0), 0);
// 建筑块
rect(townGrid, 6, 5, 12, 10, 1);
rect(townGrid, 8, 10, 10, 10, 0); // 门
rect(townGrid, 26, 4, 33, 9, 1);
rect(townGrid, 28, 9, 30, 9, 0);
rect(townGrid, 16, 16, 24, 22, 1);
rect(townGrid, 19, 22, 21, 22, 0);

const fieldGrid = ringWalls(blankMap(0), 0);
rect(fieldGrid, 10, 8, 14, 12, 1); // 岩
rect(fieldGrid, 22, 6, 25, 9, 1);
rect(fieldGrid, 30, 18, 35, 22, 1);
rect(fieldGrid, 5, 20, 9, 24, 1);

const templeGrid = ringWalls(blankMap(0), 0);
// 走廊与房间（外圈墙）
rect(templeGrid, 0, 0, 39, 1, 1);
rect(templeGrid, 0, 28, 39, 29, 1);
rect(templeGrid, 0, 0, 1, 29, 1);
rect(templeGrid, 38, 0, 39, 29, 1);
// 内室
rect(templeGrid, 12, 10, 18, 16, 1);
rect(templeGrid, 14, 16, 16, 16, 0);
rect(templeGrid, 22, 10, 28, 18, 1);
rect(templeGrid, 24, 18, 26, 18, 0);
// 入口走廊保持畅通
rect(templeGrid, 2, 12, 6, 16, 0);
rect(templeGrid, 3, 13, 5, 15, 0);

const caveGrid = ringWalls(blankMap(0), 0);
rect(caveGrid, 10, 5, 12, 20, 1);
rect(caveGrid, 11, 9, 11, 11, 0);
rect(caveGrid, 22, 9, 25, 25, 1);
rect(caveGrid, 23, 17, 24, 19, 0);
rect(caveGrid, 31, 4, 34, 12, 1);
rect(caveGrid, 32, 9, 33, 10, 0);

const sanctumGrid = ringWalls(blankMap(0), 1);
rect(sanctumGrid, 8, 6, 10, 8, 1);
rect(sanctumGrid, 29, 6, 31, 8, 1);
rect(sanctumGrid, 8, 21, 10, 23, 1);
rect(sanctumGrid, 29, 21, 31, 23, 1);
rect(sanctumGrid, 2, 13, 5, 16, 0);

/** 场景装饰图集（脚底锚点精灵 / 地表贴图） */
export const SCENERY = {
  house_a: { src: 'assets/game/scenery/house_a.png', h: 110, anchor: 0.92, block: false },
  house_b: { src: 'assets/game/scenery/house_b.png', h: 120, anchor: 0.92, block: false },
  wall: { src: 'assets/game/scenery/wall.png', h: 70, anchor: 0.9, block: false },
  tree: { src: 'assets/game/scenery/tree.png', h: 96, anchor: 0.94, block: true },
  pine: { src: 'assets/game/scenery/pine.png', h: 100, anchor: 0.94, block: true },
  bush: { src: 'assets/game/scenery/bush.png', h: 42, anchor: 0.92, block: false },
  rock: { src: 'assets/game/scenery/rock.png', h: 56, anchor: 0.92, block: true },
  rock_small: { src: 'assets/game/scenery/rock_small.png', h: 36, anchor: 0.92, block: false },
  grass: { src: 'assets/game/scenery/grass.png', h: 34, anchor: 0.9, block: false },
  flower: { src: 'assets/game/scenery/flower.png', h: 32, anchor: 0.9, block: false },
};

export const TILES = {
  road: 'assets/game/tiles/road.png',
  grass: 'assets/game/tiles/grass.png',
  dirt: 'assets/game/tiles/dirt.png',
};

/** 十字主街 + 广场铺路 */
function makeTownRoads() {
  const set = new Set();
  const add = (x, y) => {
    if (x > 0 && y > 0 && x < WORLD.cols - 1 && y < WORLD.rows - 1) set.add(`${x},${y}`);
  };
  for (let x = 2; x < WORLD.cols - 2; x++) add(x, 13), add(x, 14), add(x, 15);
  for (let y = 2; y < WORLD.rows - 2; y++) add(18, y), add(19, y), add(20, y);
  // 连接各建筑门口
  for (let y = 10; y <= 13; y++) add(9, y);
  for (let y = 9; y <= 13; y++) add(29, y);
  for (let y = 14; y <= 22; y++) add(20, y);
  return [...set].map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
  });
}

const townRoads = makeTownRoads();

/** 野外土路：比奇入口 → 寺庙方向 */
function makeFieldRoads() {
  const set = new Set();
  const add = (x, y) => {
    if (x > 0 && y > 0 && x < WORLD.cols - 1 && y < WORLD.rows - 1) set.add(`${x},${y}`);
  };
  for (let x = 2; x <= 36; x++) add(x, 13), add(x, 14), add(x, 15);
  for (let y = 14; y <= 20; y++) add(35, y), add(36, y);
  return [...set].map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
  });
}

const fieldRoads = makeFieldRoads();

export const MAPS = {
  bich: {
    id: 'bich',
    name: '比奇城',
    safe: true,
    bg: 'assets/game/map/town.jpg',
    ground: 'grass',
    grid: townGrid,
    roads: townRoads,
    decors: [
      // 建筑落在墙体块上
      { id: 'house_a', x: 9, y: 9, h: 118 },
      { id: 'house_b', x: 29.5, y: 8.2, h: 128 },
      { id: 'house_a', x: 20, y: 20.5, h: 115 },
      // 城墙段点缀
      { id: 'wall', x: 4, y: 6, h: 68 },
      { id: 'wall', x: 35, y: 6, h: 68 },
      { id: 'wall', x: 4, y: 24, h: 68 },
      { id: 'wall', x: 35, y: 24, h: 68 },
      // 城内绿化
      { id: 'tree', x: 5, y: 12 },
      { id: 'tree', x: 14, y: 8 },
      { id: 'tree', x: 24, y: 8 },
      { id: 'tree', x: 34, y: 12 },
      { id: 'bush', x: 12, y: 14 },
      { id: 'bush', x: 26, y: 14 },
      { id: 'flower', x: 16, y: 16 },
      { id: 'flower', x: 22, y: 16 },
      { id: 'rock_small', x: 7, y: 17 },
      { id: 'grass', x: 32, y: 18 },
    ],
    spawns: [],
    portals: [
      { x: 36, y: 14, to: 'field', tx: 3, ty: 14, label: '去盟重省' },
    ],
    npcs: [
      { id: 'healer', name: '药店老板', x: 10, y: 12, action: 'heal', sprite: 'healer' },
      { id: 'merchant', name: '杂货商', x: 29, y: 11, action: 'shop', sprite: 'merchant' },
      { id: 'warehouse', name: '仓库管理员', x: 20, y: 23, action: 'warehouse', sprite: 'warehouse' },
      { id: 'captain', name: '卫士队长', x: 18, y: 12, action: 'quest', sprite: 'healer' },
    ],
    playerStart: { x: 18, y: 14 },
    tint: 'rgba(40,50,35,0.08)',
  },
  field: {
    id: 'field',
    name: '盟重省',
    safe: false,
    bg: 'assets/game/map/field.jpg',
    ground: 'grass',
    grid: fieldGrid,
    roads: fieldRoads,
    decors: [
      // 树林带
      { id: 'tree', x: 6, y: 6 }, { id: 'tree', x: 8, y: 7 }, { id: 'pine', x: 7, y: 9 },
      { id: 'tree', x: 16, y: 5 }, { id: 'pine', x: 18, y: 6 }, { id: 'tree', x: 20, y: 5 },
      { id: 'pine', x: 32, y: 7 }, { id: 'tree', x: 34, y: 8 }, { id: 'tree', x: 36, y: 10 },
      { id: 'tree', x: 6, y: 26 }, { id: 'pine', x: 8, y: 27 }, { id: 'tree', x: 12, y: 28 },
      { id: 'pine', x: 28, y: 26 }, { id: 'tree', x: 30, y: 27 },
      // 岩石区（贴合碰撞岩块）
      { id: 'rock', x: 12, y: 11, h: 62 }, { id: 'rock_small', x: 13.5, y: 10 },
      { id: 'rock', x: 23.5, y: 8.5, h: 58 }, { id: 'rock_small', x: 24.5, y: 9.5 },
      { id: 'rock', x: 32.5, y: 21, h: 64 }, { id: 'rock', x: 7, y: 23, h: 60 },
      // 野草花丛
      { id: 'bush', x: 11, y: 15 }, { id: 'bush', x: 22, y: 17 }, { id: 'bush', x: 27, y: 12 },
      { id: 'grass', x: 9, y: 18 }, { id: 'grass', x: 15, y: 20 }, { id: 'grass', x: 25, y: 24 },
      { id: 'grass', x: 33, y: 16 }, { id: 'flower', x: 17, y: 11 }, { id: 'flower', x: 29, y: 15 },
      { id: 'flower', x: 21, y: 22 }, { id: 'rock_small', x: 19, y: 19 },
    ],
    spawns: [
      { monster: 'deer', count: 12, x: 10, y: 10, r: 6 },
      { monster: 'zombie', count: 10, x: 26, y: 12, r: 6 },
      { monster: 'skeleton', count: 8, x: 30, y: 22, r: 5 },
      { monster: 'orc', count: 5, x: 14, y: 22, r: 5 },
    ],
    portals: [
      { x: 2, y: 14, to: 'bich', tx: 34, ty: 14, label: '回比奇城' },
      { x: 36, y: 20, to: 'cave', tx: 4, ty: 14, label: '废弃矿洞', reqLevel: 3 },
    ],
    npcs: [],
    playerStart: { x: 5, y: 14 },
    tint: 'rgba(20,40,20,0.12)',
  },
  cave: {
    id: 'cave',
    name: '废弃矿洞',
    safe: false,
    bg: 'assets/game/map/temple.jpg',
    ground: 'dirt',
    grid: caveGrid,
    roads: [],
    decors: [
      { id: 'rock', x: 8, y: 7 }, { id: 'rock_small', x: 17, y: 9 },
      { id: 'rock', x: 28, y: 21 }, { id: 'wall', x: 11, y: 16 },
      { id: 'grass', x: 18, y: 23 }, { id: 'rock_small', x: 35, y: 18 },
    ],
    spawns: [
      { monster: 'zombie', count: 14, x: 8, y: 18, r: 5 },
      { monster: 'skeleton', count: 12, x: 19, y: 8, r: 6 },
      { monster: 'bat', count: 10, x: 30, y: 20, r: 5 },
    ],
    portals: [
      { x: 3, y: 14, to: 'field', tx: 34, ty: 20, label: '回盟重省' },
      { x: 36, y: 14, to: 'temple', tx: 4, ty: 14, label: '沃玛寺庙', reqLevel: 5 },
    ],
    npcs: [],
    playerStart: { x: 5, y: 14 },
    tint: 'rgba(14,8,20,0.34)',
  },
  temple: {
    id: 'temple',
    name: '沃玛寺庙',
    safe: false,
    bg: 'assets/game/map/temple.jpg',
    ground: 'dirt',
    grid: templeGrid,
    roads: [],
    decors: [
      { id: 'rock', x: 8, y: 8, h: 58 }, { id: 'rock_small', x: 10, y: 9 },
      { id: 'rock', x: 30, y: 8, h: 58 }, { id: 'rock', x: 32, y: 22, h: 60 },
      { id: 'rock_small', x: 18, y: 22 }, { id: 'bush', x: 6, y: 20 },
      { id: 'grass', x: 12, y: 24 }, { id: 'grass', x: 26, y: 24 },
      { id: 'wall', x: 14, y: 12, h: 72 }, { id: 'wall', x: 26, y: 12, h: 72 },
    ],
    spawns: [
      { monster: 'bat', count: 10, x: 10, y: 8, r: 5 },
      { monster: 'bat', count: 8, x: 28, y: 8, r: 4 },
      { monster: 'orc', count: 6, x: 12, y: 20, r: 4 },
      { monster: 'skeleton', count: 6, x: 28, y: 20, r: 4 },
      { monster: 'guardian', count: 1, x: 20, y: 14, r: 1 },
    ],
    portals: [
      { x: 3, y: 14, to: 'cave', tx: 34, ty: 14, label: '回废弃矿洞' },
      { x: 36, y: 14, to: 'sanctum', tx: 4, ty: 14, label: '沃玛内殿', reqLevel: 7 },
    ],
    npcs: [],
    playerStart: { x: 5, y: 14 },
    tint: 'rgba(10,5,20,0.28)',
  },
  sanctum: {
    id: 'sanctum',
    name: '沃玛内殿',
    safe: false,
    bg: 'assets/game/map/temple.jpg',
    ground: 'dirt',
    grid: sanctumGrid,
    roads: [],
    decors: [
      { id: 'wall', x: 9, y: 8 }, { id: 'wall', x: 30, y: 8 },
      { id: 'wall', x: 9, y: 23 }, { id: 'wall', x: 30, y: 23 },
      { id: 'rock', x: 15, y: 8 }, { id: 'rock', x: 25, y: 22 },
    ],
    spawns: [
      { monster: 'orc', count: 8, x: 12, y: 14, r: 5 },
      { monster: 'guardian', count: 2, x: 25, y: 14, r: 5 },
      { monster: 'lord', count: 1, x: 32, y: 14, r: 1 },
    ],
    portals: [
      { x: 3, y: 14, to: 'temple', tx: 34, ty: 14, label: '回沃玛寺庙' },
    ],
    npcs: [],
    playerStart: { x: 5, y: 14 },
    tint: 'rgba(35,3,3,0.3)',
  },
};

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
    next: 'q_zombie',
  },
  {
    id: 'q_zombie',
    name: '清剿僵尸',
    giver: 'captain',
    desc: '深入废弃矿洞，击杀 10 只僵尸。',
    steps: [{ type: 'kill', monster: 'zombie', count: 10 }],
    reward: { xp: 220, gold: 200, items: [{ id: 'cloth', qty: 1 }, { id: 'mp_pot', qty: 5 }] },
    next: 'q_skeleton',
  },
  {
    id: 'q_skeleton',
    name: '矿洞白骨',
    giver: 'captain',
    desc: '清理矿洞中的 12 具骷髅，搜集强化用的黑铁矿石。',
    steps: [{ type: 'kill', monster: 'skeleton', count: 12 }],
    reward: { xp: 420, gold: 350, items: [{ id: 'black_iron', qty: 3 }, { id: 'helmet', qty: 1 }] },
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
