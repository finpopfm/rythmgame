// FINPOP Rhythm Game — Beatmap System
// Loads, parses and manages note timing

export class BeatmapManager {
  constructor() {
    this.notes = [];
    this.bpm = 128;
    this.offset = 0;
    this.trackName = '';
    this.duration = 0;
    this.sections = [];
  }

  async load(url) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      this.bpm = data.bpm || 134;
      this.offset = data.offset || 0;
      this.trackName = data.track || 'unknown';
      this.notes = data.notes.map((n, i) => ({
        id: i,
        time: n.time + this.offset,
        lane: n.lane,
        type: n.type || 'tap',
        duration: n.duration || 0,
        hit: false,
        missed: false,
        judged: false,
      }));
      this.duration = this.notes.length > 0
        ? this.notes[this.notes.length - 1].time + 2
        : 0;
      this.initSections();
      return true;
    } catch (e) {
      console.warn('Beatmap load failed, generating default:', e.message);
      this.generateDefault();
      return true;
    }
  }

  generateDefault() {
    // Generate a full beatmap for "Payments on Lock" at 134 BPM
    this.bpm = 134;
    this.offset = 0;
    this.trackName = 'payments_on_lock';
    this.notes = [];

    const beat = 60 / this.bpm; // 0.46875s
    const bar = beat * 4;       // 1.875s
    let noteId = 0;

    const addNote = (time, lane, type = 'tap', duration = 0) => {
      this.notes.push({
        id: noteId++,
        time,
        lane,
        type,
        duration,
        hit: false,
        missed: false,
        judged: false,
      });
    };

    // Helper: add notes at beat positions within a range
    const addPattern = (startBar, pattern, lanes) => {
      const startTime = startBar * bar;
      for (const p of pattern) {
        const time = startTime + p.beat * beat;
        const lane = p.lane !== undefined ? p.lane : lanes[Math.floor(Math.random() * lanes.length)];
        addNote(time, lane, p.type || 'tap', p.duration || 0);
      }
    };

    // ========================================
    // INTRO (bars 0-7) — "Yeah! Yeah! Yeah!"
    // Sparse, mainly LUNA lane, building energy
    // ========================================
    // Bar 0-1: Empty / buildup
    addNote(1 * bar + 0 * beat, 0); // "Yeah!"
    addNote(1 * bar + 1 * beat, 0); // "Yeah!"
    addNote(1 * bar + 2 * beat, 0); // "Yeah!"

    // Bar 2-3: "SaaS in the house, PSP on the line"
    addNote(2 * bar + 0 * beat, 0);
    addNote(2 * bar + 2 * beat, 2);
    addNote(3 * bar + 0 * beat, 0);
    addNote(3 * bar + 2 * beat, 3);

    // Bar 4-7: "Let's get it!" + buildup
    addNote(4 * bar + 0 * beat, 0);
    addNote(4 * bar + 1 * beat, 1);
    addNote(4 * bar + 2 * beat, 2);
    addNote(4 * bar + 3 * beat, 3);
    addNote(5 * bar + 0 * beat, 0);
    addNote(5 * bar + 2 * beat, 2);
    addNote(6 * bar + 0 * beat, 0);
    addNote(6 * bar + 1 * beat, 1);
    addNote(6 * bar + 2 * beat, 2);
    addNote(6 * bar + 3 * beat, 3);
    addNote(7 * bar + 0 * beat, 0);
    addNote(7 * bar + 1 * beat, 2);
    addNote(7 * bar + 2 * beat, 1);
    addNote(7 * bar + 3 * beat, 3);

    // ========================================
    // VERSE 1 (bars 8-23) — "Inbox full, late night glow"
    // Medium density, alternating lanes
    // ========================================
    for (let b = 8; b < 16; b++) {
      const l1 = b % 4;
      const l2 = (b + 2) % 4;
      addNote(b * bar + 0 * beat, l1);
      addNote(b * bar + 2 * beat, l2);
      if (b % 2 === 0) {
        addNote(b * bar + 3 * beat, (l1 + 1) % 4);
      }
    }
    // "IC++ on the table now" — slightly denser
    for (let b = 16; b < 24; b++) {
      const l1 = (b + 1) % 4;
      const l2 = (b + 3) % 4;
      addNote(b * bar + 0 * beat, l1);
      addNote(b * bar + 1 * beat, l2);
      addNote(b * bar + 2 * beat, l1);
      if (b % 2 === 1) {
        addNote(b * bar + 3 * beat, (l2 + 1) % 4);
      }
    }

    // ========================================
    // CHORUS (bars 24-39) — "Payments on Lock!"
    // High density, all 4 lanes, energetic
    // ========================================
    for (let b = 24; b < 32; b++) {
      // Strong downbeats on all lanes
      if (b % 4 === 0) {
        addNote(b * bar + 0 * beat, 0);
        addNote(b * bar + 0 * beat, 3);
      }
      addNote(b * bar + 0 * beat, b % 4);
      addNote(b * bar + 1 * beat, (b + 1) % 4);
      addNote(b * bar + 2 * beat, (b + 2) % 4);
      addNote(b * bar + 3 * beat, (b + 3) % 4);
      // Extra notes on even bars
      if (b % 2 === 0) {
        addNote(b * bar + 1.5 * beat, (b + 2) % 4);
      }
    }
    // Second half of chorus — even more intense
    for (let b = 32; b < 40; b++) {
      addNote(b * bar + 0 * beat, 0);
      addNote(b * bar + 0.5 * beat, 1);
      addNote(b * bar + 1 * beat, 2);
      addNote(b * bar + 1.5 * beat, 3);
      addNote(b * bar + 2 * beat, (b % 2 === 0) ? 0 : 2);
      addNote(b * bar + 2.5 * beat, (b % 2 === 0) ? 1 : 3);
      addNote(b * bar + 3 * beat, b % 4);
    }

    // ========================================
    // VERSE 2 (bars 40-55) — "Google Meet, cameras low"
    // Similar to verse 1 but with more variation
    // ========================================
    for (let b = 40; b < 48; b++) {
      addNote(b * bar + 0 * beat, (b) % 4);
      addNote(b * bar + 1.5 * beat, (b + 1) % 4);
      addNote(b * bar + 2 * beat, (b + 2) % 4);
      addNote(b * bar + 3.5 * beat, (b + 3) % 4);
    }
    for (let b = 48; b < 56; b++) {
      addNote(b * bar + 0 * beat, (b + 1) % 4);
      addNote(b * bar + 1 * beat, (b + 2) % 4);
      addNote(b * bar + 2 * beat, (b + 3) % 4);
      addNote(b * bar + 3 * beat, b % 4);
      if (b % 3 === 0) {
        addNote(b * bar + 0.5 * beat, (b + 3) % 4);
      }
    }

    // ========================================
    // RAP BREAK (bars 56-71) — "PCI DSS — certified"
    // Fast notes, heavy on IRIS (lane 1) lane
    // ========================================
    for (let b = 56; b < 64; b++) {
      // IRIS dominates with rapid-fire
      addNote(b * bar + 0 * beat, 1);
      addNote(b * bar + 0.5 * beat, 1);
      addNote(b * bar + 1 * beat, 1);
      addNote(b * bar + 2 * beat, (b + 1) % 4);
      addNote(b * bar + 2.5 * beat, 1);
      addNote(b * bar + 3 * beat, 1);
    }
    for (let b = 64; b < 72; b++) {
      // More varied but still fast
      addNote(b * bar + 0 * beat, 1);
      addNote(b * bar + 0.5 * beat, (b % 3));
      addNote(b * bar + 1 * beat, 1);
      addNote(b * bar + 1.5 * beat, (b % 4));
      addNote(b * bar + 2 * beat, 1);
      addNote(b * bar + 2.5 * beat, 3);
      addNote(b * bar + 3 * beat, (b + 2) % 4);
      addNote(b * bar + 3.5 * beat, 1);
    }

    // ========================================
    // BRIDGE (bars 72-79) — "Typing dots... silence loud"
    // Slow, hold notes, atmospheric
    // ========================================
    addNote(72 * bar + 0 * beat, 0, 'hold', beat * 3);
    addNote(73 * bar + 0 * beat, 2, 'hold', beat * 3);
    addNote(74 * bar + 0 * beat, 1, 'hold', beat * 2);
    addNote(74 * bar + 2 * beat, 3, 'hold', beat * 2);
    addNote(75 * bar + 0 * beat, 0, 'hold', beat * 4);
    addNote(76 * bar + 0 * beat, 2);
    addNote(76 * bar + 2 * beat, 3);
    addNote(77 * bar + 0 * beat, 1, 'hold', beat * 2);
    addNote(77 * bar + 2 * beat, 0);
    addNote(78 * bar + 0 * beat, 0);
    addNote(78 * bar + 1 * beat, 1);
    addNote(78 * bar + 2 * beat, 2);
    addNote(78 * bar + 3 * beat, 3);
    // "Approved." — dramatic single note
    addNote(79 * bar + 2 * beat, 0, 'hold', beat * 2);

    // ========================================
    // FINAL CHORUS (bars 80-95) — "Payments on Lock!" reprise
    // Maximum density — the climax
    // ========================================
    for (let b = 80; b < 88; b++) {
      addNote(b * bar + 0 * beat, 0);
      addNote(b * bar + 0 * beat, 3);
      addNote(b * bar + 0.5 * beat, 1);
      addNote(b * bar + 1 * beat, 2);
      addNote(b * bar + 1.5 * beat, 0);
      addNote(b * bar + 2 * beat, 3);
      addNote(b * bar + 2.5 * beat, 2);
      addNote(b * bar + 3 * beat, 1);
      addNote(b * bar + 3.5 * beat, (b % 4));
    }
    for (let b = 88; b < 96; b++) {
      addNote(b * bar + 0 * beat, b % 4);
      addNote(b * bar + 0.5 * beat, (b + 1) % 4);
      addNote(b * bar + 1 * beat, (b + 2) % 4);
      addNote(b * bar + 1.5 * beat, (b + 3) % 4);
      addNote(b * bar + 2 * beat, (b + 1) % 4);
      addNote(b * bar + 2.5 * beat, (b + 2) % 4);
      addNote(b * bar + 3 * beat, (b + 3) % 4);
    }

    // ========================================
    // OUTRO (bars 96-103) — "We don't beg for access"
    // Winding down
    // ========================================
    for (let b = 96; b < 100; b++) {
      addNote(b * bar + 0 * beat, 0);
      addNote(b * bar + 2 * beat, 2);
    }
    addNote(100 * bar + 0 * beat, 0);
    addNote(100 * bar + 2 * beat, 0);
    addNote(101 * bar + 0 * beat, 0, 'hold', beat * 4);
    // Final note
    addNote(102 * bar + 0 * beat, 0, 'hold', beat * 6);

    // Sort by time
    this.notes.sort((a, b) => a.time - b.time);
    this.duration = this.notes[this.notes.length - 1].time + 3;
    this.initSections();
  }

  reset() {
    for (const note of this.notes) {
      note.hit = false;
      note.missed = false;
      note.judged = false;
    }
  }

  getVisibleNotes(currentTime, approachTime = 2.0) {
    return this.notes.filter(n => {
      const relTime = n.time - currentTime;
      return relTime > -0.5 && relTime < approachTime && !n.hit;
    });
  }

  getJudgableNotes(currentTime, lane, window = 0.200) {
    return this.notes.filter(n =>
      n.lane === lane &&
      !n.judged &&
      Math.abs(n.time - currentTime) <= window
    );
  }

  markMissedNotes(currentTime, missWindow = 0.200) {
    const missed = [];
    for (const note of this.notes) {
      if (!note.judged && !note.missed && (currentTime - note.time) > missWindow) {
        note.missed = true;
        note.judged = true;
        missed.push(note);
      }
    }
    return missed;
  }

  getTotalNotes() {
    return this.notes.length;
  }

  isComplete(currentTime) {
    if (this.notes.length === 0) return false;
    const lastNote = this.notes[this.notes.length - 1];
    return currentTime > lastNote.time + 2;
  }

  initSections() {
    const beat = 60 / this.bpm;
    const bar = beat * 4;
    this.sections = [
      { name: 'INTRO',         start: 0,       end: 8 * bar  },
      { name: 'VERSE 1',       start: 8 * bar,  end: 24 * bar },
      { name: 'CHORUS',        start: 24 * bar, end: 40 * bar },
      { name: 'VERSE 2',       start: 40 * bar, end: 56 * bar },
      { name: 'RAP BREAK',     start: 56 * bar, end: 72 * bar },
      { name: 'BRIDGE',        start: 72 * bar, end: 80 * bar },
      { name: 'FINAL CHORUS',  start: 80 * bar, end: 96 * bar },
      { name: 'OUTRO',         start: 96 * bar, end: 104 * bar },
    ];
  }

  getCurrentSection(currentTime) {
    if (!this.sections.length) this.initSections();
    for (const s of this.sections) {
      if (currentTime >= s.start && currentTime < s.end) return s.name;
    }
    return '';
  }
}
