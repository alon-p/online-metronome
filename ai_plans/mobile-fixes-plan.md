# Mobile Browser Fixes — Implementation Plan

## Problems to Solve

1. **Screen lock kills audio** — On mobile browsers, when the screen locks (auto-lock or power button), the `setInterval` scheduler gets suspended and Web Audio stops producing sound.
2. **Start button breaks after screen lock** — After the screen locks and unlocks, pressing "Start" flashes momentarily but produces no sound and stops. The `AudioContext` is left in a `suspended` or `interrupted` state, and the scheduler's timing references (`_nextBeatTime`) are stale.
3. **Mobile code should live in its own file** — All mobile-specific logic should be isolated in `js/mobile.js` for maintainability.

---

## Solution Design

### New file: `js/mobile.js`

A single `initMobile(metronome)` function (mirroring the `initUI(metronome)` pattern) that is called from `main.js`. It handles everything below.

---

### 1. Keep the Screen Awake (Wake Lock API)

**What:** Use the [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) to prevent the device from sleeping while the metronome is playing.

**How:**

```js
let wakeLock = null;

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {
      // Wake lock request failed (e.g. low battery, tab not visible)
      console.warn('Wake lock failed:', e);
    }
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}
```

**Integration points:**
- Call `requestWakeLock()` when the metronome starts.
- Call `releaseWakeLock()` when the metronome stops.
- Re-acquire the wake lock on `visibilitychange` → `visible` (the browser releases wake locks when the page becomes hidden, so we must re-request when it comes back).

**Browser support:** Chrome Android 84+, Safari iOS 16.4+, Firefox Android 126+. Covers the vast majority of mobile users. On older browsers, the call silently does nothing thanks to the `'wakeLock' in navigator` guard.

---

### 2. Keep Audio Alive During Brief Screen Locks (Silent Audio Fallback)

The Wake Lock API prevents screen dimming, but the user can still manually lock the screen (power button). When that happens, `setInterval` is throttled/killed by the OS.

**What:** Use a looping silent `<audio>` element to signal to the browser that audio playback is "in progress," which keeps the audio session alive on iOS and Android even when the screen is off. This is the same technique used by apps like Spotify to keep playing in the background.

**How:**

- Generate a short (~1 second) silent WAV as a base64 data URI (tiny, no network request).
- Create an `<audio>` element with `loop=true`.
- When the metronome starts, call `silentAudio.play()`.
- When the metronome stops, call `silentAudio.pause()`.

```js
function createSilentAudio() {
  const audio = document.createElement('audio');
  // Minimal 1-second silent WAV, base64-encoded (~7 KB)
  audio.src = 'data:audio/wav;base64,...'; // generated silent WAV
  audio.loop = true;
  audio.volume = 0;               // fully silent
  audio.setAttribute('playsinline', '');
  return audio;
}
```

**Why this works:** Mobile browsers (especially iOS Safari) allow audio to continue in the background as long as an active `<audio>` or `<video>` element is playing. The Web Audio API alone does not get this privilege, but an `<audio>` element does — and once the audio session is kept alive, the Web Audio API's `AudioContext` is not interrupted either.

**iOS caveat:** The `<audio>` element must be started from a user gesture. We will `.play()` it inside the same click handler that starts the metronome, which satisfies this requirement.

---

### 3. Recover Gracefully After AudioContext Interruption

Even with the above, there are edge cases (phone call interrupts, OS kills the tab, Bluetooth headphone disconnect) where the `AudioContext` gets suspended or the scheduler timing drifts.

**What:** Add a `visibilitychange` listener and an `AudioContext.onstatechange` handler that detect when the context has been interrupted and robustly restart the scheduler.

**How — `visibilitychange` handler:**

```js
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && metronome.isRunning) {
    recoverPlayback();
    requestWakeLock(); // re-acquire (browser releases it when hidden)
  }
});
```

**How — `recoverPlayback()` function:**

```js
function recoverPlayback() {
  const ctx = metronome._audioCtx;
  if (!ctx) return;

  // Resume the AudioContext if it was suspended/interrupted
  if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
    ctx.resume();
  }

  // The setInterval scheduler may have been killed or drifted.
  // Reset the scheduler timing to "now" so it resumes immediately
  // without trying to catch up on missed beats.
  metronome._nextBeatTime = ctx.currentTime + (ctx.baseLatency || 0.01);

  // If the interval was killed (some browsers do this), restart it
  if (metronome._intervalId === null && metronome.isRunning) {
    // isRunning is true but intervalId is null — this shouldn't happen
    // in normal flow, but as a safety net:
    metronome._intervalId = setInterval(
      () => metronome._schedule(),
      metronome.LOOKAHEAD_INTERVAL
    );
  }
}
```

**How — `onstatechange` handler (set once when AudioContext is created):**

The `Metronome` class's `_ensureAudioContext()` already creates the context. We will hook `onstatechange` after the context is created:

```js
function hookAudioContextRecovery() {
  const ctx = metronome._audioCtx;
  if (!ctx || ctx._mobileHooked) return;
  ctx._mobileHooked = true;

  ctx.addEventListener('statechange', () => {
    if (ctx.state === 'running' && metronome.isRunning) {
      // Context just resumed (e.g. after phone call ended).
      // Reset scheduler timing so it doesn't try to "catch up".
      metronome._nextBeatTime = ctx.currentTime + (ctx.baseLatency || 0.01);
    }
  });
}
```

This will be called from `initMobile()` after the AudioContext is first created, and also from the start-button click handler.

---

### 4. Fix the "Start Doesn't Work" Bug

The root cause: after a screen lock/unlock cycle, `AudioContext.resume()` returns a promise that hasn't resolved yet when `metronome.start()` runs. The scheduler sees `ctx.currentTime` as 0 or stale, schedules beats in the past, and the oscillators never play.

**Fix in `js/mobile.js`:**

Wrap the start flow to await `resume()` before scheduling:

```js
// In initMobile(), monkey-patch or wrap the start-stop click handler
// to properly await AudioContext resumption.

async function safeStart() {
  metronome._ensureAudioContext();
  const ctx = metronome._audioCtx;
  hookAudioContextRecovery();

  if (ctx.state !== 'running') {
    await ctx.resume();
  }

  // Now that context is confirmed running, start the scheduler
  metronome.start();
  silentAudio.play().catch(() => {});
  requestWakeLock();
}

function safeStop() {
  metronome.stop();
  silentAudio.pause();
  releaseWakeLock();
}
```

**Integration:** `initMobile()` will replace the start/stop click listener that `ui.js` sets up. To avoid modifying `ui.js`, we expose a hook: `initMobile()` will set a `metronome.onStartStop` callback pair, and `ui.js` will call them if present. Alternatively (simpler), `initMobile()` can simply add its own listener on the start-stop button that fires alongside the existing one — the wake lock / silent audio / recovery logic doesn't conflict with the existing UI toggling.

**Chosen approach:** `initMobile()` will override the click handler on `#start-stop` by removing the old listener and adding a new one that includes both the UI logic and the mobile-safe start/stop. This keeps `ui.js` unchanged but means the click handler now lives partly in `mobile.js`. To keep it clean, we will extract the UI toggle into a small exported helper from `ui.js` that both files can use.

**Revised approach (simplest, least invasive):** Add lifecycle hooks to the `Metronome` class — `onStart` and `onStop` callbacks — that fire after start/stop. `initMobile()` subscribes to these hooks. `ui.js` remains unchanged. The hooks are called from `Metronome.start()` and `Metronome.stop()`.

---

## Changes Per File

### `js/metronome.js` (minor additions)
- Add `this.onStart = null` and `this.onStop = null` callback properties.
- Call `this.onStart?.()` at the end of `start()`.
- Call `this.onStop?.()` at the end of `stop()`.
- Make `start()` accept an optional pre-resolved AudioContext (or just ensure `_nextBeatTime` is set after resume, not before).

### `js/ui.js` (minor change)
- In the start-stop click handler, `await` the `ctx.resume()` call before calling `metronome.start()`. Change:
  ```js
  metronome._audioCtx.resume();
  ```
  to:
  ```js
  await metronome._audioCtx.resume();
  ```
  And make the click handler `async`.

### `js/mobile.js` (new file)
Contains `initMobile(metronome)` with:
- Wake Lock acquire/release.
- Silent `<audio>` element creation and play/pause.
- `visibilitychange` listener for recovery + wake lock re-acquisition.
- `AudioContext.onstatechange` hook for timing recovery.
- All helper functions described above.

### `index.html`
- Add `<script src="js/mobile.js"></script>` before `main.js`.

### `js/main.js`
- Add `initMobile(metronome);` call after `initUI(metronome)`.

---

## Implementation Order

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1 | Add `onStart`/`onStop` lifecycle hooks to `Metronome` class | `metronome.js` | ✅ Done |
| 2 | Make the start-stop handler `async` and `await ctx.resume()` | `ui.js` | ✅ Done |
| 3 | Create `js/mobile.js` with `initMobile()` — wake lock, silent audio, recovery logic | `mobile.js` | ✅ Done |
| 4 | Wire up `mobile.js` in `index.html` and `main.js` | `index.html`, `main.js` | ✅ Done |
| 5 | Test on iOS Safari and Chrome Android — verify audio persists through screen lock, start always works after unlock | — | ⬜ Pending |

---

## Testing Checklist

- [ ] Start metronome → screen should not auto-lock (wake lock active)
- [ ] Manually lock screen → audio continues playing
- [ ] Unlock screen → metronome is still running, beat indicator is in sync
- [ ] Press Start after a screen lock/unlock cycle → metronome starts immediately with sound
- [ ] Stop metronome → screen can auto-lock again (wake lock released)
- [ ] Incoming phone call interrupts audio → after call, metronome resumes cleanly
- [ ] Works on iOS Safari 16.4+, Chrome Android, Firefox Android
- [ ] Desktop browsers are unaffected (all mobile code is guarded)
