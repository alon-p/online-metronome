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

----

## License

MIT License

Copyright (c) [year] [fullname]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

