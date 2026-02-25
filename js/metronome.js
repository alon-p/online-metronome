/**
 * Metronome — Web Audio API lookahead scheduler
 *
 * Based on Chris Wilson's "A Tale of Two Clocks":
 * https://web.dev/audio-scheduling/
 *
 * A setInterval fires every LOOKAHEAD_INTERVAL ms and schedules any beats
 * that fall within the next SCHEDULE_AHEAD_TIME seconds using AudioContext
 * timestamps, giving sample-accurate timing independent of UI thread jank.
 */
class Metronome {
  constructor() {
    // Scheduler config
    this.SCHEDULE_AHEAD_TIME = 0.1;  // seconds to look ahead
    this.LOOKAHEAD_INTERVAL  = 25;   // ms between scheduler ticks

    // Oscillator config
    this.FREQ_ACCENT   = 1500; // Hz — first beat of measure
    this.FREQ_NORMAL   = 1000; // Hz — all other beats
    this.CLICK_DURATION = 0.03; // seconds

    // User-facing state
    this._bpm             = 120;
    this._beatsPerMeasure = 4;
    this._volume          = 0.8;
    this._subdivision     = 1; // clicks per beat (1=quarter, 2=eighth, 3=triplet, 4=sixteenth)

    // Internal runtime state
    this._audioCtx       = null;
    this._intervalId     = null;
    this._nextBeatTime   = 0;  // AudioContext time of next scheduled click
    this._currentBeat    = 0;  // 0-based beat within measure
    this._currentSubdiv  = 0;  // 0-based subdivision within beat

    // UI hook — called with the 0-based beat index just before it sounds
    this.onBeat = null;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  get bpm() { return this._bpm; }
  set bpm(value) {
    this._bpm = Math.min(300, Math.max(20, Math.round(value)));
  }

  get beatsPerMeasure() { return this._beatsPerMeasure; }
  set beatsPerMeasure(value) {
    this._beatsPerMeasure = value;
    this._currentBeat = 0;
  }

  get volume() { return this._volume; }
  set volume(value) {
    this._volume = Math.min(1, Math.max(0, value));
  }

  get subdivision() { return this._subdivision; }
  set subdivision(value) {
    this._subdivision    = Math.max(1, Math.floor(value));
    this._currentSubdiv  = 0;
  }

  get isRunning() { return this._intervalId !== null; }

  start() {
    if (this.isRunning) return;
    this._ensureAudioContext();

    const ctx = this._audioCtx;
    // Safari/iOS may suspend the context until triggered by a user gesture
    if (ctx.state === 'suspended') ctx.resume();

    this._currentBeat   = 0;
    this._currentSubdiv = 0;
    // Use the context's own hardware latency as the offset so the first beat
    // is scheduled just far enough in the future to be played without being
    // dropped, with no perceptible delay.
    this._nextBeatTime  = ctx.currentTime + (ctx.baseLatency || 0.01);
    this._schedule(); // schedule immediately so the first beat is never missed
    this._intervalId    = setInterval(() => this._schedule(), this.LOOKAHEAD_INTERVAL);
  }

  stop() {
    if (!this.isRunning) return;
    clearInterval(this._intervalId);
    this._intervalId = null;
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  _ensureAudioContext() {
    if (!this._audioCtx) {
      // webkitAudioContext for older Safari
      const AC = window.AudioContext || window.webkitAudioContext;
      this._audioCtx = new AC();
    }
  }

  _schedule() {
    const ctx           = this._audioCtx;
    const scheduleUntil = ctx.currentTime + this.SCHEDULE_AHEAD_TIME;

    while (this._nextBeatTime < scheduleUntil) {
      this._scheduleClick(this._currentBeat, this._currentSubdiv, this._nextBeatTime);
      this._advanceBeat();
    }
  }

  _scheduleClick(beat, subdiv, time) {
    const ctx      = this._audioCtx;
    const isAccent = beat === 0 && subdiv === 0;
    const isBeat   = subdiv === 0;

    // Accent: 1500 Hz | beat: 1000 Hz | subdivision: 600 Hz
    let freq;
    if (isAccent)      freq = this.FREQ_ACCENT;
    else if (isBeat)   freq = this.FREQ_NORMAL;
    else               freq = 600;

    // Subdivisions are quieter so they don't overwhelm the beat clicks
    const subdivVolume = isBeat ? this._volume : this._volume * 0.45;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    const vol = Math.max(subdivVolume, 0.0001);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + this.CLICK_DURATION);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + this.CLICK_DURATION);

    // Fire the UI callback at the right wall-clock moment (beat clicks only)
    if (subdiv === 0) {
      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      setTimeout(() => {
        if (this.onBeat) this.onBeat(beat);
      }, delayMs);
    }
  }

  _advanceBeat() {
    // Each tick is one subdivision; advance beat counter on each full beat
    this._nextBeatTime  += (60 / this._bpm) / this._subdivision;
    this._currentSubdiv  = (this._currentSubdiv + 1) % this._subdivision;
    if (this._currentSubdiv === 0) {
      this._currentBeat = (this._currentBeat + 1) % this._beatsPerMeasure;
    }
  }
}
