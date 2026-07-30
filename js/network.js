const RESUME_STORAGE_KEY = 'ember_multiplayer_resume_v1';
const RELIABLE_ACTION_TYPES = new Set([
  'chat',
  'friend_request', 'friend_accept', 'friend_remove',
  'team_invite', 'team_accept', 'team_leave', 'team_kick', 'team_promote',
  'guild_create', 'guild_invite', 'guild_accept', 'guild_leave', 'guild_kick', 'guild_promote',
  'trade_request', 'trade_accept', 'trade_offer', 'trade_confirm', 'trade_cancel',
  'use_item', 'unequip', 'buy_item', 'sell_item', 'repair_all',
  'enhance_slot', 'craft_recipe', 'heal_full', 'claim_achievement',
  'quest_interact', 'guild_war_declare', 'sabac_declare',
]);
const RELIABLE_ACTION_TTL_MS = 8_000;
const RELIABLE_ACTION_LIMIT = 64;

function actionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function playerCount(snapshot) {
  return Number.isFinite(snapshot?.onlinePlayers)
    ? snapshot.onlinePlayers
    : snapshot?.players?.length || 1;
}

function mergeCollection(previous = [], patch = {}) {
  const removed = new Set(patch.remove || []);
  const byId = new Map(
    previous
      .filter((entry) => !removed.has(entry.id))
      .map((entry) => [entry.id, entry]),
  );
  for (const update of patch.upsert || []) {
    const current = byId.get(update.id);
    byId.set(update.id, current ? { ...current, ...update } : update);
  }
  return [...byId.values()];
}

function mergeSnapshotDelta(previous, delta) {
  const next = {
    ...previous,
    ...(delta.changes || {}),
    type: 'snapshot',
    sequence: delta.sequence,
    serverTime: delta.serverTime,
  };
  for (const [key, patch] of Object.entries(delta.collections || {})) {
    next[key] = mergeCollection(previous[key], patch);
  }
  return next;
}

export class MultiplayerClient {
  constructor({
    onSnapshot = () => {},
    onStatus = () => {},
    onSocial = () => {},
    fetchImpl = globalThis.fetch?.bind(globalThis),
    EventSourceImpl = globalThis.EventSource,
    storage = globalThis.sessionStorage,
    heartbeatIntervalMs = 5_000,
    requestTimeoutMs = 5_000,
    reconnectBaseMs = 500,
    reconnectMaxMs = 10_000,
    randomImpl = Math.random,
  } = {}) {
    this.onSnapshot = onSnapshot;
    this.onStatus = onStatus;
    this.onSocial = onSocial;
    this.fetchImpl = fetchImpl;
    this.EventSourceImpl = EventSourceImpl;
    this.storage = storage;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.requestTimeoutMs = requestTimeoutMs;
    this.reconnectBaseMs = reconnectBaseMs;
    this.reconnectMaxMs = reconnectMaxMs;
    this.randomImpl = randomImpl;
    this.token = null;
    this.resumeToken = this.readResumeToken();
    this.playerId = null;
    this.profile = null;
    this.events = null;
    this.connected = false;
    this.closed = true;
    this.connectPromise = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.heartbeatInFlight = false;
    this.retryAttempt = 0;
    this.instanceId = actionId();
    this.eventGeneration = 0;
    this.lastPlayers = 1;
    this.lastMoveAt = 0;
    this.lastStateAt = 0;
    this.lastInventoryAt = 0;
    this.lastMoveHash = '';
    this.lastInventoryHash = '';
    this.sequenceByChannel = { move: 0, state: 0, inventory: 0 };
    this.inFlightLatest = new Set();
    this.pendingLatest = new Map();
    this.lastStatusSignature = '';
    this.lastSocialSignature = '';
    this.authoritativeSnapshot = null;
    this.reliablePending = new Map();
    this.reliableInFlight = false;
  }

  readResumeToken() {
    try {
      return this.storage?.getItem(RESUME_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  }

  storeResumeToken(token) {
    this.resumeToken = token || null;
    try {
      if (token) this.storage?.setItem(RESUME_STORAGE_KEY, token);
      else this.storage?.removeItem(RESUME_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in private or embedded browser contexts.
    }
  }

  reportStatus(connected, state, reason = null, players = this.lastPlayers) {
    this.connected = connected;
    this.lastPlayers = Math.max(connected ? 1 : 0, Number(players) || 0);
    const status = {
      connected,
      players: this.lastPlayers,
      state,
      reason,
      attempt: this.retryAttempt,
    };
    const signature = [
      status.connected ? 1 : 0,
      status.players,
      status.state,
      status.reason || '',
      status.attempt,
    ].join(':');
    if (signature === this.lastStatusSignature) return;
    this.lastStatusSignature = signature;
    this.onStatus(status);
  }

  socialSignature(social) {
    if (!social) return 'none';
    const roster = (entries = []) => entries
      .map((entry) => `${entry.id}:${entry.level || 0}:${entry.online === false ? 0 : 1}`)
      .join(',');
    const group = (entry) => entry
      ? `${entry.id}:${entry.leaderId || ''}:${entry.name || ''}:${roster(entry.members)}`
      : '';
    const messages = social.messages || [];
    const events = social.events || [];
    const trade = social.trade;
    return [
      `f:${roster(social.friends)}`,
      `fr:${roster(social.friendRequests)}`,
      `ti:${roster(social.teamInvites)}`,
      `gi:${(social.guildInvites || []).map((entry) => `${entry.id}:${entry.name}`).join(',')}`,
      `t:${group(social.team)}`,
      `g:${group(social.guild)}`,
      `m:${messages.length}:${messages.at(-1)?.id || ''}`,
      `e:${events.length}:${events.at(-1)?.id || ''}`,
      `tr:${trade ? `${trade.id}:${trade.status}:${(trade.confirmed || []).join(',')}:${JSON.stringify(trade.offers || {})}` : ''}`,
    ].join('|');
  }

  emitSocial(social) {
    const signature = this.socialSignature(social);
    if (signature === this.lastSocialSignature) return;
    this.lastSocialSignature = signature;
    this.onSocial(social || null);
  }

  acceptSnapshot(frame, { reset = false } = {}) {
    if (!frame || !Number.isFinite(Number(frame.sequence))) return false;
    let snapshot = frame;
    if (frame.type === 'snapshot_delta') {
      const previous = this.authoritativeSnapshot;
      if (!previous || frame.baseSequence !== previous.sequence) {
        this.handleConnectionFailure('desync');
        return false;
      }
      if (frame.sequence <= previous.sequence) return false;
      snapshot = mergeSnapshotDelta(previous, frame);
    } else {
      if (!reset && this.authoritativeSnapshot && frame.sequence <= this.authoritativeSnapshot.sequence) {
        return false;
      }
      if (!Array.isArray(frame.players)) return false;
    }
    this.authoritativeSnapshot = snapshot;
    this.lastPlayers = playerCount(snapshot);
    this.reportStatus(true, 'online', null, this.lastPlayers);
    this.onSnapshot(snapshot, this.playerId);
    this.emitSocial(snapshot.social || null);
    return true;
  }

  async fetchJson(url, options = {}, timeoutMs = this.requestTimeoutMs) {
    if (!this.fetchImpl) throw new Error('fetch unavailable');
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    try {
      const response = await this.fetchImpl(url, {
        ...options,
        ...(controller ? { signal: controller.signal } : {}),
      });
      const payload = await response.json().catch(() => ({ ok: response.ok }));
      return { response, payload };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async connect(profile = this.profile) {
    if (profile) this.profile = { ...profile };
    if (!this.profile) return false;
    this.closed = false;
    if (this.connectPromise) return this.connectPromise;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reportStatus(false, this.retryAttempt ? 'reconnecting' : 'connecting', null, this.lastPlayers);
    this.connectPromise = this.establishSession();
    const succeeded = await this.connectPromise;
    this.connectPromise = null;
    if (!succeeded || (!this.connected && !this.closed)) this.scheduleReconnect();
    return succeeded;
  }

  async establishSession() {
    try {
      const { response, payload } = await this.fetchJson('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...this.profile,
          resumeToken: this.resumeToken,
          instanceId: this.instanceId,
        }),
      });
      if (response.status === 409 && ['character_online', 'character_conflict'].includes(payload?.reason)) {
        this.closed = true;
        this.reportStatus(false, 'conflict', payload.reason, 0);
        return false;
      }
      if (!response.ok || !payload?.token || !payload?.player?.id) {
        throw new Error(`session ${response.status}`);
      }
      if (this.closed) return false;
      this.token = payload.token;
      this.playerId = payload.player.id;
      this.storeResumeToken(payload.resumeToken);
      this.sequenceByChannel = { move: 0, state: 0, inventory: 0 };
      this.lastMoveHash = '';
      this.lastInventoryHash = '';
      this.pendingLatest.clear();
      this.retryAttempt = 0;
      this.authoritativeSnapshot = null;
      this.acceptSnapshot(payload.snapshot, { reset: true });
      this.openEvents();
      this.startHeartbeat();
      this.flushReliable();
      return true;
    } catch (error) {
      if (this.closed) return false;
      this.reportStatus(false, 'reconnecting', error?.name === 'AbortError' ? 'timeout' : 'network', 0);
      return false;
    }
  }

  openEvents() {
    this.events?.close();
    if (!this.EventSourceImpl || !this.token || this.closed) {
      this.handleConnectionFailure('events');
      return;
    }
    const generation = ++this.eventGeneration;
    const events = new this.EventSourceImpl(`/api/events?token=${encodeURIComponent(this.token)}&delta=1`);
    this.events = events;
    events.onopen = () => {
      if (this.closed || generation !== this.eventGeneration) return;
      this.retryAttempt = 0;
      this.reportStatus(true, 'online', null, this.lastPlayers);
    };
    events.onmessage = (event) => {
      if (this.closed || generation !== this.eventGeneration) return;
      try {
        const frame = JSON.parse(event.data);
        const accepted = this.acceptSnapshot(frame);
        if (!accepted) return;
        if (!this.authoritativeSnapshot.players?.some((player) => player.id === this.playerId)) {
          this.handleConnectionFailure('session');
        }
      } catch {
        // The next authoritative frame repairs a malformed or partial frame.
      }
    };
    events.onerror = () => {
      if (this.closed || generation !== this.eventGeneration) return;
      this.handleConnectionFailure('events');
    };
  }

  handleConnectionFailure(reason = 'network') {
    if (this.closed) return;
    this.eventGeneration += 1;
    this.events?.close();
    this.events = null;
    this.reportStatus(false, 'reconnecting', reason, 0);
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.closed || this.reconnectTimer || this.connectPromise) return;
    const ceiling = Math.min(this.reconnectMaxMs, this.reconnectBaseMs * (2 ** this.retryAttempt));
    const jitter = 0.8 + Math.max(0, Math.min(1, Number(this.randomImpl?.()) || 0)) * 0.4;
    const delay = Math.max(1, Math.round(ceiling * jitter));
    this.retryAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  startHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.connected || this.closed || this.heartbeatInFlight) return;
      this.heartbeatInFlight = true;
      this.send({ type: 'heartbeat' })
        .finally(() => {
          this.heartbeatInFlight = false;
        });
    }, this.heartbeatIntervalMs);
  }

  withMetadata(action) {
    const next = { ...action, actionId: action.actionId || actionId() };
    if (Object.hasOwn(this.sequenceByChannel, action.type)) {
      this.sequenceByChannel[action.type] += 1;
      next.clientSeq = this.sequenceByChannel[action.type];
    }
    return next;
  }

  enqueueReliable(action) {
    if (!RELIABLE_ACTION_TYPES.has(action.type) || this.closed) return;
    this.reliablePending.set(action.actionId, {
      action,
      expiresAt: Date.now() + RELIABLE_ACTION_TTL_MS,
    });
    while (this.reliablePending.size > RELIABLE_ACTION_LIMIT) {
      this.reliablePending.delete(this.reliablePending.keys().next().value);
    }
  }

  async flushReliable() {
    if (this.reliableInFlight || !this.connected || this.closed || !this.reliablePending.size) return;
    this.reliableInFlight = true;
    try {
      for (const [id, pending] of this.reliablePending) {
        if (!this.connected || this.closed) break;
        if (pending.expiresAt <= Date.now()) {
          this.reliablePending.delete(id);
          continue;
        }
        const result = await this.sendEnriched(pending.action);
        if (!result.ok && ['network', 'timeout', 'session'].includes(result.reason)) break;
        this.reliablePending.delete(id);
      }
    } finally {
      this.reliableInFlight = false;
    }
  }

  async sendEnriched(enriched) {
    if (!this.token || this.closed) return { ok: false, reason: 'session' };
    const requestToken = this.token;
    try {
      const { response, payload } = await this.fetchJson('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: requestToken, action: enriched }),
        keepalive: enriched.type === 'heartbeat',
      });
      if (response.status === 401 && this.token === requestToken) {
        this.handleConnectionFailure('session');
        return { ...payload, ok: false };
      }
      return response.ok ? payload : { ...payload, ok: false };
    } catch (error) {
      if (this.token === requestToken) {
        this.handleConnectionFailure(error?.name === 'AbortError' ? 'timeout' : 'network');
      }
      return { ok: false, reason: error?.name === 'AbortError' ? 'timeout' : 'network' };
    }
  }

  async send(action) {
    const enriched = this.withMetadata(action);
    const result = await this.sendEnriched(enriched);
    if (!result.ok && ['network', 'timeout', 'session'].includes(result.reason)) {
      this.enqueueReliable(enriched);
    }
    return result;
  }

  queueLatest(channel, action) {
    this.pendingLatest.set(channel, action);
    if (!this.inFlightLatest.has(channel)) this.flushLatest(channel);
  }

  async flushLatest(channel) {
    if (this.inFlightLatest.has(channel) || this.closed || !this.connected) return;
    const action = this.pendingLatest.get(channel);
    if (!action) return;
    this.pendingLatest.delete(channel);
    this.inFlightLatest.add(channel);
    try {
      const result = await this.send(action);
      if (channel === 'inventory' && !result?.ok && result?.reason === 'inventory') {
        this.lastInventoryHash = '';
      }
    } finally {
      this.inFlightLatest.delete(channel);
      if (this.pendingLatest.has(channel) && this.connected && !this.closed) this.flushLatest(channel);
    }
  }

  syncPlayer(player, mapId, now = performance.now()) {
    this.profile = {
      ...this.profile,
      name: player.name,
      characterId: player.characterId,
      classId: player.classId,
    };
    if (!this.connected) return;
    if (now - this.lastMoveAt >= 100) {
      this.lastMoveAt = now;
      const moveHash = `${mapId}:${Math.round(player.x * 10)}:${Math.round(player.y * 10)}:${player.running ? 1 : 0}`;
      if (moveHash !== this.lastMoveHash) {
        this.lastMoveHash = moveHash;
        this.queueLatest('move', {
          type: 'move',
          mapId,
          x: player.x,
          y: player.y,
          run: player.running,
        });
      }
    }
    if (now - this.lastStateAt >= 1000) {
      this.lastStateAt = now;
      this.queueLatest('state', {
        type: 'state',
        pkMode: player.pkMode,
        anim: player.anim,
        mapId,
      });
    }
  }

  async changeMap(mapId) {
    const result = await this.send({ type: 'map', to: mapId });
    if (result?.ok) this.lastMoveHash = '';
    return result;
  }

  close({ notify = false, clearResume = false } = {}) {
    if (notify && this.token && this.fetchImpl) {
      this.fetchImpl('/api/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.token }),
        keepalive: true,
      }).catch(() => {});
    }
    this.closed = true;
    this.connected = false;
    this.eventGeneration += 1;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeatTimer);
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.events?.close();
    this.events = null;
    this.authoritativeSnapshot = null;
    this.pendingLatest.clear();
    this.inFlightLatest.clear();
    this.reliablePending.clear();
    this.reliableInFlight = false;
    if (clearResume) this.storeResumeToken(null);
    this.reportStatus(false, 'closed', 'closed', 0);
  }
}
