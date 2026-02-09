// FINPOP Rhythm Game — Input Handler
// Handles keyboard (D/F/J/K) and multi-touch input

export class InputHandler {
  constructor() {
    this.keys = {};
    this.prevKeys = {};
    this.touches = new Map(); // touchId -> lane
    this.prevTouches = new Set();
    this.currentTouches = new Set();
    this.laneCount = 4;
    this.isMobile = false;
    this.canvas = null;

    // Key bindings: lanes 0-3
    this.keyMap = {
      'd': 0, 'D': 0,
      'f': 1, 'F': 1,
      'j': 2, 'J': 2,
      'k': 3, 'K': 3,
      // Arrow keys as alternative
      'ArrowLeft': 0,
      'ArrowDown': 1,
      'ArrowUp': 2,
      'ArrowRight': 3,
    };

    this.anyKeyPressed = false;
    this.spacePressed = false;
    this.prevSpacePressed = false;
    this.escPressed = false;
  }

  init(canvas) {
    this.canvas = canvas;
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Keyboard events
    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      if (e.key === ' ') {
        this.spacePressed = true;
        e.preventDefault();
      }
      if (e.key === 'Escape') this.escPressed = true;
      this.anyKeyPressed = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
      if (e.key === ' ') this.spacePressed = false;
    });

    // Touch events
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.anyKeyPressed = true;
      for (const touch of e.changedTouches) {
        const lane = this.getTouchLane(touch);
        if (lane >= 0) {
          this.touches.set(touch.identifier, lane);
          this.currentTouches.add(lane);
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        const lane = this.touches.get(touch.identifier);
        if (lane !== undefined) {
          this.currentTouches.delete(lane);
        }
        this.touches.delete(touch.identifier);
      }
    }, { passive: false });

    canvas.addEventListener('touchcancel', (e) => {
      for (const touch of e.changedTouches) {
        const lane = this.touches.get(touch.identifier);
        if (lane !== undefined) {
          this.currentTouches.delete(lane);
        }
        this.touches.delete(touch.identifier);
      }
    });

    // Mouse click for desktop (title screen etc.)
    canvas.addEventListener('mousedown', () => {
      this.anyKeyPressed = true;
    });

    // Click/tap for any interaction
    canvas.addEventListener('click', () => {
      this.anyKeyPressed = true;
    });
  }

  getTouchLane(touch) {
    if (!this.canvas) return -1;
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const laneWidth = rect.width / this.laneCount;
    const lane = Math.floor(x / laneWidth);
    return Math.max(0, Math.min(this.laneCount - 1, lane));
  }

  isLanePressed(lane) {
    // Check keyboard
    for (const [key, mappedLane] of Object.entries(this.keyMap)) {
      if (mappedLane === lane && this.keys[key]) return true;
    }
    // Check touch
    return this.currentTouches.has(lane);
  }

  isLaneJustPressed(lane) {
    const currentlyPressed = this.isLanePressed(lane);
    const wasPreviouslyPressed = this.prevLaneStates ? this.prevLaneStates[lane] : false;
    return currentlyPressed && !wasPreviouslyPressed;
  }

  isAnyJustPressed() {
    const result = this.anyKeyPressed;
    return result;
  }

  isSpaceJustPressed() {
    return this.spacePressed && !this.prevSpacePressed;
  }

  update() {
    // Store CURRENT lane states as "previous" for next frame's just-pressed detection.
    // This must capture the actual current state, not a delayed version.
    this.prevLaneStates = [];
    for (let i = 0; i < this.laneCount; i++) {
      this.prevLaneStates[i] = this.isLanePressed(i);
    }

    this.prevKeys = { ...this.keys };
    this.prevTouches = new Set(this.currentTouches);
    this.prevSpacePressed = this.spacePressed;
    this.anyKeyPressed = false;
    this.escPressed = false;
  }

  consumeAnyKey() {
    const was = this.anyKeyPressed;
    this.anyKeyPressed = false;
    return was;
  }

  getActiveLanes() {
    const lanes = [];
    for (let i = 0; i < this.laneCount; i++) {
      if (this.isLaneJustPressed(i)) lanes.push(i);
    }
    return lanes;
  }
}
