# Online Metronome - Project Plan

## Overview

A static webpage metronome that runs entirely in the browser. No backend, no build tools — just HTML, CSS, and JavaScript. The user can set a BPM, start/stop the metronome, hear an audible click on each beat, and see a visual pulse.

## Tech Stack

- **HTML5** — structure
- **CSS3** — styling and animations
- **Vanilla JavaScript** — logic, timing, and Web Audio API for sound
- No frameworks, no bundlers, no dependencies

## Features

### Core (MVP)
- BPM control (range: 20–300 BPM)
- Start / Stop button
- Audible click using the Web Audio API (oscillator-generated tone, no external audio files)
- Visual beat indicator (pulse/flash on each beat)
- Tap tempo — tap a button repeatedly to set BPM from your tapping rhythm

### Enhanced
- Time signature selection (e.g. 4/4, 3/4, 6/8)
- Accent on the first beat of each measure (different tone pitch/volume)
- Beat counter display showing current beat within the measure
- Keyboard shortcuts (Space = start/stop, Up/Down = adjust BPM)
- Volume control
- Responsive design (works on desktop and mobile)

### Nice-to-Have
- Subdivisions (eighth notes, triplets)
- Preset tempos (Largo, Andante, Allegro, Presto, etc.)
- Dark/light theme toggle
- Save last-used BPM in localStorage

## Architecture

```
index.html          — single page, all markup
css/
  style.css         — layout, theme, animations
js/
  metronome.js      — Metronome class (audio scheduling, timing)
  ui.js             — DOM bindings, event listeners, UI updates
  main.js           — entry point, wires everything together
```

### Audio Approach

Use the **Web Audio API** with a lookahead scheduler (as described by Chris Wilson's "A Tale of Two Clocks") to avoid timing drift from `setInterval` alone:

1. A `setInterval` fires frequently (~25ms) to check if any beats need scheduling.
2. Beats are scheduled ahead of time using `AudioContext.currentTime` for sample-accurate timing.
3. Each beat is a short oscillator burst (e.g. 1000 Hz for normal beats, 1500 Hz for accented beats).

This gives rock-solid timing regardless of UI thread jank.

## Steps

| # | Step | Status |
|---|------|--------|
| 1 | Create project file structure (`index.html`, `css/style.css`, `js/metronome.js`, `js/ui.js`, `js/main.js`) | Done |
| 2 | Implement `Metronome` class with Web Audio API scheduling (start, stop, BPM, time signature) | Done |
| 3 | Build HTML layout (BPM display, controls, beat indicator) | Done |
| 4 | Wire up UI event listeners and DOM updates in `ui.js` and `main.js` | Done |
| 5 | Add CSS styling — clean, centered layout with beat pulse animation | Done |
| 6 | Implement tap tempo | Done |
| 7 | Add time signature selection and accented first beat | Done |
| 8 | Add keyboard shortcuts (Space, Up/Down arrows) | Done |
| 9 | Add volume control | Done |
| 10 | Make responsive (mobile-friendly) | Done |
| 11 | Test across browsers (Chrome, Firefox, Safari) and fix edge cases | Done |
| 12 | Optional: subdivisions, presets, theme toggle, localStorage | Done |

## Design Notes

- Minimal, distraction-free UI — the metronome should feel like a tool, not an app
- Large, readable BPM number front and center
- Beat indicator should be visually obvious (color flash or scaling pulse)
- Controls should be accessible with one hand on mobile