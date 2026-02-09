// FINPOP Rhythm Game — Audio Engine (Web Audio API)
// Provides precise audio timing for rhythm game synchronization

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffer = null;
    this.source = null;
    this.gainNode = null;
    this.analyser = null;
    this.startTime = 0;
    this.pauseTime = 0;
    this.playing = false;
    this.loaded = false;
    this.duration = 0;
    this.frequencyData = null;
    this.waveformData = null;
    this.endedTime = 0;
  }

  async init() {
    if (this.ctx) return; // Already initialized — idempotent
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.waveformData = new Uint8Array(this.analyser.frequencyBinCount);
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  async loadTrack(url) {
    if (!this.ctx) await this.init();

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.duration = this.buffer.duration;
      this.loaded = true;
      return true;
    } catch (e) {
      console.warn('Audio load failed, generating demo track:', e.message);
      this.generateDemoTrack();
      return true;
    }
  }

  generateDemoTrack() {
    // Generate a simple 128 BPM beat for demo/testing
    const sampleRate = this.ctx.sampleRate;
    const duration = 200; // 3:20
    const length = sampleRate * duration;
    this.buffer = this.ctx.createBuffer(2, length, sampleRate);
    const left = this.buffer.getChannelData(0);
    const right = this.buffer.getChannelData(1);

    const bpm = 128;
    const beatInterval = 60 / bpm;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const beatPhase = (t % beatInterval) / beatInterval;
      const barPhase = (t % (beatInterval * 4)) / (beatInterval * 4);
      const beatInBar = Math.floor((t % (beatInterval * 4)) / beatInterval);

      // Kick on beats 1 and 3
      let kick = 0;
      if (beatInBar === 0 || beatInBar === 2) {
        if (beatPhase < 0.1) {
          const env = 1 - beatPhase / 0.1;
          kick = Math.sin(2 * Math.PI * (160 - 100 * beatPhase) * t) * env * 0.4;
        }
      }

      // Hi-hat on every eighth note
      const eighthPhase = (t % (beatInterval / 2)) / (beatInterval / 2);
      let hihat = 0;
      if (eighthPhase < 0.03) {
        hihat = (Math.random() * 2 - 1) * (1 - eighthPhase / 0.03) * 0.15;
      }

      // Snare on beats 2 and 4
      let snare = 0;
      if (beatInBar === 1 || beatInBar === 3) {
        if (beatPhase < 0.08) {
          const env = 1 - beatPhase / 0.08;
          snare = (Math.random() * 2 - 1) * env * 0.25 +
                  Math.sin(2 * Math.PI * 200 * t) * env * 0.15;
        }
      }

      // Bass synth — simple sub bass
      const bassFreq = 55; // A1
      const bassPhase16 = (t % (beatInterval * 16)) / (beatInterval * 16);
      let bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.2;
      // Modulate bass with a slow envelope
      if (beatPhase < 0.5) {
        bass *= 1;
      } else {
        bass *= 0.5;
      }

      // Pad chord — soft background
      const section = Math.floor(t / (beatInterval * 32));
      const chordFreqs = [
        [185, 220, 277], // F#m
        [164, 207, 246], // E
        [146, 185, 220], // D
        [123, 164, 196], // C#m
      ];
      const chord = chordFreqs[section % chordFreqs.length];
      let pad = 0;
      for (const f of chord) {
        pad += Math.sin(2 * Math.PI * f * t) * 0.04;
      }

      const sample = kick + hihat + snare + bass + pad;
      left[i] = sample;
      right[i] = sample * 0.95 + (Math.random() * 0.001); // slight stereo
    }

    this.duration = duration;
    this.loaded = true;
  }

  play(offset = 0) {
    if (!this.loaded || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.stop();

    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.gainNode);
    this.source.start(0, offset);
    this.startTime = this.ctx.currentTime - offset;
    this.playing = true;

    this.source.onended = () => {
      // Store final time before marking as not playing
      this.endedTime = this.ctx.currentTime - this.startTime;
      this.playing = false;
    };
  }

  stop() {
    if (this.source) {
      try {
        this.source.stop();
      } catch (e) { /* already stopped */ }
      this.source.disconnect();
      this.source = null;
    }
    this.playing = false;
  }

  getCurrentTime() {
    if (!this.ctx) return 0;
    if (!this.playing) {
      // Return the time when audio ended (so game logic can still detect completion)
      return this.endedTime || 0;
    }
    return this.ctx.currentTime - this.startTime;
  }

  getProgress() {
    if (!this.duration) return 0;
    return Math.min(this.getCurrentTime() / this.duration, 1);
  }

  isFinished() {
    return this.loaded && !this.playing && this.startTime > 0;
  }

  getFrequencyData() {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.frequencyData);
    }
    return this.frequencyData;
  }

  getWaveformData() {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(this.waveformData);
    }
    return this.waveformData;
  }

  getAverageFrequency() {
    this.getFrequencyData();
    if (!this.frequencyData) return 0;
    let sum = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      sum += this.frequencyData[i];
    }
    return sum / this.frequencyData.length / 255;
  }

  getBassLevel() {
    this.getFrequencyData();
    if (!this.frequencyData) return 0;
    let sum = 0;
    const bassRange = 10;
    for (let i = 0; i < bassRange; i++) {
      sum += this.frequencyData[i];
    }
    return sum / bassRange / 255;
  }

  setVolume(v) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, v));
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}
