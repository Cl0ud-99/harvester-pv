# NEXT STEPS — v0.0.1 handoff

State: `main` is green, build works, single-file `HARVESTER-PV.html` is current.

## Build / verify loop

```bash
npm run build     # esbuild -> dist/app.js
npm run serve     # http://localhost:5199  (NOT 5173 — another Vite app owns it)
node tools/shot.mjs --out shots/x.png --eval "__cinema.jump(0,0.5)" --wait 1600 --settle 1200
npm run pack      # inline everything -> HARVESTER-PV.html
```

Debug hooks: `__app`, `__cinema`, `__setCam([x,y,z],[tx,ty,tz],fov)`, `__setTime(t)`, `__probe(x,y,z)` (downward raycast), `__fps`.

## Do next, in order

1. **Volumetric light** (only item left from the lighting pass). Needs: depth render target, half-res raymarch (16 steps), 1-sample-per-step depth occlusion, sun screen pos + visibility (already computed in `main.js` frame loop). Insert before `Bloom` in `composer`.
2. **TAA** — Halton jitter on the projection matrix + history buffer, reset on shot change.
3. **Planar reflection on the deck** — mirror camera, half-res, render only `harvester` + `station`.
4. **Dry soil ring** outside the moss belt still borrows the grass texture and reads too bright/wet. Needs its own texture or a vertex-colour break.
5. **Crown plating** — the crown is still simple; the reference has layered panel stacks.

## Hard-won gotchas (do not re-learn these)

- **Never edit JS through `bash -c` with backticks** — the shell eats template literals and silently corrupts `main.js`. Use a written `.py` patch file or the patch tool.
- **Full-arc annuli**: two `absarc` calls sharing endpoints collapse to a solid disc after earcut. Full rings must use `shape.holes`. This is what hid the lava well for several passes.
- **`CylinderGeometry(..., false)`** is capped — a 82 m radius capped cylinder becomes an invisible floor over the whole station.
- **Post order**: ACES belongs in `OutputPass`; grade the sRGB result. Putting ACES inside the grade pass crushes everything.
- **Loft winding**: `lib/loft.js` auto-flips by signed volume; don't hand-fix normals elsewhere.
- **Metalness 0.9 with nothing to reflect renders black** — that is why the backlit truss looked dead. Lower metalness, raise albedo.
- **DOF must be off in roam**; `setRoam()` already forces `cinema.state.active = false` and `bokeh.enabled = false`.
- Port **5199**, not 5173.

## Known limits

- Trees are stacked-cone impostors; readable as geometry inside ~5 m. A card-based pass looked better in silhouette but cost 2× the frame time and was reverted (`flora.js` history).
- 24 point lights. Adding more will flatten the shading and cost fill rate.
- No LODs anywhere; forest is chunked into 200 m cells for culling.
