// FINPOP Rhythm Game — Main Game Controller
// Orchestrates all systems: audio, input, rendering, scoring, state

import { AudioEngine } from './audio.js';
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
  RESULTS: 'RESULTS',
};

class Game {
  constructor() {
    this.audio = new AudioEngine();
    this.input = new InputHandler();
    this.renderer = new Renderer();
    this.beatmap = new BeatmapManager();
    this.scorer = new Scorer();
    this.ui = new UI();

    this.state = State.LOADING;
    this.countdownTimer = 0;
    this.countdownStart = 0;
    this.lastFrameTime = 0;
    this.gameStartTime = 0;
    this.trackFinished = false;
    this.lastJudgmentLane = -1;

    // Track if audio context was started (needs user gesture)
    this.audioReady = false;
  }

  async init() {
    // Setup canvas
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    this.renderer.init(canvas);
    this.input.init(canvas);
    this.ui.init();

    // Show loading
    this.ui.showLoading(0, 'Initializing systems...');

    // Load character images
    this.ui.showLoading(0.2, 'Loading character assets...');
    // Character images disabled
    // await this.renderer.loadCharacterImages([...]);

    // Load beatmap
    this.ui.showLoading(0.5, 'Loading beatmap data...');
    await this.beatmap.load('assets/beatmaps/payments_on_lock.json');

    // Load audio
    this.ui.showLoading(0.7, 'Loading audio track...');
    await this.audio.loadTrack('assets/audio/payments-on-lock.wav');

    this.ui.showLoading(1, 'Systems online.');

    // Check for shared score in URL
    const sharedScore = this.ui.parseShareUrl();
    if (sharedScore) {
      this.showChallengeBanner(sharedScore);
    }

    // Short delay then show title
    await new Promise(r => setTimeout(r, 500));
    this.ui.hideLoading();
    this.state = State.TITLE;
    this.ui.showTitle();

    // Start game loop
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05); // cap at 50ms
    this.lastFrameTime = timestamp;

    this.update(dt);
    this.render(dt);

    this.input.update();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    switch (this.state) {
      case State.TITLE:
        this.updateTitle(dt);
        break;
      case State.COUNTDOWN:
        this.updateCountdown(dt);
        break;
      case State.PLAYING:
        this.updatePlaying(dt);
        break;
      case State.RESULTS:
        this.updateResults(dt);
        break;
    }

    this.renderer.updateEffects(dt);
  }

  updateTitle(dt) {
    // Wait for any input to start (keyboard events go through window, always work)
    if (this.input.consumeAnyKey()) {
      this.tryStart();
    }
  }

  tryStart() {
    if (this.state === State.TITLE) {
      this.startCountdown().catch(e => {
        console.error('Start failed:', e);
        // Recover: go back to title
        this.state = State.TITLE;
        this.ui.showTitle();
      });
    }
  }

  async startCountdown() {
    // Ensure audio context is started (requires user gesture)
    if (!this.audioReady) {
      await this.audio.init();
      this.audioReady = true;
    }
    await this.audio.resume();

    this.ui.hideTitle();
    this.state = State.COUNTDOWN;
    this.countdownTimer = 3.5; // 3, 2, 1, GO!
    this.scorer.reset();
    this.beatmap.reset();
    this.trackFinished = false;
  }

  updateCountdown(dt) {
    this.countdownTimer -= dt;

    if (this.countdownTimer <= 0) {
      this.state = State.PLAYING;
      this.audio.play();
      this.gameStartTime = performance.now();
    }
  }

  updatePlaying(dt) {
    const currentTime = this.audio.getCurrentTime();

    // Check for lane presses and judge notes
    for (let lane = 0; lane < 4; lane++) {
      if (this.input.isLaneJustPressed(lane)) {
        this.judgePress(lane, currentTime);
      }
    }

    // Check for missed notes
    const missedNotes = this.beatmap.markMissedNotes(currentTime, TIMING.MISS);
    for (const note of missedNotes) {
      const result = this.scorer.addHit(Judgment.CHARGEBACK, currentTime);
      this.renderer.renderJudgment(Judgment.CHARGEBACK, note.lane, currentTime);
    }

    // Check if track is complete
    if (this.beatmap.isComplete(currentTime) || (this.audio.loaded && !this.audio.playing && currentTime > 5)) {
      this.finishTrack();
    }
  }

  judgePress(lane, currentTime) {
    const candidates = this.beatmap.getJudgableNotes(currentTime, lane, TIMING.MISS);

    if (candidates.length === 0) return; // No notes to judge

    // Find the closest note
    let closest = null;
    let closestDiff = Infinity;
    for (const note of candidates) {
      const diff = Math.abs(note.time - currentTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = note;
      }
    }

    if (!closest) return;

    const timeDiff = closest.time - currentTime;
    const judgment = this.scorer.judge(timeDiff);

    closest.judged = true;
    closest.hit = judgment !== Judgment.CHARGEBACK;

    const result = this.scorer.addHit(judgment, currentTime);
    this.renderer.renderJudgment(judgment, lane, currentTime);
    this.lastJudgmentLane = lane;

    // Check for combo milestones
    this.renderer.renderComboMilestone(result.combo);

    // Vibrate on mobile for hits
    if (judgment === Judgment.APPROVED && navigator.vibrate) {
      navigator.vibrate(15);
    }
    if (judgment === Judgment.CHARGEBACK && navigator.vibrate) {
      navigator.vibrate([30, 20, 30]);
    }
  }

  finishTrack() {
    if (this.trackFinished) return; // Guard against double-trigger
    this.trackFinished = true;
    this.audio.stop();
    this.state = State.RESULTS;
    const stats = this.scorer.getStats();
    this.ui.showResults(stats);
  }

  updateResults(dt) {
    // Listen for replay or share — handled by HTML buttons
  }

  showChallengeBanner(sharedScore) {
    const banner = document.getElementById('challenge-banner');
    if (banner) {
      const text = banner.querySelector('.challenge-text');
      if (text) {
        text.textContent = `Someone scored Grade ${sharedScore.grade} with ${sharedScore.approvalRate}% approval! Can you beat it?`;
      }
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

  render(dt) {
    const layout = this.renderer.getLayout();

    // Apply screen shake
    this.renderer.resetTransform();
    this.renderer.applyScreenShake();

    // Clear
    this.renderer.clear();

    // Background (always render for ambient effect)
    const audioLevel = this.state === State.PLAYING ? this.audio.getAverageFrequency() : 0.1;
    const bassLevel = this.state === State.PLAYING ? this.audio.getBassLevel() : 0;
    const currentTime = this.state === State.PLAYING ? this.audio.getCurrentTime() : performance.now() / 1000;

    this.renderer.renderBackground(audioLevel, bassLevel, currentTime);

    switch (this.state) {
      case State.TITLE:
        this.renderTitle(currentTime);
        break;
      case State.COUNTDOWN:
        this.renderCountdown();
        break;
      case State.PLAYING:
        this.renderPlaying(currentTime, audioLevel);
        break;
      case State.RESULTS:
        // Results shown via HTML overlay; canvas shows ambient bg
        this.renderer.renderEffects();
        break;
    }

    this.renderer.resetTransform();
  }

  renderTitle(time) {
    // Render decorative lanes in background
    this.renderer.renderLanes([false, false, false, false]);
    this.renderer.renderSidePanels(0.2, 0, time);
    this.renderer.renderEffects();
  }

  renderCountdown() {
    this.renderer.renderLanes([false, false, false, false]);
    const count = Math.ceil(this.countdownTimer);
    this.renderer.renderCountdown(count);
  }

  getBeatPhase(currentTime) {
    const beatDuration = 60 / this.beatmap.bpm;
    return (currentTime % beatDuration) / beatDuration;
  }

  renderPlaying(currentTime, audioLevel) {
    // Lane press states
    const laneStates = [0, 1, 2, 3].map(i => this.input.isLanePressed(i));
    const beatPhase = this.getBeatPhase(currentTime);

    // Render lanes with beat phase for pulse effect
    this.renderer.renderLanes(laneStates, beatPhase);

    // Render notes
    const visibleNotes = this.beatmap.getVisibleNotes(currentTime, this.renderer.getLayout().approachTime);
    this.renderer.renderNotes(visibleNotes, currentTime);

    // Render effects (particles, judgments)
    this.renderer.renderEffects();

    // Side panels
    this.renderer.renderSidePanels(audioLevel, this.scorer.combo, currentTime);

    // HUD
    this.renderer.renderHUD(
      this.scorer.score,
      this.scorer.combo,
      this.scorer.multiplier,
      this.scorer.getVolumeDisplay(),
      this.scorer.getApprovalRate(),
      this.beatmap.duration > 0 ? Math.min(currentTime / this.beatmap.duration, 1) : this.audio.getProgress(),
      this.scorer.getRiskLevel()
    );

    // Section label
    this.renderer.renderSectionLabel(this.beatmap.getCurrentSection(currentTime));

    // Key prompts
    this.renderer.renderKeyPrompts(this.renderer.getLayout().isMobile);
  }
}

// Initialize and expose to global for HTML button handlers
const game = new Game();

window.addEventListener('DOMContentLoaded', () => {
  game.init().catch(console.error);
});

// Global handlers for HTML buttons (inline onclick)
window.gameReplay = () => { game.replay(); };
window.gameShare = () => { game.shareResults(); };
window.openSpotify = () => { window.open('https://open.spotify.com/album/1e8GYRBtFoo0TdMIJJk8bk', '_blank'); };

// Title screen — click/tap anywhere to start
window.addEventListener('DOMContentLoaded', () => {
  const titleScreen = document.getElementById('title-screen');
  if (titleScreen) {
    titleScreen.addEventListener('click', () => game.tryStart());
    titleScreen.addEventListener('touchend', (e) => {
      e.preventDefault();
      game.tryStart();
    });
  }
});
