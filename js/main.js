import { Game, loadAssets, CLASSES, ITEMS, SHOP, QUESTS } from './game.js';
import {
  ACHIEVEMENTS, ENHANCE_MAX, EQUIP_SLOTS, MONSTERS, RARITIES, SLOT_NAMES, enhanceCost,
} from './config.js';
import { hasSave, loadGame, clearSave } from './save.js';
import { SoundSystem } from './audio.js';

const $ = (selector) => document.querySelector(selector);
const screens = { menu: $('#screen-menu'), pick: $('#screen-pick'), game: $('#screen-game') };
const panelIds = ['bag', 'character', 'achievements', 'shop', 'warehouse', 'settings'];
const sound = new SoundSystem();

let assets = null;
let game = null;
let selected = null;
let raf = 0;
let last = 0;
let lastPanelSync = 0;
let questOpen = true;
let achievementTimer = 0;
const held = new Set();

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

function openPanel(id, keep = []) {
  const panel = $(`#${id}`);
  const opening = panel.classList.contains('hidden');
  closePanels(opening ? [id, ...keep] : keep);
  panel.classList.toggle('hidden', !opening);
  if (!opening) return;
  if (id === 'bag') syncBag();
  if (id === 'character') syncCharacter();
  if (id === 'achievements') syncAchievements();
  if (id === 'warehouse') syncWarehouse();
  if (id === 'settings') syncSettings();
}

async function boot() {
  wireStaticActions();
  $('#btn-continue').classList.toggle('hidden', !hasSave());
  try {
    assets = await loadAssets();
    $('#load-status').innerHTML = '<span></span>玛法大陆已就绪';
  } catch (error) {
    console.error(error);
    $('#load-status').textContent = `资源整备失败：${error.message}`;
  }
}

function wireStaticActions() {
  $('#btn-start').onclick = () => { buildClassPick(); show('pick'); };
  $('#btn-continue').onclick = continueGame;
  $('#btn-back').onclick = () => show('menu');
  $('#btn-enter').onclick = startGame;
  $('#btn-menu-help').onclick = () => {
    window.alert('鼠标或触屏移动与攻击；WASD 自由移动；1—4 技能；F1/F2 药水；B 背包；C 角色强化；Y 成就；空格规避 Boss 法阵。');
  };

  $('#btn-bag').onclick = () => openPanel('bag');
  $('#btn-character').onclick = () => openPanel('character');
  $('#btn-char').onclick = () => openPanel('character');
  $('#btn-achievements').onclick = () => openPanel('achievements');
  $('#btn-settings').onclick = () => openPanel('settings');
  $('#btn-bag-close').onclick = () => $('#bag').classList.add('hidden');
  $('#btn-char-close').onclick = () => $('#character').classList.add('hidden');
  $('#btn-ach-close').onclick = () => $('#achievements').classList.add('hidden');
  $('#btn-shop-close').onclick = () => $('#shop').classList.add('hidden');
  $('#btn-wh-close').onclick = () => $('#warehouse').classList.add('hidden');
  $('#btn-settings-close').onclick = () => $('#settings').classList.add('hidden');
  $('#btn-quest-toggle').onclick = toggleQuest;

  $('#btn-potion-hp').onclick = () => usePotion('hp');
  $('#btn-potion-mp').onclick = () => usePotion('mp');
  $('#btn-town').onclick = useRecall;
  $('#btn-sell').onclick = () => { game?.sellSelected(); syncBag(); syncHud(); };
  $('#btn-deposit').onclick = () => { game?.depositSelected(); syncBag(); syncWarehouse(); };
  $('#btn-revive').onclick = () => {
    $('#death').classList.add('hidden');
    game.revive();
    syncHud();
  };
  $('#btn-save').onclick = () => { game?.persist(); hint('进度已保存到当前设备'); };
  $('#btn-sound').onclick = () => { sound.setEnabled(!sound.enabled); sound.play('equip'); syncSettings(); };
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
    card.innerHTML = `
      <div class="art"><img src="${character.portrait}" alt="${character.name}" onerror="this.src='${character.unit}'"/></div>
      <div class="meta"><span class="role">${roles[character.id]}</span><h3>${character.name}</h3><p>${character.desc}</p></div>`;
    card.onclick = () => {
      grid.querySelectorAll('.class-card').forEach((entry) => entry.classList.remove('selected'));
      card.classList.add('selected');
      selected = character.id;
      $('#btn-enter').disabled = false;
      $('#pick-info').innerHTML = `<h4>${character.name}技能</h4>${character.skills.map((skill) => `<div><b>${skill.key}</b>${skill.name}：${skill.desc}</div>`).join('')}`;
    };
    grid.appendChild(card);
  }
}

function continueGame() {
  const save = loadGame();
  if (!save || !assets) return;
  selected = save.player.classId;
  show('game');
  bootGame({ save });
}

function startGame() {
  if (!selected || !assets) return;
  clearSave();
  show('game');
  bootGame({ classId: selected, name: ($('#player-name').value || '无名旅人').trim().slice(0, 8) });
}

function bootGame(options) {
  closePanels();
  $('#death').classList.add('hidden');
  game = new Game($('#game-canvas'), assets, {
    ...options,
    onHint: (message) => {
      if (message === '__SHOP__') { openShop(); return; }
      if (message === '__WAREHOUSE__') { openWarehouse(); return; }
      hint(message);
    },
    onDeath: () => {
      game.paused = true;
      closePanels();
      $('#death').classList.remove('hidden');
      sound.play('bossDown');
    },
    onQuest: syncQuest,
    onLog: addLog,
    onSfx: (name) => sound.play(name),
    onAchievement: showAchievementToast,
  });
  wireGameInput();
  buildSkills();
  syncHud();
  syncQuest();
  addLog({ message: '余烬重燃，旅程开始', type: 'zone' });
  last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
  hint('先与比奇城中央的卫士队长交谈，开启主线。');
}

function useSkill(index) {
  if (!game) return;
  const skill = game.player.def.skills[index];
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
  game.player.def.skills.forEach((skill, index) => {
    const button = document.createElement('button');
    button.innerHTML = `<span class="k">${skill.key}</span>${skill.name}<span class="mana">${skill.mana || ''}</span>`;
    button.title = skill.desc;
    button.setAttribute('aria-label', `${skill.key} ${skill.name}`);
    button.onclick = () => useSkill(index);
    bar.appendChild(button);
  });
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game) {
    game.update(dt);
    game.render();
    syncHud();
    if (now - lastPanelSync > 300) {
      lastPanelSync = now;
      if (isOpen('character')) syncCharacter();
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
  $('#clock-label').textContent = `玛法历 ${String(Math.floor(player.playTime / 60) + 1).padStart(3, '0')}`;
  $('#hud-portrait').src = player.def.avatar;
  $('#hud-name').textContent = player.name;
  $('#hud-class').textContent = player.def.name;
  $('#hud-lv').textContent = player.level;
  $('#hud-power').textContent = `战力 ${player.combatPower()}`;
  $('#hud-gold').textContent = `${player.gold} 金`;
  $('#bar-hp').style.transform = `scaleX(${Math.max(0, player.hp / player.maxHp)})`;
  $('#bar-mp').style.transform = `scaleX(${Math.max(0, player.mp / Math.max(1, player.maxMp))})`;
  $('#bar-xp').style.transform = `scaleX(${Math.min(1, player.xp / player.xpNeed())})`;
  $('#txt-hp').textContent = `${Math.ceil(player.hp)} / ${Math.ceil(player.maxHp)}`;
  $('#txt-mp').textContent = `${Math.ceil(player.mp)} / ${Math.ceil(player.maxMp)}`;
  $('#txt-xp').textContent = `${player.xp}/${player.xpNeed()}`;
  $('#hp-pot-count').textContent = player.countItem('hp_pot') + player.countItem('hp_pot_b');
  $('#mp-pot-count').textContent = player.countItem('mp_pot') + player.countItem('mp_pot_b');
  $('#scroll-count').textContent = player.countItem('recall');

  $('#skill-bar').querySelectorAll('button').forEach((button, index) => {
    const skill = player.def.skills[index];
    if (!skill) return;
    button.classList.toggle('ready', player.skillCd[index] <= 0 && player.mp >= skill.mana);
    let cd = button.querySelector('.cd');
    if (player.skillCd[index] > 0) {
      if (!cd) { cd = document.createElement('div'); cd.className = 'cd'; button.appendChild(cd); }
      cd.textContent = Math.ceil(player.skillCd[index]);
    } else cd?.remove();
  });

  const boss = game.monsters.find((monster) => monster.boss && monster.alive);
  $('#boss-hud').classList.toggle('hidden', !boss);
  if (boss) {
    $('#boss-name').textContent = boss.name;
    $('#boss-phase').textContent = boss.enraged ? '狂暴' : '第一阶段';
    $('#boss-hp').style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
  }
  $('#combo-hud').classList.toggle('hidden', game.combo < 3);
  $('#combo-count').textContent = game.combo;
}

function syncQuest() {
  if (!game) return;
  const player = game.player;
  const element = $('#quest-body');
  if (!player.questId) {
    element.innerHTML = '<h4>余烬之后</h4><p>主线已完成。继续挑战教主、强化装备并完成玛法纪事。</p>';
    return;
  }
  const quest = QUESTS.find((entry) => entry.id === player.questId);
  if (!quest) { element.textContent = ''; return; }
  const lines = quest.steps.map((step) => {
    if (step.type === 'talk') return `<span>· 与卫士队长对话</span>`;
    if (step.type === 'kill') {
      const current = Math.min(step.count, player.questProgress[step.monster] || 0);
      return `<span class="${current >= step.count ? 'done' : ''}">· 击杀 ${MONSTERS[step.monster]?.name || step.monster} ${current}/${step.count}</span>`;
    }
    if (step.type === 'collect') {
      const current = Math.min(step.count, player.countItem(step.item));
      return `<span class="${current >= step.count ? 'done' : ''}">· 收集 ${ITEMS[step.item]?.name || step.item} ${current}/${step.count}</span>`;
    }
    return '';
  });
  element.innerHTML = `<h4>${quest.name}</h4><p>${quest.desc}</p>${lines.join('<br>')}`;
}

function toggleQuest() {
  questOpen = !questOpen;
  $('#quest-body').classList.toggle('hidden', !questOpen);
  $('#btn-quest-toggle').textContent = questOpen ? '−' : '+';
}

function itemIcon(item) {
  const icon = item?.icon ?? (item?.type === 'weapon' ? 4 : item?.type === 'armor' ? 5 : 2);
  const x = -(icon % 3) * 32;
  const y = -Math.floor(icon / 3) * 32;
  return `<span class="item-icon" style="background-position:${x}px ${y}px"></span>`;
}

function rarityColor(item) {
  return RARITIES[item?.rarity || 'common']?.color || '#c8c0ad';
}

function syncBag() {
  if (!game) return;
  const player = game.player;
  const equipment = $('#equip-slots');
  equipment.innerHTML = '';
  for (const slotName of EQUIP_SLOTS) {
    const id = player.equip[slotName];
    const item = ITEMS[id];
    const slot = document.createElement('button');
    slot.className = `equip-slot${id ? ' active' : ''}`;
    slot.innerHTML = id
      ? `${itemIcon(item)}<span style="color:${rarityColor(item)}">${item.name}</span>${player.enhance[slotName] ? `<b class="plus">+${player.enhance[slotName]}</b>` : ''}`
      : `<span class="lab">${SLOT_NAMES[slotName]}</span>空`;
    slot.title = id ? `${item.name} ${item.desc}（点击卸下）` : SLOT_NAMES[slotName];
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
      slot.title = `${item.name} · ${item.desc}`;
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
    detail.innerHTML = `${itemIcon(item)}<div><strong style="color:${rarityColor(item)}">${item.name} · ${RARITIES[item.rarity].name}</strong><p>${item.desc}${requirement}</p></div>`;
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
  $('#char-title').textContent = `等级 ${player.level} · 最佳连斩 ${player.bestCombo} · 击杀 ${player.totalKills}`;
  $('#char-power').textContent = `战力 ${player.combatPower()}`;
  const stats = [
    ['生命', Math.floor(player.maxHp)], ['魔法', Math.floor(player.maxMp)], ['攻击', Math.floor(player.atk)],
    ['魔法', Math.floor(player.mag)], ['防御', Math.floor(player.defense)], ['魔防', Math.floor(player.magDef)],
    ['暴击', `${Math.round(player.crit * 100)}%`], ['闪避', `${Math.round(player.dodge * 100)}%`], ['吸血', `${Math.round(player.lifesteal * 100)}%`],
  ];
  $('#stat-grid').innerHTML = stats.map(([label, value]) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`).join('');

  const list = $('#forge-list');
  list.innerHTML = '';
  for (const slotName of EQUIP_SLOTS) {
    const id = player.equip[slotName];
    const level = player.enhance[slotName] || 0;
    const cost = enhanceCost(level);
    const row = document.createElement('div');
    row.className = 'forge-row';
    row.innerHTML = `
      <div><strong>${SLOT_NAMES[slotName]} · ${id ? ITEMS[id].name : '未装备'}</strong> <em>${level ? `+${level}` : ''}</em></div>
      <span class="cost">${level >= ENHANCE_MAX ? '已满级' : `${cost.gold} 金${cost.ore ? ` · 黑铁 ${cost.ore}` : ''} · ${Math.round(cost.rate * 100)}%`}</span>
      <button class="btn tiny" ${!id || level >= ENHANCE_MAX ? 'disabled' : ''}>强化</button>`;
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

function openShop() {
  closePanels(['shop']);
  $('#shop').classList.remove('hidden');
  const list = $('#shop-list');
  list.innerHTML = '';
  for (const id of SHOP) {
    const item = ITEMS[id];
    const row = document.createElement('button');
    row.className = 'shop-item';
    row.innerHTML = `${itemIcon(item)}<div><strong style="color:${rarityColor(item)}">${item.name}</strong><p class="desc">${item.desc}</p></div><span class="price">${item.price} 金</span>`;
    row.onclick = () => { game.buyItem(id); syncHud(); syncBag(); };
    list.appendChild(row);
  }
}

function openWarehouse() {
  closePanels(['warehouse', 'bag']);
  $('#warehouse').classList.remove('hidden');
  $('#bag').classList.remove('hidden');
  syncWarehouse();
  syncBag();
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
    row.innerHTML = `${itemIcon(item)}<div><strong style="color:${rarityColor(item)}">${item.name} ×${entry.qty}</strong><p class="desc">点击取回背包</p></div><span class="price">取出</span>`;
    row.onclick = () => { game.withdrawWarehouse(index); syncWarehouse(); syncBag(); syncHud(); };
    list.appendChild(row);
  });
  if (!player.warehouse.length) list.innerHTML = '<p class="muted">仓库为空。请在背包中选择物品后点击“存入仓库”。</p>';
}

function syncSettings() {
  $('#btn-sound').textContent = sound.enabled ? '开启' : '关闭';
  $('#btn-sound').classList.toggle('off', !sound.enabled);
}

function usePotion(kind) {
  if (!game) return;
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
}

function wireGameInput() {
  const canvas = $('#game-canvas');
  canvas.oncontextmenu = (event) => event.preventDefault();
  canvas.onpointerdown = (event) => {
    if (event.pointerType === 'touch' || event.button === 0) game.onClick(event.clientX, event.clientY);
  };

  window.onkeydown = (event) => {
    if (!game || event.target.tagName === 'INPUT') return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault(); held.add(key); updateMovement();
    }
    if (event.key === 'Shift') game.setRun(true);
    if (event.code === 'Space') { event.preventDefault(); game.tryJump(); }
    if (['1', '2', '3', '4'].includes(key)) useSkill(Number(key) - 1);
    if (key === 'b') openPanel('bag');
    if (key === 'c') openPanel('character');
    if (key === 'y') openPanel('achievements');
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
  };
  window.onblur = () => {
    held.clear();
    game?.setMoveVector(0, 0);
    game?.setRun(false);
  };
  window.onresize = () => game?.resize();

  setupJoystick();
  document.querySelectorAll('[data-skill]').forEach((button) => {
    button.onpointerdown = (event) => { event.preventDefault(); useSkill(Number(button.dataset.skill)); };
  });
  $('#mobile-jump').onpointerdown = (event) => { event.preventDefault(); game?.tryJump(); };
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
