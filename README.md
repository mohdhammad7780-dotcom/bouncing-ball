# Bouncing Ball

A browser-based neon bouncing-ball physics simulation. Balls bounce inside a rotating ring with an open gap; whenever a ball escapes, three more balls spawn. Build up to the 1,000-ball finale.

## Run locally

This is a static web app and does not require a build step or package installation.

From the project directory, start a local server:

```powershell
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in a browser. You can also open `index.html` directly, though a local server is recommended.

## Controls

- **Pause / Resume**: pause or resume the simulation.
- **+3 Balls** and **+50 Balls**: add balls manually.
- **1,000 Finale**: trigger the finale immediately.
- **Reset** or **Play Again**: restart the simulation.
- **Tap for Sound**: enable synthesized sound effects. Audio requires a user interaction.
- **Space**: toggle pause.
- **R**: reset.
- **M**: toggle sound.

## Project files

- `index.html` — page structure and controls.
- `style.css` — responsive layout and neon visual styling.
- `script.js` — canvas rendering, physics, controls, and Web Audio sound effects.
