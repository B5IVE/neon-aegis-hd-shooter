# NEON AEGIS — HD Arcade Space Shooter

A high-DPI 60FPS HTML5 Canvas arcade twin-stick space shooter built with **vanilla JavaScript, CSS3, and procedural Web Audio synthesis**—with zero external asset dependencies.

## Features

- **Retina / High-DPI Rendering:** Automatically scales canvas resolution to `devicePixelRatio` with glow shaders, parallax starfields, shockwave rings, and screen-shake feedback.
- **Procedural Web Audio Synthesizer:** Real-time laser, explosion, pickup, and Overdrive Nova sound effects generated via the Web Audio API (no external `.mp3`/`.wav` files required).
- **Escalating Waves & Enemy Classes:** Features Chasers, high-speed Dashers, armored Tanks, weapon spread upgrades, combo score multipliers up to `8.0x`, and Overdrive Nova screen-clears.

## Controls

- **Move:** `W A S D` or `Arrow Keys`
- **Aim & Fire:** `Mouse` + `Left Click` (or `Space`)
- **Overdrive Nova (at 100%):** `Shift`, `E`, or `Right Click`
- **Pause / Resume:** `P`

## Quickstart

Run directly by opening `index.html` in a modern browser, or serve via Vite:

```bash
npm install
npm run dev
