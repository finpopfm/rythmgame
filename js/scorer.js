// FINPOP Rhythm Game — Scoring Engine
// Handles judgments, combo, score calculation

export const Judgment = {
  APPROVED: 'APPROVED',
  PENDING: 'PENDING',
  DECLINED: 'DECLINED',
  CHARGEBACK: 'CHARGEBACK',
};

// Timing windows in seconds
export const TIMING = {
  APPROVED: 0.045,   // +/- 45ms
  PENDING: 0.100,    // +/- 100ms
  DECLINED: 0.150,   // +/- 150ms
  MISS: 0.200,       // beyond 200ms = chargeback
};

// Score values
const SCORE_VALUES = {
  [Judgment.APPROVED]: 300,
  [Judgment.PENDING]: 200,
  [Judgment.DECLINED]: 50,
  [Judgment.CHARGEBACK]: 0,
};

export class Scorer {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.totalNotes = 0;
    this.counts = {
      [Judgment.APPROVED]: 0,
      [Judgment.PENDING]: 0,
      [Judgment.DECLINED]: 0,
      [Judgment.CHARGEBACK]: 0,
    };
    this.recentJudgment = null;
    this.recentJudgmentTime = 0;
    this.volume = 0; // "Transaction volume" display
  }

  judge(timeDiff) {
    const abs = Math.abs(timeDiff);
    if (abs <= TIMING.APPROVED) return Judgment.APPROVED;
    if (abs <= TIMING.PENDING) return Judgment.PENDING;
    if (abs <= TIMING.DECLINED) return Judgment.DECLINED;
    return Judgment.CHARGEBACK;
  }

  addHit(judgment, currentTime) {
    this.counts[judgment]++;
    this.totalNotes++;

    if (judgment === Judgment.CHARGEBACK) {
      this.combo = 0;
      this.multiplier = 1;
    } else {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // Multiplier tiers
      if (this.combo >= 100) this.multiplier = 8;
      else if (this.combo >= 50) this.multiplier = 4;
      else if (this.combo >= 25) this.multiplier = 3;
      else if (this.combo >= 10) this.multiplier = 2;
      else this.multiplier = 1;
    }

    const points = SCORE_VALUES[judgment] * this.multiplier;
    this.score += points;

    // Transaction volume grows with score
    this.volume = this.score * 100;

    this.recentJudgment = judgment;
    this.recentJudgmentTime = currentTime;

    return { judgment, points, combo: this.combo, multiplier: this.multiplier };
  }

  getGrade() {
    if (this.totalNotes === 0) return 'D';
    const approvedRate = this.counts[Judgment.APPROVED] / this.totalNotes;
    const hitRate = (this.totalNotes - this.counts[Judgment.CHARGEBACK]) / this.totalNotes;

    if (approvedRate >= 0.95 && hitRate >= 0.99) return 'S';
    if (approvedRate >= 0.85 && hitRate >= 0.95) return 'A';
    if (approvedRate >= 0.70 && hitRate >= 0.85) return 'B';
    if (hitRate >= 0.70) return 'C';
    return 'D';
  }

  getApprovalRate() {
    if (this.totalNotes === 0) return 0;
    return ((this.totalNotes - this.counts[Judgment.CHARGEBACK]) / this.totalNotes * 100);
  }

  getVolumeDisplay() {
    const vol = this.volume;
    if (vol >= 1000000000) return `$${(vol / 1000000000).toFixed(1)}B`;
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol}`;
  }

  getRiskLevel() {
    const chargebackRate = this.totalNotes > 0
      ? this.counts[Judgment.CHARGEBACK] / this.totalNotes
      : 0;
    if (chargebackRate > 0.3) return { level: 'CRITICAL', color: '#ff0040' };
    if (chargebackRate > 0.15) return { level: 'HIGH', color: '#ff6600' };
    if (chargebackRate > 0.05) return { level: 'MEDIUM', color: '#ffcc00' };
    return { level: 'LOW', color: '#00ff88' };
  }

  getStats() {
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      grade: this.getGrade(),
      approvalRate: this.getApprovalRate(),
      volume: this.getVolumeDisplay(),
      riskLevel: this.getRiskLevel(),
      counts: { ...this.counts },
      totalNotes: this.totalNotes,
    };
  }
}
