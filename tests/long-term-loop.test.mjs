import assert from 'node:assert/strict';
import {
  applyPlayerAction, createWorldState, registerPlayer,
} from '../server/local-server.mjs';
import {
  BOUNTIES, ITEMS, MAPS, MONSTERS, SHOP_TOWN, WORLD,
} from '../js/config.js';
import { Player, createItemEntry } from '../js/entities.js';
import { refreshServerStats } from '../js/authoritative-rules.js';

for (let level = 1; level <= 35; level += 1) {
  assert.ok(Object.values(MAPS).some((map) => !map.safe && map.id !== 'sabac'
    && level >= map.recommendedLevel[0] && level <= map.recommendedLevel[1]),
  `level ${level} has at least one authored hunting zone`);
}
assert.ok(Object.values(MONSTERS).some((monster) => monster.level >= 25 && !monster.boss),
  'late progression has repeatable non-boss prey');
assert.equal(SHOP_TOWN.some((id) => ITEMS[id].reqLevel >= 15), false,
  'mid and late progression cannot be skipped through the town shop');

const state = createWorldState();
const session = registerPlayer(state, { name: '长线猎人', classId: 'warrior' }, 1000);
const player = state.players.get(session.player.id);
const act = (action, now) => applyPlayerAction(state, session.token, action, now);
const captain = MAPS.bich.npcs.find((npc) => npc.id === 'captain');
player.mapId = 'bich';
player.x = captain.x * WORLD.tile;
player.y = captain.y * WORLD.tile;
player.level = 30;
player.questId = null;
player.completedQuests = ['q_lord'];
refreshServerStats(player, { fill: true });

assert.equal(act({ type: 'quest_interact', npcId: 'captain' }, 1500).ok, true,
  'post-story captain offers an authoritative repeatable bounty');
assert.equal(player.bounty.id, BOUNTIES[0].id, 'first eligible bounty is deterministic');
player.bounty.progress = BOUNTIES[0].count;
const bountyGold = player.gold;
const bountyXp = player.xp;
assert.equal(act({ type: 'quest_interact', npcId: 'captain' }, 1600).ok, true,
  'completed bounty can be settled at the captain');
assert.equal(player.bounty, null, 'settled bounty clears for the next rotation');
assert.equal(player.bountyCompletions, 1, 'bounty completion becomes permanent progression');
assert.ok(player.gold > bountyGold && player.xp > bountyXp, 'bounty pays growth currency without granting chase equipment');
assert.ok(player.bag.some((entry) => entry.id === 'black_iron'), 'bounty feeds the weapon-upgrade material loop');
assert.equal(act({ type: 'quest_interact', npcId: 'captain' }, 1700).ok, true,
  'next interaction starts the next rotating bounty');
assert.equal(player.bounty.id, BOUNTIES[1].id, 'bounties rotate instead of repeating one target forever');

player.level = 35;
player.equip.weapon = createItemEntry('steel_sword', { rollAffix: false });
player.equip.weapon.luck = 7;
player.enhance.weapon = 5;
player.bountyCompletions = 10;
player.sabacWins = 1;
player.killCounts.lord = 10;
player.skills.slash = { learned: true, level: 3, exp: 360 };
refreshServerStats(player);
assert.equal(act({ type: 'heartbeat' }, 2000).ok, true, 'heartbeat evaluates long-term milestones');
for (const achievementId of ['level_35', 'forge_5', 'luck_7', 'lord_hunter', 'bounty_10', 'sabac_win', 'skill_master']) {
  assert.ok(player.achievements.includes(achievementId), `${achievementId} unlocks authoritatively`);
}
const claimGold = player.gold;
assert.equal(act({ type: 'claim_achievement', achievementId: 'luck_7' }, 2100).ok, true,
  'unlocked achievement reward is claimed through the server ledger');
assert.equal(player.gold, claimGold + 1600, 'achievement claim pays its configured reward exactly once');
assert.equal(act({ type: 'claim_achievement', achievementId: 'luck_7' }, 2200).ok, false,
  'duplicate achievement claim is rejected');

const offline = new Player('warrior', '存档猎人', 0, 0);
const saved = offline.serialize();
saved.questId = null;
saved.bounty = { id: BOUNTIES[0].id, progress: 7 };
saved.bountyCompletions = 4;
const restored = Player.fromSave(saved, 0, 0);
assert.equal(restored.questId, null, 'completed main story does not reset after local save/load');
assert.deepEqual(restored.bounty, saved.bounty, 'active bounty survives local save/load');
assert.equal(restored.bountyCompletions, 4, 'bounty history survives local save/load');

console.log('long-term loop: level bands, rotating hunts, materials, server milestones and completed-story persistence OK');
