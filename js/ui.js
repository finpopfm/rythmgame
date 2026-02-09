// FINPOP Rhythm Game — UI Manager
// Manages HTML overlay screens: Title, Results, Share, Pause, Calibration

import { LANE_COLORS } from './renderer.js';

export class UI {
  constructor() {
    this.titleScreen = null;
    this.resultsScreen = null;
    this.loadingScreen = null;
    this.pauseScreen = null;
    this.calibrationScreen = null;
  }

  init() {
    this.titleScreen = document.getElementById('title-screen');
    this.resultsScreen = document.getElementById('results-screen');
    this.loadingScreen = document.getElementById('loading-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.calibrationScreen = document.getElementById('calibration-screen');
  }

  showLoading(progress = 0, message = 'Loading...') {
    if (this.loadingScreen) {
      this.loadingScreen.classList.add('active');
      const bar = this.loadingScreen.querySelector('.load-progress-fill');
      const msg = this.loadingScreen.querySelector('.load-message');
      if (bar) bar.style.width = `${progress * 100}%`;
      if (msg) msg.textContent = message;
    }
  }

  hideLoading() {
    if (this.loadingScreen) this.loadingScreen.classList.remove('active');
  }

  showTitle() {
    if (this.titleScreen) this.titleScreen.classList.add('active');
    this.hideResults();
  }

  hideTitle() {
    if (this.titleScreen) this.titleScreen.classList.remove('active');
  }

  showPause() {
    if (this.pauseScreen) this.pauseScreen.classList.add('active');
  }

  hidePause() {
    if (this.pauseScreen) this.pauseScreen.classList.remove('active');
  }

  showCalibration() {
    if (this.calibrationScreen) this.calibrationScreen.classList.add('active');
  }

  hideCalibration() {
    if (this.calibrationScreen) this.calibrationScreen.classList.remove('active');
  }

  showBestScore() {
    const el = document.getElementById('title-best');
    if (!el) return;
    try {
      const best = JSON.parse(localStorage.getItem('finpop_best') || 'null');
      if (best && best.score) {
        el.textContent = `BEST: Grade ${best.grade} | ${best.score.toLocaleString()} | ${best.difficulty || 'NORMAL'}`;
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    } catch {
      el.style.display = 'none';
    }
  }

  showResults(stats) {
    if (!this.resultsScreen) return;
    this.resultsScreen.classList.add('active');

    const set = (id, val) => {
      const el = this.resultsScreen.querySelector(`#${id}`);
      if (el) el.textContent = val;
    };

    // Grade: reveal with animation
    const gradeEl = this.resultsScreen.querySelector('#result-grade');
    if (gradeEl) {
      gradeEl.textContent = '';
      gradeEl.classList.remove('grade-reveal');
      const gradeColors = { S: '#FFD700', A: '#00ff88', B: '#00d4ff', C: '#ff6600', D: '#ff0040' };
      gradeEl.style.color = gradeColors[stats.grade] || '#ffffff';
      gradeEl.style.textShadow = `0 0 30px ${gradeColors[stats.grade] || '#ffffff'}`;
      setTimeout(() => {
        gradeEl.textContent = stats.grade;
        gradeEl.classList.add('grade-reveal');
      }, 400);
    }

    // Comment
    const commentEl = this.resultsScreen.querySelector('#result-comment');
    if (commentEl) {
      const comments = {
        S: '"Flawless execution. We\'re going public." — LUNA',
        A: '"Clean settlement record. Almost perfect." — NOVA',
        B: '"Some chargebacks, but we can manage." — VERA',
        C: '"Risk levels elevated. Tighten controls." — IRIS',
        D: '"Compliance review required. Immediately." — VERA',
      };
      commentEl.textContent = '';
      setTimeout(() => { commentEl.textContent = comments[stats.grade] || comments.C; }, 1200);
    }

    // Animated countUp for stats
    this._countUp('result-score', 0, stats.score, 1000, 800, v => v.toLocaleString());
    this._countUp('result-approval', 0, stats.approvalRate, 1000, 900, v => `${v.toFixed(1)}%`);
    this._countUp('result-volume-raw', 0, stats.score * 100, 1000, 1000, v => {
      if (v >= 1e9) return `$${(v/1e9).toFixed(1)}B`;
      if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`;
      if (v >= 1e3) return `$${(v/1e3).toFixed(1)}K`;
      return `$${Math.round(v)}`;
    });
    // Volume uses raw number for animation
    set('result-volume', '$0');
    setTimeout(() => set('result-volume', stats.volume), 1100);
    this._countUp('result-streak', 0, stats.maxCombo, 800, 1100, v => `${Math.round(v)}x`);

    // Breakdown — staggered fade-in
    const breakdownIds = ['result-approved-count', 'result-pending-count', 'result-declined-count', 'result-chargeback-count'];
    const breakdownVals = [stats.counts.APPROVED || 0, stats.counts.PENDING || 0, stats.counts.DECLINED || 0, stats.counts.CHARGEBACK || 0];
    breakdownIds.forEach((id, i) => {
      const el = this.resultsScreen.querySelector(`#${id}`);
      if (el) {
        el.textContent = '0';
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => {
          el.style.transition = 'opacity 0.3s, transform 0.3s';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          el.textContent = breakdownVals[i];
        }, 1400 + i * 100);
      }
    });

    // Risk level
    const riskEl = this.resultsScreen.querySelector('#result-risk');
    if (riskEl) {
      riskEl.textContent = stats.riskLevel.level;
      riskEl.style.color = stats.riskLevel.color;
    }
  }

  _countUp(id, from, to, duration, delay, format) {
    const el = this.resultsScreen.querySelector(`#${id}`);
    if (!el) return;
    el.textContent = format(from);
    setTimeout(() => {
      const start = performance.now();
      const animate = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + (to - from) * eased;
        el.textContent = format(current);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
  }

  hideResults() {
    if (this.resultsScreen) this.resultsScreen.classList.remove('active');
  }

  async generateShareImage(stats) {
    const canvas = document.createElement('canvas');
    const w = 600, h = 340;
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(0,212,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    ctx.fillStyle = 'rgba(0,212,255,0.1)';
    ctx.fillRect(0, 0, w, 50);
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText('FINPOP SETTLEMENT REPORT', 20, 32);
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('● VERIFIED', w - 20, 32);

    const gradeColors = { S: '#FFD700', A: '#00ff88', B: '#00d4ff', C: '#ff6600', D: '#ff0040' };
    ctx.font = 'bold 80px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = gradeColors[stats.grade] || '#ffffff';
    ctx.shadowColor = gradeColors[stats.grade] || '#ffffff';
    ctx.shadowBlur = 30;
    ctx.fillText(stats.grade, 100, 160);
    ctx.shadowBlur = 0;
    ctx.font = '13px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RISK GRADE', 100, 185);

    ctx.textAlign = 'left';
    const statsData = [
      { label: 'SCORE', value: stats.score.toLocaleString(), color: '#ffffff' },
      { label: 'APPROVED', value: `${stats.approvalRate.toFixed(1)}%`, color: '#00ff88' },
      { label: 'VOLUME', value: stats.volume, color: '#FFD700' },
      { label: 'MAX STREAK', value: `${stats.maxCombo}x`, color: '#00d4ff' },
      { label: 'RISK LEVEL', value: stats.riskLevel.level, color: stats.riskLevel.color },
    ];
    for (let i = 0; i < statsData.length; i++) {
      const y = 85 + i * 34;
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(statsData[i].label, 200, y);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = statsData[i].color;
      ctx.fillText(statsData[i].value, 200, y + 20);
    }

    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('PLAY AT BEAT.FINPOP.FM', w / 2, h - 10);

    return new Promise(resolve => { canvas.toBlob(blob => resolve(blob), 'image/png'); });
  }

  async share(stats) {
    const text = `FINPOP Settlement Report: Grade ${stats.grade} | ${stats.approvalRate.toFixed(0)}% Approved | ${stats.volume} Volume | ${stats.maxCombo}x Streak`;
    const url = this.getShareUrl(stats);

    if (navigator.share) {
      try {
        const blob = await this.generateShareImage(stats);
        const file = new File([blob], 'finpop-report.png', { type: 'image/png' });
        await navigator.share({ title: 'PAYMENTS ON LOCK: Beat Edition', text, url, files: [file] });
        return true;
      } catch (e) {
        try { await navigator.share({ title: 'FINPOP', text, url }); return true; } catch { /* cancelled */ }
      }
    }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); return true; } catch { return false; }
  }

  getShareUrl(stats) {
    const params = new URLSearchParams({ s: Math.round(stats.approvalRate), g: stats.grade, v: stats.maxCombo, sc: stats.score });
    return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
  }

  parseShareUrl() {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    try {
      const params = new URLSearchParams(hash);
      return {
        approvalRate: parseInt(params.get('s')) || 0,
        grade: params.get('g') || '?',
        maxCombo: parseInt(params.get('v')) || 0,
        score: parseInt(params.get('sc')) || 0,
      };
    } catch { return null; }
  }
}
