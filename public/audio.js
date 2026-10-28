// Original procedural score: quiet minor-key bells and wind, with a twang/whistle finale sting.
// AudioContext is created only by the user's Enable sound gesture.
export function createGameAudio({ music = false, events = music, onChange = () => {}, AudioContextClass } = {}) {
  let ctx, master, musicBus, effectsBus, noiseBuffer, timer, enabled = false, volume = .35;
  let phase = 'lobby', roundId, seeded = false, nextBeat = 0, beat = 0, holdUntil = 0;
  const seen = new Set(), sources = new Set();
  const frequency = note => 440 * 2 ** ((note - 69) / 12);
  const track = source => { sources.add(source); source.onended = () => sources.delete(source); return source; };
  function tone(note, time, duration = .5, level = .1, type = 'sine', bus = musicBus, whistle = false) {
    const osc = track(ctx.createOscillator()), gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency(note), time);
    gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(level, time + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    osc.connect(gain); gain.connect(bus); osc.start(time); osc.stop(time + duration + .03);
    if (whistle) {
      osc.frequency.setValueAtTime(frequency(note) * .96, time);
      osc.frequency.exponentialRampToValueAtTime(frequency(note), time + .08);
      const vibrato = track(ctx.createOscillator()), depth = ctx.createGain();
      vibrato.frequency.value = 5.4; depth.gain.value = 4;
      vibrato.connect(depth); depth.connect(osc.frequency); vibrato.start(time); vibrato.stop(time + duration);
    }
  }
  function pluck(note, time, duration = 1, level = .18, bus = musicBus) {
    // Karplus–Strong string: a short noise excitation rings in a filtered delay loop.
    const size = Math.max(2, Math.round(ctx.sampleRate / frequency(note)));
    const count = Math.ceil(ctx.sampleRate * duration), buffer = ctx.createBuffer(1, count, ctx.sampleRate);
    const data = buffer.getChannelData(0), ring = new Float32Array(size);
    for (let i = 0; i < size; i++) ring[i] = Math.random() * 2 - 1;
    for (let i = 0; i < count; i++) { const k = i % size; data[i] = ring[k] * (1 - i / count); ring[k] = .496 * (ring[k] + ring[(k + 1) % size]); }
    const source = track(ctx.createBufferSource()), gain = ctx.createGain();
    source.buffer = buffer; gain.gain.value = level; source.connect(gain); gain.connect(bus); source.start(time);
  }
  function noise(time, duration, level, cutoff, bus = effectsBus) {
    const source = track(ctx.createBufferSource()), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noiseBuffer; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(level, time + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter); filter.connect(gain); gain.connect(bus); source.start(time); source.stop(time + duration + .03);
  }
  function sting() {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + .05; holdUntil = t + 6.4;
    // A new western phrase, voiced as plucked strings, a sliding whistle, and dry hoofbeats.
    [52,59,64,67].forEach((n,i) => pluck(n, t + i * .075, 2.2, .37, effectsBus));
    [[76,0,.48],[79,.6,.32],[83,1.05,.85],[81,2,.45],[79,2.6,.48],[76,3.22,1.25],[71,4.6,.35],[76,5.1,1.05]]
      .forEach(([n,at,d]) => tone(n, t + at, d, .19, 'sine', effectsBus, true));
    for (let i = 0; i < 12; i++) { pluck(i % 3 === 0 ? 40 : 47, t + i * .42, .65, .24, effectsBus); noise(t + i * .42 + .18, .055, .09, 1000); }
    [52,59,64].forEach((n,i) => pluck(n, t + 5.6 + i * .05, 1.5, .28, effectsBus));
  }
  function effect(kind) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + .025;
    if (kind === 'capture') { tone(76,t,.16,.15,'sine',effectsBus); tone(83,t+.11,.32,.13,'sine',effectsBus); }
    else if (kind === 'ready') { tone(64,t,.18,.14,'triangle',effectsBus); tone(71,t+.14,.25,.12,'sine',effectsBus); }
    else if (kind === 'vanquished') { pluck(52,t,.9,.26,effectsBus); tone(47,t+.1,.65,.1,'triangle',effectsBus); }
    else if (kind === 'start') [64,67,71].forEach((n,i)=>tone(n,t+i*.17,.6,.1,'sine',effectsBus));
    else if (kind === 'finish') [64,67,71,76].forEach((n,i)=>pluck(n,t+i*.18,1.4,.25,effectsBus));
  }
  function schedule() {
    if (!enabled || ctx.state !== 'running' || !music) return;
    if (nextBeat < ctx.currentTime) nextBeat = ctx.currentTime + .08;
    while (nextBeat < ctx.currentTime + .3) {
      const t = nextBeat, step = phase === 'pvp' ? .39 : phase === 'pve' ? .66 : .84;
      if (t >= holdUntil) {
        if (beat % 4 === 0) tone([40,43,40,47][Math.floor(beat/4)%4],t,2.1,.055,'triangle');
        if (phase === 'pvp') {
          pluck(beat % 4 === 0 ? 40 : 47,t,.8,.18);
          if (beat % 2) noise(t,.045,.035,800,musicBus);
          if (beat % 8 === 0) tone([76,79,74,71][Math.floor(beat/8)%4],t,1.3,.04,'sine',musicBus,true);
        } else {
          const melody = [76,null,79,83,null,81,79,null,76,74,null,71,null,74,76,null];
          const n = melody[beat % melody.length];
          if (n !== null && (phase !== 'lobby' || beat % 2 === 0)) { tone(n,t,1.8,.04); tone(n+12,t,1,.009); }
          if (beat % 8 === 0) noise(t,4,.025,330,musicBus);
        }
      }
      nextBeat += step; beat++;
    }
  }
  async function enable() {
    if (enabled) return;
    if (!ctx) {
      const Constructor = AudioContextClass || globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Constructor) throw new Error('Sound is unavailable in this browser.');
      ctx = new Constructor(); master = ctx.createGain(); musicBus = ctx.createGain(); effectsBus = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.ratio.value = 8;
      musicBus.gain.value = .55; effectsBus.gain.value = .65; musicBus.connect(master); effectsBus.connect(master); master.connect(limiter); limiter.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0); for (let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    }
    await ctx.resume(); enabled = true; master.gain.setValueAtTime(volume * .7, ctx.currentTime);
    nextBeat = ctx.currentTime + .1; beat = 0; holdUntil = 0;
    if (timer) clearInterval(timer); timer = setInterval(schedule,100);
    if (music && phase === 'pvp') sting(); else effect('ready');
    schedule(); onChange(true);
  }
  function disable() {
    enabled = false; clearInterval(timer); timer = undefined;
    if (ctx) {
      master.gain.setTargetAtTime(0,ctx.currentTime,.015);
      setTimeout(()=>{if(!enabled){ for(const source of sources){try{source.stop();}catch{}} sources.clear(); if(ctx.state!=='closed') ctx.suspend().catch(()=>{});}},80);
    }
    onChange(false);
  }
  function update(state) {
    const first = !seeded || roundId !== state.roundId, changed = !first && phase !== state.phase;
    phase = state.phase; roundId = state.roundId;
    if (first) { seen.clear(); seeded = true; beat = 0; }
    if (changed && enabled && music) {
      nextBeat = ctx.currentTime + .1; beat = 0;
      if (phase === 'pvp') sting();
      else if (phase === 'pve') effect('start');
      else if (phase === 'results') { holdUntil = ctx.currentTime + 2; effect('finish'); }
    }
    const fresh = [];
    for(const entry of state.log || []) {
      const key = `${entry.at}:${entry.message}`;
      if(!seen.has(key)){seen.add(key);if(!first)fresh.push(entry.message);}
    }
    if(seen.size>120){seen.clear();for(const entry of state.log||[])seen.add(`${entry.at}:${entry.message}`);}
    if(events && fresh.some(s=>s.includes('captured Ghost')||s.includes('hit the boss ghost')))effect('capture');
    if(events && fresh.some(s=>s.includes('vanquished the boss ghost')))effect('finish');
    if(events && fresh.some(s=>(s.includes('vanquished')&&!s.includes('boss ghost'))||s.includes('Both Vanquished')))effect('vanquished');
  }
  return { enable, disable, update, effect, get enabled(){return enabled;}, setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));if(ctx&&enabled)master.gain.setTargetAtTime(volume*.7,ctx.currentTime,.03);}, destroy(){disable();ctx?.close();} };
}
