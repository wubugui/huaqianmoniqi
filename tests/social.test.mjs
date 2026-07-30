import assert from 'node:assert/strict';
import {
  applyPlayerAction, createWorldState, registerPlayer, worldSnapshot,
} from '../server/local-server.mjs';
import { addServerItem } from '../js/authoritative-rules.js';

const state = createWorldState();
const first = registerPlayer(state, {
  name: '战士甲',
  classId: 'warrior',
  bag: [{ id: 'iron_sword', qty: 1, uid: 101 }],
  gold: 100,
}, 1000);
const second = registerPlayer(state, {
  name: '法师乙',
  classId: 'wizard',
  bag: [{ id: 'magic_ring', qty: 1, uid: 202 }],
  gold: 50,
}, 1000);
const third = registerPlayer(state, { name: '道士丙', classId: 'taoist' }, 1000);
const firstInternal = state.players.get(first.player.id);
const secondInternal = state.players.get(second.player.id);
firstInternal.bag = [{ id: 'iron_sword', qty: 1, uid: 'trade-iron', durability: 8, maxDurability: 8, enhance: 0, luck: 0, curse: 0, bonus: {} }];
firstInternal.gold = 100;
secondInternal.bag = [{ id: 'magic_ring', qty: 1, uid: 'trade-ring', durability: 7, maxDurability: 7, enhance: 0, luck: 0, curse: 0, bonus: {} }];
secondInternal.gold = 50;

const act = (session, action, now) => applyPlayerAction(state, session.token, action, now);

assert.equal(act(first, { type: 'friend_request', targetId: second.player.id }, 1500).ok, true, 'friend request succeeds');
assert.equal(worldSnapshot(state, second.token).social.friendRequests[0].id, first.player.id, 'friend request reaches target');
assert.equal(act(second, { type: 'friend_accept', targetId: first.player.id }, 1600).ok, true, 'friend acceptance succeeds');
assert.equal(worldSnapshot(state, first.token).social.friends[0].id, second.player.id, 'friendship is mutual');

assert.equal(act(first, { type: 'team_invite', targetId: second.player.id }, 1700).ok, true, 'team invitation succeeds');
assert.equal(act(second, { type: 'team_accept', targetId: first.player.id }, 1800).ok, true, 'team invitation can be accepted');
const team = worldSnapshot(state, first.token).social.team;
assert.equal(team.members.length, 2, 'accepted team contains both players');

firstInternal.level = 20;
firstInternal.gold = 1000;
addServerItem(firstInternal, { id: 'orc_tooth', qty: 1 });
assert.equal(act(first, { type: 'guild_create', name: '玛法兄弟会' }, 1900).ok, true, 'guild creation succeeds');
assert.equal(firstInternal.gold, 0, 'guild creation charges the authoritative founding cost');
assert.equal(firstInternal.bag.some((entry) => entry.id === 'orc_tooth'), false, 'guild creation consumes the Woma horn');
assert.equal(act(first, { type: 'guild_invite', targetId: second.player.id }, 2000).ok, true, 'guild leader can invite a player');
const guildInvite = worldSnapshot(state, second.token).social.guildInvites[0];
assert.equal(guildInvite.name, '玛法兄弟会', 'guild invitation identifies the guild');
assert.equal(act(second, { type: 'guild_accept', guildId: guildInvite.id }, 2100).ok, true, 'guild invitation can be accepted');
assert.equal(worldSnapshot(state, first.token).social.guild.members.length, 2, 'guild roster contains accepted member');
firstInternal.gold = 100;

const worldChat = act(first, { type: 'chat', channel: 'world', text: '沙城集合！' }, 2600);
assert.equal(worldChat.ok, true, 'world chat message succeeds');
assert.equal(worldChat.message.text, '沙城集合！', 'successful chat returns the authoritative message for immediate UI echo');
assert.equal(worldSnapshot(state, third.token).social.messages.at(-1).text, '沙城集合！', 'world chat is visible to all players');
assert.equal(act(first, { type: 'chat', channel: 'team', text: '队伍出发' }, 3200).ok, true, 'team chat message succeeds');
assert.equal(worldSnapshot(state, second.token).social.messages.at(-1).text, '队伍出发', 'team chat reaches team members');
assert.notEqual(worldSnapshot(state, third.token).social.messages.at(-1)?.text, '队伍出发', 'team chat is hidden from outsiders');

assert.equal(act(first, { type: 'trade_request', targetId: second.player.id }, 3500).ok, true, 'trade request succeeds');
const tradeId = worldSnapshot(state, second.token).social.trade.id;
assert.equal(act(second, { type: 'trade_accept', tradeId }, 3600).ok, true, 'trade request can be accepted');
assert.equal(act(first, { type: 'trade_offer', tradeId, itemIndex: 0, gold: 10 }, 3700).ok, true, 'first player submits item and gold offer');
assert.equal(act(second, { type: 'trade_offer', tradeId, itemIndex: 0, gold: 5 }, 3800).ok, true, 'second player submits item and gold offer');
assert.equal(act(first, { type: 'trade_confirm', tradeId }, 3900).ok, true, 'first trade confirmation succeeds');
assert.equal(act(second, { type: 'trade_confirm', tradeId }, 4000).ok, true, 'second confirmation atomically commits trade');

assert.equal(firstInternal.bag[0].id, 'magic_ring', 'first player receives second player item');
assert.equal(secondInternal.bag[0].id, 'iron_sword', 'second player receives first player item');
assert.equal(firstInternal.gold, 95, 'first player gold is atomically exchanged');
assert.equal(secondInternal.gold, 55, 'second player gold is atomically exchanged');
assert.ok(worldSnapshot(state, first.token).social.events.some((event) => event.type === 'trade_complete'), 'trade completion event reaches first player');
assert.ok(worldSnapshot(state, second.token).social.events.some((event) => event.type === 'trade_complete'), 'trade completion event reaches second player');

assert.equal(act(first, { type: 'team_invite', targetId: third.player.id }, 4200).ok, true, 'team leader can extend the roster');
assert.equal(act(third, { type: 'team_accept', targetId: first.player.id }, 4300).ok, true, 'third player joins the existing team');
assert.equal(act(first, { type: 'team_promote', targetId: second.player.id }, 4400).ok, true, 'team leader can transfer leadership');
assert.equal(act(second, { type: 'team_kick', targetId: third.player.id }, 4500).ok, true, 'new team leader can remove a member');
assert.equal(state.players.get(third.player.id).teamId, null, 'removed member leaves the authoritative team');

assert.equal(act(first, { type: 'guild_invite', targetId: third.player.id }, 4600).ok, true, 'guild leader can invite a third member');
const thirdGuildInvite = worldSnapshot(state, third.token).social.guildInvites[0];
assert.equal(act(third, { type: 'guild_accept', guildId: thirdGuildInvite.id }, 4700).ok, true, 'third member joins the guild');
assert.equal(act(first, { type: 'guild_promote', targetId: second.player.id }, 4800).ok, true, 'guild leadership can be transferred');
assert.equal(act(second, { type: 'guild_kick', targetId: third.player.id }, 4900).ok, true, 'new guild leader can remove a member outside wartime');
assert.equal(state.players.get(third.player.id).guildId, null, 'removed member leaves the authoritative guild');

console.log('social: chat, friends, governed teams/guilds and atomic face-to-face trade OK');
