/**
 * mobile.js — Mobile browser resilience for the metronome.
 *
 * Handles three problems:
 *  1. Screen auto-lock kills audio  → Wake Lock API keeps the screen on while playing.
 *  2. Manual screen lock kills audio → Silent looping <audio> keeps the audio session alive.
 *  3. AudioContext gets suspended    → visibilitychange + statechange handlers recover timing.
 *
 * Call initMobile(metronome) from main.js after initUI(metronome).
 */

function initMobile(metronome) {

  // ─── 1. Wake Lock ────────────────────────────────────────────────────────────

  let wakeLock = null;

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {
      console.warn('Wake lock failed:', e);
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  }

  // ─── 2. Silent audio — keeps iOS/Android audio session alive ─────────────────
  //
  // A looping silent <audio> element signals to the OS that audio is "in
  // progress", preventing the WebAudio AudioContext from being suspended when
  // the screen locks manually. Must be started inside a user gesture.
  //
  // Minimal 1-second silent WAV (44100 Hz, mono, 16-bit PCM), base64-encoded.

  const SILENT_WAV =
    'data:audio/wav;base64,' +
    'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  const silentAudio = document.createElement('audio');
  silentAudio.src = SILENT_WAV;
  silentAudio.loop = true;
  silentAudio.volume = 0;
  silentAudio.setAttribute('playsinline', '');

  // ─── 3. AudioContext recovery ────────────────────────────────────────────────

  function recoverPlayback() {
    const ctx = metronome._audioCtx;
    if (!ctx) return;

    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      ctx.resume();
    }

    // Reset scheduler timing to "now" so it doesn't try to catch up on
    // beats that were missed while the screen was locked.
    if (metronome.isRunning) {
      metronome._nextBeatTime = ctx.currentTime + (ctx.baseLatency || 0.01);
    }
  }

  function hookAudioContextRecovery() {
    const ctx = metronome._audioCtx;
    if (!ctx || ctx._mobileHooked) return;
    ctx._mobileHooked = true;

    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'running' && metronome.isRunning) {
        // Context just resumed (e.g. after phone call ended).
        // Reset timing so the scheduler doesn't try to catch up.
        metronome._nextBeatTime = ctx.currentTime + (ctx.baseLatency || 0.01);
      }
    });
  }

  // Re-acquire wake lock and recover audio when the tab becomes visible again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && metronome.isRunning) {
      recoverPlayback();
      requestWakeLock();
    }
  });

  // ─── Lifecycle hooks ─────────────────────────────────────────────────────────

  metronome.onStart = () => {
    hookAudioContextRecovery();
    silentAudio.play().catch(() => {});
    requestWakeLock();
  };

  metronome.onStop = () => {
    silentAudio.pause();
    releaseWakeLock();
  };
}
