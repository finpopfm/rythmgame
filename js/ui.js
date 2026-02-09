// FINPOP Rhythm Game — UI Manager
// Manages HTML overlay screens: Title, Results, Share

import { LANE_COLORS } from './renderer.js';

export class UI {
  constructor() {
    this.titleScreen = null;
    this.resultsScreen = null;
    this.loadingScreen = null;
    this.onStart = null;
    this.onReplay = null;
  }

  init() {
    this.titleScreen = document.getElementById('title-screen');
    this.resultsScreen = document.getElementById('results-screen');
    this.loadingScreen = document.getElementById('loading-screen');
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
    if (this.loadingScreen) {
      this.loadingScreen.classList.remove('active');
    }
  }

  showTitle() {
    if (this.titleScreen) {
      this.titleScreen.classList.add('active');
    }
    this.hideResults();
  }

  hideTitle() {
    if (this.titleScreen) {
      this.titleScreen.classList.remove('active');
    }
  }

  showResults(stats) {
    if (!this.resultsScreen) return;
    this.resultsScreen.classList.add('active');

    // Fill in stats
    const set = (id, val) => {
      const el = this.resultsScreen.querySelector(`#${id}`);
      if (el) el.textContent = val;
    };

    set('result-grade', stats.grade);
    set('result-score', stats.score.toLocaleString());
    set('result-approval', `${stats.approvalRate.toFixed(1)}%`);
    set('result-volume', stats.volume);
    set('result-streak', `${stats.maxCombo}x`);
    set('result-approved-count', stats.counts.APPROVED || 0);
    set('result-pending-count', stats.counts.PENDING || 0);
    set('result-declined-count', stats.counts.DECLINED || 0);
    set('result-chargeback-count', stats.counts.CHARGEBACK || 0);

    // Grade color
    const gradeEl = this.resultsScreen.querySelector('#result-grade');
    if (gradeEl) {
      const gradeColors = { S: '#FFD700', A: '#00ff88', B: '#00d4ff', C: '#ff6600', D: '#ff0040' };
      gradeEl.style.color = gradeColors[stats.grade] || '#ffffff';
      gradeEl.style.textShadow = `0 0 30px ${gradeColors[stats.grade] || '#ffffff'}`;
    }

    // Risk level
    const riskEl = this.resultsScreen.querySelector('#result-risk');
    if (riskEl) {
      riskEl.textContent = stats.riskLevel.level;
      riskEl.style.color = stats.riskLevel.color;
    }

    // Character comment based on grade
    const commentEl = this.resultsScreen.querySelector('#result-comment');
    if (commentEl) {
      const comments = {
        S: '"Flawless execution. We\'re going public." — LUNA',
        A: '"Clean settlement record. Almost perfect." — NOVA',
        B: '"Some chargebacks, but we can manage." — VERA',
        C: '"Risk levels elevated. Tighten controls." — IRIS',
        D: '"Compliance review required. Immediately." — VERA',
      };
      commentEl.textContent = comments[stats.grade] || comments.C;
    }
  }

  hideResults() {
    if (this.resultsScreen) {
      this.resultsScreen.classList.remove('active');
    }
  }

  async generateShareImage(stats) {
    const canvas = document.createElement('canvas');
    const w = 600;
    const h = 340;
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // Grid pattern
    ctx.strokeStyle = 'rgba(0,212,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Header
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

    // Grade
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

    // Stats
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

    // Lane colors bar at bottom
    const barY = h - 50;
    for (let i = 0; i < 4; i++) {
      const bw = (w - 40) / 4;
      ctx.fillStyle = `rgba(${hexToRgb(LANE_COLORS[i].main)},0.3)`;
      ctx.fillRect(20 + i * bw, barY, bw - 4, 6);
      ctx.font = '9px monospace';
      ctx.fillStyle = LANE_COLORS[i].main;
      ctx.textAlign = 'center';
      ctx.fillText(LANE_COLORS[i].name, 20 + i * bw + bw / 2, barY + 20);
    }

    // Footer
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('PLAY AT FINPOP.FM', w / 2, h - 10);

    // Convert to blob
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });
  }

  async share(stats) {
    const text = `FINPOP Settlement Report: Grade ${stats.grade} | ${stats.approvalRate.toFixed(0)}% Approved | ${stats.volume} Volume | ${stats.maxCombo}x Streak`;
    const url = this.getShareUrl(stats);

    if (navigator.share) {
      try {
        const blob = await this.generateShareImage(stats);
        const file = new File([blob], 'finpop-report.png', { type: 'image/png' });
        await navigator.share({
          title: 'FINPOP — Payments on Lock',
          text,
          url,
          files: [file],
        });
        return true;
      } catch (e) {
        // Fallback: share without image
        try {
          await navigator.share({ title: 'FINPOP', text, url });
          return true;
        } catch (e2) { /* user cancelled */ }
      }
    }

    // Desktop fallback: copy URL
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      return true;
    } catch (e) {
      return false;
    }
  }

  getShareUrl(stats) {
    const params = new URLSearchParams({
      s: Math.round(stats.approvalRate),
      g: stats.grade,
      v: stats.maxCombo,
      sc: stats.score,
    });
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
    } catch {
      return null;
    }
  }
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
