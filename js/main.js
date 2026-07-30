import { Game, loadAssets, CLASSES, ITEMS, SHOP, QUESTS, RECIPES } from './game.js?v=0.9.23';
import {
  ACHIEVEMENTS, BOUNTIES, ENHANCE_MAX, EQUIP_SLOTS, ITEM_TYPE_NAMES, MAPS, MONSTERS, RARITIES, SKILL_LEVEL_XP, SKILL_MAX_LEVEL,
  SLOT_NAMES, WORLD, enhanceCost,
} from './config.js?v=0.9.21';
import { hasSave, loadGame, clearSave } from './save.js';
import { SoundSystem } from './audio.js?v=0.9.13';
import { MultiplayerClient } from './network.js?v=0.9.10';
import { WORLD_MAP_LAYOUT, directionLabel, distanceInTiles, findWorldRoute, portalForLeg } from './navigation.js?v=0.9.17';

const $ = (selector) => document.querySelector(selector);
const screens = { menu: $('#screen-menu'), pick: $('#screen-pick'), game: $('#screen-game') };
const panelIds = ['bag', 'character', 'skill-learning', 'achievements', 'social', 'world-map', 'shop', 'warehouse', 'npc-dialogue', 'settings'];
// Classic PC ARPG panels remain usable under pressure; combat keeps running and
// only the full-screen navigation map yields when the player is hit.
const combatBlockingPanels = [];
const damageClosingPanels = ['world-map'];
const sound = new SoundSystem();
const RENDER_QUALITY_KEY = 'ember_render_quality';
const AUDIO_BUS_CONTROLS = ['music', 'ambience', 'combat', 'ui'];

function readRenderQuality() {
  try {
    const value = localStorage.getItem(RENDER_QUALITY_KEY);
    return ['performance', 'balanced', 'quality'].includes(value) ? value : 'balanced';
  } catch {
    return 'balanced';
  }
}

function writeRenderQuality(value) {
  try { localStorage.setItem(RENDER_QUALITY_KEY, value); } catch {}
}

function audioRegionForMap(mapId) {
  if (mapId === 'bich' || mapId === 'sabac') return 'town';
  if (mapId === 'field' || mapId === 'valley') return 'wild';
  return 'dungeon';
}

function syncRegionAudio(mapId) {
  const region = audioRegionForMap(mapId);
  sound.setRegionMusic(region);
  sound.setRegionSpace(region);
}

let renderQuality = readRenderQuality();

let assets = null;
let game = null;
let selected = null;
let raf = 0;
let last = 0;
let lastHudSync = 0;
let lastPanelSync = 0;
let lastObservedHp = null;
let lastPanelEvac = 0;
let questOpen = true;
let achievementTimer = 0;
let network = null;
let socialState = null;
let lastChatSignature = '';
let lastBagAuthorityVersion = -1;
let selectedSocialTarget = null;
let selectedMapDestination = 'bich';
let activeWorldDestination = null;
let routeLegFrom = null;
let routeLegTo = null;
let lastRouteMapId = null;
let routeContinueTimer = 0;
let gameLaunchPending = false;
let spaceAttackArmed = true;
const localChatNotices = [];
const handledNetworkEvents = new Set();
const pendingSkillLearning = new Set();
const held = new Set();

function triggerBasicAttack() {
  if (!game) return;
  // Keep the skill-bar button from retaining focus; a focused <button> turns
  // subsequent Space keydowns into browser-generated click repeats.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  game.attackNearest();
}

function show(name) {
  Object.values(screens).forEach((el) => el.classList.remove('active'));
  screens[name].classList.add('active');
}

function isOpen(id) {
  return !$(id.startsWith('#') ? id : `#${id}`).classList.contains('hidden');
}

function closePanels(except = []) {
  for (const id of panelIds) {
    if (!except.includes(id)) $(`#${id}`).classList.add('hidden');
  }
}

function closeMobileUtility() {
  $('#mobile-utility').classList.add('hidden');
  $('#mobile-more').setAttribute('aria-expanded', 'false');
}

function closeMobileChat({ blur = true } = {}) {
  $('#chat-panel').classList.remove('mobile-open');
  document.documentElement.classList.remove('mobile-chat-focus');
  if (blur) $('#chat-input').blur();
}

function syncVisualViewport() {
  const viewport = window.visualViewport;
  const layoutHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
  const visibleHeight = viewport?.height || layoutHeight;
  const keyboardInset = Math.max(0, layoutHeight - visibleHeight - (viewport?.offsetTop || 0));
  document.documentElement.style.setProperty('--visual-viewport-height', `${Math.round(visibleHeight)}px`);
  document.documentElement.style.setProperty('--keyboard-inset', `${Math.round(keyboardInset)}px`);
  game?.resize();
}

function openPanel(id, keep = []) {
  const panel = $(`#${id}`);
  const opening = panel.classList.contains('hidden');
  if (opening && combatBlockingPanels.includes(id) && game?.isThreatened()) {
    hint('附近存在威胁，暂时无法打开大型界面');
    return;
  }
  if (opening) {
    closeMobileUtility();
    closeMobileChat();
  }
  closePanels(opening ? [id, ...keep] : keep);
  panel.classList.toggle('hidden', !opening);
  sound.play(opening ? 'uiOpen' : 'uiClose');
  if (!opening) return;
  if (id === 'bag') syncBag();
  if (id === 'character') syncCharacter();
  if (id === 'skill-learning') syncSkillLearning();
  if (id === 'achievements') syncAchievements();
  if (id === 'social') syncSocial();
  if (id === 'world-map') syncWorldMap();
  if (id === 'warehouse') syncWarehouse();
  if (id === 'settings') syncSettings();
}

function makeUiElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function routeRequiredLevel(route) {
  let required = 1;
  for (let index = 0; index < route.length - 1; index++) {
    required = Math.max(required, portalForLeg(route[index], route[index + 1])?.reqLevel || 1);
  }
  return required;
}

function routeEdgeKey(from, to) {
  return [from, to].sort().join(':');
}

function appendRouteChain(container, route) {
  const chain = makeUiElement('div', 'world-route-chain');
  route.forEach((mapId, index) => {
    chain.appendChild(makeUiElement('span', '', MAPS[mapId]?.name || mapId));
    if (index < route.length - 1) chain.appendChild(makeUiElement('i', '', '→'));
  });
  container.appendChild(chain);
}

function syncWorldMap() {
  if (!game) return;
  if (!MAPS[selectedMapDestination]) selectedMapDestination = game.mapId;
  const route = findWorldRoute(game.mapId, selectedMapDestination);
  const activeEdges = new Set(route.slice(0, -1).map((from, index) => routeEdgeKey(from, route[index + 1])));
  const routesSvg = $('#world-map-routes');
  const nodes = $('#world-map-nodes');
  routesSvg.replaceChildren();
  nodes.replaceChildren();

  const renderedEdges = new Set();
  for (const [mapId, map] of Object.entries(MAPS)) {
    for (const portal of map.portals || []) {
      const edge = routeEdgeKey(mapId, portal.to);
      if (renderedEdges.has(edge) || !WORLD_MAP_LAYOUT[mapId] || !WORLD_MAP_LAYOUT[portal.to]) continue;
      renderedEdges.add(edge);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', WORLD_MAP_LAYOUT[mapId].x);
      line.setAttribute('y1', WORLD_MAP_LAYOUT[mapId].y);
      line.setAttribute('x2', WORLD_MAP_LAYOUT[portal.to].x);
      line.setAttribute('y2', WORLD_MAP_LAYOUT[portal.to].y);
      if (activeEdges.has(edge)) line.classList.add('active');
      routesSvg.appendChild(line);
    }
  }

  for (const [mapId, map] of Object.entries(MAPS)) {
    const layout = WORLD_MAP_LAYOUT[mapId];
    if (!layout) continue;
    const nodeRoute = findWorldRoute(game.mapId, mapId);
    const required = routeRequiredLevel(nodeRoute);
    const button = makeUiElement('button', 'world-map-node');
    button.type = 'button';
    button.style.left = `${layout.x}%`;
    button.style.top = `${layout.y}%`;
    button.classList.toggle('current', mapId === game.mapId);
    button.classList.toggle('selected', mapId === selectedMapDestination);
    button.classList.toggle('locked', required > game.player.level);
    button.setAttribute('aria-label', `${map.name}，推荐 ${map.recommendedLevel[0]} 至 ${map.recommendedLevel[1]} 级`);
    button.appendChild(makeUiElement('strong', '', map.name));
    button.appendChild(makeUiElement(
      'small',
      '',
      required > game.player.level
        ? `需 Lv.${required}`
        : `推荐 Lv.${map.recommendedLevel[0]}–${map.recommendedLevel[1]}`,
    ));
    button.onclick = () => {
      selectedMapDestination = mapId;
      syncWorldMap();
    };
    nodes.appendChild(button);
  }

  $('#world-current-copy').textContent = `${game.map.name} · Lv.${game.player.level}`;
  const summary = $('#world-route-summary');
  summary.replaceChildren();
  summary.appendChild(makeUiElement('h4', '', selectedMapDestination === game.mapId ? '当前位置' : `前往 ${MAPS[selectedMapDestination].name}`));
  if (route.length <= 1) {
    summary.appendChild(makeUiElement('p', '', `你正在 ${game.map.name}。点击其他地区即可查看完整换乘路线。`));
  } else {
    const requirement = routeRequiredLevel(route);
    summary.appendChild(makeUiElement('p', '', `共经过 ${route.length - 1} 个出口，路线按当前地图的真实传送门生成。`));
    appendRouteChain(summary, route);
    const startButton = makeUiElement(
      'button',
      'btn tiny primary',
      requirement > game.player.level ? `需要达到 Lv.${requirement}` : '开始全程自动寻路',
    );
    startButton.type = 'button';
    startButton.disabled = requirement > game.player.level;
    startButton.onclick = () => startWorldNavigation(selectedMapDestination);
    summary.appendChild(startButton);
  }

  const exits = $('#world-exit-list');
  exits.replaceChildren();
  for (const portal of game.portals) {
    const targetMap = MAPS[portal.to];
    const locked = (portal.reqLevel || 1) > game.player.level;
    const direction = directionLabel(game.player.x, game.player.y, portal.x, portal.y);
    const distance = distanceInTiles(game.player.x, game.player.y, portal.x, portal.y, WORLD.tile);
    const row = makeUiElement('article', `world-exit-row${locked ? ' locked' : ''}`);
    const copy = makeUiElement('div');
    copy.appendChild(makeUiElement('strong', '', `${portal.label} · ${targetMap.name}`));
    copy.appendChild(makeUiElement(
      'span',
      '',
      `${direction}方约 ${distance} 格${portal.reqLevel ? ` · 进入需 Lv.${portal.reqLevel}` : ''}`,
    ));
    const button = makeUiElement('button', 'btn tiny', locked ? '等级不足' : '自动寻路');
    button.type = 'button';
    button.disabled = locked;
    button.onclick = () => startWorldNavigation(portal.to);
    row.append(copy, button);
    exits.appendChild(row);
  }

  const selectedMap = MAPS[selectedMapDestination];
  const detail = $('#world-region-detail');
  detail.replaceChildren();
  detail.appendChild(makeUiElement('h4', '', selectedMap.name));
  detail.appendChild(makeUiElement('p', 'world-region-level', `推荐等级 Lv.${selectedMap.recommendedLevel[0]}–${selectedMap.recommendedLevel[1]} · ${selectedMap.safe ? '安全区' : '危险区域'}`));
  detail.appendChild(makeUiElement('p', '', selectedMap.scenePlan?.story || '这片区域尚无游历记载。'));
  const zones = makeUiElement('div', 'world-region-zones');
  for (const zone of selectedMap.scenePlan?.zones || []) zones.appendChild(makeUiElement('span', '', zone));
  detail.appendChild(zones);
}

function syncWorldRouteTracker() {
  const tracker = $('#route-hud');
  if (!game || !activeWorldDestination || !MAPS[activeWorldDestination]) {
    tracker.classList.add('hidden');
    return;
  }
  const route = findWorldRoute(game.mapId, activeWorldDestination);
  if (route.length === 1) {
    const destinationName = MAPS[activeWorldDestination].name;
    activeWorldDestination = null;
    routeLegFrom = null;
    routeLegTo = null;
    tracker.classList.add('hidden');
    hint(`已抵达 ${destinationName}`);
    return;
  }
  if (route.length < 1) {
    $('#route-title').textContent = `前往 ${MAPS[activeWorldDestination].name}`;
    $('#route-step').textContent = '当前无法规划跨图路线';
    const nextButton = $('#btn-route-next');
    nextButton.textContent = '重试';
    nextButton.disabled = false;
    tracker.classList.remove('hidden');
    return;
  }
  const nextMapId = route[1];
  const transitioning = !!(game.portalLoading || game.awaitingMapAck);
  const navigating = !transitioning
    && routeLegFrom === game.mapId
    && routeLegTo === nextMapId
    && game.pendingPortal?.to === nextMapId;
  $('#route-title').textContent = `前往 ${MAPS[activeWorldDestination].name}`;
  $('#route-step').textContent = transitioning
    ? `${game.map.name} → ${MAPS[nextMapId].name} · 传送中…`
    : `${game.map.name} → ${MAPS[nextMapId].name} · 剩余 ${route.length - 1} 段`;
  const nextButton = $('#btn-route-next');
  nextButton.textContent = transitioning ? '传送中' : navigating ? '寻路中' : '继续';
  nextButton.disabled = transitioning || navigating;
  tracker.classList.remove('hidden');
}

function startWorldNavigation(destination, { silent = false } = {}) {
  if (!game || !MAPS[destination]) return;
  window.clearTimeout(routeContinueTimer);
  selectedMapDestination = destination;
  const route = findWorldRoute(game.mapId, destination);
  if (route.length <= 1) {
    activeWorldDestination = destination;
    syncWorldRouteTracker();
    return;
  }
  const nextMapId = route[1];
  const portal = game.portals.find((entry) => entry.to === nextMapId);
  if (!portal) {
    hint(`未找到通往 ${MAPS[nextMapId].name} 的出口`);
    return;
  }
  if ((portal.reqLevel || 1) > game.player.level) {
    hint(`进入 ${MAPS[nextMapId].name} 需要达到 ${portal.reqLevel} 级`);
    return;
  }
  activeWorldDestination = destination;
  routeLegFrom = game.mapId;
  routeLegTo = nextMapId;
  game.approachPortal(portal);
  $('#world-map').classList.add('hidden');
  syncWorldRouteTracker();
  if (!silent) hint(`自动寻路：${portal.label}，将继续前往 ${MAPS[destination].name}`);
}

function cancelWorldNavigation() {
  window.clearTimeout(routeContinueTimer);
  activeWorldDestination = null;
  routeLegFrom = null;
  routeLegTo = null;
  if (game?.pendingPortal) {
    game.pendingPortal = null;
    game.navigationPath = [];
    game.player.moveGoal = null;
  }
  $('#route-hud').classList.add('hidden');
  hint('已取消自动寻路');
}

function handleRouteMapChange() {
  if (!game || game.mapId === lastRouteMapId) return;
  lastRouteMapId = game.mapId;
  routeLegFrom = null;
  routeLegTo = null;
  if (isOpen('world-map')) syncWorldMap();
  syncWorldRouteTracker();
  if (!activeWorldDestination || activeWorldDestination === game.mapId) {
    if (activeWorldDestination === game.mapId) syncWorldRouteTracker();
    return;
  }
  if (game.portalLoading || game.awaitingMapAck) return;
  const mapAtArrival = game.mapId;
  window.clearTimeout(routeContinueTimer);
  routeContinueTimer = window.setTimeout(() => {
    if (
      game?.mapId === mapAtArrival
      && activeWorldDestination
      && !game.portalLoading
      && !game.awaitingMapAck
    ) {
      startWorldNavigation(activeWorldDestination, { silent: true });
    }
  }, 280);
}

async function boot() {
  wireStaticActions();
  wireConnectionLifecycle();
  $('#btn-continue').classList.toggle('hidden', !hasSave());
  try {
    assets = await loadAssets();
    $('#load-status').innerHTML = '<span></span>玛法大陆已就绪';
  } catch (error) {
    console.error(error);
    $('#load-status').textContent = `资源整备失败：${error.message}`;
  }
}

function wireConnectionLifecycle() {
  window.addEventListener('pagehide', () => network?.close({ notify: true }));
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && network && game) network.connect();
  });
  window.addEventListener('online', () => {
    if (network && game && !network.connected) network.connect();
  });
  window.addEventListener('offline', () => network?.handleConnectionFailure('offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && network && game && !network.connected) network.connect();
  });
}

function wireStaticActions() {
  $('#btn-start').onclick = () => { buildClassPick(); show('pick'); };
  $('#btn-continue').onclick = continueGame;
  $('#btn-back').onclick = () => show('menu');
  $('#btn-enter').onclick = startGame;
  $('#btn-menu-help').onclick = () => {
    window.alert('鼠标或触屏移动与攻击；WASD 自由移动；1—4 技能；G 拾取；H 采集；F1/F2 药水；B 背包；C 角色强化；K 技能学习；I 物品图鉴；M 世界地图与自动寻路；Y 成就；空格普通攻击。');
  };

  $('#btn-bag').onclick = () => openPanel('bag');
  $('#map-name').onclick = () => openPanel('world-map');
  $('#btn-character').onclick = () => openPanel('character');
  $('#btn-char').onclick = () => openPanel('character');
  $('#btn-skills').onclick = () => openPanel('skill-learning');
  $('#btn-achievements').onclick = () => openPanel('achievements');
  $('#btn-pk-mode').onclick = () => { game?.cyclePkMode(); syncHud(); };
  $('#btn-social').onclick = () => openPanel('social');
  $('#btn-codex').onclick = () => openShop('codex-only');
  $('#btn-world-map').onclick = () => openPanel('world-map');
  $('#btn-settings').onclick = () => openPanel('settings');
  $('#btn-bag-close').onclick = () => $('#bag').classList.add('hidden');
  $('#btn-char-close').onclick = () => $('#character').classList.add('hidden');
  $('#btn-skills-close').onclick = () => $('#skill-learning').classList.add('hidden');
  $('#btn-ach-close').onclick = () => $('#achievements').classList.add('hidden');
  $('#btn-social-close').onclick = () => $('#social').classList.add('hidden');
  $('#btn-world-map-close').onclick = () => $('#world-map').classList.add('hidden');
  $('#btn-shop-close').onclick = () => $('#shop').classList.add('hidden');
  $('#btn-shop-stock').onclick = () => openShop('shop');
  $('#btn-item-codex').onclick = () => openShop('codex');
  $('#btn-wh-close').onclick = () => $('#warehouse').classList.add('hidden');
  $('#btn-npc-close').onclick = closeNpcDialogue;
  $('#btn-npc-leave').onclick = closeNpcDialogue;
  $('#btn-settings-close').onclick = () => $('#settings').classList.add('hidden');
  $('#btn-quest-toggle').onclick = toggleQuest;
  $('#btn-route-next').onclick = () => {
    if (activeWorldDestination) startWorldNavigation(activeWorldDestination);
  };
  $('#btn-route-cancel').onclick = cancelWorldNavigation;

  $('#btn-potion-hp').onclick = () => usePotion('hp');
  $('#btn-potion-mp').onclick = () => usePotion('mp');
  $('#btn-town').onclick = useRecall;
  $('#btn-sell').onclick = () => { game?.sellSelected(); syncBag(); syncHud(); };
  $('#btn-deposit').onclick = () => { game?.depositSelected(); syncBag(); syncWarehouse(); };
  $('#btn-repair').onclick = () => {
    game?.repairAll();
    syncBag();
    syncCharacter();
    syncHud();
  };
  $('#btn-chat-send').onclick = sendChat;
  $('#chat-input').onkeydown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); sendChat(); }
  };
  $('#chat-input').addEventListener('focus', () => {
    document.documentElement.classList.add('mobile-chat-focus');
    syncVisualViewport();
  });
  $('#chat-input').addEventListener('blur', () => {
    document.documentElement.classList.remove('mobile-chat-focus');
    syncVisualViewport();
  });
  $('#btn-friend-add').onclick = () => sendTargetAction('friend_request');
  $('#btn-team-invite').onclick = () => sendTargetAction('team_invite');
  $('#btn-guild-invite').onclick = () => sendTargetAction('guild_invite');
  $('#btn-trade-request').onclick = () => sendTargetAction('trade_request');
  $('#btn-guild-war').onclick = () => {
    if (!selectedSocialTarget?.guildId) { hint('目标玩家尚未加入行会'); return; }
    sendSocialAction({ type: 'guild_war_declare', targetGuildId: selectedSocialTarget.guildId });
  };
  $('#btn-sabac-declare').onclick = () => {
    if ((game?.player.level || 0) < 30) { hint('申请攻城需要会长达到30级'); return; }
    if ((game?.player.gold || 0) < 5000 || game?.player.countItem('lord_seal') < 1) {
      hint('申请攻城需要教主印记 ×1 和 5000 金币军费');
      return;
    }
    sendSocialAction({ type: 'sabac_declare' });
  };
  $('#btn-siege-attack').onclick = () => sendSocialAction({ type: 'sabac_objective_attack', skillId: 'basic' });
  $('#btn-guild-create').onclick = async () => {
    const name = $('#guild-name').value.trim();
    if (!name) { hint('请输入行会名'); return; }
    if ((game?.player.level || 0) < 20) { hint('创建行会需要角色达到20级'); return; }
    if ((game?.player.gold || 0) < 1000 || game?.player.countItem('orc_tooth') < 1) {
      hint('创建行会需要沃玛号角 ×1 和 1000 金币');
      return;
    }
    await sendSocialAction({ type: 'guild_create', name });
  };
  $('#btn-trade-offer').onclick = submitTradeOffer;
  $('#btn-trade-confirm').onclick = () => {
    if (socialState?.trade) sendSocialAction({ type: 'trade_confirm', tradeId: socialState.trade.id });
  };
  $('#btn-trade-cancel').onclick = () => {
    if (socialState?.trade) sendSocialAction({ type: 'trade_cancel', tradeId: socialState.trade.id });
  };
  $('#btn-revive').onclick = () => {
    $('#death').classList.add('hidden');
    game.revive();
    syncHud();
  };
  $('#btn-save').onclick = () => { game?.persist(); hint('进度已保存到当前设备'); };
  $('#btn-sound').onclick = () => { sound.setEnabled(!sound.enabled); sound.play('equip'); syncSettings(); };
  $('#sound-volume').oninput = (event) => {
    sound.setVolume(Number(event.currentTarget.value) / 100);
    syncSettings();
  };
  document.querySelectorAll('[data-audio-bus]').forEach((input) => {
    input.oninput = (event) => {
      sound.setBusVolume(event.currentTarget.dataset.audioBus, Number(event.currentTarget.value) / 100);
      syncSettings();
    };
  });
  $('#dynamic-range').onchange = (event) => {
    sound.setDynamicRange(event.currentTarget.value);
    sound.play('uiOpen');
    syncSettings();
  };
  $('#render-quality').onchange = (event) => {
    renderQuality = event.currentTarget.value;
    writeRenderQuality(renderQuality);
    game?.setRenderQuality(renderQuality);
    syncSettings();
  };
  $('#btn-fullscreen').onclick = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  };
}

function buildClassPick() {
  const grid = $('#class-grid');
  grid.innerHTML = '';
  selected = null;
  $('#btn-enter').disabled = true;
  $('#pick-info').textContent = '选择一个职业，查看成长方向与技能。';
  const roles = { warrior: '近战 · 生存', wizard: '远程 · 爆发', taoist: '召唤 · 续航' };

  for (const character of Object.values(CLASSES)) {
    const card = document.createElement('article');
    card.className = 'class-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `选择${character.name}职业`);
    card.setAttribute('aria-pressed', 'false');
    card.innerHTML = `
      <div class="art"><img src="${character.portrait}" alt="${character.name}" onerror="this.src='${character.unit}'"/></div>
      <div class="meta"><span class="role">${roles[character.id]}</span><h3>${character.name}</h3><p>${character.desc}</p></div>`;
    const selectCard = () => {
      grid.querySelectorAll('.class-card').forEach((entry) => {
        entry.classList.remove('selected');
        entry.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      selected = character.id;
      $('#btn-enter').disabled = false;
      $('#pick-info').innerHTML = `<h4>${character.name}技能</h4>${character.skills.map((skill) => `<div><b>${skill.key}</b>${skill.name}：${skill.desc}</div>`).join('')}`;
    };
    card.onclick = selectCard;
    card.onkeydown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectCard();
    };
    grid.appendChild(card);
  }
}

async function primeGameplayAssets(classId, mapId, button) {
  if (gameLaunchPending) return false;
  gameLaunchPending = true;
  const originalText = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = '正在载入战斗资源…';
  }
  try {
    await Promise.all([
      assets.ensurePlayerAnim?.(classId),
      assets.ensureMap?.(mapId),
    ]);
    return true;
  } catch (error) {
    console.error(error);
    hint(`战斗资源载入失败：${error.message}`);
    return false;
  } finally {
    gameLaunchPending = false;
    if (button) {
      button.textContent = originalText;
      button.disabled = button.id === 'btn-enter' ? !selected : false;
    }
  }
}

async function continueGame() {
  const save = loadGame();
  if (!save || !assets) return;
  if (!await primeGameplayAssets(save.player.classId, save.mapId || 'bich', $('#btn-continue'))) return;
  selected = save.player.classId;
  show('game');
  bootGame({ save });
}

async function startGame() {
  if (!selected || !assets) return;
  if (!await primeGameplayAssets(selected, 'bich', $('#btn-enter'))) return;
  clearSave();
  show('game');
  bootGame({ classId: selected, name: ($('#player-name').value || '无名旅人').trim().slice(0, 8) });
}

function bootGame(options) {
  closePanels();
  $('#death').classList.add('hidden');
  network?.close();
  lastChatSignature = '';
  lastBagAuthorityVersion = -1;
  game = new Game($('#game-canvas'), assets, {
    ...options,
    renderQuality,
    onHint: (message) => {
      if (message === '__SHOP__') { openShop(); return; }
      if (message === '__CRAFT__') { openShop('craft'); return; }
      if (message === '__WAREHOUSE__') { openWarehouse(); return; }
      hint(message);
    },
    onDeath: () => {
      game.paused = true;
      closePanels();
      $('#death').classList.remove('hidden');
      sound.play('playerDeath');
    },
    onQuest: syncQuest,
    onLog: addLog,
    onSfx: (name, soundOptions) => sound.play(name, soundOptions),
    onAchievement: showAchievementToast,
    onNpc: openNpcDialogue,
    onRemoteSelected: selectSocialTarget,
    onRemoteAttack: (target, damage, skillId = 'basic') => network?.send({
      type: 'pvp_attack', targetId: target.networkId, damage, skillId,
    }),
    onNetworkMonsterAttack: (target, skillId) => network?.send({
      type: 'monster_attack',
      targetId: target.networkId,
      skillId: skillId || 'basic',
    }),
    onBossDamage: (boss, damage, skillId = 'basic') => network?.send({
      type: 'boss_damage', bossId: boss.kind, damage, skillId,
    }),
    onNetworkPickup: (dropId) => network?.send({ type: 'pickup_drop', dropId }),
    onServerAction: (action) => network?.send(action),
  });
  lastObservedHp = game.player.hp;
  network = new MultiplayerClient({
    onSnapshot: (snapshot, ownId) => {
      game?.applyNetworkSnapshot(snapshot, ownId);
      syncWarHud(snapshot);
    },
    onSocial: handleSocialSnapshot,
    onStatus: ({ connected, players, state }) => {
      const label = $('#online-status');
      label.textContent = connected
        ? `本地服 · ${players}人在线`
        : state === 'connecting'
          ? '本地服 · 连接中…'
          : state === 'reconnecting'
            ? '本地服 · 自动重连中…'
            : state === 'conflict'
              ? '角色已在另一窗口在线'
            : '单机模式 · 服务未连接';
      label.classList.toggle('offline', !connected);
      if (game) game.multiplayerActive = connected;
    },
  });
  game.onRequestMapChange = (mapId) => network?.changeMap(mapId);
  game.onMapChange = (mapId) => {
    syncRegionAudio(mapId);
    handleRouteMapChange();
  };
  lastRouteMapId = game.mapId;
  syncRegionAudio(game.mapId);
  network.connect({
    characterId: game.player.characterId,
    name: game.player.name,
    classId: game.player.classId,
  });
  wireGameInput();
  buildSkills();
  syncHud();
  syncQuest();
  addLog({ message: '余烬重燃，旅程开始', type: 'zone' });
  last = performance.now();
  lastHudSync = 0;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
  hint('先与比奇城中央的卫士队长交谈，开启主线。');
}

function useSkill(index) {
  if (!game) return;
  const skill = game.player.def.skills[index];
  const state = game.player.skillState(skill?.id);
  if (!skill || !state.learned) {
    hint(skill ? `尚未学习 ${skill.name}，需要${skill.reqLevel}级并研读技能书` : '技能不存在');
    return;
  }
  if (skill?.type === 'passive') {
    const target = game.nearestMonster(game.player, 360);
    if (target) game.player.target = target;
    else hint('附近没有可攻击目标');
    return;
  }
  game.castSkill(index);
}

function buildSkills() {
  const bar = $('#skill-bar');
  bar.innerHTML = '';
  // 底栏 2×3 六槽：普通攻击 + 职业四技能 + 1 预留空槽
  const basic = document.createElement('button');
  basic.type = 'button';
  basic.className = 'basic-attack ready';
  basic.innerHTML = '<span class="skill-icon" aria-hidden="true"></span><span class="skill-glyph" aria-hidden="true">⚔</span><span class="k">空格</span><span class="skill-name">普攻</span><span class="skill-level">Lv.1</span>';
  basic.title = '普通攻击从1级即可使用，不需要技能书';
  basic.setAttribute('aria-label', '空格 普通攻击，1级可用');
  basic.onpointerdown = (event) => {
    event.preventDefault();
    triggerBasicAttack();
  };
  // Space on a focused button synthesizes click repeats in Chromium/WebKit.
  basic.onkeydown = (event) => {
    if (event.code === 'Space' || event.key === ' ') event.preventDefault();
  };
  bar.appendChild(basic);
  game.player.def.skills.forEach((skill, index) => {
    const button = document.createElement('button');
    button.className = 'class-skill';
    const skillIconUrl = skill.icon.startsWith('/') ? skill.icon : `/${skill.icon}`;
    button.style.setProperty('--skill-icon', `url("${skillIconUrl}")`);
    button.innerHTML = `<span class="skill-icon" aria-hidden="true"></span><span class="k">${skill.key}</span><span class="skill-name">${skill.name}</span><span class="skill-level"></span><span class="mana">${skill.mana || ''}</span>`;
    button.title = skill.desc;
    button.setAttribute('aria-label', `${skill.key} ${skill.name}`);
    button.onclick = () => useSkill(index);
    bar.appendChild(button);
    const mobileButton = document.querySelector(`.mobile-actions [data-skill="${index}"]`);
    if (mobileButton) {
      mobileButton.style.setProperty('--skill-icon', `url("${skillIconUrl}")`);
      mobileButton.title = skill.name;
      mobileButton.innerHTML = `<span class="mobile-skill-key">${skill.key}</span><span class="mobile-cd"></span>`;
    }
  });
  while (bar.children.length < 6) {
    const empty = document.createElement('button');
    empty.type = 'button';
    empty.className = 'skill-empty';
    empty.disabled = true;
    empty.setAttribute('aria-hidden', 'true');
    bar.appendChild(empty);
  }
}

function skillBookFor(skillId, classId = game?.player.classId) {
  return Object.values(ITEMS).find(
    (item) => item.type === 'skillbook' && item.skillId === skillId && item.classId === classId,
  ) || null;
}

async function learnSkillFromPanel(skill, book) {
  if (!game || !book || pendingSkillLearning.has(skill.id)) return;
  const player = game.player;
  const index = player.bag.findIndex((entry) => entry.id === book.id);
  if (index < 0) {
    hint(`缺少 ${book.name}`);
    syncSkillLearning();
    return;
  }
  if (player.level < skill.reqLevel) {
    hint(`需要 ${skill.reqLevel} 级才能研读 ${book.name}`);
    return;
  }
  pendingSkillLearning.add(skill.id);
  syncSkillLearning();
  player.selectedBag = index;
  try {
    const result = await game.useSelectedItem();
    if (result && !result.ok) hint('研读未完成：技能书、等级或角色状态已发生变化');
  } finally {
    pendingSkillLearning.delete(skill.id);
    syncSkillLearning();
    if (isOpen('bag')) syncBag();
    syncCharacter();
    if (now - lastHudSync >= 80) {
      lastHudSync = now;
      syncHud();
    }
  }
}

function syncSkillLearning() {
  if (!game) return;
  const player = game.player;
  const learnedCount = player.def.skills.filter((skill) => player.skillState(skill.id).learned).length;
  $('#skill-learning-summary').innerHTML = `
    <div><span>职业</span><strong>${player.def.name}</strong></div>
    <div><span>角色等级</span><strong>Lv.${player.level}</strong></div>
    <div><span>已学技能</span><strong>${learnedCount} / ${player.def.skills.length}</strong></div>`;
  const list = $('#skill-learning-list');
  list.innerHTML = '';
  for (const [skillIndex, skill] of player.def.skills.entries()) {
    const state = player.skillState(skill.id);
    const book = skillBookFor(skill.id, player.classId);
    const bookCount = book ? player.countItem(book.id) : 0;
    const pending = pendingSkillLearning.has(skill.id);
    const levelReady = player.level >= skill.reqLevel;
    const canLearn = !state.learned && levelReady && bookCount > 0 && !pending;
    const currentThreshold = SKILL_LEVEL_XP[state.level] || 0;
    const nextThreshold = state.level >= SKILL_MAX_LEVEL ? currentThreshold : SKILL_LEVEL_XP[state.level + 1];
    const masteryPct = !state.learned ? 0 : state.level >= SKILL_MAX_LEVEL
      ? 100
      : Math.max(0, Math.min(100, ((state.exp - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)) * 100));
    const status = state.learned
      ? `已学习 · Lv.${state.level}${state.level >= SKILL_MAX_LEVEL ? '（圆满）' : ` · ${state.exp}/${nextThreshold} 熟练度`}`
      : !levelReady
        ? `${skillIndex === 0 ? '经典规则' : '等级不足'} · 需要 Lv.${skill.reqLevel}${skillIndex === 0 ? ' · 普攻已开放' : ''}`
        : bookCount <= 0
          ? `缺少 ${book?.name || '对应技能书'}`
          : '条件满足 · 可以研读';
    const actionLabel = state.learned
      ? '已学习'
      : pending
        ? '研读中…'
        : !levelReady
          ? `Lv.${skill.reqLevel} 解锁`
          : bookCount <= 0
            ? '缺少技能书'
            : '研读学习';
    const row = document.createElement('article');
    row.className = `skill-learning-row${state.learned ? ' learned' : ''}${canLearn ? ' available' : ''}`;
    row.innerHTML = `
      <img src="${skill.icon}" alt="" />
      <div class="skill-learning-copy">
        <div class="skill-learning-title"><strong>${skill.name}</strong><kbd>${skill.key}</kbd><span>${skill.mana ? `${skill.mana} MP` : '无消耗'}</span></div>
        <p>${skill.desc}</p>
        <div class="skill-learning-state"><span>${status}</span><em>${book?.name || '无技能书配置'} × ${bookCount}</em></div>
        <small class="skill-learning-source">获取：${book?.source || '未知'} · ${book?.market || '不可购买'}</small>
        <div class="skill-learning-track"><i style="width:${masteryPct}%"></i></div>
      </div>
      <button class="btn tiny${canLearn ? ' primary' : ''}" ${canLearn ? '' : 'disabled'}>${actionLabel}</button>`;
    row.querySelector('button').onclick = () => learnSkillFromPanel(skill, book);
    list.appendChild(row);
  }
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game) {
    game.update(dt);
    if (
      lastObservedHp !== null
      && game.player.hp < lastObservedHp - 0.01
      && damageClosingPanels.some((id) => isOpen(id))
    ) {
      for (const id of damageClosingPanels) $(`#${id}`).classList.add('hidden');
      if (now - lastPanelEvac > 1800) {
        hint('受到攻击，大型界面已自动关闭');
        lastPanelEvac = now;
      }
    }
    lastObservedHp = game.player.hp;
    // Do not publish a post-portal mapId/position until the server has acked
    // the transition; otherwise move frames are rejected and the route stalls.
    if (!game.portalLoading && !game.awaitingMapAck) {
      network?.syncPlayer(game.player, game.mapId, now);
    }
    game.render();
    syncHud();
    handleRouteMapChange();
    if (activeWorldDestination) syncWorldRouteTracker();
    if (now - lastPanelSync > 300) {
      lastPanelSync = now;
      if (isOpen('character')) syncCharacter();
      if (isOpen('skill-learning')) syncSkillLearning();
      if (isOpen('achievements')) syncAchievements();
    }
  }
  raf = requestAnimationFrame(loop);
}

function hint(message) {
  const element = $('#sys-hint');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(hint.timer);
  hint.timer = setTimeout(() => element.classList.remove('show'), 2800);
}

function addLog(entry) {
  const log = $('#combat-log');
  const line = document.createElement('p');
  line.textContent = entry.message;
  line.className = entry.type || 'system';
  log.prepend(line);
  while (log.children.length > 7) log.lastElementChild.remove();
}

function selectSocialTarget(player) {
  selectedSocialTarget = player ? {
    id: player.networkId || player.id,
    name: player.name,
    classId: player.classId,
    level: player.level,
    mapId: player.mapId || game?.mapId,
    teamId: player.teamId || null,
    guildId: player.guildId || null,
  } : null;
  if (isOpen('social')) syncSocial();
}

async function sendSocialAction(action, { silent = false } = {}) {
  if (!network?.connected) {
    if (!silent) hint('本地联机服务未连接');
    return { ok: false, reason: 'offline' };
  }
  const result = await network.send(action);
  if (!result?.ok && !silent) hint('操作未完成：条件不满足或对方已离线');
  return result;
}

function sendTargetAction(type) {
  if (!selectedSocialTarget?.id) {
    hint('请先点击同地图玩家');
    return;
  }
  sendSocialAction({ type, targetId: selectedSocialTarget.id });
}

function appendChatNotice(text) {
  localChatNotices.push({
    id: `local:${Date.now()}:${localChatNotices.length}`,
    channel: 'system',
    fromName: '系统',
    text,
  });
  if (localChatNotices.length > 6) localChatNotices.shift();
  renderChat(socialState?.messages || []);
}

async function sendChat() {
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  const channel = $('#chat-channel').value;
  if (channel === 'whisper' && !selectedSocialTarget?.id) {
    hint('私聊前请先选中玩家');
    return;
  }
  const result = await sendSocialAction({
    type: 'chat',
    channel,
    text,
    targetId: channel === 'whisper' ? selectedSocialTarget.id : null,
  }, { silent: true });
  if (!result?.ok) {
    const failures = {
      offline: '聊天未发送：本地联机尚未连接',
      timeout: '聊天未发送：服务器响应超时',
      chat: '聊天发送过快或当前频道不可用',
      session: '聊天未发送：会话已失效，正在重连',
    };
    const message = failures[result?.reason] || '聊天未发送，请稍后重试';
    hint(message);
    appendChatNotice(message);
    return;
  }
  input.value = '';
  if (result.message) {
    const messages = [...(socialState?.messages || []), result.message];
    socialState = { ...(socialState || {}), messages };
    renderChat(messages);
  }
}

function renderChat(messages = []) {
  const container = $('#chat-messages');
  const channelNames = { nearby: '附近', world: '世界', team: '组队', guild: '行会', whisper: '私聊', system: '系统' };
  container.innerHTML = '';
  const deduped = [...messages, ...localChatNotices].filter(
    (message, index, all) => all.findIndex((entry) => entry.id === message.id) === index,
  ).slice(-35);
  if (!deduped.length) {
    const empty = document.createElement('p');
    empty.className = 'chat-empty';
    empty.textContent = '暂无消息 · 选择频道后输入内容即可发言';
    container.appendChild(empty);
  }
  for (const message of deduped) {
    const line = document.createElement('p');
    line.className = `chat-line ${message.channel}`;
    const channel = document.createElement('span');
    channel.className = 'channel';
    channel.textContent = `[${channelNames[message.channel] || message.channel}]`;
    const copy = document.createElement('span');
    const whisperTarget = message.channel === 'whisper' && message.toName ? ` → ${message.toName}` : '';
    copy.textContent = `${message.fromName}${whisperTarget}：${message.text}`;
    line.append(channel, copy);
    container.appendChild(line);
    game?.showChatMessage(message);
  }
  container.scrollTop = container.scrollHeight;
}

function handleSocialSnapshot(next) {
  if (!next || !game) return;
  socialState = next;
  game.player.teamId = next.team?.id || null;
  game.player.guildId = next.guild?.id || null;
  const messages = next.messages || [];
  const chatSignature = `${messages.length}:${messages.at(-1)?.id || ''}`;
  if (chatSignature !== lastChatSignature) {
    lastChatSignature = chatSignature;
    renderChat(messages);
  }
  for (const event of next.events || []) {
    if (handledNetworkEvents.has(event.id)) continue;
    handledNetworkEvents.add(event.id);
    game.applyNetworkEvent(event);
  }
  if (handledNetworkEvents.size > 200) {
    const keep = [...handledNetworkEvents].slice(-100);
    handledNetworkEvents.clear();
    keep.forEach((id) => handledNetworkEvents.add(id));
  }
  if (isOpen('social')) syncSocial();
  if (isOpen('bag') && lastBagAuthorityVersion !== game.lastServerAuthorityVersion) {
    lastBagAuthorityVersion = game.lastServerAuthorityVersion;
    syncBag();
  }
}

function socialChip(player, actionLabel = '', action = null) {
  const chip = document.createElement('span');
  chip.className = 'social-chip';
  const name = document.createElement('span');
  name.textContent = `${player.name} Lv${player.level}`;
  chip.appendChild(name);
  chip.onclick = () => { selectSocialTarget(player); };
  if (actionLabel && action) {
    const button = document.createElement('button');
    button.textContent = actionLabel;
    button.onclick = (event) => { event.stopPropagation(); action(); };
    chip.appendChild(button);
  }
  return chip;
}

function fillSocialList(element, title, players, empty = '暂无') {
  element.innerHTML = `<h4>${title}</h4>`;
  const list = document.createElement('div');
  list.className = 'social-list';
  for (const player of players) list.appendChild(socialChip(player));
  if (!players.length) list.textContent = empty;
  element.appendChild(list);
}

function syncSocial() {
  if (!game) return;
  const target = $('#social-target');
  target.innerHTML = '';
  if (selectedSocialTarget) {
    const name = document.createElement('strong');
    name.textContent = `${selectedSocialTarget.name} · Lv${selectedSocialTarget.level}`;
    target.append(name, document.createTextNode(` · ${CLASSES[selectedSocialTarget.classId]?.name || ''}`));
  } else {
    target.textContent = '点击同地图玩家以选中目标';
  }
  const state = socialState || {
    friends: [], friendRequests: [], teamInvites: [], guildInvites: [],
    team: null, guild: null, trade: null,
  };
  fillSocialList($('#social-friends'), '好友', state.friends || []);

  const requests = $('#social-requests');
  requests.innerHTML = '<h4>请求与邀请</h4>';
  const requestList = document.createElement('div');
  requestList.className = 'social-list';
  for (const player of state.friendRequests || []) {
    requestList.appendChild(socialChip(player, '同意好友', () => sendSocialAction({ type: 'friend_accept', targetId: player.id })));
  }
  for (const player of state.teamInvites || []) {
    requestList.appendChild(socialChip(player, '加入队伍', () => sendSocialAction({ type: 'team_accept', targetId: player.id })));
  }
  for (const guild of state.guildInvites || []) {
    const leader = guild.members.find((member) => member.id === guild.leaderId) || { name: guild.name, level: '' };
    requestList.appendChild(socialChip(
      { ...leader, name: guild.name },
      '加入行会',
      () => sendSocialAction({ type: 'guild_accept', guildId: guild.id }),
    ));
  }
  if (state.trade?.status === 'requested' && state.trade.requesterId !== network?.playerId) {
    const requester = state.trade.members.find((member) => member.id === state.trade.requesterId);
    if (requester) requestList.appendChild(socialChip(requester, '接受交易', () => sendSocialAction({ type: 'trade_accept', tradeId: state.trade.id })));
  }
  if (!requestList.children.length) requestList.textContent = '暂无待处理请求';
  requests.appendChild(requestList);

  const team = $('#social-team');
  fillSocialList(team, state.team ? '当前队伍' : '队伍', state.team?.members || [], '尚未组队');
  if (state.team) {
    const ownLeader = state.team.leaderId === network?.playerId;
    const roster = team.querySelector('.social-list');
    roster.innerHTML = '';
    for (const member of state.team.members) {
      const chip = socialChip({
        ...member,
        name: `${member.id === state.team.leaderId ? '队长·' : ''}${member.name}`,
      });
      if (ownLeader && member.id !== network?.playerId) {
        const promote = document.createElement('button');
        promote.textContent = '交队长';
        promote.onclick = (event) => {
          event.stopPropagation();
          sendSocialAction({ type: 'team_promote', targetId: member.id });
        };
        const kick = document.createElement('button');
        kick.textContent = '移出';
        kick.onclick = (event) => {
          event.stopPropagation();
          sendSocialAction({ type: 'team_kick', targetId: member.id });
        };
        chip.append(promote, kick);
      }
      roster.appendChild(chip);
    }
    const leave = document.createElement('button');
    leave.className = 'btn tiny';
    leave.textContent = '离开队伍';
    leave.onclick = () => sendSocialAction({ type: 'team_leave' });
    team.appendChild(leave);
  }

  const guild = $('#social-guild');
  fillSocialList(guild, state.guild ? `行会 · ${state.guild.name}` : '行会', state.guild?.members || [], '尚未加入行会');
  if (state.guild) {
    const ownLeader = state.guild.leaderId === network?.playerId;
    const roster = guild.querySelector('.social-list');
    roster.innerHTML = '';
    for (const member of state.guild.members) {
      const chip = socialChip({
        ...member,
        name: `${member.id === state.guild.leaderId ? '会长·' : ''}${member.name}`,
      });
      if (ownLeader && member.id !== network?.playerId) {
        const promote = document.createElement('button');
        promote.textContent = '转会长';
        promote.onclick = (event) => {
          event.stopPropagation();
          sendSocialAction({ type: 'guild_promote', targetId: member.id });
        };
        const kick = document.createElement('button');
        kick.textContent = '逐出';
        kick.onclick = (event) => {
          event.stopPropagation();
          sendSocialAction({ type: 'guild_kick', targetId: member.id });
        };
        chip.append(promote, kick);
      }
      roster.appendChild(chip);
    }
    const leave = document.createElement('button');
    leave.className = 'btn tiny';
    leave.textContent = '离开行会';
    leave.onclick = () => sendSocialAction({ type: 'guild_leave' });
    guild.appendChild(leave);
  }
  $('.guild-create').classList.toggle('hidden', !!state.guild);

  const tradeBox = $('#trade-box');
  const activeTrade = state.trade?.status === 'active';
  tradeBox.classList.toggle('hidden', !activeTrade);
  if (activeTrade) {
    const other = state.trade.members.find((member) => member.id !== network?.playerId);
    const ownOffer = state.trade.offers[network?.playerId];
    const otherOffer = state.trade.offers[other?.id];
    const offerCopy = (offer) => offer
      ? `${offer.item ? ITEMS[offer.item.id]?.name || offer.item.id : '无物品'} · ${offer.gold || 0}金币`
      : '尚未报价';
    $('#trade-summary').textContent = `与 ${other?.name || '玩家'} 交易｜我方：${offerCopy(ownOffer)}｜对方：${offerCopy(otherOffer)}｜已确认 ${state.trade.confirmed.length}/2`;
  }
}

async function submitTradeOffer() {
  const trade = socialState?.trade;
  if (!trade || trade.status !== 'active') return;
  const gold = Math.max(0, Math.floor(Number($('#trade-gold').value) || 0));
  const itemIndex = game.player.selectedBag >= 0 ? game.player.selectedBag : null;
  const result = await sendSocialAction({ type: 'trade_offer', tradeId: trade.id, itemIndex, gold });
  if (result?.ok) hint('报价已提交，任意改价会撤销双方确认');
}

function showAchievementToast(achievement) {
  const toast = $('#achievement-toast');
  $('#achievement-toast-name').textContent = achievement.name;
  toast.classList.remove('hidden');
  clearTimeout(achievementTimer);
  achievementTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

function syncHud() {
  if (!game) return;
  const player = game.player;
  $('#map-name').textContent = game.map.name;
  $('#safe-label').textContent = game.map.safe ? '安全区' : '危险区域';
  $('#safe-label').classList.toggle('danger', !game.map.safe);
  const pkStatus = game.pkStatus(player);
  const pkModeNames = { peace: '和平', team: '组队', guild: '行会', all: '全体' };
  $('#pk-label').textContent = `${pkStatus.name} · PK ${player.pkPoints}`;
  $('#pk-label').className = `pk-label ${pkStatus.id}`;
  $('#btn-pk-mode').childNodes[0].textContent = pkModeNames[player.pkMode] || '和平';
  $('#clock-label').textContent = `玛法历 ${String(Math.floor(player.playTime / 60) + 1).padStart(3, '0')}`;
  $('#hud-portrait').src = player.def.avatar;
  $('#hud-name').textContent = player.name;
  $('#hud-class').textContent = player.def.name;
  $('#hud-lv').textContent = player.level;
  $('#hud-power').textContent = `战力 ${player.combatPower()}`;
  $('#hud-gold').textContent = `${player.gold} 金`;
  const usesMana = player.classId !== 'warrior';
  document.body.classList.toggle('no-mana', !usesMana);
  document.querySelector('.mir-hud')?.classList.toggle('no-mana', !usesMana);
  const hpPct = Math.max(0, Math.min(1, player.hp / Math.max(1, player.maxHp)));
  const mpPct = Math.max(0, Math.min(1, player.mp / Math.max(1, player.maxMp)));
  $('#bar-hp').style.setProperty('--orb-pct', String(hpPct));
  $('#bar-mp').style.setProperty('--orb-pct', String(mpPct));
  const xpNeed = player.xpNeed();
  const xpPct = player.level >= 50 ? 1 : Math.min(1, player.xp / Math.max(1, xpNeed));
  $('#bar-xp').style.setProperty('--xp-pct', String(xpPct));
  $('#bar-xp').style.transform = `scaleX(${xpPct})`;
  $('#txt-hp').textContent = `${Math.ceil(player.hp)}/${Math.ceil(player.maxHp)}`;
  $('#txt-mp').textContent = usesMana
    ? `${Math.ceil(player.mp)}/${Math.ceil(player.maxMp)}`
    : '';
  $('#txt-xp').textContent = player.level >= 50
    ? 'MAX'
    : `${Math.floor(xpPct * 100)}%`;
  const hpPotCount = player.countItem('hp_pot') + player.countItem('hp_pot_b');
  const mpPotCount = player.countItem('mp_pot') + player.countItem('mp_pot_b');
  $('#hp-pot-count').textContent = hpPotCount;
  $('#mp-pot-count').textContent = mpPotCount;
  $('#scroll-count').textContent = player.countItem('recall');
  $('#mobile-hp').dataset.count = hpPotCount;
  $('#mobile-mp').dataset.count = mpPotCount;

  $('#skill-bar').querySelectorAll('.class-skill').forEach((button, index) => {
    const skill = player.def.skills[index];
    if (!skill) return;
    const state = player.skillState(skill.id);
    button.classList.toggle('locked', !state.learned);
    button.classList.toggle('ready', state.learned && player.skillCd[index] <= 0 && player.mp >= skill.mana);
    button.querySelector('.skill-level').textContent = state.learned ? `Lv.${state.level}` : `${skill.reqLevel}级`;
    button.title = state.learned
      ? `${skill.name} Lv.${state.level}：${skill.desc}`
      : `未学习：角色达到${skill.reqLevel}级后研读${skill.name}技能书`;
    let cd = button.querySelector('.cd');
    if (state.learned && player.skillCd[index] > 0) {
      if (!cd) { cd = document.createElement('div'); cd.className = 'cd'; button.appendChild(cd); }
      cd.textContent = Math.ceil(player.skillCd[index]);
    } else cd?.remove();
    const mobileButton = document.querySelector(`.mobile-actions [data-skill="${index}"]`);
    if (mobileButton) {
      mobileButton.classList.toggle('locked', !state.learned);
      mobileButton.classList.toggle('ready', state.learned && player.skillCd[index] <= 0 && player.mp >= skill.mana);
      mobileButton.querySelector('.mobile-cd').textContent = state.learned && player.skillCd[index] > 0
        ? Math.ceil(player.skillCd[index])
        : '';
      mobileButton.setAttribute('aria-label', state.learned
        ? `${skill.name}，${player.skillCd[index] > 0 ? `冷却${Math.ceil(player.skillCd[index])}秒` : '可用'}`
        : `${skill.name}，未学习`);
    }
  });

  const boss = game.monsters.find((monster) => monster.boss && monster.alive);
  $('#boss-hud').classList.toggle('hidden', !boss);
  if (boss) {
    $('#boss-name').textContent = boss.name;
    $('#boss-phase').textContent = boss.enraged ? '狂暴' : '第一阶段';
    $('#boss-hp').style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
    $('#boss-hp-text').textContent = `${Math.ceil(boss.hp).toLocaleString()} / ${Math.ceil(boss.maxHp).toLocaleString()}`;
  }
  $('#combo-hud').classList.toggle('hidden', game.combo < 3);
  $('#combo-count').textContent = game.combo;
}

function syncWarHud(snapshot) {
  if (!game) return;
  const hud = $('#war-hud');
  const sabac = snapshot?.sabac;
  const sabacWar = sabac?.war;
  const siegeAttack = $('#btn-siege-attack');
  siegeAttack.classList.add('hidden');
  const guildWar = (snapshot?.guildWars || []).find(
    (war) => game.player.guildId && [war.guildA, war.guildB].includes(game.player.guildId),
  );
  if (sabacWar && ['active', 'captured'].includes(sabacWar.status)) {
    hud.classList.remove('hidden');
    $('#war-title').textContent = `沙巴克：${sabacWar.attackerGuildName} VS ${sabacWar.defenderGuildName}`;
    if (sabacWar.status === 'captured') {
      $('#war-copy').textContent = `${sabac.ownerGuildName} 已占领皇宫 · 胜方全会获得1500金币`;
      $('#war-progress').style.width = '100%';
    } else if (sabacWar.phase === 'gate') {
      const gatePct = Math.max(0, Math.min(100, (sabacWar.gateHp || 0) / Math.max(1, sabacWar.gateMaxHp || 1) * 100));
      $('#war-copy').textContent = `第一阶段：攻破城门 ${Math.ceil(sabacWar.gateHp || 0)} / ${sabacWar.gateMaxHp || 0} · 击杀 ${sabacWar.attackerKills || 0}:${sabacWar.defenderKills || 0}`;
      $('#war-progress').style.width = `${gatePct}%`;
      siegeAttack.classList.toggle('hidden', game.mapId !== 'sabac'
        || game.player.guildId !== sabacWar.attackerGuildId);
    } else {
      $('#war-copy').textContent = `第二阶段：皇宫占领 ${Math.floor(sabacWar.captureProgress || 0)}% · 守方人数足够会压退进度 · 击杀 ${sabacWar.attackerKills || 0}:${sabacWar.defenderKills || 0}`;
      $('#war-progress').style.width = `${Math.max(0, Math.min(100, sabacWar.captureProgress || 0))}%`;
    }
  } else if (guildWar) {
    hud.classList.remove('hidden');
    $('#war-title').textContent = `行会战：${guildWar.guildAName} VS ${guildWar.guildBName}`;
    $('#war-copy').textContent = `击杀比分 ${guildWar.scoreA} : ${guildWar.scoreB}`;
    $('#war-progress').style.width = '0';
  } else {
    hud.classList.add('hidden');
  }
}

function syncQuest() {
  if (!game) return;
  const player = game.player;
  const element = $('#quest-body');
  if (!player.questId) {
    const bounty = BOUNTIES.find((entry) => entry.id === player.bounty?.id);
    if (bounty) {
      const current = Math.min(bounty.count, player.bounty.progress || 0);
      const pct = Math.round(current / Math.max(1, bounty.count) * 100);
      element.innerHTML = `<h4>循环悬赏 · ${bounty.name}</h4><p>击杀 ${MONSTERS[bounty.monster]?.name || bounty.monster}，完成后回卫士队长处结算。</p><div class="quest-steps"><div class="quest-step ${current >= bounty.count ? 'done' : ''}"><span>猎杀目标</span><em>${current}/${bounty.count}</em><i><b style="width:${pct}%"></b></i></div></div><small>已完成 ${player.bountyCompletions || 0} 轮</small>`;
    } else {
      element.innerHTML = `<h4>余烬之后</h4><p>主线已完成。找卫士队长领取循环悬赏；继续争夺教主、幸运武器与沙巴克。</p><small>已完成 ${player.bountyCompletions || 0} 轮悬赏</small>`;
    }
    return;
  }
  const quest = QUESTS.find((entry) => entry.id === player.questId);
  if (!quest) { element.textContent = ''; return; }
  const lines = quest.steps.map((step) => {
    if (step.type === 'talk') return '<div class="quest-step talk"><span>与卫士队长对话</span><em>交谈</em></div>';
    if (step.type === 'kill') {
      const current = Math.min(step.count, player.questProgress[step.monster] || 0);
      const pct = Math.round(current / Math.max(1, step.count) * 100);
      return `<div class="quest-step ${current >= step.count ? 'done' : ''}"><span>击杀 ${MONSTERS[step.monster]?.name || step.monster}</span><em>${current}/${step.count}</em><i><b style="width:${pct}%"></b></i></div>`;
    }
    if (step.type === 'collect') {
      const current = Math.min(step.count, player.countItem(step.item));
      const pct = Math.round(current / Math.max(1, step.count) * 100);
      return `<div class="quest-step ${current >= step.count ? 'done' : ''}"><span>收集 ${ITEMS[step.item]?.name || step.item}</span><em>${current}/${step.count}</em><i><b style="width:${pct}%"></b></i></div>`;
    }
    return '';
  });
  const ready = player.questReady ? '<strong class="quest-ready">目标完成 · 回比奇城找卫士队长复命</strong><br>' : '';
  element.innerHTML = `<h4>${quest.name}</h4><p>${quest.desc}</p>${ready}<div class="quest-steps">${lines.join('')}</div>`;
}

function toggleQuest() {
  questOpen = !questOpen;
  $('#quest-body').classList.toggle('hidden', !questOpen);
  $('#btn-quest-toggle').textContent = questOpen ? '−' : '+';
  sound.play(questOpen ? 'uiOpen' : 'uiClose');
}

/** Per-item atlas: 12 cols × 128px source cells, drawn at 32px. */
const ITEM_ICON_ATLAS = {
  cell: 128,
  cols: 12,
  display: 32,
  version: '0.9.22',
};
const ITEM_ICON_INDEX = (() => {
  // Filled at boot from assets/game/ui/items/raw/icon_index.json when available;
  // fallback computes stable order from ITEMS insertion order.
  const map = new Map();
  let i = 0;
  for (const id of Object.keys(ITEMS)) {
    map.set(id, { col: i % ITEM_ICON_ATLAS.cols, row: Math.floor(i / ITEM_ICON_ATLAS.cols), i });
    i += 1;
  }
  return map;
})();

function itemIcon(item) {
  const id = item?.id || item?.itemId;
  const entry = (id && ITEM_ICON_INDEX.get(id)) || { col: 0, row: 0 };
  const scale = ITEM_ICON_ATLAS.display / ITEM_ICON_ATLAS.cell;
  const x = -(entry.col * ITEM_ICON_ATLAS.cell * scale);
  const y = -(entry.row * ITEM_ICON_ATLAS.cell * scale);
  return `<span class="item-icon" style="background-position:${x}px ${y}px" title="${item?.name || id || ''}"></span>`;
}

function rarityColor(item) {
  return RARITIES[item?.rarity || 'common']?.color || '#c8c0ad';
}

const STAT_NAMES = {
  atk: '攻击', mag: '魔法', def: '防御', magDef: '魔防',
  hp: '生命', mp: '魔法值', crit: '暴击', dodge: '闪避', lifesteal: '吸血',
};

function itemCatalogDetails(item) {
  if (!item) return '';
  const facts = [
    `<b>${item.category || ITEM_TYPE_NAMES[item.type] || '其他'}</b>`,
    `来源：${item.source || '未知'}`,
    item.useHint,
    item.market,
    item.stackLimit > 1 ? `单格最多 ${item.stackLimit}` : null,
  ].filter(Boolean);
  return facts.join('<br>');
}

function itemEntryDetails(entry) {
  if (!entry) return '';
  const item = ITEMS[entry.id];
  if (!item?.slot) return '';
  const parts = [`耐久 ${Math.floor(entry.durability)}/${entry.maxDurability}`];
  if (entry.enhance) parts.push(`${item.slot === 'weapon' ? '武器升级' : '旧档强化'} +${entry.enhance}`);
  if (entry.luck) parts.push(`幸运 +${entry.luck}`);
  if (entry.curse) parts.push(`诅咒 +${entry.curse}`);
  for (const [stat, value] of Object.entries(entry.bonus || {})) {
    parts.push(`极品 ${STAT_NAMES[stat] || stat} +${stat === 'crit' ? `${Math.round(value * 100)}%` : value}`);
  }
  if (entry.durability <= 0) parts.push('已损坏：属性失效');
  return parts.join(' · ');
}

function syncBag() {
  if (!game) return;
  const player = game.player;
  const equipment = $('#equip-slots');
  equipment.innerHTML = '';
  for (const slotName of EQUIP_SLOTS) {
    const entry = player.equip[slotName];
    const id = typeof entry === 'string' ? entry : entry?.id;
    const item = ITEMS[id];
    const slot = document.createElement('button');
    slot.className = `equip-slot${id ? ' active' : ''}${entry?.durability === 0 ? ' broken' : ''}`;
    slot.innerHTML = id
      ? `${itemIcon(item)}<span style="color:${rarityColor(item)}">${item.name}</span>${entry?.enhance ? `<b class="plus">+${entry.enhance}</b>` : ''}<small>${entry?.durability ?? '—'}/${entry?.maxDurability ?? '—'}</small>`
      : `<span class="lab">${SLOT_NAMES[slotName]}</span>空`;
    slot.title = id ? `${item.name} · ${item.desc} · ${itemEntryDetails(entry)}（点击卸下）` : SLOT_NAMES[slotName];
    slot.onclick = () => { if (id) { game.unequip(slotName); syncBag(); syncHud(); } };
    equipment.appendChild(slot);
  }

  const grid = $('#bag-grid');
  grid.innerHTML = '';
  for (let index = 0; index < player.bagSize; index++) {
    const slot = document.createElement('button');
    slot.className = `bag-slot${player.selectedBag === index ? ' selected' : ''}`;
    const entry = player.bag[index];
    if (entry) {
      const item = ITEMS[entry.id];
      slot.innerHTML = `${itemIcon(item)}${entry.qty > 1 ? `<span class="qty">${entry.qty}</span>` : ''}`;
      slot.style.color = rarityColor(item);
      slot.title = `${item.name} · ${item.desc} · 来源：${item.source}${itemEntryDetails(entry) ? ` · ${itemEntryDetails(entry)}` : ''}`;
      slot.onclick = () => {
        if (player.selectedBag === index) game.useSelectedItem();
        else player.selectedBag = index;
        syncBag();
        syncHud();
        syncCharacter();
      };
    } else {
      slot.innerHTML = '<span class="lab">空</span>';
    }
    grid.appendChild(slot);
  }

  const selectedEntry = player.bag[player.selectedBag];
  const detail = $('#bag-detail');
  if (selectedEntry) {
    const item = ITEMS[selectedEntry.id];
    const requirement = item.reqLevel ? ` · 需要 ${item.reqLevel} 级` : '';
    const instanceDetails = itemEntryDetails(selectedEntry);
    detail.innerHTML = `${itemIcon(item)}<div><strong style="color:${rarityColor(item)}">${item.name} · ${RARITIES[item.rarity || 'common'].name}</strong><p>${item.desc}${requirement}${instanceDetails ? `<br>${instanceDetails}` : ''}</p><small class="item-catalog">${itemCatalogDetails(item)}</small></div>`;
  } else {
    detail.innerHTML = '<span>选择物品查看详情；再次点击可使用或装备。</span>';
  }
  $('#bag-cap').textContent = `${player.bag.length} / ${player.bagSize} 格`;
}

function syncCharacter() {
  if (!game) return;
  const player = game.player;
  $('#char-art').src = player.def.portrait;
  $('#char-name').textContent = `${player.name} · ${player.def.name}`;
  $('#char-title').textContent = `等级 ${player.level} · 采集 Lv.${player.gatheringLevel} · 最佳连斩 ${player.bestCombo} · 击杀 ${player.totalKills}`;
  $('#char-power').textContent = `战力 ${player.combatPower()}`;
  const stats = [
    ['生命', Math.floor(player.maxHp)], ['法力', Math.floor(player.maxMp)], ['攻击', Math.floor(player.atk)],
    ['魔法攻击', Math.floor(player.mag)], ['防御', Math.floor(player.defense)], ['魔防', Math.floor(player.magDef)],
    ['暴击', `${Math.round(player.crit * 100)}%`], ['闪避', `${Math.round(player.dodge * 100)}%`], ['吸血', `${Math.round(player.lifesteal * 100)}%`],
  ];
  $('#stat-grid').innerHTML = stats.map(([label, value]) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`).join('');

  $('#skill-mastery').innerHTML = player.def.skills.map((skill) => {
    const state = player.skillState(skill.id);
    if (!state.learned) {
      return `<div class="mastery-row locked"><div class="mastery-meta"><strong>${skill.name}</strong><span>${skill.reqLevel}级 · 需要技能书</span></div><div class="mastery-track"><i style="width:0"></i></div></div>`;
    }
    const currentThreshold = SKILL_LEVEL_XP[state.level] || 0;
    const nextThreshold = state.level >= SKILL_MAX_LEVEL ? currentThreshold : SKILL_LEVEL_XP[state.level + 1];
    const pct = state.level >= SKILL_MAX_LEVEL
      ? 100
      : Math.max(0, Math.min(100, ((state.exp - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)) * 100));
    const progress = state.level >= SKILL_MAX_LEVEL ? '已修炼圆满' : `${state.exp}/${nextThreshold} 熟练度`;
    return `<div class="mastery-row"><div class="mastery-meta"><strong>${skill.name} Lv.${state.level}</strong><span>${progress}</span></div><div class="mastery-track"><i style="width:${pct}%"></i></div></div>`;
  }).join('');

  const list = $('#forge-list');
  list.innerHTML = '';
  for (const slotName of EQUIP_SLOTS) {
    const entry = player.equip[slotName];
    const id = typeof entry === 'string' ? entry : entry?.id;
    const level = typeof entry === 'object' ? (entry?.enhance || 0) : (player.enhance[slotName] || 0);
    const cost = enhanceCost(level);
    const weaponSlot = slotName === 'weapon';
    const costText = !weaponSlot
      ? '仅武器可用黑铁升级'
      : level >= ENHANCE_MAX
        ? '已达 +7'
        : `${cost.gold} 金 · 黑铁 ${cost.ore} · ${Math.round(cost.rate * 100)}%${cost.destroysOnFailure ? ' · 失败破碎' : ''}`;
    const row = document.createElement('div');
    row.className = 'forge-row';
    row.innerHTML = `
      <div><strong>${SLOT_NAMES[slotName]} · ${id ? ITEMS[id].name : '未装备'}</strong> <em>${level ? `+${level}` : ''}</em>${entry?.durability === 0 ? ' <em>已损坏</em>' : ''}</div>
      <span class="cost">${costText}</span>
      <button class="btn tiny" ${!weaponSlot || !id || level >= ENHANCE_MAX ? 'disabled' : ''}>升级武器</button>`;
    row.querySelector('button').onclick = () => { game.enhanceSlot(slotName); syncCharacter(); syncBag(); syncHud(); };
    list.appendChild(row);
  }
}

function syncAchievements() {
  if (!game) return;
  const player = game.player;
  const unlocked = player.achievements.length;
  $('#achievement-summary').innerHTML = `<span>已解锁 <strong>${unlocked} / ${ACHIEVEMENTS.length}</strong></span><span>总击杀 <strong>${player.totalKills}</strong></span>`;
  const list = $('#achievement-list');
  list.innerHTML = '';
  for (const achievement of ACHIEVEMENTS) {
    const hasUnlocked = player.achievements.includes(achievement.id);
    const claimed = player.claimedAchievements.includes(achievement.id);
    const row = document.createElement('div');
    row.className = `achievement-row${hasUnlocked ? ' unlocked' : ''}`;
    row.innerHTML = `
      <span class="achievement-medal">${hasUnlocked ? '◆' : '◇'}</span>
      <div><h4>${achievement.name}</h4><p>${achievement.desc} · 奖励 ${achievement.reward} 金币</p></div>
      <button class="btn tiny" ${!hasUnlocked || claimed ? 'disabled' : ''}>${claimed ? '已领取' : hasUnlocked ? '领取' : '未达成'}</button>`;
    row.querySelector('button').onclick = () => { game.claimAchievement(achievement.id); syncAchievements(); syncHud(); };
    list.appendChild(row);
  }
}

function openShop(mode = 'shop') {
  closePanels(['shop']);
  $('#shop').classList.remove('hidden');
  const codexMode = mode === 'codex' || mode === 'codex-only';
  const catalogOnly = mode === 'codex-only';
  const craftMode = mode === 'craft';
  $('#shop-title').textContent = craftMode
    ? '比奇铁匠铺'
    : codexMode
      ? `玛法物品图鉴 · ${Object.keys(ITEMS).length} 件`
      : '比奇商店 · 杂货与书店';
  $('#shop-tabs').classList.toggle('hidden', craftMode || catalogOnly);
  $('#shop-tools').classList.toggle('hidden', codexMode);
  $('#btn-shop-stock').classList.toggle('active', !codexMode);
  $('#btn-item-codex').classList.toggle('active', codexMode);
  const search = $('#item-codex-search');
  search.classList.toggle('hidden', !codexMode);
  if (!codexMode) search.value = '';
  const list = $('#shop-list');
  list.classList.toggle('hidden', craftMode);
  const renderGoods = () => {
    list.innerHTML = '';
    const query = search.value.trim().toLocaleLowerCase();
    const typeOrder = Object.keys(ITEM_TYPE_NAMES);
    const goods = (codexMode ? Object.values(ITEMS) : SHOP.map((id) => ITEMS[id]))
      .filter(Boolean)
      .filter((item) => !query || [item.name, item.category, item.source, item.desc, item.useHint]
        .join(' ').toLocaleLowerCase().includes(query))
      .sort((a, b) => {
        if (!codexMode) return 0;
        const typeDelta = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
        if (typeDelta) return typeDelta;
        const levelDelta = (a.reqLevel || 0) - (b.reqLevel || 0);
        return levelDelta || a.name.localeCompare(b.name, 'zh-CN');
      });
    let category = '';
    for (const item of goods) {
      if (item.category !== category) {
        category = item.category;
        const heading = document.createElement('h4');
        heading.className = 'shop-category';
        heading.textContent = category;
        list.appendChild(heading);
      }
      const row = document.createElement(codexMode ? 'article' : 'button');
      row.className = `shop-item${codexMode ? ' codex-item' : ''}`;
      const sourceCopy = codexMode
        ? `${item.useHint}<br>来源：${item.source}<br>${item.market}`
        : `${item.useHint} · 回售 ${item.sell || 0} 金`;
      const valueCopy = codexMode
        ? item.type === 'quest'
          ? '关键'
          : SHOP.includes(item.id)
          ? `${item.price} 金`
          : item.sell > 0
            ? `售 ${item.sell}`
            : '关键'
        : `${item.price} 金`;
      row.innerHTML = `${itemIcon(item)}<div><strong style="color:${rarityColor(item)}">${item.name}<small>${RARITIES[item.rarity || 'common'].name}</small></strong><p class="desc">${item.desc}</p><p class="shop-source">${sourceCopy}</p></div><span class="price">${valueCopy}</span>`;
      row.title = `${item.name} · ${item.source} · ${item.market}`;
      if (!codexMode) row.onclick = () => { game.buyItem(item.id); syncHud(); syncBag(); };
      list.appendChild(row);
    }
    if (!goods.length) {
      const empty = document.createElement('p');
      empty.className = 'shop-empty';
      empty.textContent = '没有找到符合条件的物品';
      list.appendChild(empty);
    }
  };
  search.oninput = renderGoods;
  renderGoods();
  const section = $('#craft-section');
  section.classList.toggle('hidden', !craftMode);
  const craftList = $('#craft-list');
  craftList.innerHTML = '';
  for (const recipe of Object.values(RECIPES)) {
    const materials = recipe.materials.map((material) => `${ITEMS[material.id].name}×${material.qty}`).join('、');
    const outputs = recipe.outputs.map((output) => `${ITEMS[output.id].name}×${output.qty}`).join('、');
    const row = document.createElement('button');
    row.className = 'shop-item';
    row.innerHTML = `<div><strong>${recipe.name}</strong><p class="desc">${materials} → ${outputs}</p></div><span class="price">${recipe.gold} 金</span>`;
    row.onclick = () => {
      game.craftRecipe(recipe.id);
      syncHud();
      if (isOpen('bag')) syncBag();
    };
    craftList.appendChild(row);
  }
}

function openWarehouse() {
  closePanels(['warehouse', 'bag']);
  $('#warehouse').classList.remove('hidden');
  $('#bag').classList.remove('hidden');
  syncWarehouse();
  syncBag();
}

function npcQuestCopy() {
  const player = game.player;
  const quest = QUESTS.find((entry) => entry.id === player.questId);
  if (!quest) {
    const bounty = BOUNTIES.find((entry) => entry.id === player.bounty?.id);
    if (bounty) {
      const progress = Math.min(bounty.count, player.bounty.progress || 0);
      return progress >= bounty.count
        ? {
          text: `「${bounty.name}」已经完成，玛法会记住你的战功。`,
          note: `结算 ${bounty.reward.xp} 经验、${bounty.reward.gold} 金币与锻造材料。`,
          action: '完成悬赏',
        }
        : {
          text: `继续执行「${bounty.name}」，不要让那些怪物喘息。`,
          note: `${MONSTERS[bounty.monster]?.name || bounty.monster} ${progress}/${bounty.count}`,
          action: '查看进度',
        };
    }
    return {
      text: '主线已经结束，但玛法的怪物不会停。领取猎令，清剿一轮后回来结算。',
      note: `循环悬赏提供经验、金币和锻造材料；已完成 ${player.bountyCompletions || 0} 轮。`,
      action: '领取悬赏',
    };
  }
  const talk = quest.steps.find((step) => step.type === 'talk');
  if (talk) {
    return { text: talk.text, note: `主线 · ${quest.name}`, action: '接受任务' };
  }
  if (player.questReady) {
    return {
      text: `做得好，你已经完成「${quest.name}」的全部目标。`,
      note: '任务物品会在交付后扣除，奖励将直接进入背包。',
      action: '完成复命',
    };
  }
  const progress = quest.steps.map((step) => {
    if (step.type === 'kill') {
      return `${MONSTERS[step.monster]?.name || step.monster} ${Math.min(step.count, player.questProgress[step.monster] || 0)}/${step.count}`;
    }
    if (step.type === 'collect') return `${ITEMS[step.item]?.name || step.item} ${Math.min(step.count, player.countItem(step.item))}/${step.count}`;
    return '';
  }).filter(Boolean).join(' · ');
  return {
    text: quest.desc,
    note: progress ? `当前进度：${progress}` : `主线 · ${quest.name}`,
    action: '复命',
  };
}

function npcDialogueCopy(npc) {
  const copies = {
    healer: {
      role: '比奇药铺',
      portrait: 'assets/game/npc/healer.png',
      text: '行走玛法，伤势不可轻视。只要回到城里，我便替你把气血与魔力调理周全。',
      note: '1—5级免费；之后按伤势收取金币。',
      action: '接受疗伤',
    },
    merchant: {
      role: '比奇杂货铺 · 书店',
      portrait: 'assets/game/npc/merchant.png',
      text: '金创药、魔法药、传送卷、新手器具和低级技能书都在这里。高级书与极品装备没有固定货源，得去怪物身上找。',
      note: '7—19级技能书可直接购买；25级以上技能书和高阶装备主要由精英、首领掉落。',
      action: '查看货物',
    },
    warehouse: {
      role: '比奇仓库',
      portrait: 'assets/game/npc/warehouse.png',
      text: '贵重之物交给老夫保管，既不占行囊，也不怕征战途中有所闪失。',
      note: `仓库容量 ${game.player.warehouse.length}/${game.player.warehouseSize} 格。`,
      action: '打开仓库',
    },
    captain: {
      role: '比奇卫队',
      portrait: 'assets/game/portrait/warrior_face.png',
      ...npcQuestCopy(),
    },
    blacksmith: {
      role: '比奇铁匠铺',
      portrait: 'assets/game/npc/merchant.png',
      text: '矿石要经火炼，药材也得按方调制。把野外采来的材料给我，我替你做成真正能用的物资。',
      note: '提供生活制造、装备修理；强化仍在角色面板中进行。',
      action: '打开制造',
    },
    valley_guard: {
      role: '毒蛇山谷哨所',
      portrait: 'assets/game/portrait/warrior_face.png',
      text: '雪狼会成群追击旅人。继续向东就是石墓阵，至少十八级再进去。',
      note: '山谷中药草资源丰富，可点击资源点采集。',
      action: '记下情报',
    },
    miner: {
      role: '蜈蚣洞矿区',
      portrait: 'assets/game/npc/merchant.png',
      text: '矿脉不是徒手能刨开的。把鹤嘴锄装备到武器位，再点击矿石慢慢采。',
      note: '采矿会消耗鹤嘴锄耐久；黑铁矿脉产出更稀有。',
      action: '记下情报',
    },
  };
  return copies[npc.id] || {
    role: '玛法居民',
    portrait: 'assets/game/portrait/warrior_face.png',
    text: '玛法大陆风云再起，旅人，请多保重。',
    note: '',
    action: '继续',
  };
}

function closeNpcDialogue() {
  $('#npc-dialogue').classList.add('hidden');
}

function openNpcDialogue(npc) {
  const copy = npcDialogueCopy(npc);
  closePanels(['npc-dialogue']);
  $('#npc-role').textContent = copy.role;
  $('#npc-name').textContent = npc.name;
  $('#npc-portrait').src = copy.portrait;
  $('#npc-portrait').alt = npc.name;
  $('#npc-text').textContent = copy.text;
  $('#npc-note').textContent = copy.note;
  $('#btn-npc-action').textContent = copy.action;
  $('#btn-npc-action').onclick = () => {
    closeNpcDialogue();
    if (npc.action === 'heal') game.healFull();
    if (npc.action === 'shop') openShop();
    if (npc.action === 'craft') openShop('craft');
    if (npc.action === 'warehouse') openWarehouse();
    if (npc.action === 'quest') game.talkQuest(npc.id);
    if (npc.action === 'guide') hint(npc.id === 'miner'
      ? '装备鹤嘴锄后点击矿脉，或在矿脉附近按 H 采集。'
      : '雪狼成群行动，准备药水后再前往石墓阵。');
    syncHud();
    syncQuest();
  };
  $('#npc-dialogue').classList.remove('hidden');
}

function syncWarehouse() {
  if (!game) return;
  const player = game.player;
  const list = $('#wh-list');
  list.innerHTML = '';
  player.warehouse.forEach((entry, index) => {
    const item = ITEMS[entry.id];
    const row = document.createElement('button');
    row.className = 'shop-item';
    row.innerHTML = `${itemIcon(item)}<div><strong style="color:${rarityColor(item)}">${item.name}${entry.qty > 1 ? ` ×${entry.qty}` : ''}</strong><p class="desc">${itemEntryDetails(entry) || '点击取回背包'}</p></div><span class="price">取出</span>`;
    row.onclick = () => { game.withdrawWarehouse(index); syncWarehouse(); syncBag(); syncHud(); };
    list.appendChild(row);
  });
  if (!player.warehouse.length) list.innerHTML = '<p class="muted">仓库为空。请在背包中选择物品后点击“存入仓库”。</p>';
}

function syncSettings() {
  $('#btn-sound').textContent = sound.enabled ? '开启' : '关闭';
  $('#btn-sound').classList.toggle('off', !sound.enabled);
  $('#sound-volume').value = String(Math.round(sound.volume * 100));
  $('#sound-volume-value').textContent = `${Math.round(sound.volume * 100)}%`;
  for (const bus of AUDIO_BUS_CONTROLS) {
    const value = Math.round((sound.getBusVolume(bus) ?? 1) * 100);
    $(`#${bus}-volume`).value = String(value);
    $(`#${bus}-volume-value`).textContent = `${value}%`;
  }
  $('#dynamic-range').value = sound.getDynamicRange();
  $('#render-quality').value = renderQuality;
}

function usePotion(kind) {
  if (!game) return;
  if (kind === 'mp' && game.player.classId === 'warrior') {
    hint('战士无需魔法');
    return;
  }
  game.useHotPotion(kind);
  if (isOpen('bag')) syncBag();
  syncHud();
}

function useRecall() {
  if (!game) return;
  const index = game.player.bag.findIndex((entry) => entry.id === 'recall');
  if (index < 0) { hint('没有回城卷'); return; }
  game.player.selectedBag = index;
  game.useSelectedItem();
  if (isOpen('bag')) syncBag();
}

function updateMovement() {
  if (!game) return;
  const x = (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0);
  const y = (held.has('s') || held.has('arrowdown') ? 1 : 0) - (held.has('w') || held.has('arrowup') ? 1 : 0);
  game.setMoveVector(x, y);
  if (activeWorldDestination) syncWorldRouteTracker();
}

function wireGameInput() {
  const canvas = $('#game-canvas');
  canvas.oncontextmenu = (event) => event.preventDefault();
  canvas.onpointerdown = (event) => {
    if (event.pointerType === 'touch' || event.button === 0) {
      const point = game.pointerToView(event.clientX, event.clientY);
      game.onClick(point.x, point.y);
      if (activeWorldDestination) syncWorldRouteTracker();
    }
  };

  window.onkeydown = (event) => {
    if (!game || event.target.tagName === 'INPUT') return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault(); held.add(key); updateMovement();
    }
    if (event.key === 'Shift') game.setRun(true);
    if (event.code === 'Space' || key === ' ') {
      event.preventDefault();
      if (event.repeat || !spaceAttackArmed) return;
      spaceAttackArmed = false;
      triggerBasicAttack();
    }
    if (['1', '2', '3', '4'].includes(key)) useSkill(Number(key) - 1);
    if (key === 'b') openPanel('bag');
    if (key === 'c') openPanel('character');
    if (key === 'k') openPanel('skill-learning');
    if (key === 'f') openPanel('social');
    if (key === 'i') openShop('codex-only');
    if (key === 'm') openPanel('world-map');
    if (key === 'y') openPanel('achievements');
    if (key === 'g') game.pickupNearestDrop();
    if (key === 'h') game.gatherNearest();
    if (key === 'p') { game.cyclePkMode(); syncHud(); }
    if (key === 'q') toggleQuest();
    if (key === 'v') useRecall();
    if (key === 'f1') { event.preventDefault(); usePotion('hp'); }
    if (key === 'f2') { event.preventDefault(); usePotion('mp'); }
    if (key === 'escape') {
      if (panelIds.some(isOpen)) closePanels();
      else openPanel('settings');
    }
  };
  window.onkeyup = (event) => {
    const key = event.key.toLowerCase();
    held.delete(key);
    updateMovement();
    if (event.key === 'Shift') game?.setRun(false);
    if (event.code === 'Space' || key === ' ') spaceAttackArmed = true;
  };
  window.onblur = () => {
    held.clear();
    game?.setMoveVector(0, 0);
    game?.setRun(false);
  };
  window.onresize = syncVisualViewport;
  if (window.visualViewport) {
    window.visualViewport.onresize = syncVisualViewport;
    window.visualViewport.onscroll = syncVisualViewport;
  }
  syncVisualViewport();

  setupJoystick();
  document.querySelectorAll('[data-skill]').forEach((button) => {
    button.onpointerdown = (event) => { event.preventDefault(); useSkill(Number(button.dataset.skill)); };
  });
  $('#mobile-attack').onpointerdown = (event) => { event.preventDefault(); triggerBasicAttack(); };
  $('#mobile-pickup').onpointerdown = (event) => { event.preventDefault(); game?.pickupNearestDrop(); };
  $('#mobile-gather').onpointerdown = (event) => { event.preventDefault(); game?.gatherNearest(); };
  $('#mobile-hp').onpointerdown = (event) => { event.preventDefault(); usePotion('hp'); };
  $('#mobile-mp').onpointerdown = (event) => { event.preventDefault(); usePotion('mp'); };
  $('#mobile-bag').onclick = (event) => { event.preventDefault(); openPanel('bag'); };
  $('#mobile-more').onclick = (event) => {
    event.preventDefault();
    const utility = $('#mobile-utility');
    const opening = utility.classList.contains('hidden');
    if (opening) closeMobileChat();
    utility.classList.toggle('hidden', !opening);
    $('#mobile-more').setAttribute('aria-expanded', String(opening));
  };
  $('#mobile-chat').onclick = (event) => {
    event.preventDefault();
    closeMobileUtility();
    const chat = $('#chat-panel');
    const opening = !chat.classList.contains('mobile-open');
    chat.classList.toggle('mobile-open', opening);
    if (opening) $('#chat-input').focus({ preventScroll: true });
    else closeMobileChat();
  };
  $('#mobile-world-map').onclick = (event) => { event.preventDefault(); closeMobileUtility(); openPanel('world-map'); };
  $('#mobile-skills').onclick = (event) => { event.preventDefault(); closeMobileUtility(); openPanel('skill-learning'); };
  $('#mobile-social').onclick = (event) => { event.preventDefault(); closeMobileUtility(); openPanel('social'); };
  $('#mobile-codex').onclick = (event) => { event.preventDefault(); closeMobileUtility(); openShop('codex-only'); };
  $('#mobile-pk').onclick = (event) => {
    event.preventDefault();
    closeMobileUtility();
    game?.cyclePkMode();
    syncHud();
  };
  $('#mobile-settings').onclick = (event) => { event.preventDefault(); closeMobileUtility(); openPanel('settings'); };
}

function setupJoystick() {
  const joystick = $('#joystick');
  const knob = $('#joystick-knob');
  let pointerId = null;
  const reset = () => {
    pointerId = null;
    knob.style.transform = 'translate(0, 0)';
    game?.setMoveVector(0, 0);
    game?.setRun(false);
  };
  const move = (event) => {
    if (event.pointerId !== pointerId) return;
    const rect = joystick.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const radius = rect.width * 0.33;
    const length = Math.hypot(dx, dy);
    if (length > radius) { dx = dx / length * radius; dy = dy / length * radius; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    game?.setMoveVector(dx / radius, dy / radius);
    game?.setRun(length > radius * 0.78);
  };
  joystick.onpointerdown = (event) => {
    event.preventDefault();
    pointerId = event.pointerId;
    joystick.setPointerCapture?.(pointerId);
    move(event);
  };
  joystick.onpointermove = move;
  joystick.onpointerup = reset;
  joystick.onpointercancel = reset;
}

boot();
