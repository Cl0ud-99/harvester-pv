# HARVESTER — Apex-style Megastructure

## About

A single-scene, real-time environment study of the Hammond Robotics **Harvester** from Apex Legends'
World's Edge — rebuilt from reference stills in Three.js with no external assets.

Everything you see is generated at load: the armour plating and its panel lines, the rust truss cage,
the basalt buttes, the moss belt, ~7 000 conifers, the field modules and the stencilled decals.
The scene runs as a six-shot cinematic with a time-of-day slider, plus free explore, first-person
walk and free-fly modes.

**Scope** — 220 m tower, 184 m span, 82 m saucer station, a 48 m open lava shaft, 2.6 km of terrain.
**Status** — v0.0.1, playable vertical slice. Modelling detail and atmosphere work continue.
**Not** — a game, a plugin, or a pre-rendered film. One HTML file that opens by double-click.

A real-time, single-scene study of a **Hammond Robotics Harvester**: a 220 m armoured tower with four splayed legs, a molten core, a 1.6 km energy beam, and a saucer station built over an open lava shaft — sitting in a forested volcanic rift.

Built with Three.js and hand-written shaders. No external assets: every texture, tree, rock and decal is generated procedurally at load.

![01 ARRIVAL](docs/shots/01-arrival.png)

> Real-time stylised environment, not pre-rendered CG. 1600×900 · 60–120 fps · ~2.9 M triangles.

---

## Open it

Double-click **`HARVESTER-PV.html`** — single file, fully offline, no server required.

Development:

```bash
npm install
npm run build      # esbuild bundle -> dist/app.js
npm run serve      # http://localhost:5199
npm run shot       # headless screenshot
npm run pack       # inline everything into HARVESTER-PV.html
```

## Controls

| Key | Action |
|---|---|
| `Space` | Play / pause the film |
| `1`–`6` | Jump to a shot |
| `←` `→` | Previous / next shot |
| `E` | Explore (orbit) |
| `V` | First-person walk |
| `F` | Free fly |
| `C` / `Q` | Descend (fly mode) |
| `D` | Toggle depth of field |
| `H` | Hide HUD |
| `Esc` | Release pointer |

The time slider walks the palette from afternoon through golden hour, dusk and night.

## Shots

| | |
|---|---|
| ![01](docs/shots/01-arrival.png) | ![02](docs/shots/02-tower.png) |
| ![03](docs/shots/03-deck.png) | ![05](docs/shots/05-arm.png) |
| ![06](docs/shots/06-harvest.png) | ![board](docs/shots/contact-sheet.png) |

Details: [well catwalks](docs/shots/detail-well.png) · [decals](docs/shots/detail-decals.png)

## What is in the scene

- **Tower** — 8-sided armoured column, four arms with a second outer skin and seam brackets, wide crown, rust truss cage, 8.4 m molten core, 1 600 m additive energy beam. 220 m tall, 184 m span.
- **Station** — 82 m lathe-turned saucer, blue hull band, lower catwalk ring, yellow pipe runs with capped ends, 2 maintenance rings inside the shaft, 14 practical lights.
- **Terrain** — 2.6 km heightfield (420²) with a two-stage foothill-to-ridge profile, a noise-warped moss belt, and 34 chunked basalt butte clusters.
- **Flora** — 330 forest patches (~7 000 conifers) with baked vertical colour gradients, split into 200 m cells for frustum culling; 420 boulders.
- **Decals** — stencilled hull codes, hazard triangles, rust runs and scorch marks.

## Technical notes

1. **Custom loft winding.** Hand-built loft geometry with reversed triangle order gets back-face culled and the armour silently disappears. `lib/loft.js` computes signed volume and flips when needed.
2. **Post order matters.** ACES belongs in `OutputPass`; grading must happen after the sRGB encode. Putting ACES inside the grade pass crushes the whole frame.
3. **Full-arc annuli.** Two `absarc` calls that share endpoints collapse into a solid disc after earcut — full rings must be built with `shape.holes`.
4. **Open-ended cylinders are single-sided.** They vanish from inside; anything seen from both sides needs real thickness.
5. **Shadows need a frustum that covers the subject** — a 220 m tower with a ±190 m shadow camera leaves the top unshadowed.
6. **Metalness is not decoration.** A `metalness: 0.9` surface with nothing to reflect renders black. Backlit steel needs albedo and lower metalness, not more lights.

## Known gaps

- Armour plating is still simpler than the reference — no rivet rows or layered panel stacks on the crown.
- The dry soil ring outside the moss belt still borrows the grass texture and reads too bright.
- No TAA, no planar reflections, no volumetric light yet.
- Trees are stacked-cone impostors: fine at mid distance, readable as geometry within ~5 m.

## Layout

```
index.html / style.css        dev page + HUD
HARVESTER-PV.html             single-file build
src/main.js                   renderer, lights, time-of-day, roam, debug hooks
src/cinema.js                 six-shot data + state machine
src/hud.js                    film / explore HUD
src/lib/loft.js               lofting with automatic winding fix
src/lib/post.js               Bloom → Output(ACES) → Grade → SMAA
src/lib/materials.js          material library
src/lib/textures.js           procedural canvas textures
src/world/harvester.js        the tower
src/world/ring.js             saucer station + shaft catwalks
src/world/terrain.js          heightfield, buttes, moss belt
src/world/flora.js            forest + boulders
src/world/props.js            field modules, containers, beacon
src/world/decals.js           stencils, hazard plates, rust
src/world/lava.js             lava shader + shaft
src/world/sky.js              sky shader + time stops
tool/shot.mjs                 puppeteer capture
tools/pack.mjs                single-file packer
```
