// Procedural Web Audio API sound synthesizer for R.E.P.O.-style tactile feedback
// Zero external audio files required; lazily unlocks on first user gesture.

class SoundFxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  // Continuous tractor-beam hum nodes
  private beamActive = false;
  private beamOscLow: OscillatorNode | null = null;
  private beamOscMid: OscillatorNode | null = null;
  private beamLfo: OscillatorNode | null = null;
  private beamGain: GainNode | null = null;
  private beamFilter: BiquadFilterNode | null = null;

  // Red Alert klaxon timer
  private klaxonInterval: number | null = null;
  private klaxonActive = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.48;
        this.masterGain.connect(this.ctx.destination);
        this.noiseBuffer = this.buildNoiseBuffer(this.ctx);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public unlock() {
    this.ensureContext();
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.48, this.ctx.currentTime, 0.03);
    }
    if (muted) {
      this.stopTractorHum();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  // 1. Subtle mechanical boot footsteps synced to head-bob stride
  public playFootstep(sprinting: boolean) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    // Low boot thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = sprinting ? 96 : 78;
    osc.frequency.setValueAtTime(baseFreq + Math.random() * 12, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.085);

    const thudVol = sprinting ? 0.22 : 0.14;
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(thudVol, now + 0.008);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);

    // Subtle industrial steel sole scuff
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = sprinting ? 820 : 620;
    filter.Q.value = 1.6;

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(sprinting ? 0.09 : 0.055, now + 0.006);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now, Math.random() * 0.5, 0.08);
  }

  // 2. Mechanical drawer rail slide + latch click
  public playDrawerSlide(opening = true) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    // Metallic rail friction sweep
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3.2;
    filter.frequency.setValueAtTime(opening ? 480 : 1200, now);
    filter.frequency.exponentialRampToValueAtTime(opening ? 1350 : 420, now + 0.24);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.18, now + 0.03);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now, 0.1, 0.28);

    // Latch click
    const latch = ctx.createOscillator();
    const lGain = ctx.createGain();
    latch.type = 'square';
    latch.frequency.setValueAtTime(opening ? 320 : 210, now + 0.01);
    latch.frequency.exponentialRampToValueAtTime(95, now + 0.055);
    lGain.gain.setValueAtTime(0.08, now + 0.01);
    lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    latch.connect(lGain);
    lGain.connect(this.masterGain);
    latch.start(now + 0.01);
    latch.stop(now + 0.065);
  }

  // 3. Paper rustle for handwritten notes & field manuals
  public playPaperRustle() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2400 + Math.random() * 600, now);
    hp.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.025);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.06);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.09);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now, Math.random() * 0.7, 0.18);
  }

  // 4. Retro Mac mechanical keyboard click
  public playKeyClick() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    // Keycap thock
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'triangle';
    const pitch = 240 + Math.random() * 55;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.028);

    oGain.gain.setValueAtTime(0.11, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    osc.connect(oGain);
    oGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.036);

    // Crisp switch snap
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'highpass';
    bp.frequency.value = 2600;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.06, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

    noise.connect(bp);
    bp.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now, Math.random() * 0.6, 0.025);
  }

  // 5. Tractor beam electric levitation hum
  public startTractorHum() {
    if (this.muted || this.beamActive) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    this.beamOscLow = ctx.createOscillator();
    this.beamOscMid = ctx.createOscillator();
    this.beamLfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    this.beamFilter = ctx.createBiquadFilter();
    this.beamGain = ctx.createGain();

    this.beamOscLow.type = 'sawtooth';
    this.beamOscLow.frequency.setValueAtTime(72, now);

    this.beamOscMid.type = 'sine';
    this.beamOscMid.frequency.setValueAtTime(144, now);

    this.beamLfo.type = 'sine';
    this.beamLfo.frequency.setValueAtTime(7.5, now);
    lfoGain.gain.setValueAtTime(8, now);
    this.beamLfo.connect(lfoGain);
    lfoGain.connect(this.beamOscMid.frequency);

    this.beamFilter.type = 'lowpass';
    this.beamFilter.frequency.setValueAtTime(340, now);
    this.beamFilter.Q.value = 4.2;

    this.beamGain.gain.setValueAtTime(0.001, now);
    this.beamGain.gain.linearRampToValueAtTime(0.14, now + 0.1);

    this.beamOscLow.connect(this.beamFilter);
    this.beamOscMid.connect(this.beamFilter);
    this.beamFilter.connect(this.beamGain);
    this.beamGain.connect(this.masterGain);

    this.beamOscLow.start(now);
    this.beamOscMid.start(now);
    this.beamLfo.start(now);
    this.beamActive = true;
  }

  public updateTractorHum(swaySpeed: number, integrityPct: number) {
    if (!this.beamActive || !this.ctx || !this.beamOscLow || !this.beamOscMid || !this.beamFilter) {
      return;
    }
    const now = this.ctx.currentTime;
    const speedRatio = Math.min(1, swaySpeed / 8);
    const stressPitch = (1 - integrityPct / 100) * 18;
    this.beamOscLow.frequency.setTargetAtTime(72 + speedRatio * 20 + stressPitch, now, 0.05);
    this.beamOscMid.frequency.setTargetAtTime(144 + speedRatio * 48 + stressPitch * 2, now, 0.05);
    this.beamFilter.frequency.setTargetAtTime(320 + speedRatio * 360, now, 0.05);
  }

  public stopTractorHum() {
    if (!this.beamActive) return;
    this.beamActive = false;
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;

    if (this.beamGain && ctx) {
      try {
        this.beamGain.gain.setTargetAtTime(0.0001, now, 0.03);
      } catch {
        // ignore
      }
    }
    const oscL = this.beamOscLow;
    const oscM = this.beamOscMid;
    const lfo = this.beamLfo;
    this.beamOscLow = null;
    this.beamOscMid = null;
    this.beamLfo = null;
    this.beamGain = null;
    this.beamFilter = null;

    window.setTimeout(() => {
      try {
        oscL?.stop();
        oscL?.disconnect();
        oscM?.stop();
        oscM?.disconnect();
        lfo?.stop();
        lfo?.disconnect();
      } catch {
        // ignore already stopped
      }
    }, 90);
  }

  // 6. Metallic wall/obstacle impact thud + electrical spark burst
  public playImpactThud(severity = 0.7) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const clamped = Math.max(0.2, Math.min(1.0, severity));
    const now = ctx.currentTime;

    // Heavy low metallic thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(135, now);
    thud.frequency.exponentialRampToValueAtTime(32, now + 0.22);

    thudGain.gain.setValueAtTime(0.38 * clamped, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    thud.connect(thudGain);
    thudGain.connect(this.masterGain);
    thud.start(now);
    thud.stop(now + 0.26);

    // Metallic hull clang overtone
    const clang = ctx.createOscillator();
    const clangGain = ctx.createGain();
    clang.type = 'square';
    clang.frequency.setValueAtTime(390 + Math.random() * 80, now);
    clang.frequency.exponentialRampToValueAtTime(195, now + 0.14);

    clangGain.gain.setValueAtTime(0.14 * clamped, now);
    clangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    clang.connect(clangGain);
    clangGain.connect(this.masterGain);
    clang.start(now);
    clang.stop(now + 0.17);

    // Electric spark crackle
    const spark = ctx.createBufferSource();
    spark.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3200;
    const sGain = ctx.createGain();
    sGain.gain.setValueAtTime(0.22 * clamped, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    spark.connect(hp);
    hp.connect(sGain);
    sGain.connect(this.masterGain);
    spark.start(now, Math.random() * 0.4, 0.16);
  }

  // 7. Magnetic delivery clamp + dual confirmation chime
  public playDeliveryChime() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  // 8. Deep industrial Red Alert warning klaxon
  private triggerKlaxonPulse() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.36;
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      oscA.type = 'sawtooth';
      oscB.type = 'sawtooth';
      oscA.frequency.setValueAtTime(i === 0 ? 220 : 185, t);
      oscB.frequency.setValueAtTime(i === 0 ? 226 : 191, t);
      oscA.frequency.linearRampToValueAtTime(i === 0 ? 195 : 155, t + 0.28);
      oscB.frequency.linearRampToValueAtTime(i === 0 ? 200 : 160, t + 0.28);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(920, t);
      filter.Q.value = 3.5;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.025);
      gain.gain.setValueAtTime(0.13, t + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      oscA.start(t);
      oscB.start(t);
      oscA.stop(t + 0.31);
      oscB.stop(t + 0.31);
    }
  }

  public startRedAlertKlaxon() {
    if (this.klaxonActive) return;
    this.klaxonActive = true;
    this.triggerKlaxonPulse();
    this.klaxonInterval = window.setInterval(() => {
      if (this.klaxonActive) {
        this.triggerKlaxonPulse();
      }
    }, 2400);
  }

  public stopRedAlertKlaxon() {
    this.klaxonActive = false;
    if (this.klaxonInterval !== null) {
      window.clearInterval(this.klaxonInterval);
      this.klaxonInterval = null;
    }
  }

  // 9. Tactile pocket draw: fabric/holster slide + unclip + soft digital screen wake-up chime
  public playTabletDraw() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    // Subtle fabric / holster slide
    const slide = ctx.createBufferSource();
    slide.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.9;
    bp.frequency.setValueAtTime(420, now);
    bp.frequency.exponentialRampToValueAtTime(1650, now + 0.16);

    const slideGain = ctx.createGain();
    slideGain.gain.setValueAtTime(0.001, now);
    slideGain.gain.linearRampToValueAtTime(0.14, now + 0.035);
    slideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    slide.connect(bp);
    bp.connect(slideGain);
    slideGain.connect(this.masterGain);
    slide.start(now, 0.05, 0.2);

    // Crisp holster snap release
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(280, now + 0.015);
    snap.frequency.exponentialRampToValueAtTime(130, now + 0.055);
    snapGain.gain.setValueAtTime(0.075, now + 0.015);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    snap.connect(snapGain);
    snapGain.connect(this.masterGain);
    snap.start(now + 0.015);
    snap.stop(now + 0.065);

    // Soft digital screen wake-up chime (ascending harmonic intervals)
    const wakeNotes = [
      { freq: 587.33, offset: 0.14, dur: 0.18, vol: 0.09 },
      { freq: 880.0, offset: 0.205, dur: 0.22, vol: 0.11 },
      { freq: 1174.66, offset: 0.265, dur: 0.26, vol: 0.075 },
    ];
    for (const n of wakeNotes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      const t = now + n.offset;
      osc.frequency.setValueAtTime(n.freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(n.vol, t + 0.014);
      g.gain.exponentialRampToValueAtTime(0.001, t + n.dur);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + n.dur + 0.02);
    }
  }

  // 10. Tactile holster return: soft screen-lock click + reverse pocket fabric slide
  public playTabletHolster() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    // Soft screen-lock click
    const lockOsc = ctx.createOscillator();
    const lockGain = ctx.createGain();
    lockOsc.type = 'sine';
    lockOsc.frequency.setValueAtTime(760, now);
    lockOsc.frequency.exponentialRampToValueAtTime(240, now + 0.032);
    lockGain.gain.setValueAtTime(0.11, now);
    lockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
    lockOsc.connect(lockGain);
    lockGain.connect(this.masterGain);
    lockOsc.start(now);
    lockOsc.stop(now + 0.045);

    // Subtle descending lock tone
    const lockSub = ctx.createOscillator();
    const lockSubGain = ctx.createGain();
    lockSub.type = 'triangle';
    lockSub.frequency.setValueAtTime(440, now + 0.02);
    lockSub.frequency.exponentialRampToValueAtTime(293.66, now + 0.09);
    lockSubGain.gain.setValueAtTime(0.055, now + 0.02);
    lockSubGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    lockSub.connect(lockSubGain);
    lockSubGain.connect(this.masterGain);
    lockSub.start(now + 0.02);
    lockSub.stop(now + 0.1);

    // Reverse pocket fabric slide + soft holster settle
    const slide = ctx.createBufferSource();
    slide.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.9;
    bp.frequency.setValueAtTime(1450, now + 0.045);
    bp.frequency.exponentialRampToValueAtTime(360, now + 0.24);

    const slideGain = ctx.createGain();
    slideGain.gain.setValueAtTime(0.001, now + 0.045);
    slideGain.gain.linearRampToValueAtTime(0.13, now + 0.08);
    slideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    slide.connect(bp);
    bp.connect(slideGain);
    slideGain.connect(this.masterGain);
    slide.start(now + 0.045, 0.25, 0.24);

    // Muted pocket bottom settle
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(135, now + 0.21);
    thump.frequency.exponentialRampToValueAtTime(58, now + 0.27);
    thumpGain.gain.setValueAtTime(0.06, now + 0.21);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    thump.connect(thumpGain);
    thumpGain.connect(this.masterGain);
    thump.start(now + 0.21);
    thump.stop(now + 0.29);
  }

  // 11. Laser blowtorch continuous thermal plasma hiss
  private torchActive = false;
  private torchNoise: AudioBufferSourceNode | null = null;
  private torchOsc: OscillatorNode | null = null;
  private torchGain: GainNode | null = null;

  public startLaserTorch() {
    if (this.muted || this.torchActive) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, now);
    bp.Q.value = 1.4;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(118, now);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.05, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.08);

    noise.connect(bp);
    bp.connect(gain);
    osc.connect(oscGain);
    oscGain.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    osc.start(now);

    this.torchNoise = noise;
    this.torchOsc = osc;
    this.torchGain = gain;
    this.torchActive = true;
  }

  public stopLaserTorch() {
    if (!this.torchActive) return;
    this.torchActive = false;
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;
    if (this.torchGain && ctx) {
      try {
        this.torchGain.gain.setTargetAtTime(0.0001, now, 0.03);
      } catch {
        // ignore
      }
    }
    const n = this.torchNoise;
    const o = this.torchOsc;
    this.torchNoise = null;
    this.torchOsc = null;
    this.torchGain = null;
    window.setTimeout(() => {
      try {
        n?.stop();
        n?.disconnect();
        o?.stop();
        o?.disconnect();
      } catch {
        // ignore
      }
    }, 90);
  }

  // 12. Cash bundle drop snap sound
  public playCashSnap() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1850, now);
    bp.Q.value = 2.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now, Math.random() * 0.4, 0.09);

    const tone = ctx.createOscillator();
    const tGain = ctx.createGain();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(640, now);
    tone.frequency.exponentialRampToValueAtTime(960, now + 0.06);
    tGain.gain.setValueAtTime(0.065, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    tone.connect(tGain);
    tGain.connect(this.masterGain);
    tone.start(now);
    tone.stop(now + 0.08);
  }

  // 13. Hologram projector power-on shimmer
  public playHoloProject() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [330, 493.88, 659.25, 987.77];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}

export const soundFx = new SoundFxEngine();
