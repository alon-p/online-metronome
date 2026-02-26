/**
 * ui.js — DOM bindings and UI update helpers.
 *
 * Exports a single `initUI(metronome)` function that wires every control to
 * the Metronome instance and sets up the beat-indicator animation.
 */

function initUI(metronome) {
  // ─── Element refs ──────────────────────────────────────────────────────────
  const startStopBtn    = document.getElementById('start-stop');
  const tapTempoBtn     = document.getElementById('tap-tempo');
  const bpmValueEl      = document.getElementById('bpm-value');
  const bpmSlider       = document.getElementById('bpm-slider');
  const bpmUpBtn        = document.getElementById('bpm-up');
  const bpmDownBtn      = document.getElementById('bpm-down');
  const beatIndicator   = document.getElementById('beat-indicator');
  const beatDisplay     = document.getElementById('beat-display');
  const beatsPerMeasure = document.getElementById('beats-per-measure');
  const timeSigSelect    = document.getElementById('time-sig');
  const volumeSlider     = document.getElementById('volume');
  const subdivSelect     = document.getElementById('subdivision');
  const presetsList      = document.getElementById('presets-list');
  const themeToggleBtn   = document.getElementById('theme-toggle');

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function updateBpmDisplay(bpm) {
    bpmValueEl.textContent = bpm;
    bpmSlider.value = bpm;
  }

  function setBpm(bpm) {
    metronome.bpm = bpm;
    updateBpmDisplay(metronome.bpm);
    localStorage.setItem('bpm', metronome.bpm);
  }

  function flashBeat(beat) {
    const isAccent = beat === 0;
    beatDisplay.textContent = beat + 1;

    // Trigger CSS pulse animation by toggling a class
    beatIndicator.classList.remove('pulse', 'pulse-accent');
    // Force reflow so the browser restarts the animation
    void beatIndicator.offsetWidth;
    beatIndicator.classList.add(isAccent ? 'pulse-accent' : 'pulse');
  }

  // ─── Start / Stop ──────────────────────────────────────────────────────────

  startStopBtn.addEventListener('click', () => {
    if (metronome.isRunning) {
      metronome.stop();
      startStopBtn.textContent = 'Start';
      startStopBtn.classList.remove('running');
      beatDisplay.textContent = '1';
      beatIndicator.classList.remove('pulse', 'pulse-accent');
    } else {
      // Ensure AudioContext exists and is resumed within the user gesture.
      // resume() is async but start() schedules 100 ms ahead, giving enough
      // time for the context to become running before the first beat plays.
      metronome._ensureAudioContext();
      metronome._audioCtx.resume();
      metronome.start();
      startStopBtn.textContent = 'Stop';
      startStopBtn.classList.add('running');
    }
  });

  // ─── BPM controls ──────────────────────────────────────────────────────────

  bpmUpBtn.addEventListener('click', () => setBpm(metronome.bpm + 1));
  bpmDownBtn.addEventListener('click', () => setBpm(metronome.bpm - 1));

  bpmSlider.addEventListener('input', () => setBpm(Number(bpmSlider.value)));

  // Allow clicking the BPM number to type a value directly
  bpmValueEl.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = 20;
    input.max = 300;
    input.value = metronome.bpm;
    input.className = 'bpm-edit-input';

    bpmValueEl.replaceWith(input);
    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const val = Number(input.value);
      if (!isNaN(val)) setBpm(val);
      input.replaceWith(bpmValueEl);
      updateBpmDisplay(metronome.bpm);
    };

    const cancel = () => {
      if (committed) return;
      committed = true;
      input.replaceWith(bpmValueEl);
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') cancel();
    });
  });

  // ─── Time signature ────────────────────────────────────────────────────────

  timeSigSelect.addEventListener('change', () => {
    const beats = Number(timeSigSelect.value);
    metronome.beatsPerMeasure = beats;
    beatsPerMeasure.textContent = beats;
    beatDisplay.textContent = '1';
  });

  // ─── Volume ────────────────────────────────────────────────────────────────

  volumeSlider.addEventListener('input', () => {
    metronome.volume = Number(volumeSlider.value);
  });

  // ─── Tap tempo ─────────────────────────────────────────────────────────────

  const tapTimes = [];
  const TAP_RESET_MS = 2000; // reset tap sequence after 2 s of silence

  tapTempoBtn.addEventListener('click', () => {
    const now = Date.now();

    // Reset if too much time has passed since the last tap
    if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > TAP_RESET_MS) {
      tapTimes.length = 0;
    }

    tapTimes.push(now);

    if (tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapTimes.length; i++) {
        intervals.push(tapTimes[i] - tapTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(Math.round(60000 / avgInterval));
    }
  });

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    // Ignore when user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        startStopBtn.click();
        break;
      case 'ArrowUp':
        e.preventDefault();
        setBpm(metronome.bpm + 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setBpm(metronome.bpm - 1);
        break;
      case 't':
      case 'T':
        tapTempoBtn.click();
        break;
    }
  });

  // ─── Subdivisions ──────────────────────────────────────────────────────────

  subdivSelect.addEventListener('change', () => {
    metronome.subdivision = Number(subdivSelect.value);
    localStorage.setItem('subdivision', subdivSelect.value);
  });

  // ─── Presets ───────────────────────────────────────────────────────────────

  presetsList.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset-btn');
    if (!btn) return;
    setBpm(Number(btn.dataset.bpm));
  });

  // ─── Theme toggle ──────────────────────────────────────────────────────────

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggleBtn.textContent = theme === 'light' ? '☾' : '☀';
    localStorage.setItem('theme', theme);
  }

  themeToggleBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
  });

  // ─── localStorage — restore saved state ────────────────────────────────────

  const savedBpm = localStorage.getItem('bpm');
  if (savedBpm) setBpm(Number(savedBpm));

  const savedTimeSig = localStorage.getItem('timeSig');
  if (savedTimeSig) {
    timeSigSelect.value = savedTimeSig;
    metronome.beatsPerMeasure = Number(savedTimeSig);
    beatsPerMeasure.textContent = savedTimeSig;
  }

  const savedSubdiv = localStorage.getItem('subdivision');
  if (savedSubdiv) {
    subdivSelect.value = savedSubdiv;
    metronome.subdivision = Number(savedSubdiv);
  }

  const savedVolume = localStorage.getItem('volume');
  if (savedVolume) {
    volumeSlider.value = savedVolume;
    metronome.volume = Number(savedVolume);
  }

  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);

  timeSigSelect.addEventListener('change', () => {
    localStorage.setItem('timeSig', timeSigSelect.value);
  });

  volumeSlider.addEventListener('input', () => {
    localStorage.setItem('volume', volumeSlider.value);
  });

  // ─── Beat callback ─────────────────────────────────────────────────────────

  metronome.onBeat = flashBeat;

  // ─── iOS audio unlock ──────────────────────────────────────────────────────
  // iOS Safari suspends AudioContext until a user gesture. Pre-warm it on the
  // first touch so it's ready when Start is pressed.
  document.addEventListener('touchstart', () => {
    metronome._ensureAudioContext();
    const ctx = metronome._audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
  }, { once: true });
}
