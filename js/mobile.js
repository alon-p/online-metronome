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
  // Build the WAV buffer programmatically to guarantee a valid file.

  function buildSilentWavUrl() {
    // 46-byte WAV: RIFF/WAVE/fmt /data headers + 1 silent 16-bit PCM sample
    const buf  = new ArrayBuffer(46);
    const view = new DataView(buf);
    // RIFF chunk
    view.setUint32(0,  0x52494646, false); // "RIFF"
    view.setUint32(4,  38,         true);  // chunk size = file size - 8
    view.setUint32(8,  0x57415645, false); // "WAVE"
    // fmt sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16,         true);  // sub-chunk size
    view.setUint16(20, 1,          true);  // PCM
    view.setUint16(22, 1,          true);  // mono
    view.setUint32(24, 44100,      true);  // sample rate
    view.setUint32(28, 88200,      true);  // byte rate (44100 * 1 * 2)
    view.setUint16(32, 2,          true);  // block align
    view.setUint16(34, 16,         true);  // bits per sample
    // data sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, 2,          true);  // data size (1 sample = 2 bytes)
    view.setInt16(44,  0,          true);  // silent sample
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  const silentAudio = document.createElement('audio');
  silentAudio.src = buildSilentWavUrl();
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
