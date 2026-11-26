// ARUNIKA: procedural sound. One job: the engine hum, the wind and the
// mission chimes, all synthesised with WebAudio — no audio files, no network.

export function createAudio() {
  const audio = {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    muted: false,
    started: false,

    ensure() {
      if (this.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        // Engine: two detuned saws through a low-pass, gain follows throttle.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.value = 55 * 1.007;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(filter);
        osc2.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
        osc2.start();
        this.engineOsc2 = osc2;
        // Wind: looped noise buffer through a band-pass.
        const len = this.ctx.sampleRate * 2;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = buf;
        this.windSource.loop = true;
        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 480;
        windFilter.Q.value = 0.6;
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;
        this.windSource.connect(windFilter);
        windFilter.connect(this.windGain);
        this.windGain.connect(this.ctx.destination);
        this.windSource.start();
        this.started = true;
        return true;
      } catch (err) {
        return false;
      }
    },

    update(throttle, speed01, flying) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const target = flying ? 0.02 + throttle * 0.05 : 0;
      this.engineGain.gain.setTargetAtTime(target, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(48 + throttle * 70 + speed01 * 30, t, 0.1);
      this.engineOsc2.frequency.setTargetAtTime((48 + throttle * 70 + speed01 * 30) * 1.007, t, 0.1);
      this.windGain.gain.setTargetAtTime(flying ? speed01 * 0.05 : 0, t, 0.15);
    },

    chime(kind) {
      if (!this.ctx || this.muted) return;
      const notes = kind === 'ring' ? [880, 1174, 1568] : kind === 'drop' ? [523, 659, 784] : [392, 523, 659, 784];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        const start = this.ctx.currentTime + i * 0.09;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.55);
      });
    },

    thud() {
      if (!this.ctx || this.muted) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.4);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.5);
    },

    toggleMute() {
      this.muted = !this.muted;
      if (this.ctx) {
        const target = this.muted ? 0 : 1;
        this.ctx.destination.gain?.setTargetAtTime?.(target, this.ctx.currentTime, 0.05);
        if (this.engineGain) this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.05, this.ctx.currentTime, 0.05);
        if (this.windGain) this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      return this.muted;
    },
  };
  return audio;
}
