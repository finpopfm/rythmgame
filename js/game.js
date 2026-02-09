// FINPOP Rhythm Game — Main Game Controller
// Orchestrates all systems: audio, input, rendering, scoring, state

import { AudioEngine, SFXEngine } from './audio.js';
import { InputHandler } from './input.js';
import { Renderer } from './renderer.js';
import { BeatmapManager } from './beatmap.js';
import { Scorer, Judgment, TIMING } from './scorer.js';
import { UI } from './ui.js';

const State = {
  LOADING: 'LOADING',
  TITLE: 'TITLE',
  COUNTDOWN: 'COUNTDOWN',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  RESULTS: 'RESULTS',
  CALIBRATION: 'CALIBRATION',
};

const DIFFICULTY = {
  EASY:   { label: 'EASY',   approachTime: 2.5, filter: 0.45 },
  NORMAL: { label: 'NORMAL', approachTime: 2.0, filter: 1.0  },
  HARD:   { label: 'HARD',   approachTime: 1.5, filter: 1.0, extra: true },
};

class Game {
  constructor() {
    this.audio = new AudioEngine();
    this.sfx = new SFXEngine(() => this.audio.ctx);
    this.input = new InputHandler();
    this.renderer = new Renderer();
    this.beatmap = new BeatmapManager();
    this.scorer = new Scorer();
    this.ui = new UI();

    this.state = State.LOADING;
    this.countdownTimer = 0;
    this.lastFrameTime = 0;
    this.gameStartTime = 0;
    this.trackFinished = false;
    this.audioReady = false;

    // Difficulty
    this.difficulty = 'NORMAL';

    // Calibration
    this.calibrationOffset = parseFloat(localStorage.getItem('finpop_offset') || '0');
    this.calibrationTaps = [];
    this.calibrationBeat = 0;
    this.calibrationStartTime = 0;

    // Lyrics (loaded from beatmap)
    this.lyrics = [];
  }

  async init() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) { console.error('Canvas not found'); return; }

    this.renderer.init(canvas);
    this.input.init(canvas);
    this.ui.init();

    this.ui.showLoading(0, 'Initializing systems...');

    this.ui.showLoading(0.5, 'Loading beatmap data...');
    await this.beatmap.load('assets/beatmaps/payments_on_lock.json');
    this.lyrics = this.beatmap.lyrics || [];

    this.ui.showLoading(0.7, 'Loading audio track...');
    await this.audio.loadTrack('assets/audio/payments-on-lock.mp3');

    this.ui.showLoading(1, 'Systems online.');

    const sharedScore = this.ui.parseShareUrl();
    if (sharedScore) this.showChallengeBanner(sharedScore);

    await new Promise(r => setTimeout(r, 500));
    this.ui.hideLoading();
    this.state = State.TITLE;
    this.ui.showTitle();
    this.ui.showBestScore();

    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = timestamp;

    this.update(dt);
    this.render(dt);
    this.input.update();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    switch (this.state) {
      case State.TITLE:       this.updateTitle(dt); break;
      case State.COUNTDOWN:   this.updateCountdown(dt); break;
      case State.PLAYING:     this.updatePlaying(dt); break;
      case State.PAUSED:      this.updatePaused(dt); break;
      case State.RESULTS:     break;
      case State.CALIBRATION: this.updateCalibration(dt); break;
    }
    this.renderer.updateEffects(dt);
  }

  // --- TITLE ---
  updateTitle(dt) {
    if (this.input.consumeAnyKey()) this.tryStart();
  }

  tryStart() {
    if (this.state === State.TITLE) {
      this.startCountdown().catch(e => {
        console.error('Start failed:', e);
        this.state = State.TITLE;
        this.ui.showTitle();
      });
    }
  }

  async startCountdown() {
    if (!this.audioReady) {
      await this.audio.init();
      this.audioReady = true;
    }
    await this.audio.resume();

    // Apply difficulty
    const diff = DIFFICULTY[this.difficulty];
    this.renderer.approachTime = diff.approachTime;
    this.beatmap.applyDifficulty(this.difficulty);
    this.beatmap.offset = this.calibrationOffset;

    this.ui.hideTitle();
    this.ui.hidePause();
    this.state = State.COUNTDOWN;
    this.countdownTimer = 3.5;
    this.scorer.reset();
    this.beatmap.reset();
    this.trackFinished = false;
  }

  // --- COUNTDOWN ---
  updateCountdown(dt) {
    this.countdownTimer -= dt;
    if (this.countdownTimer <= 0) {
      this.state = State.PLAYING;
      this.audio.play();
      this.gameStartTime = performance.now();
    }
  }

  // --- PLAYING ---
  updatePlaying(dt) {
    const currentTime = this.audio.getCurrentTime();

    // Pause on Escape
    if (this.input.escPressed) {
      this.pauseGame();
      return;
    }

    // Judge lane presses
    for (let lane = 0; lane < 4; lane++) {
      if (this.input.isLaneJustPressed(lane)) {
        this.judgePress(lane, currentTime);
      }
    }

    // Missed notes
    const missedNotes = this.beatmap.markMissedNotes(currentTime, TIMING.MISS);
    for (const note of missedNotes) {
      this.scorer.addHit(Judgment.CHARGEBACK, currentTime);
      this.renderer.renderJudgment(Judgment.CHARGEBACK, note.lane, currentTime, 0);
      this.sfx.play(Judgment.CHARGEBACK);
    }

    // Track complete?
    if (this.beatmap.isComplete(currentTime) || (this.audio.loaded && !this.audio.playing && currentTime > 5)) {
      this.finishTrack();
    }
  }

  judgePress(lane, currentTime) {
    const candidates = this.beatmap.getJudgableNotes(currentTime, lane, TIMING.MISS);
    if (candidates.length === 0) return;

    let closest = null;
    let closestDiff = Infinity;
    for (const note of candidates) {
      const diff = Math.abs(note.time - currentTime);
      if (diff < closestDiff) { closestDiff = diff; closest = note; }
    }
    if (!closest) return;

    const timeDiff = closest.time - currentTime;
    const judgment = this.scorer.judge(timeDiff);

    closest.judged = true;
    closest.hit = judgment !== Judgment.CHARGEBACK;

    const result = this.scorer.addHit(judgment, currentTime);
    this.renderer.renderJudgment(judgment, lane, currentTime, timeDiff);
    this.renderer.renderComboMilestone(result.combo);

    // SFX
    this.sfx.play(judgment);

    // Vibration
    if (judgment === Judgment.APPROVED && navigator.vibrate) navigator.vibrate(15);
    if (judgment === Judgment.CHARGEBACK && navigator.vibrate) navigator.vibrate([30, 20, 30]);
  }

  // --- PAUSE ---
  pauseGame() {
    if (this.state !== State.PLAYING) return;
    this.state = State.PAUSED;
    this.audio.suspendCtx();
    this.ui.showPause();
  }

  resumeGame() {
    if (this.state !== State.PAUSED) return;
    this.state = State.PLAYING;
    this.audio.resumeCtx();
    this.ui.hidePause();
  }

  updatePaused(dt) {
    if (this.input.escPressed || this.input.consumeAnyKey()) {
      this.resumeGame();
    }
  }

  // --- FINISH ---
  finishTrack() {
    if (this.trackFinished) return;
    this.trackFinished = true;
    this.audio.stop();
    this.state = State.RESULTS;
    const stats = this.scorer.getStats();

    // Save high score
    this.saveHighScore(stats);

    this.ui.showResults(stats);
  }

  saveHighScore(stats) {
    try {
      const prev = JSON.parse(localStorage.getItem('finpop_best') || '{}');
      if (!prev.score || stats.score > prev.score) {
        localStorage.setItem('finpop_best', JSON.stringify({
          score: stats.score,
          grade: stats.grade,
          approvalRate: stats.approvalRate,
          maxCombo: stats.maxCombo,
          difficulty: this.difficulty,
        }));
      }
    } catch (e) { /* localStorage unavailable */ }
  }

  // --- CALIBRATION ---
  startCalibration() {
    if (!this.audioReady) return;
    this.state = State.CALIBRATION;
    this.calibrationTaps = [];
    this.calibrationBeat = 0;
    this.calibrationStartTime = performance.now() / 1000;
    this.ui.hideTitle();
    this.ui.showCalibration();
  }

  updateCalibration(dt) {
    const elapsed = performance.now() / 1000 - this.calibrationStartTime;
    const beatDuration = 60 / this.beatmap.bpm;
    const currentBeat = Math.floor(elapsed / beatDuration);

    // Play metronome clicks
    if (currentBeat > this.calibrationBeat && currentBeat <= 16) {
      this.calibrationBeat = currentBeat;
      this.sfx.playMetronome(currentBeat % 4 === 1);
    }

    // Collect taps
    if (this.input.consumeAnyKey() && currentBeat >= 4 && currentBeat <= 16) {
      const expectedBeat = Math.round(elapsed / beatDuration) * beatDuration;
      const offset = elapsed - expectedBeat;
      this.calibrationTaps.push(offset);
    }

    // End after 16 beats
    if (currentBeat > 16) {
      this.finishCalibration();
    }

    // Escape to cancel
    if (this.input.escPressed) {
      this.cancelCalibration();
    }
  }

  finishCalibration() {
    if (this.calibrationTaps.length >= 3) {
      const avg = this.calibrationTaps.reduce((a, b) => a + b, 0) / this.calibrationTaps.length;
      this.calibrationOffset = Math.round(avg * 1000) / 1000;
      localStorage.setItem('finpop_offset', this.calibrationOffset.toString());
    }
    this.ui.hideCalibration();
    this.state = State.TITLE;
    this.ui.showTitle();
    this.ui.showBestScore();
  }

  cancelCalibration() {
    this.ui.hideCalibration();
    this.state = State.TITLE;
    this.ui.showTitle();
    this.ui.showBestScore();
  }

  // --- MISC ---
  showChallengeBanner(sharedScore) {
    const banner = document.getElementById('challenge-banner');
    if (banner) {
      const text = banner.querySelector('.challenge-text');
      if (text) text.textContent = `Someone scored Grade ${sharedScore.grade} with ${sharedScore.approvalRate}% approval! Can you beat it?`;
      banner.classList.add('active');
      setTimeout(() => banner.classList.remove('active'), 8000);
    }
  }

  replay() {
    this.ui.hideResults();
    this.startCountdown();
  }

  async shareResults() {
    const stats = this.scorer.getStats();
    const success = await this.ui.share(stats);
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.textContent = success ? 'COPIED!' : 'SHARE';
      setTimeout(() => { shareBtn.textContent = 'SHARE REPORT'; }, 2000);
    }
  }

  setDifficulty(level) {
    if (DIFFICULTY[level]) {
      this.difficulty = level;
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      const active = document.querySelector(`.diff-btn[data-diff="${level}"]`);
      if (active) active.classList.add('active');
    }
  }

  // --- RENDER ---
  render(dt) {
    this.renderer.resetTransform();
    this.renderer.applyScreenShake();
    this.renderer.clear();

    const audioLevel = this.state === State.PLAYING ? this.audio.getAverageFrequency() : 0.1;
    const bassLevel = this.state === State.PLAYING ? this.audio.getBassLevel() : 0;
    const currentTime = this.state === State.PLAYING ? this.audio.getCurrentTime()
                      : this.state === State.PAUSED ? this.audio.getCurrentTime()
                      : performance.now() / 1000;

    this.renderer.renderBackground(audioLevel, bassLevel, currentTime);

    switch (this.state) {
      case State.TITLE:
        this.renderer.renderLanes([false, false, false, false]);
        this.renderer.renderSidePanels(0.2, 0, currentTime);
        this.renderer.renderEffects();
        break;

      case State.COUNTDOWN:
        this.renderer.renderLanes([false, false, false, false]);
        this.renderer.renderCountdown(Math.ceil(this.countdownTimer));
        break;

      case State.PLAYING:
      case State.PAUSED:
        this.renderPlaying(currentTime, audioLevel);
        break;

      case State.RESULTS:
        this.renderer.renderEffects();
        break;

      case State.CALIBRATION:
        this.renderCalibration(currentTime);
        break;
    }

    this.renderer.resetTransform();
  }

  renderPlaying(currentTime, audioLevel) {
    const laneStates = [0, 1, 2, 3].map(i => this.input.isLanePressed(i));
    const beatPhase = ((currentTime % (60 / this.beatmap.bpm)) / (60 / this.beatmap.bpm));

    this.renderer.renderLanes(laneStates, beatPhase);

    const visibleNotes = this.beatmap.getVisibleNotes(currentTime, this.renderer.approachTime);
    this.renderer.renderNotes(visibleNotes, currentTime);
    this.renderer.renderEffects();
    this.renderer.renderSidePanels(audioLevel, this.scorer.combo, currentTime);

    this.renderer.renderHUD(
      this.scorer.score, this.scorer.combo, this.scorer.multiplier,
      this.scorer.getVolumeDisplay(), this.scorer.getApprovalRate(),
      this.beatmap.duration > 0 ? Math.min(currentTime / this.beatmap.duration, 1) : this.audio.getProgress(),
      this.scorer.getRiskLevel()
    );

    this.renderer.renderSectionLabel(this.beatmap.getCurrentSection(currentTime));
    this.renderer.renderLyrics(currentTime, this.lyrics);
    this.renderer.renderKeyPrompts(this.renderer.getLayout().isMobile);
  }

  renderCalibration(time) {
    const ctx = this.renderer.ctx;
    const { w, h } = this.renderer.getLayout();
    const elapsed = performance.now() / 1000 - this.calibrationStartTime;
    const beatDuration = 60 / this.beatmap.bpm;
    const phase = (elapsed % beatDuration) / beatDuration;
    const pulse = Math.max(0, 1 - phase * 3);

    // Pulsing circle
    const radius = 40 + pulse * 20;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,212,255,${0.1 + pulse * 0.3})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(0,212,255,${0.3 + pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText('TAP TO THE BEAT', w / 2, h / 2 + 80);
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`Taps: ${this.calibrationTaps.length} | Press ESC to cancel`, w / 2, h / 2 + 100);
  }
}

// --- INIT ---
const game = new Game();

window.addEventListener('DOMContentLoaded', () => {
  game.init().catch(console.error);

  // Title screen — click/tap to start
  const titleScreen = document.getElementById('title-screen');
  if (titleScreen) {
    titleScreen.addEventListener('click', (e) => {
      if (e.target.closest('.diff-btn') || e.target.closest('#calibrate-btn')) return;
      game.tryStart();
    });
    titleScreen.addEventListener('touchend', (e) => {
      if (e.target.closest('.diff-btn') || e.target.closest('#calibrate-btn')) return;
      e.preventDefault();
      game.tryStart();
    });
  }

  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      game.setDifficulty(btn.dataset.diff);
    });
  });

  // Calibrate button
  const calBtn = document.getElementById('calibrate-btn');
  if (calBtn) {
    calBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!game.audioReady) {
        await game.audio.init();
        game.audioReady = true;
      }
      await game.audio.resume();
      game.startCalibration();
    });
  }

  // Pause overlay resume
  const pauseScreen = document.getElementById('pause-screen');
  if (pauseScreen) {
    pauseScreen.addEventListener('click', () => game.resumeGame());
  }
});

// Global handlers for HTML buttons
window.gameReplay = () => { game.replay(); };
window.gameShare = () => { game.shareResults(); };
window.openSpotify = () => { window.open('https://open.spotify.com/album/1e8GYRBtFoo0TdMIJJk8bk', '_blank'); };
