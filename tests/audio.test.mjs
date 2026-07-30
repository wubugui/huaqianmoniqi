import assert from 'node:assert/strict';

class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.events.push(['set', value, time]);
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(['linear', value, time]);
  }

  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(['exponential', value, time]);
  }

  cancelScheduledValues(time) {
    this.events.push(['cancel', time]);
  }

  cancelAndHoldAtTime(time) {
    this.events.push(['hold', time]);
  }
}

class FakeAudioNode {
  constructor() {
    this.connections = [];
    this.disconnected = false;
  }

  connect(node) {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.disconnected = true;
    this.connections.length = 0;
  }
}

class FakeGainNode extends FakeAudioNode {
  constructor() {
    super();
    this.gain = new FakeAudioParam(1);
  }
}

class FakeFilterNode extends FakeAudioNode {
  constructor() {
    super();
    this.type = 'lowpass';
    this.frequency = new FakeAudioParam(350);
    this.Q = new FakeAudioParam(1);
  }
}

class FakeSourceNode extends FakeAudioNode {
  constructor() {
    super();
    this.onended = null;
    this.started = false;
    this.stopped = false;
    this.playbackRate = new FakeAudioParam(1);
  }

  start(...args) {
    this.started = true;
    this.startArgs = args;
  }

  stop(time) {
    this.stopped = true;
    this.stopTime = time;
  }
}

class FakeOscillatorNode extends FakeSourceNode {
  constructor() {
    super();
    this.type = 'sine';
    this.frequency = new FakeAudioParam(440);
    this.detune = new FakeAudioParam(0);
  }
}

class FakeBufferSourceNode extends FakeSourceNode {
  constructor() {
    super();
    this.buffer = null;
  }
}

class FakeCompressorNode extends FakeAudioNode {
  constructor() {
    super();
    this.threshold = new FakeAudioParam();
    this.knee = new FakeAudioParam();
    this.ratio = new FakeAudioParam();
    this.attack = new FakeAudioParam();
    this.release = new FakeAudioParam();
  }
}

class FakeStereoPannerNode extends FakeAudioNode {
  constructor() {
    super();
    this.pan = new FakeAudioParam();
  }
}

class FakeAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.duration = length / sampleRate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }

  getChannelData(channel) {
    return this.data[channel];
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 24000;
    this.state = 'running';
    this.destination = new FakeAudioNode();
    this.sources = [];
    this.gains = [];
    this.filters = [];
    this.resumeCalls = 0;
    this.suspendCalls = 0;
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }

  createBiquadFilter() {
    const filter = new FakeFilterNode();
    this.filters.push(filter);
    return filter;
  }
  createDynamicsCompressor() { return new FakeCompressorNode(); }
  createStereoPanner() { return new FakeStereoPannerNode(); }
  createConvolver() { return new FakeAudioNode(); }
  createBuffer(channels, length, sampleRate) { return new FakeAudioBuffer(channels, length, sampleRate); }

  createOscillator() {
    const source = new FakeOscillatorNode();
    this.sources.push(source);
    return source;
  }

  createBufferSource() {
    const source = new FakeBufferSourceNode();
    this.sources.push(source);
    return source;
  }

  resume() {
    this.resumeCalls += 1;
    this.state = 'running';
    return Promise.resolve();
  }

  suspend() {
    this.suspendCalls += 1;
    this.state = 'suspended';
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}
FakeAudioContext.instances = [];

const stored = new Map();
const listeners = new Map();
globalThis.window = {
  AudioContext: FakeAudioContext,
  localStorage: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  },
  addEventListener: (type, handler) => listeners.set(type, handler),
  removeEventListener: (type) => listeners.delete(type),
};
globalThis.document = {
  hidden: false,
  addEventListener: (type, handler) => listeners.set(type, handler),
  removeEventListener: (type) => listeners.delete(type),
};

const { SoundSystem } = await import('../js/audio.js');

{
  const sound = new SoundSystem();
  assert.equal(sound.volume, 0.8, 'fresh profiles start at a practical master volume');
  assert.equal(sound.play('not-a-contract-event'), false, 'unknown events are silent');
  assert.equal(FakeAudioContext.instances.length, 0, 'unknown events do not allocate an AudioContext');

  const contractEvents = [
    'footstep', 'footstepGrass', 'footstepStone', 'footstepCave', 'swing',
    'monsterAttack', 'beastAttack', 'undeadAttack', 'demonAttack',
    'hit', 'playerHit', 'playerDeath', 'crit', 'kill', 'bossDown',
    'skill', 'thrust', 'fire_sword', 'rush', 'fireball', 'lightning', 'burst', 'shield', 'heal',
    'talisman', 'poison', 'summon', 'gather', 'potion', 'loot', 'buy', 'equip', 'portal', 'level',
    'quest', 'achievement', 'forge', 'forgeFail', 'warning', 'explosion', 'dodge', 'uiOpen', 'uiClose',
    'ambientTown', 'ambientWild', 'ambientDungeon',
    'musicTown', 'musicWild', 'musicDungeon',
  ];
  for (const name of contractEvents) {
    assert.equal(sound.play(name), true, `${name} should schedule at least one sound layer`);
    sound.ctx.currentTime += 1;
  }
  assert.ok(sound.compressor, 'master graph includes dynamics control');
  assert.equal(sound.buses.size, 8, 'events route through calibrated category buses, including music and ambience');
  assert.ok(sound.activeVoices.length <= 48, 'voice budget remains bounded');
  sound.dispose();
  assert.equal(sound.ctx, null, 'dispose releases the context reference');
}

{
  const sound = new SoundSystem();
  assert.equal(sound.play('footstep'), true);
  const sourceCount = sound.ctx.sources.length;
  assert.equal(sound.play('footstep'), false, 'footsteps are throttled inside the cooldown window');
  assert.equal(sound.ctx.sources.length, sourceCount, 'throttled footsteps allocate no voices');
  sound.ctx.currentTime += 0.1;
  assert.equal(sound.play('footstep'), true, 'footstep variation can play after cooldown');

  sound.ctx.state = 'suspended';
  sound.ctx.currentTime += 1;
  assert.equal(sound.play('swing'), true);
  assert.ok(sound.ctx.resumeCalls >= 1, 'suspended mobile contexts are resumed on interaction');

  sound.setEnabled(false);
  assert.equal(stored.get('ember_sound'), '0');
  assert.equal(sound.play('hit'), false, 'disabled sound never schedules');
  sound.setVolume(0.45);
  assert.equal(stored.get('ember_sound_volume'), '0.45', 'master volume persists');
  assert.equal(sound.volume, 0.45, 'master volume remains available to settings UI');
  sound.dispose();
}

stored.set('ember_sound', '1');
stored.delete('ember_sound_volume');

{
  const sound = new SoundSystem();
  assert.equal(sound.play('ambientTown', { emitter: 'ambience:bich' }), true);
  const firstAmbientVoices = [...sound.activeVoices];
  const firstNoiseVoice = firstAmbientVoices.find((voice) => voice.source instanceof FakeBufferSourceNode);
  assert.ok(firstNoiseVoice, 'ambience contains a filtered noise bed');
  assert.equal(firstNoiseVoice.source.loop, true, 'long ambience explicitly enables its noise loop');
  assert.ok(firstNoiseVoice.source.buffer.duration >= 3.3, 'noise buffer is long enough to avoid an obvious short repeating texture');
  const [, firstOffset = 0] = firstNoiseVoice.source.startArgs;
  const firstRate = firstNoiseVoice.source.playbackRate.value;
  assert.ok(
    firstOffset + 2.66 * firstRate < firstNoiseVoice.source.buffer.duration,
    'ambient playback stays inside one randomized buffer window without crossing a discontinuous loop edge',
  );

  sound.ctx.currentTime = 2.28;
  assert.equal(
    sound.play('ambientTown', { emitter: 'ambience:bich' }),
    true,
    'the next ambience pulse overlaps the outgoing release instead of creating a silent cycle',
  );
  assert.equal(sound.activeEvents.get('ambientTown').length, 2, 'ambient crossfade is bounded to two pulses');

  sound.ctx.currentTime = 4.56;
  assert.equal(sound.play('ambientTown', { emitter: 'ambience:bich' }), true);
  assert.equal(sound.activeEvents.get('ambientTown').length, 2, 'expired ambience is pruned before the next crossfade');
  assert.equal(firstNoiseVoice.eventHandle.cleaned, true, 'expired ambience releases its event routing nodes');
  assert.ok(firstNoiseVoice.cleanupNodes.every((node) => node.disconnected), 'expired ambience releases per-voice filters');
  sound.dispose();
}

stored.set('ember_sound', '1');

{
  const sound = new SoundSystem();
  assert.equal(sound.play('level'), true);
  const combatGain = sound.buses.get('combat').gain;
  const skillGain = sound.buses.get('skill').gain;
  const worldGain = sound.buses.get('world').gain;
  const ambienceGain = sound.buses.get('ambience').gain;
  assert.ok(combatGain.events.some(([type, time]) => type === 'hold' && time === 0), 'ducking holds the live automation value');
  assert.ok(combatGain.events.some(([type, value, time]) => type === 'linear' && value === 0.9 * 0.82 && time === 0.022));
  assert.ok(skillGain.events.some(([type, value]) => type === 'linear' && value === 0.84 * 0.76));
  assert.ok(worldGain.events.some(([type, value]) => type === 'linear' && value === 0.76 * 0.84));
  assert.ok(ambienceGain.events.some(([type, value]) => type === 'linear' && value === 0.64 * 0.42));
  assert.ok(combatGain.events.some(([type, value, time]) => type === 'linear' && value === 0.9 && time === 0.42));
  assert.ok(
    sound.reverbGain.gain.events.some(([type, value, time]) => type === 'linear' && value === 0.145 * 0.66 && time === 0.026),
    'reward ducking also controls shared reverb masking',
  );

  sound.ctx.currentTime = 0.1;
  assert.equal(sound.play('achievement'), true);
  assert.ok(
    combatGain.events.some(([type, time]) => type === 'hold' && time === 0.1),
    'back-to-back rewards extend ducking without stepping the current bus value',
  );
  assert.ok(
    combatGain.events.some(([type, value, time]) => type === 'linear' && value === 0.9 && time === 0.52),
    'the latest reward owns the release endpoint',
  );

  sound.ctx.currentTime = 1;
  const duckEventCount = combatGain.events.length;
  const scheduleLayer = sound._scheduleLayer;
  sound._scheduleLayer = () => 0;
  assert.equal(sound.play('quest'), false, 'an unscheduled reward reports failure');
  assert.equal(combatGain.events.length, duckEventCount, 'a failed reward does not duck live gameplay');
  sound._scheduleLayer = scheduleLayer;
  sound.dispose();
}

stored.set('ember_sound', '1');

{
  const sound = new SoundSystem();
  assert.equal(sound.play('footstepStone'), true);
  const victim = sound.activeVoices.find((voice) => voice.cleanupNodes.length);
  assert.ok(victim, 'filtered voices retain cleanup metadata');
  const victimFilter = victim.cleanupNodes[0];
  sound._stopVoice(victim, sound.ctx.currentTime);
  assert.equal(victim.stopping, true);
  assert.equal(victim.finished, false, 'voice stealing leaves the fade connected until the source ends');
  assert.equal(victim.gain.disconnected, false, 'the scheduled anti-click ramp remains audible');
  assert.deepEqual(victim.gain.gain.events.at(-2), ['hold', 0], 'voice stealing holds the live envelope before fading');
  assert.deepEqual(victim.gain.gain.events.at(-1), ['exponential', 0.0001, 0.012]);
  assert.equal(sound.activeVoices.includes(victim), false, 'a retiring voice no longer consumes the active budget');
  victim.source.onended();
  assert.equal(victim.finished, true);
  assert.equal(victim.gain.disconnected, true);
  assert.equal(victimFilter.disconnected, true, 'voice completion disconnects the filter node');
  sound.dispose();
}

stored.set('ember_sound', '1');

{
  const sound = new SoundSystem();
  assert.equal(sound.play('uiOpen'), true);
  sound.setVolume(0);
  assert.equal(sound.volume, 0, 'zero is a valid master-volume setting');
  const zeroVolumeRamp = sound.master.gain.events.at(-1);
  assert.deepEqual(zeroVolumeRamp.slice(0, 2), ['exponential', 0.0001], 'zero volume ramps to inaudible silence without a logarithmic error');
  sound.setVolume('not-a-number');
  assert.equal(sound.volume, 0, 'invalid volume input cannot silently overwrite the saved setting');

  sound.ctx.currentTime = 1;
  const gainCount = sound.ctx.gains.length;
  assert.equal(sound.play('hit', { gain: 0, emitter: 'muted-test' }), true);
  const mutedEventGain = sound.ctx.gains[gainCount];
  assert.equal(mutedEventGain.gain.events[0][1], 0, 'an explicit per-event gain of zero is not replaced by unity gain');
  sound.dispose();
}

stored.set('ember_sound', '1');
stored.delete('ember_sound_volume');
stored.delete('ember_sound_bus_volumes');
stored.delete('ember_sound_dynamic_range');

{
  const sound = new SoundSystem();
  const publicBuses = ['music', 'ambience', 'combat', 'skill', 'ui', 'movement', 'reward'];
  for (const name of publicBuses) assert.equal(sound.getBusVolume(name), 1, `${name} defaults to unity`);
  assert.equal(sound.getBusVolume('not-a-bus'), null);
  assert.equal(sound.setBusVolume('not-a-bus', 0.5), false);
  assert.equal(sound.setBusVolume('combat', Number.NaN), false);
  assert.equal(sound.play('uiOpen'), true);

  assert.equal(sound.setBusVolume('combat', 0), true);
  assert.equal(sound.getBusVolume('combat'), 0);
  assert.deepEqual(
    sound.buses.get('combat').gain.events.at(-1).slice(0, 2),
    ['exponential', 0.0001],
    'muted buses retain logarithmically safe silence',
  );
  assert.equal(sound.setBusVolume('ambience', 0.44), true);
  assert.ok(
    sound.buses.get('ambience').gain.events.some(([type, value]) => type === 'exponential' && value === 0.64 * 0.44),
    'ambience preference applies to its dedicated bus',
  );
  assert.ok(
    sound.buses.get('world').gain.events.some(([type, value]) => type === 'exponential' && value === 0.76 * 0.44),
    'world-space utility effects follow the public ambience group',
  );
  assert.equal(sound.setBusVolume('music', 0.36), true);
  const savedBuses = JSON.parse(stored.get('ember_sound_bus_volumes'));
  assert.deepEqual(Object.keys(savedBuses).sort(), [...publicBuses].sort(), 'only documented groups are persisted');
  assert.equal(savedBuses.music, 0.36);
  assert.equal(savedBuses.combat, 0);
  sound.dispose();

  const restored = new SoundSystem();
  assert.equal(restored.getBusVolume('music'), 0.36, 'music volume survives a new sound session');
  assert.equal(restored.getBusVolume('combat'), 0, 'mute survives a new sound session');
  assert.equal(restored.getBusVolume('ambience'), 0.44);
  restored.dispose();
}

stored.set('ember_sound', '1');
stored.delete('ember_sound_volume');
stored.delete('ember_sound_bus_volumes');
stored.delete('ember_sound_dynamic_range');

{
  const sound = new SoundSystem();
  assert.equal(sound.getDynamicRange(), 'balanced');
  assert.equal(sound.play('uiOpen'), true);
  assert.equal(sound.setDynamicRange('night'), true);
  assert.equal(sound.getDynamicRange(), 'night');
  assert.equal(stored.get('ember_sound_dynamic_range'), 'night');
  assert.ok(
    sound.compressor.threshold.events.some(([type, value]) => type === 'linear' && value === -26),
    'night mode lowers the compression threshold',
  );
  assert.ok(
    sound.compressor.ratio.events.some(([type, value]) => type === 'linear' && value === 12),
    'night mode constrains transient range',
  );
  assert.ok(
    sound.master.gain.events.some(([type, value]) => type === 'exponential' && value === 0.68 * 0.8 * 0.82),
    'night mode trims output headroom',
  );
  assert.ok(
    sound.buses.get('movement').gain.events.some(([type, value]) => type === 'exponential' && value === 0.56 * 1.04),
    'night mode preserves quiet navigation detail',
  );
  assert.ok(
    sound.reverbs.get('dungeon').gain.gain.events.some(([type, value]) => type === 'exponential' && value === 0.175 * 0.72),
    'night mode shortens perceived tails by trimming reverb returns',
  );
  assert.equal(sound.setDynamicRange('normal'), true);
  assert.equal(sound.getDynamicRange(), 'balanced', 'normal is a stable alias for balanced');
  assert.equal(sound.setDynamicRange('cinema'), false, 'unknown range modes cannot corrupt the profile');
  sound.setDynamicRange('night');
  sound.dispose();

  const restored = new SoundSystem();
  assert.equal(restored.getDynamicRange(), 'night', 'dynamic-range mode persists');
  restored.dispose();
}

stored.set('ember_sound', '1');
stored.delete('ember_sound_volume');
stored.delete('ember_sound_bus_volumes');
stored.delete('ember_sound_dynamic_range');

{
  const sound = new SoundSystem();
  assert.equal(sound.setRegionMusic('not-a-region'), false);
  assert.equal(sound.setRegionMusic('town'), true);
  assert.equal(sound.regionSpace, 'town');
  sound._clearMusicTimer();
  sound._musicTick();
  sound._clearMusicTimer();

  const firstTownVoices = sound.activeVoices.filter((voice) => voice.eventHandle?.eventName === 'musicTown');
  assert.ok(firstTownVoices.length >= 5, 'town music schedules a sparse multi-note phrase');
  assert.equal(sound.activeEvents.get('musicTown').length, 1);
  assert.ok(firstTownVoices.every((voice) => voice.eventHandle.category === 'music'));
  assert.ok(
    firstTownVoices.every((voice) => voice.source.stopTime - voice.source.startArgs[0] < 1.6),
    'music is composed from bounded notes rather than fatiguing continuous oscillators',
  );
  const townSend = firstTownVoices[0].eventHandle.nodes.at(-1);
  assert.ok(
    townSend.connections.includes(sound.reverbs.get('town').convolver),
    'town phrases route to the short town response',
  );
  assert.ok(
    sound.reverbs.get('town').convolver.buffer.duration < sound.reverbs.get('wild').convolver.buffer.duration
      && sound.reverbs.get('wild').convolver.buffer.duration < sound.reverbs.get('dungeon').convolver.buffer.duration,
    'regional impulse responses progress from dry town to deep dungeon',
  );

  const secondPhraseTime = sound.musicNextTime;
  sound.ctx.currentTime = secondPhraseTime - 0.7;
  sound._musicTick();
  sound._clearMusicTimer();
  assert.equal(sound.activeEvents.get('musicTown').length, 2, 'lookahead schedules a bounded phrase overlap');
  assert.ok(sound.musicNextTime > secondPhraseTime, 'music cadence advances monotonically');

  const oldTownVoices = sound.activeVoices.filter((voice) => voice.eventHandle?.category === 'music');
  assert.equal(sound.setRegionMusic('dungeon'), true);
  assert.ok(oldTownVoices.every((voice) => voice.stopping), 'region changes fade every old music voice');
  assert.equal(sound.activeEvents.has('musicTown'), false, 'old scheduled phrase state is discarded');
  sound._clearMusicTimer();
  sound._musicTick();
  sound._clearMusicTimer();
  const dungeonVoices = sound.activeVoices.filter((voice) => voice.eventHandle?.eventName === 'musicDungeon');
  assert.ok(dungeonVoices.length >= 5);
  assert.ok(dungeonVoices.every((voice) => voice.eventHandle.space === 'dungeon'));

  sound.setBusVolume('music', 0);
  assert.equal(sound.musicTimer, null, 'music mute cancels scheduler work');
  assert.equal(sound.activeEvents.has('musicDungeon'), false, 'music mute clears stale phrase limits');
  assert.ok(dungeonVoices.every((voice) => voice.stopping), 'music mute fades the current phrase');
  sound.setBusVolume('music', 0.5);
  sound._clearMusicTimer();
  sound._musicTick();
  sound._clearMusicTimer();
  assert.equal(sound.activeEvents.get('musicDungeon').length, 1, 'unmuting restarts a fresh phrase');

  sound.ctx.currentTime += 1;
  assert.equal(sound.setRegionSpace('dungeon'), true);
  assert.equal(sound.play('heal', { emitter: 'space-test' }), true);
  const spatialVoice = sound.activeVoices.find((voice) => voice.eventHandle?.eventName === 'heal');
  assert.equal(spatialVoice.eventHandle.space, 'dungeon', 'ordinary events inherit the active regional response');
  assert.equal(sound.setRegionSpace('void'), false);

  sound.stopRegionMusic();
  assert.equal(sound.musicRegion, null);
  assert.equal(sound.musicTimer, null);
  sound.dispose();
  assert.equal(sound.ctx, null, 'music disposal releases the shared graph');
}

stored.set('ember_sound', '1');
stored.delete('ember_sound_bus_volumes');
stored.delete('ember_sound_dynamic_range');

{
  const sound = new SoundSystem();
  sound.setRegionMusic('wild');
  sound._clearMusicTimer();
  sound._musicTick();
  const frozenVoices = sound.activeVoices.filter((voice) => voice.eventHandle?.category === 'music');
  assert.ok(frozenVoices.length);
  globalThis.document.hidden = true;
  listeners.get('visibilitychange')();
  assert.equal(sound.ctx.state, 'suspended');
  assert.equal(sound.musicTimer, null, 'backgrounding cancels the lookahead timer');
  assert.equal(sound.musicNeedsResync, true);

  globalThis.document.hidden = false;
  listeners.get('visibilitychange')();
  sound._resumeContext();
  await Promise.resolve();
  assert.equal(sound.musicNeedsResync, false, 'foreground resume invalidates frozen music scheduling');
  assert.ok(frozenVoices.every((voice) => voice.stopping), 'frozen region voices receive a bounded resume fade');
  assert.ok(sound.musicTimer, 'foreground resume restarts lookahead scheduling');
  sound.dispose();
  assert.equal(sound.musicTimer, null, 'dispose cancels music timers');
}

console.log('audio.test.mjs passed');
