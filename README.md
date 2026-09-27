# Ash Corridor

A one-level browser first-person shooter. You move through a dark metal service tunnel and fight original low-poly aliens with a rapid energy rifle.

The art, audio, and names in this game are original. It does not use Doom or id Software sprites, WADs, audio, or trademarks.

## Run

From this directory, start a static server:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 in a desktop browser.

Any static file server works. The page loads Three.js as an ES module from a CDN, and pointer lock needs a page served over http rather than opened as a `file://` URL.

## Controls

- Click the start overlay to capture the mouse
- `W` and `S` to move forward and back
- `A` and `D` to turn left and right
- Mouse to look
- `Shift` to run
- Left click to fire energy bolts
- `R` to reload a magazine that is not already full
- `Esc` to release the mouse
- Restart on the win and lose screens

## Goal

You start with a loaded rifle, some armor, and full health. Green health packs, blue ammo cells, and metal armor plates are on the floor. Aliens chase you, slide along walls, and hit you up close. Clear all eight to win. The run ends at 0 health.
