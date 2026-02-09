// FINPOP Rhythm Game — Canvas Renderer
// Handles all visual rendering: lanes, notes, effects, particles

import { Judgment } from './scorer.js';

// Character theme colors
export const LANE_COLORS = [
  { name: 'LUNA',  role: 'CEO', main: '#FFD700', glow: '#FFA500', bg: 'rgba(255,215,0,0.08)' },
  { name: 'IRIS',  role: 'CTO', main: '#C77DFF', glow: '#9B59B6', bg: 'rgba(199,125,255,0.08)' },
  { name: 'NOVA',  role: 'CFO', main: '#00D4FF', glow: '#0099CC', bg: 'rgba(0,212,255,0.08)' },
  { name: 'VERA',  role: 'COO', main: '#00FF88', glow: '#00CC66', bg: 'rgba(0,255,136,0.08)' },
];

const JUDGMENT_COLORS = {
  [Judgment.APPROVED]: '#00ff88',
  [Judgment.PENDING]: '#FFD700',
  [Judgment.DECLINED]: '#ff6600',
  [Judgment.CHARGEBACK]: '#ff0040',
};

export class Renderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.particles = [];
    this.hitEffects = [];
    this.bgElements = [];
    this.shakeAmount = 0;
    this.shakeDecay = 0.9;
    this.time = 0;
    this.characterImages = [null, null, null, null];
    this.imagesLoaded = false;
    this.dpr = window.devicePixelRatio || 1;
  }

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Initialize background floating elements
    for (let i = 0; i < 30; i++) {
      this.bgElements.push({
        x: Math.random(),
        y: Math.random(),
        speed: 0.0002 + Math.random() * 0.0005,
        size: 1 + Math.random() * 2,
        opacity: 0.1 + Math.random() * 0.2,
        char: ['$', '€', '£', '¥', '₿', '◆', '●', '▸'][Math.floor(Math.random() * 8)],
      });
    }
  }

  async loadCharacterImages(paths) {
    const promises = paths.map((path, i) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.characterImages[i] = img;
          resolve();
        };
        img.onerror = () => resolve(); // graceful fail
        img.src = path;
      });
    });
    await Promise.all(promises);
    this.imagesLoaded = true;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Layout calculations
  getLayout() {
    const w = this.width;
    const h = this.height;
    const isMobile = w < 768;

    const laneAreaWidth = isMobile ? w * 0.92 : Math.min(w * 0.6, 600);
    const laneAreaX = (w - laneAreaWidth) / 2;
    const laneWidth = laneAreaWidth / 4;

    const hitLineY = h * 0.85;
    const topY = h * 0.08;
    const approachTime = 2.0; // seconds for note to travel from top to hit line
    const noteSpeed = (hitLineY - topY) / approachTime;

    return {
      w, h, isMobile,
      laneAreaX, laneAreaWidth, laneWidth,
      hitLineY, topY, noteSpeed, approachTime,
    };
  }

  clear() {
    const { w, h } = this.getLayout();
    this.ctx.fillStyle = '#08080f';
    this.ctx.fillRect(0, 0, w, h);
  }

  renderBackground(audioLevel = 0, bassLevel = 0, currentTime = 0) {
    const ctx = this.ctx;
    const { w, h } = this.getLayout();
    this.time = currentTime;

    // Subtle gradient background
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.8);
    grad.addColorStop(0, `rgba(15,10,30,${0.3 + bassLevel * 0.3})`);
    grad.addColorStop(1, 'rgba(8,8,15,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = `rgba(0,212,255,${0.03 + audioLevel * 0.04})`;
    ctx.lineWidth = 0.5;
    const gridSize = 60;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Floating symbols
    ctx.font = '12px monospace';
    for (const el of this.bgElements) {
      el.y -= el.speed;
      if (el.y < 0) { el.y = 1; el.x = Math.random(); }
      ctx.fillStyle = `rgba(0,212,255,${el.opacity * (0.5 + audioLevel * 0.5)})`;
      ctx.fillText(el.char, el.x * w, el.y * h);
    }

    // Pulsing horizontal scan line
    const scanY = (currentTime * 50) % h;
    ctx.strokeStyle = `rgba(0,255,136,${0.05 + bassLevel * 0.1})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(w, scanY);
    ctx.stroke();
  }

  renderLanes(laneStates = [false, false, false, false], beatPhase = 0) {
    const ctx = this.ctx;
    const layout = this.getLayout();
    const { laneAreaX, laneWidth, hitLineY, topY, h } = layout;

    // Beat pulse — subtle glow on downbeats
    const beatGlow = Math.max(0, 1 - beatPhase * 4); // bright at beat start, fades quickly

    for (let i = 0; i < 4; i++) {
      const x = laneAreaX + i * laneWidth;
      const color = LANE_COLORS[i];

      // Lane background with beat pulse
      const bgAlpha = 0.08 + beatGlow * 0.04;
      ctx.fillStyle = `rgba(${this.hexToRgb(color.main)},${bgAlpha})`;
      ctx.fillRect(x, topY, laneWidth, hitLineY - topY + 40);

      // Lane separator lines
      ctx.strokeStyle = `rgba(255,255,255,0.06)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, hitLineY + 40);
      ctx.stroke();

      // Lane beat flash — vertical light streak on downbeat
      if (beatGlow > 0.2) {
        const flashGrad = ctx.createLinearGradient(x, hitLineY - 60, x, hitLineY);
        flashGrad.addColorStop(0, `rgba(${this.hexToRgb(color.main)},0)`);
        flashGrad.addColorStop(1, `rgba(${this.hexToRgb(color.main)},${beatGlow * 0.12})`);
        ctx.fillStyle = flashGrad;
        ctx.fillRect(x, topY, laneWidth, hitLineY - topY);
      }

      // Hit zone
      const hitZoneHeight = 8;
      const pressed = laneStates[i];

      if (pressed) {
        // Bright glow when pressed
        ctx.shadowColor = color.main;
        ctx.shadowBlur = 25;
        ctx.fillStyle = color.main;
        ctx.fillRect(x + 2, hitLineY - hitZoneHeight / 2, laneWidth - 4, hitZoneHeight);
        ctx.shadowBlur = 0;

        // Press flash effect
        const flashGrad = ctx.createRadialGradient(
          x + laneWidth / 2, hitLineY, 0,
          x + laneWidth / 2, hitLineY, laneWidth
        );
        flashGrad.addColorStop(0, `rgba(${this.hexToRgb(color.main)},0.3)`);
        flashGrad.addColorStop(1, `rgba(${this.hexToRgb(color.main)},0)`);
        ctx.fillStyle = flashGrad;
        ctx.fillRect(x, hitLineY - laneWidth, laneWidth, laneWidth * 2);
      } else {
        ctx.fillStyle = `rgba(${this.hexToRgb(color.main)},0.4)`;
        ctx.fillRect(x + 2, hitLineY - hitZoneHeight / 2, laneWidth - 4, hitZoneHeight);
      }

      // Character label at bottom
      const labelY = hitLineY + 30;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = color.main;
      ctx.fillText(color.name, x + laneWidth / 2, labelY);
      ctx.font = '9px monospace';
      ctx.fillStyle = `rgba(${this.hexToRgb(color.main)},0.5)`;
      ctx.fillText(color.role, x + laneWidth / 2, labelY + 14);

      // Character avatar (small circle)
      if (this.characterImages[i]) {
        const imgSize = layout.isMobile ? 28 : 36;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + laneWidth / 2, labelY + 36, imgSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          this.characterImages[i],
          x + laneWidth / 2 - imgSize / 2,
          labelY + 36 - imgSize / 2,
          imgSize, imgSize
        );
        ctx.restore();
      }
    }

    // Right border of last lane
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(laneAreaX + 4 * laneWidth, topY);
    ctx.lineTo(laneAreaX + 4 * laneWidth, hitLineY + 40);
    ctx.stroke();
  }

  renderNotes(visibleNotes, currentTime) {
    const ctx = this.ctx;
    const layout = this.getLayout();
    const { laneAreaX, laneWidth, hitLineY, topY, approachTime } = layout;

    for (const note of visibleNotes) {
      if (note.hit) continue;

      const relTime = note.time - currentTime;
      const progress = 1 - (relTime / approachTime);
      const y = topY + (hitLineY - topY) * progress;

      if (y < topY - 30 || y > hitLineY + 50) continue;

      const x = laneAreaX + note.lane * laneWidth;
      const color = LANE_COLORS[note.lane];

      const noteWidth = laneWidth * 0.7;
      const noteHeight = 14;
      const noteX = x + (laneWidth - noteWidth) / 2;

      if (note.type === 'hold' && note.duration > 0) {
        // Hold note — render the tail first
        const tailEndTime = note.time + note.duration - currentTime;
        const tailProgress = 1 - (tailEndTime / approachTime);
        const tailY = topY + (hitLineY - topY) * tailProgress;
        const bodyTop = Math.max(tailY, topY);

        ctx.fillStyle = `rgba(${this.hexToRgb(color.main)},0.25)`;
        ctx.fillRect(noteX + noteWidth * 0.2, bodyTop, noteWidth * 0.6, y - bodyTop);

        // Side glow on hold body
        ctx.strokeStyle = `rgba(${this.hexToRgb(color.main)},0.4)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(noteX + noteWidth * 0.2, bodyTop);
        ctx.lineTo(noteX + noteWidth * 0.2, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(noteX + noteWidth * 0.8, bodyTop);
        ctx.lineTo(noteX + noteWidth * 0.8, y);
        ctx.stroke();
      }

      // Note head
      ctx.shadowColor = color.main;
      ctx.shadowBlur = 12;

      // Note gradient
      const noteGrad = ctx.createLinearGradient(noteX, y - noteHeight / 2, noteX + noteWidth, y - noteHeight / 2);
      noteGrad.addColorStop(0, `rgba(${this.hexToRgb(color.main)},0.8)`);
      noteGrad.addColorStop(0.5, color.main);
      noteGrad.addColorStop(1, `rgba(${this.hexToRgb(color.main)},0.8)`);

      ctx.fillStyle = noteGrad;
      this.roundRect(noteX, y - noteHeight / 2, noteWidth, noteHeight, 4);
      ctx.fill();

      // Transaction icon inside note
      ctx.shadowBlur = 0;
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0a0a1a';
      const icons = ['💳', '⚡', '◆', '▸'];
      ctx.fillText(icons[note.lane], x + laneWidth / 2, y + 3);

      // Approaching warning: note glows brighter near hit zone
      if (relTime < 0.3 && relTime > 0) {
        const urgency = 1 - relTime / 0.3;
        ctx.shadowColor = color.main;
        ctx.shadowBlur = 8 + urgency * 20;
        ctx.strokeStyle = color.main;
        ctx.lineWidth = 1 + urgency;
        this.roundRect(noteX - 1, y - noteHeight / 2 - 1, noteWidth + 2, noteHeight + 2, 5);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Missed note fading
      if (note.missed) {
        ctx.fillStyle = 'rgba(255,0,64,0.6)';
        this.roundRect(noteX, y - noteHeight / 2, noteWidth, noteHeight, 4);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
  }

  renderSectionLabel(sectionName) {
    if (!sectionName) return;
    const ctx = this.ctx;
    const { w } = this.getLayout();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,212,255,0.35)';
    ctx.fillText(`— ${sectionName} —`, w / 2, 72);
  }

  renderHUD(score, combo, multiplier, volumeDisplay, approvalRate, progress, riskLevel) {
    const ctx = this.ctx;
    const layout = this.getLayout();
    const { w, isMobile } = layout;
    const fontSize = isMobile ? 11 : 13;

    // Top bar background
    ctx.fillStyle = 'rgba(10,10,26,0.85)';
    ctx.fillRect(0, 0, w, 56);
    ctx.strokeStyle = 'rgba(0,212,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 56);
    ctx.lineTo(w, 56);
    ctx.stroke();

    // Title
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText('FINPOP PAYMENTS ENGINE v1.0', isMobile ? 10 : 20, 20);

    // Status dot
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(isMobile ? w - 15 : w - 20, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${fontSize - 2}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('LIVE', isMobile ? w - 24 : w - 30, 20);

    // Score
    ctx.font = `bold ${isMobile ? 18 : 22}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(score.toLocaleString(), isMobile ? 10 : 20, 45);

    // Combo (Settlement Streak)
    if (combo > 0) {
      ctx.textAlign = 'center';
      ctx.font = `bold ${isMobile ? 14 : 16}px monospace`;
      const comboColor = combo >= 50 ? '#FFD700' : combo >= 25 ? '#00ff88' : '#00d4ff';
      ctx.fillStyle = comboColor;
      ctx.fillText(`${combo}x STREAK`, w / 2, 38);
      if (multiplier > 1) {
        ctx.font = `${fontSize - 2}px monospace`;
        ctx.fillStyle = `rgba(255,255,255,0.5)`;
        ctx.fillText(`${multiplier}x MULTIPLIER`, w / 2, 50);
      }
    }

    // Volume
    ctx.textAlign = 'right';
    ctx.font = `bold ${isMobile ? 14 : 16}px monospace`;
    ctx.fillStyle = '#FFD700';
    ctx.fillText(volumeDisplay, w - (isMobile ? 10 : 20), 38);
    ctx.font = `${fontSize - 2}px monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('VOLUME', w - (isMobile ? 10 : 20), 50);

    // Progress bar
    const pbY = 55;
    const pbH = 2;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, pbY, w, pbH);
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(0, pbY, w * progress, pbH);

    // Risk level indicator (bottom left)
    if (riskLevel) {
      ctx.font = `bold ${fontSize - 1}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = riskLevel.color;
      ctx.fillText(`● RISK: ${riskLevel.level}`, isMobile ? 10 : 20, layout.h - 8);
    }

    // Approval rate (bottom right)
    ctx.font = `${fontSize - 1}px monospace`;
    ctx.textAlign = 'right';
    ctx.fillStyle = approvalRate > 90 ? '#00ff88' : approvalRate > 70 ? '#FFD700' : '#ff6600';
    ctx.fillText(`APPROVED: ${approvalRate.toFixed(1)}%`, w - (isMobile ? 10 : 20), layout.h - 8);
  }

  renderJudgment(judgment, lane, time) {
    if (!judgment) return;

    const layout = this.getLayout();
    const x = layout.laneAreaX + lane * layout.laneWidth + layout.laneWidth / 2;
    const y = layout.hitLineY - 40;
    const color = JUDGMENT_COLORS[judgment] || '#ffffff';

    // Add to hit effects
    this.hitEffects.push({
      x, y,
      text: judgment,
      color,
      alpha: 1,
      scale: 1.5,
      vy: -1,
      life: 1,
    });

    // Spawn particles on successful hit
    if (judgment !== Judgment.CHARGEBACK) {
      const laneColor = LANE_COLORS[lane].main;
      const count = judgment === Judgment.APPROVED ? 18 : 8;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        const speed = 2 + Math.random() * 5;
        this.particles.push({
          x,
          y: layout.hitLineY,
          vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 2,
          vy: Math.sin(angle) * speed - 2,
          size: 1.5 + Math.random() * 3,
          color: laneColor,
          alpha: 1,
          life: 0.4 + Math.random() * 0.5,
          decay: 0.025,
        });
      }

      // Additional sparkle ring on APPROVED
      if (judgment === Judgment.APPROVED) {
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 * i) / 8;
          this.particles.push({
            x,
            y: layout.hitLineY,
            vx: Math.cos(a) * 8,
            vy: Math.sin(a) * 8 - 1,
            size: 1,
            color: '#ffffff',
            alpha: 0.8,
            life: 0.3,
            decay: 0.035,
          });
        }
      }
    } else {
      // Screen shake on chargeback
      this.shakeAmount = 10;

      // Red flash particles
      for (let i = 0; i < 12; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 40,
          y: layout.hitLineY + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 6,
          vy: -Math.random() * 3,
          size: 2 + Math.random() * 2,
          color: '#ff0040',
          alpha: 0.8,
          life: 0.4,
          decay: 0.03,
        });
      }

      // "COMBO BREAK" text if there was a combo
      this.hitEffects.push({
        x: layout.w / 2,
        y: layout.hitLineY - 80,
        text: 'COMBO BREAK',
        color: '#ff0040',
        alpha: 1,
        scale: 1.8,
        vy: -0.3,
        life: 1.2,
        big: false,
      });
    }
  }

  renderComboMilestone(combo) {
    if (combo === 10 || combo === 25 || combo === 50 || combo === 100) {
      const layout = this.getLayout();
      const labels = { 10: 'CONNECTED!', 25: 'ON FIRE!', 50: 'GO LIVE!', 100: 'UNICORN!' };
      this.hitEffects.push({
        x: layout.w / 2,
        y: layout.h / 2,
        text: labels[combo] || `${combo}x`,
        color: '#FFD700',
        alpha: 1,
        scale: 3,
        vy: -0.5,
        life: 1.5,
        big: true,
      });

      // Burst of particles
      for (let i = 0; i < 40; i++) {
        const angle = (Math.PI * 2 * i) / 40;
        this.particles.push({
          x: layout.w / 2,
          y: layout.h / 2,
          vx: Math.cos(angle) * (3 + Math.random() * 5),
          vy: Math.sin(angle) * (3 + Math.random() * 5),
          size: 2 + Math.random() * 4,
          color: LANE_COLORS[i % 4].main,
          alpha: 1,
          life: 1 + Math.random(),
          decay: 0.015,
        });
      }
    }
  }

  updateEffects(dt) {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.alpha -= p.decay;
      p.life -= dt;
      if (p.life <= 0 || p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update hit effects (floating text)
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const e = this.hitEffects[i];
      e.y += e.vy;
      e.alpha -= 0.025;
      e.scale *= 0.97;
      e.life -= dt;
      if (e.life <= 0 || e.alpha <= 0) {
        this.hitEffects.splice(i, 1);
      }
    }

    // Decay screen shake
    this.shakeAmount *= this.shakeDecay;
    if (this.shakeAmount < 0.1) this.shakeAmount = 0;
  }

  renderEffects() {
    const ctx = this.ctx;

    // Render particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Render floating judgment text
    for (const e of this.hitEffects) {
      ctx.globalAlpha = Math.max(0, e.alpha);
      ctx.font = `bold ${e.big ? 28 : 14}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = e.big ? 20 : 8;
      ctx.fillText(e.text, e.x, e.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  applyScreenShake() {
    if (this.shakeAmount > 0) {
      const dx = (Math.random() - 0.5) * this.shakeAmount;
      const dy = (Math.random() - 0.5) * this.shakeAmount;
      this.ctx.translate(dx, dy);
    }
  }

  resetTransform() {
    const dpr = this.dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Side panels (fintech dashboard feel)
  renderSidePanels(audioLevel, combo, currentTime) {
    const ctx = this.ctx;
    const layout = this.getLayout();
    const { w, h, laneAreaX, laneAreaWidth, isMobile } = layout;

    if (isMobile) return; // skip on mobile

    const leftPanelW = laneAreaX - 20;
    const rightPanelX = laneAreaX + laneAreaWidth + 20;
    const rightPanelW = w - rightPanelX;

    if (leftPanelW < 80 || rightPanelW < 80) return;

    ctx.globalAlpha = 0.4 + audioLevel * 0.3;

    // Left panel: fake transaction log
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    const txTypes = ['CARD', 'BANK', 'CRYPTO', 'WIRE'];
    const statuses = ['✓', '⏳', '✓', '✓', '✓', '⚠'];
    for (let i = 0; i < 12; i++) {
      const y = 80 + i * 24;
      if (y > h - 100) break;
      const pulse = Math.sin(currentTime * 3 + i) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(0,212,255,${0.3 * pulse})`;
      const tx = txTypes[i % 4];
      const amt = ((i * 137 + Math.floor(currentTime * 10)) % 9000 + 100).toFixed(0);
      const st = statuses[(i + Math.floor(currentTime)) % statuses.length];
      ctx.fillText(`${st} ${tx} $${amt}`, 15, y);
    }

    // Right panel: fake metrics
    ctx.textAlign = 'right';
    const metrics = [
      { label: 'TPS', value: (127 + Math.floor(Math.sin(currentTime * 2) * 30)).toString() },
      { label: 'LATENCY', value: `${(23 + Math.floor(Math.sin(currentTime) * 10))}ms` },
      { label: 'UPTIME', value: '99.97%' },
      { label: 'NODES', value: '4/4' },
    ];
    for (let i = 0; i < metrics.length; i++) {
      const y = 80 + i * 36;
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(metrics[i].label, w - 15, y);
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = 'rgba(0,255,136,0.5)';
      ctx.fillText(metrics[i].value, w - 15, y + 16);
    }

    // Mini chart on right (fake bar chart reacting to audio)
    const chartY = 240;
    const chartH = 100;
    const barCount = 16;
    const barW = Math.min(8, rightPanelW / barCount - 2);
    for (let i = 0; i < barCount; i++) {
      const barH = (Math.sin(currentTime * 4 + i * 0.5) * 0.3 + 0.5 + audioLevel * 0.3) * chartH;
      const bx = w - 15 - (barCount - i) * (barW + 2);
      ctx.fillStyle = `rgba(0,212,255,${0.2 + audioLevel * 0.3})`;
      ctx.fillRect(bx, chartY + chartH - barH, barW, barH);
    }

    ctx.globalAlpha = 1;
  }

  // Key prompt overlay for desktop
  renderKeyPrompts(isMobile) {
    if (isMobile) return;
    const ctx = this.ctx;
    const layout = this.getLayout();
    const { laneAreaX, laneWidth, h } = layout;
    const keys = ['D', 'F', 'J', 'K'];

    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i < 4; i++) {
      const x = laneAreaX + i * laneWidth + laneWidth / 2;
      const y = h - 14;
      ctx.fillStyle = `rgba(${this.hexToRgb(LANE_COLORS[i].main)},0.3)`;
      this.roundRect(x - 14, y - 14, 28, 22, 4);
      ctx.fill();
      ctx.fillStyle = LANE_COLORS[i].main;
      ctx.fillText(keys[i], x, y);
    }
  }

  // Countdown before track starts
  renderCountdown(count) {
    const ctx = this.ctx;
    const { w, h } = this.getLayout();
    ctx.font = 'bold 72px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00d4ff';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 30;
    ctx.fillText(count > 0 ? count.toString() : 'GO!', w / 2, h / 2);
    ctx.shadowBlur = 0;
  }

  // Utility: hex color to r,g,b string
  hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  // Utility: rounded rectangle
  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
