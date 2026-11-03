# NEXT STEPS — v0.0.10 handoff

State: `main` is green, build works, single-file `HARVESTER-PV.html` is current.
**2026-11-04 — volumetric light + TAA + deck planar reflection + dry soil ring landed.**

## Build / verify loop

```bash
npm run build     # esbuild -> dist/app.js
npm run serve     # http://localhost:5199  (NOT 5173 — another Vite app owns it)
node tools/shot.mjs --out shots/x.png --eval "__cinema.jump(0,0.5)" --wait 1600 --settle 1200
npm run pack      # inline everything -> HARVESTER-PV.html
```

Debug hooks: `__app`, `__cinema`, `__setCam([x,y,z],[tx,ty,tz],fov)`, `__setTime(t)`, `__probe(x,y,z)` (downward raycast), `__fps`.
Volumetric toggle: `__app.post.volumetric.enabled = false`; TAA toggle: `__app.post.taa.enabled = false`; deck reflection strength: `__app.deckReflection.uniforms.uReflectionStrength.value = 0`; live tuning: `__app.post.volumetric.volumeMaterial.uniforms.uDensity.value = 0.0004`.

## Done this pass

1. **Volumetric light** — depth render target on the composer scene RT; half-res 16-step raymarch inserted before `Bloom`; one camera-depth occlusion sample per step plus one sun-shadow-map sample per step; sun direction/visibility/colour fed from the `main.js` frame loop. Code in `src/lib/post.js` (`VolumetricLightPass`), tuning defaults `uDensity 0.00055`, `uIntensity 0.85`.
2. **TAA** — Halton(2,3) sub-pixel jitter on the projection matrix, 16-frame sequence; history reprojection from scene depth with neighbourhood clamping; reset on shot cuts, roam changes, FOV changes and resize. Code in `src/lib/post.js` (`TAAPass`), wired in `src/main.js` (`applyTaaJitter`) and `src/cinema.js`.
3. **Deck planar reflection** — mirror camera on the y=0 deck plane with oblique near-plane clipping; half-res HDR target renders only layer-2 objects (`harvester` + `station` + sky); `deckVC` samples it projectively with a Fresnel term. Code in `src/lib/reflection.js`, wired in `src/main.js`.
4. **Dry soil ring** — generated a dedicated ochre/gravel/crack texture (`dryGroundSet` in `textures.js`); terrain has an `aDry` vertex attribute starting around 265 m that mixes the dry map over the moss ground map and raises roughness to 0.95. Code in `textures.js`, `materials.js`, `terrain.js`.
5. **Deck/ground/emitter polish** — first deck uses a 2×2 brushed-metal plate texture (`deckMetalSet`) with metalness 0.62; second-level saucer uses a finer 4×4 subtle metal map (seam lines doubled), outer reach radius 99.84→84.86 m (−15%), thickness 7.2→5.04→4.536→3.1752 m (bottom fixed), an outward 3.0 m hard bevel (reduced from 8.25 m so it no longer fights neighbouring geometry) with bevelSegments 1 + flatShading, a raised 4-band × 28-sector armour plate grid with recessed seams on the top face, plus a yellow paint ring aligned with the central concentric recessed seam and another centred yellow line on the sloped chamfer face; a self-lit textured underliner lifts the previously black underside; the dark underplate was removed so the lower bevel stays readable. Upper-deck material reflection halved (metalness 0.29 / envMap 0.45 / clearcoat 0.15). Ground normal scale 0.28→0.42 (+50%); emitter lip widened to 7.8 m; the molten core now stops at y=200 instead of poking through the plinth as an orange band. Deck planar reflection strength 0.55→0.385 (−30%).
6. **Grass belt** — moss mask outer fade 196→270 m, then 270→373 m; keeping the inner edge at the station skirt, the visible green area has roughly doubled twice (4× the original), and the dry ring followed outward. Code in `terrain.js`.
7. **First deck expansion** — `SET.ringR` 82→94.5 m (deck annulus area +50%); gantry arms, field modules, beacon, cargo, pipes and forest clearings all shifted outward by the deck delta. Code in `terrain.js`, `ring.js`, `props.js`, `flora.js`.

8. **Crown layered armour** — three overlapping octagonal plate stacks (y≈164–207) with recessed separation and blue trim rings, sitting outside the original crown drum. Code in `harvester.js`.
9. **v0.0.9 performance pass** — sun shadow map 4096→2048 and now refreshes only on cuts/explicit time scrubs; unused basalt-butte generator/dead fascia removed; 7 underdeck point lights removed after testing showed they did not reach the underside; per-frame `Vector3`/`Color` allocations in the time-of-day and sun-projection paths removed. 1600×900 headless measurements: 204–439 FPS across shots (well above the 60 FPS target), no frame-time spikes from shadow-map rebuilds.
10. **Static resolution cap** — internal drawing buffer is capped at 3200×1800; 4K/5K canvases upscale from that fixed buffer instead of changing resolution at runtime. Measured 4K ≈77 FPS / 5K ≈92 FPS headless, with no resize hitches or auto-quality oscillation.

## Do next, in order

- None for v0.0.9. Re-benchmark on the target GPU before starting a new art pass.

## Hard-won gotchas (do not re-learn these)

- **Never edit JS through `bash -c` with backticks** — the shell eats template literals and silently corrupts `main.js`. Use a written `.py` patch file or the patch tool.
- **Full-arc annuli**: two `absarc` calls sharing endpoints collapse to a solid disc after earcut. Full rings must use `shape.holes`. This is what hid the lava well for several passes.
- **`CylinderGeometry(..., false)`** is capped — a 82 m radius capped cylinder becomes an invisible floor over the whole station.
- **Post order**: ACES belongs in `OutputPass`; grade the sRGB result. Putting ACES inside the grade pass crushes everything.
- **Loft winding**: `lib/loft.js` auto-flips by signed volume; don't hand-fix normals elsewhere.
- **Metalness 0.9 with nothing to reflect renders black** — that is why the backlit truss looked dead. Lower metalness, raise albedo.
- **DOF must be off in roam**; `setRoam()` already forces `cinema.state.active = false` and `bokeh.enabled = false`.
- Port **5199**, not 5173.
- **Volumetric depth target**: `EffectComposer` must be constructed with a `WebGLRenderTarget` that has a `DepthTexture`; `RenderPass` writes to `readBuffer`, so both composer targets need the depth texture (clone does this).
- **Sun shadow map is RGBA-packed**: sample `sun.shadow.map.texture` with `unpackRGBAToDepth()` (from `#include <packing>`) and transform by `sun.shadow.matrix`. Copy the matrix in the frame loop *before* `composer.render()` — it is one frame late, which is fine.
- **Shadows are deliberately throttled** to 2048² and refreshed only on cut / explicit scrub. Do not set `shadowDirty` from continuous `app.setTime` calls or the 4k-equivalent rebuild will reintroduce periodic hitches.
- **Volumetric pass is half-res**: keep its own RT at 0.5× and composite it back additively; do not let it inherit the composer pixel ratio twice.
- **TAA must not swap buffers**: it writes its resolve back into the composer `readBuffer` with `needsSwap = false` so the scene depth attachment survives for the volumetric pass. Disable `renderer.autoClear` for the copy or the depth dies and volumetrics turn black.
- **TAA jitter order**: apply the Halton offset after `cinema.update()` / `updateRoam()` so the shot camera's own `updateProjectionMatrix()` does not wipe the jitter. Reset history on every hard camera cut.
- **Planar reflection layers**: render only layer 2 (`harvester` + `station` + sky + lights). Keep the `deckVC` mesh off layer 2, otherwise its fragment shader samples the render target it is currently writing into.
- **Reflection camera projection**: `PlanarReflection.render()` calls `camera.updateProjectionMatrix()` to strip the previous frame's TAA jitter before copying the projection; `applyTaaJitter()` then re-applies jitter for the main pass. Do not reorder these.
- **Reflection is a half-res extra scene pass** (~45 draw calls); keep it off in LQ via `app.applyQuality()`.
- **Dry ring uses a vertex attribute**: `aDry` must exist on the merged terrain geometry before `computeVertexNormals`; the ground material hook reads `vMapUv`, so keep `USE_MAP` enabled or the mix stays inert.

## Known limits

- Trees are stacked-cone impostors; readable as geometry inside ~5 m. A card-based pass looked better in silhouette but cost 2× the frame time and was reverted (`flora.js` history).
- 24 point lights. Adding more will flatten the shading and cost fill rate.
- No LODs anywhere; forest is chunked into 200 m cells for culling.
- Volumetric pass is a screen-space approximation: rays are occluded by camera depth and the sun shadow map, so isolated thin geometry can still leak; density is deliberately conservative to protect the golden-hour palette.
- TAA has no motion vectors (static-world reprojection only): fast foliage sway and the energy beam can ghost slightly; neighbour clamping keeps it in check. It also softens high-frequency armour detail a little.
- Deck reflection is a planar mirror, not SSR: it reflects only layer-2 objects (tower/station/sky), and the deck's existing roughness map still controls the underlying PBR. Strength is 0.385 (was 0.55) so the first-layer deck keeps its metal read without washing out.
