# Online Metronome

A lightweight, browser-based metronome — no installation, no backend, no dependencies. Just open `index.html` and play.

## Features

- BPM control (20–300) via slider, +/− buttons, or click-to-type
- Start / Stop with keyboard shortcut (`Space`)
- Tap Tempo (`T` key or button)
- Time signatures: 2/4, 3/4, 4/4, 6/8
- Subdivisions: quarter notes, eighth notes, triplets, sixteenth notes
- Accented first beat (distinct pitch and visual flash)
- Volume control
- Preset tempos (Largo → Presto)
- Dark / light theme toggle
- Saves your last settings in `localStorage`
- Responsive — works on desktop and mobile

## Usage

Open `index.html` in any modern browser. No build step required.

### Keyboard shortcuts

| Key       | Action       |
|-----------|--------------|
| `Space`   | Start / Stop |
| `↑` / `↓` | BPM +1 / −1  |
| `T`       | Tap Tempo    |

## Tech

Plain HTML, CSS, and JavaScript. Audio timing uses the Web Audio API with a lookahead scheduler for drift-free clicks.

## About

This project was primarily coded by an AI agent (Claude, by Anthropic), with human direction and review.

