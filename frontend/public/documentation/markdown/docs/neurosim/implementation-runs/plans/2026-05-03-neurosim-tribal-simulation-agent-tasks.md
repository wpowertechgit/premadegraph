# NeuroSim Tribal Simulation Agent Task Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the NeuroSim critical redesign into small, finishable agent tasks so one worker can complete at least one useful slice in a single 5-hour rate-limit session.

**Architecture:** The redesign is implemented as many narrow vertical slices. Each task has a hard scope boundary and must leave the app buildable/testable. Do not hand the whole critical redesign document to one worker as an implementation prompt.

**Tech Stack:** Rust/Axum/Tokio/Rayon backend, Express bridge, Vite React frontend, binary WebSocket frames, Canvas/WebGL/Three.js as selected by task, Markdown documentation.

---

## Source Documents

Workers should read only the docs needed for their task:

- Main redesign: `docs/neurosim-tribal-simulation-critical-redesign.md`
- Current implementation summary: `docs/neurosim-tribal-simulation-implementation.md`
- Current design: `docs/neurosim-tribal-simulation-design.md`
- Old NeuroSim reference project: `C:\Users\karol\OneDrive\Dokumentumok\mystuff\genetic-neurosim`
- Old interface standard: `C:\Users\karol\OneDrive\Dokumentumok\mystuff\genetic-neurosim\DESIGN.md`

## Global Agent Rules

- Do one task only.
- Do not expand scope because the redesign document is large.
- Keep the app buildable after the task.
- Add focused tests when the task touches Rust logic or protocol parsing.
- Preserve deterministic behavior where seeds or replays are involved.
- Do not move to UI before the data contract exists, unless the task is explicitly UI-only.
- Do not put Python in the live tick loop. Python is allowed for offline ML, tuning, reports, and experiments.
- Do not expose raw PUUIDs in public UI unless the task explicitly says it is internal-only.
- Do not revive retired thesis features: Temporal Consistency, Community Cohesion vs Performance, Contraction Hierarchies, or thesis-facing Signed Balance workflows.

## Completion Format For Each Agent

Every worker should finish with:

```text
Task completed: <task id and name>
Files changed:
- <path>
Validation run:
- <command> -> <result>
Notes:
- <anything intentionally deferred>
```

---

## Track A — Baseline And Guardrails

### Task A1: Prototype Limitation Banner And Routing Guard

**Goal:** Make the current tribal page clearly identify itself as a prototype so nobody mistakes it for the final NeuroSim v2.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`
- Optional docs update: `docs/neurosim-tribal-simulation-critical-redesign.md`

**Scope:**
- Add a small non-intrusive prototype label in the current page.
- Link or mention the critical redesign doc in developer-facing text only if there is an existing docs pattern.
- Do not redesign the page.

**Steps:**
- [ ] Read `frontend/src/pages/TribalSimulationPage.tsx`.
- [ ] Add a compact label: `Prototype: territory, logs, replay, and neural inspection are redesign targets`.
- [ ] Keep the label visually restrained.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- Page still renders.
- Build succeeds.
- No simulation behavior changes.

---

### Task A2: NeuroSim Route/Docs Cross-Link

**Goal:** Make future agents discover the critical redesign and task plan from existing docs.

**Files:**
- Modify: `docs/DOCUMENT_MAP.md`
- Modify: `docs/neurosim-tribal-simulation-implementation.md`
- Modify: `docs/neurosim-tribal-simulation-design.md`

**Scope:**
- Add references to:
  - `docs/neurosim-tribal-simulation-critical-redesign.md`
  - `docs/superpowers/plans/2026-05-03-neurosim-tribal-simulation-agent-tasks.md`
- Do not rewrite the old design.

**Steps:**
- [ ] Find the relevant NeuroSim entries.
- [ ] Add short notes saying the critical redesign supersedes the current prototype for future work.
- [ ] Run a Markdown link/path sanity check with `rg "neurosim-tribal-simulation-critical-redesign|agent-tasks" docs`.

**Acceptance:**
- Future agents can find the redesign and task plan from docs.
- No code changes.

---

## Track B — Backend Control And Status

### Task B1: Add Paused State To Backend Status

**Goal:** Separate `paused` from `halted` in the Rust simulation state.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/main.rs`

**Scope:**
- Add `paused: bool`.
- Include `paused` in `StatusResponse`.
- Simulation loop should not call `step()` while paused.
- Do not add frontend controls yet.

**Steps:**
- [ ] Add `paused: bool` to `TribeSimulation`.
- [ ] Initialize `paused` to `false`.
- [ ] Add `paused: bool` to `StatusResponse`.
- [ ] Add methods `pause()`, `resume()`, and `is_paused()`.
- [ ] Update `simulation_loop` so paused sends current frame and sleeps like halted or at a safe interval.
- [ ] Run `cargo check` in `backend/genetic-neurosim/backend`.

**Acceptance:**
- `/api/status` includes `paused`.
- Existing behavior is unchanged when `paused=false`.
- `cargo check` passes.

---

### Task B2: Add Pause And Resume Endpoints

**Goal:** Expose backend pause/resume controls.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/main.rs`
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/neurosim-bridge.js` only if proxy path handling blocks the routes

**Scope:**
- Add:
  - `POST /api/control/pause`
  - `POST /api/control/resume`
- Return status after each action.
- Do not add step/reset yet.

**Steps:**
- [ ] Confirm Task B1 exists.
- [ ] Add Axum routes.
- [ ] Add handlers that call `pause()` and `resume()`.
- [ ] Test manually with `curl` or PowerShell `Invoke-RestMethod` if the backend is running.
- [ ] Run `cargo check`.

**Acceptance:**
- Pause and resume endpoints compile.
- Status response reflects pause state.

---

### Task B3: Add Step Tick Endpoint

**Goal:** Allow one deterministic tick while paused.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/main.rs`

**Scope:**
- Add `POST /api/control/step-tick`.
- If paused, advance exactly one tick.
- If halted, do not advance.
- Return updated status or a compact response.
- Do not implement step generation.

**Steps:**
- [ ] Add `step_once_when_paused()` or equivalent.
- [ ] Ensure it calls the same `step()` path used by the live loop.
- [ ] Add endpoint handler.
- [ ] Run `cargo check`.

**Acceptance:**
- A paused simulation can advance one tick.
- Halted simulation remains halted.

---

### Task B4: Add Reset Same Seed Endpoint

**Goal:** Restart the current run with the same seed and current config.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/main.rs`

**Scope:**
- Add `POST /api/control/reset`.
- Reuse existing `reinitialize()` behavior where possible.
- Preserve current `world_seed`.
- Do not add new-seed restart yet.

**Steps:**
- [ ] Add `reset_same_seed()` method that clears tick/generation/events/runtime state.
- [ ] Add endpoint handler.
- [ ] Ensure current clusters remain loaded.
- [ ] Run `cargo check`.

**Acceptance:**
- Reset returns tick/generation to zero.
- Seed remains unchanged.
- Clusters remain available.

---

### Task B5: Add New Seed Restart Endpoint

**Goal:** Restart the run with a caller-provided seed.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/main.rs`

**Scope:**
- Add `POST /api/control/restart-seed`.
- Body shape: `{ "world_seed": 123 }`.
- Reinitialize world and tribes.
- Do not change dataset.

**Steps:**
- [ ] Add request struct in Rust.
- [ ] Add method to set seed and reinitialize.
- [ ] Add route and handler.
- [ ] Run `cargo check`.

**Acceptance:**
- New seed changes world generation.
- Status/config reports the new seed.

---

## Track C — Old NeuroSim Cockpit UI Recovery

### Task C1: Extract Old NeuroSim Design Tokens Into PremadeGraph CSS

**Goal:** Create a local CSS token layer matching the old NeuroSim `DESIGN.md`.

**Files:**
- Modify: `frontend/src/index.css`
- Optional create: `frontend/src/neurosimTheme.ts`

**Scope:**
- Add CSS variables/classes for:
  - black background
  - spectral white
  - ghost button background/border
  - uppercase cockpit labels
  - translucent overlay panel
- Do not redesign the page yet.

**Steps:**
- [ ] Read old `DESIGN.md`.
- [ ] Add `.neurosim-cockpit`, `.neurosim-panel`, `.neurosim-label`, `.neurosim-ghost-button`.
- [ ] Use ASCII class names.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- Build succeeds.
- Existing app styling is not broken.

---

### Task C2: Replace Current Tribal Page Shell With Full-Screen Cockpit Layout

**Goal:** Make the current page full-screen and cockpit-like without changing simulation data.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Keep existing WebSocket parser.
- Keep existing canvas drawing.
- Reframe layout:
  - full-screen dark page
  - left live session panel
  - right controls panel
  - top toolbar with visible panel-toggle buttons
- Do not add new backend features.

**Steps:**
- [ ] Apply CSS classes from Task C1.
- [ ] Move current counters into a live-session overlay.
- [ ] Move tick slider/God Mode into a control panel.
- [ ] Make canvas fill available space while preserving draw correctness.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- Page feels closer to old NeuroSim cockpit.
- No protocol changes.
- Build succeeds.

---

### Task C3: Add Panel Toggle Toolbar And Reset View Placeholder

**Goal:** Restore old NeuroSim-style top toolbar panel controls.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Add toggles for:
  - Controls
  - Events
  - Analytics
  - Sessions
- `Reset View` can reset canvas pan/zoom only if pan/zoom exists; otherwise omit the button in this task.
- Do not implement analytics content yet.

**Steps:**
- [ ] Add panel visibility state.
- [ ] Add toolbar buttons using NeuroSim ghost button style.
- [ ] Gate existing controls panel behind toggle.
- [ ] Add collapsed panel toggles for future Events/Analytics/Sessions without rendering empty panels.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- Toolbar works.
- Panels can be shown/hidden.

---

### Task C4: Add Frontend Pause/Resume Buttons

**Goal:** Wire UI to backend pause/resume once Tasks B1-B2 exist.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Add pause/resume buttons.
- Fetch `/api/neurosim/api/control/pause` and `/api/neurosim/api/control/resume`.
- Display paused state from status if available.
- Do not add step/reset.

**Steps:**
- [ ] Add status polling or extend existing state to include `paused`.
- [ ] Add pause/resume click handlers.
- [ ] Add button state based on `paused`.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- User can pause/resume from UI.
- Build succeeds.

---

### Task C5: Add Frontend Step Tick And Reset Controls

**Goal:** Wire UI to backend step/reset once Tasks B3-B4 exist.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Add:
  - Step Tick
  - Reset Same Seed
- Do not add new seed form unless B5 exists.

**Steps:**
- [ ] Add buttons in control panel.
- [ ] Call `/api/neurosim/api/control/step-tick`.
- [ ] Call `/api/neurosim/api/control/reset`.
- [ ] Refresh status after calls.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- Controls call backend successfully.
- Build succeeds.

---

## Track D — Dynamic World Generation

### Task D1: Add WorldGenerationConfig Struct

**Goal:** Separate world generation settings from hardcoded constants.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/world.rs`
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- Create a `WorldGenerationConfig` struct.
- Include:
  - seed
  - tribe_count
  - total_initial_population
  - target_tiles_per_tribe
  - target_population_density
  - min_tiles
- Keep current 40x40 behavior as default output for now.

**Steps:**
- [ ] Add struct to `world.rs`.
- [ ] Add constructor `WorldGenerationConfig::from_clusters(seed, clusters)`.
- [ ] Add tests for config derivation if Rust test structure is available.
- [ ] Run `cargo test` or `cargo check`.

**Acceptance:**
- World generation config exists.
- No visible behavior change required.

---

### Task D2: Derive Dynamic Grid Dimensions

**Goal:** Replace fixed 40x40 sizing with computed width/height.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/world.rs`
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- `WorldGrid` should store `grid_w`, `grid_h`, and `total_tiles`.
- Keep tile IDs stable as row-major indices.
- Do not convert to hex yet.

**Steps:**
- [ ] Replace uses of `GRID_W`, `GRID_H`, `TOTAL_TILES` inside `WorldGrid` methods with instance fields.
- [ ] Keep public constants for compatibility if frontend still assumes 40x40.
- [ ] Derive dimensions from `WorldGenerationConfig`.
- [ ] Run `cargo check`.

**Acceptance:**
- Backend supports variable grid dimensions internally.
- Existing default still works.

---

### Task D3: Expose World Dimensions In Status

**Goal:** Let frontend and agents know the generated map dimensions.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- Add `world_width_tiles`, `world_height_tiles`, `total_tiles`, and `world_seed` to status or a nested world summary.
- Do not add WebSocket snapshot yet.

**Steps:**
- [ ] Add serializable world summary.
- [ ] Populate from `WorldGrid`.
- [ ] Run `cargo check`.

**Acceptance:**
- `/api/status` includes generated world dimensions.

---

## Track E — Protocol Snapshots And Typed Frontend State

### Task E1: Add Protocol Version Header For New Messages

**Goal:** Introduce a versioned message envelope without removing the old frame.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Define constants for protocol version and message types.
- Keep current frame parser working.
- Add comments/docs for planned envelope.
- Do not switch all messages yet.

**Steps:**
- [ ] Add Rust constants: `PROTOCOL_VERSION`, `MESSAGE_TRIBE_FRAME_V0`.
- [ ] Add TS constants matching Rust.
- [ ] Document current legacy frame as V0.
- [ ] Run `cargo check`.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- No behavior change.
- Version constants exist for follow-up tasks.

---

### Task E2: Add World Snapshot REST Endpoint

**Goal:** Provide full map data through a simple endpoint before binary snapshot work.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/main.rs`

**Scope:**
- Add `GET /api/world-snapshot`.
- Return JSON:
  - width
  - height
  - seed
  - tiles with biome and food metadata
- This can be slower JSON because it is not per-tick.

**Steps:**
- [ ] Add serializable snapshot structs.
- [ ] Add `world_snapshot()` method.
- [ ] Add Axum route and handler.
- [ ] Run `cargo check`.

**Acceptance:**
- Endpoint returns biome data.
- Frontend can consume it in a later task.

---

### Task E3: Frontend Fetches And Draws World Snapshot

**Goal:** Stop assuming every tile is plains.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Fetch `/api/neurosim/api/world-snapshot`.
- Populate biome and food arrays from backend.
- Draw actual biomes.
- Keep existing live food delta parsing.

**Steps:**
- [ ] Add `WorldSnapshot` TypeScript type.
- [ ] Fetch snapshot on mount.
- [ ] Populate `biomeRef` and `foodRef`.
- [ ] Use snapshot dimensions if available, but keep fallback 40x40.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- Map shows real biome colors from backend.
- Build succeeds.

---

### Task E4: Add Tile Ownership Snapshot Endpoint

**Goal:** Provide enough data to draw territory.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/main.rs`

**Scope:**
- Add `GET /api/tile-ownership`.
- Return tile owner array or compact list:
  - tile id
  - owner tribe id
  - contested flag if already available
- Do not implement owner deltas yet.

**Steps:**
- [ ] Add `tile_ownership_snapshot()` method.
- [ ] Build ownership from current tribe territories.
- [ ] Add route.
- [ ] Run `cargo check`.

**Acceptance:**
- Frontend can know which tiles belong to which tribe.

---

### Task E5: Frontend Draws Territory Ownership

**Goal:** Fill the existing `tribeTerritory` map and render owned tiles.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Fetch `/api/neurosim/api/tile-ownership`.
- Assign stable colors per tribe id.
- Tint owned tiles.
- Do not implement hex rendering yet.

**Steps:**
- [ ] Add ownership fetch after world snapshot.
- [ ] Populate `tribeTerritory.current`.
- [ ] Generate stable color per tribe.
- [ ] Draw territory tint above biome and below tribe markers.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- Owned territories are visible on current square grid.
- This is a stepping stone before hexes.

---

## Track F — Hex Map Migration

### Task F1: Add Hex Coordinate Utility Module In Frontend

**Goal:** Prepare hex rendering without touching backend.

**Files:**
- Create: `frontend/src/neurosimHex.ts`
- Test if existing setup supports it: `frontend/src/neurosimHex.test.ts`

**Scope:**
- Add axial coordinate helpers:
  - `tileIdToAxial`
  - `axialToPixel`
  - `hexCorners`
- Do not change page rendering yet.

**Steps:**
- [ ] Create helper module.
- [ ] Add simple tests if test runner exists.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- Helpers compile.
- No UI changes.

---

### Task F2: Render Square Grid As Hex-Like Frontend Layer

**Goal:** Replace square tiles visually with hexes while keeping backend tile IDs.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`
- Modify: `frontend/src/neurosimHex.ts`

**Scope:**
- Use current row-major tile IDs.
- Convert them to offset/axial-like positions for drawing.
- Draw hex polygons for biome/territory.
- Do not change backend world representation.

**Steps:**
- [ ] Add `drawHexTile(ctx, tileId, fill)` helper.
- [ ] Replace `fillRect` tile drawing with hex polygon drawing.
- [ ] Adjust canvas bounds.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- Map visually reads as hex territory.
- Existing WebSocket data still works.

---

### Task F3: Backend Hex Neighbor Abstraction

**Goal:** Prepare simulation logic for six-neighbor territory decisions.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/world.rs`

**Scope:**
- Add `hex_adjacent_tiles(index)` alongside existing 4-neighbor method.
- Do not replace all users yet.
- Add small tests if possible.

**Steps:**
- [ ] Implement offset-row hex neighbors.
- [ ] Test corner, edge, and center tile neighbor counts.
- [ ] Run `cargo test` or `cargo check`.

**Acceptance:**
- Hex neighbor helper exists and is safe at edges.

---

## Track G — Per-Tribe Logging And Events

### Task G1: Define SimulationEvent Types

**Goal:** Add typed event records without emitting them yet.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Optional create: `backend/genetic-neurosim/backend/src/events.rs`
- Modify: `backend/genetic-neurosim/backend/src/main.rs` if adding module

**Scope:**
- Define:
  - event id
  - tick
  - generation
  - event type
  - severity
  - tribe id
  - other tribe id
  - tile id
  - numeric payloads
- Do not wire UI yet.

**Steps:**
- [ ] Create compact Rust event structs/enums.
- [ ] Use numeric IDs and compact enums.
- [ ] Add serialization for REST/debug.
- [ ] Run `cargo check`.

**Acceptance:**
- Event types compile.
- No behavior change.

---

### Task G2: Add Global And Per-Tribe Event Buffers

**Goal:** Store recent events globally and per tribe.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Optional modify: `backend/genetic-neurosim/backend/src/events.rs`

**Scope:**
- Add bounded ring buffers or VecDeque.
- Keep extinct tribe logs.
- Do not emit many event types yet.

**Steps:**
- [ ] Add `events` storage to simulation.
- [ ] Add per-tribe event index/storage.
- [ ] Add helper `push_event(event)`.
- [ ] Ensure two-tribe events can index into both journals.
- [ ] Run `cargo check`.

**Acceptance:**
- Events can be stored without unbounded growth.

---

### Task G3: Emit Lifecycle Events

**Goal:** Start logs with spawn, generation, extinction, and reset events.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- Emit:
  - tribe spawned
  - generation advanced
  - tribe extinct
  - simulation reset
- Do not log every tick.

**Steps:**
- [ ] Push spawn events in `initialize_tribes()`.
- [ ] Push generation events in generation boundary.
- [ ] Push extinction when `alive` flips false.
- [ ] Push reset event in reset/reinitialize path.
- [ ] Run `cargo check`.

**Acceptance:**
- Per-tribe journals have lifecycle entries.

---

### Task G4: Add Events REST Endpoint

**Goal:** Let frontend fetch global and per-tribe logs.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/main.rs`
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- Add:
  - `GET /api/events/recent`
  - `GET /api/tribes/:id/events`
- Return JSON for now.

**Steps:**
- [ ] Add methods for recent events and tribe events.
- [ ] Add Axum routes.
- [ ] Run `cargo check`.

**Acceptance:**
- Event logs are queryable.
- Extinct tribe logs remain queryable if event storage exists.

---

### Task G5: Frontend Global Event Log Panel

**Goal:** Add a global event log panel.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Fetch `/api/neurosim/api/events/recent`.
- Render compact list.
- Poll every 1-2 seconds.
- Do not build filters yet.

**Steps:**
- [ ] Add event type.
- [ ] Add fetch function.
- [ ] Render in Events panel from Task C3 or a simple panel.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- User can see recent events.

---

### Task G6: Frontend Selected Tribe Journal Panel

**Goal:** Show logs for a selected tribe.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Add selected tribe state if not present.
- Click tribe marker to select.
- Fetch `/api/neurosim/api/tribes/:id/events`.
- Show journal.

**Steps:**
- [ ] Add click handling on canvas for nearest tribe marker.
- [ ] Store selected tribe id.
- [ ] Fetch selected tribe events.
- [ ] Render journal in Tribe/Events panel.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- User can click a tribe and view that tribe's event journal.

---

## Track H — Tribe Inspection

### Task H1: Add Tribe Snapshot Endpoint

**Goal:** Provide selected tribe details.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/main.rs`

**Scope:**
- Add `GET /api/tribes/:id`.
- Include:
  - id
  - cluster id
  - population
  - food
  - behavior
  - territory count
  - target
  - ally
  - stats
  - latest inputs/outputs
- Do not include full genome graph yet.

**Steps:**
- [ ] Add serializable selected tribe snapshot.
- [ ] Add method.
- [ ] Add route.
- [ ] Run `cargo check`.

**Acceptance:**
- A selected tribe can be inspected via REST.

---

### Task H2: Frontend Tribe Dossier Panel

**Goal:** Show selected tribe state in the UI.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Fetch endpoint from H1.
- Render compact dossier.
- Include latest inputs/outputs as numeric rows.
- Do not design the full Brain tab yet.

**Steps:**
- [ ] Reuse selected tribe id from G6 if present.
- [ ] Fetch tribe snapshot.
- [ ] Render population, food, state, territory, target/ally, stats.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- User can click a tribe and see its current state.

---

## Track I — Neural / Genetic Mechanics Visibility

### Task I1: Define Canonical Tribe Brain Schema

**Goal:** Document and encode brain input/output labels.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/tribes.rs`
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Optional docs: `docs/neurosim-tribal-simulation-critical-redesign.md`

**Scope:**
- Define input labels matching current 8 inputs.
- Define output labels matching current 3 outputs.
- Do not add more inputs/outputs yet.

**Steps:**
- [ ] Add constants for input/output count and labels.
- [ ] Use constants instead of hardcoded `8` and `3` where practical.
- [ ] Include labels in tribe snapshot endpoint if H1 exists.
- [ ] Run `cargo check`.

**Acceptance:**
- Brain schema is explicit and inspectable.

---

### Task I2: Stop Recompiling Genome Every Tick If Unchanged

**Goal:** Reduce CPU waste in neural inference.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/tribes.rs`

**Scope:**
- Investigate current `genome.compile()` inside tick path.
- Add caching only if it can be done narrowly.
- Do not rewrite NEAT.

**Steps:**
- [ ] Locate genome compile call in state machine.
- [ ] Add a cached compiled brain field or a minimal cache invalidated on mutation.
- [ ] Ensure mutation invalidates cache.
- [ ] Run `cargo check`.
- [ ] Add timing note if measurable.

**Acceptance:**
- Brain inference avoids unnecessary repeated compile work.

---

### Task I3: Log Neural Decisions For Major Actions

**Goal:** Put neural decisions into per-tribe logs.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Depends on: G1-G3

**Scope:**
- Log only major state/action changes, not every tick.
- Include input/output summary values.

**Steps:**
- [ ] When behavior changes, emit event with previous state, next state, and output drives.
- [ ] Include tribe id and tick/generation.
- [ ] Ensure event appears in per-tribe journal.
- [ ] Run `cargo check`.

**Acceptance:**
- Tribe journals explain why state changed.

---

### Task I4: Brain Tab In Frontend

**Goal:** Show selected tribe brain inputs/outputs.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Add Brain section or tab.
- Show input labels/values and output labels/values.
- Do not render neural graph topology.

**Steps:**
- [ ] Extend tribe snapshot type.
- [ ] Render inputs and outputs as compact rows.
- [ ] Highlight largest output drive.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- User can inspect a tribe's current neural decision state.

---

### Task I5: Mutation Event Logging

**Goal:** Log generation mutation events per tribe.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Depends on: G1-G3

**Scope:**
- On generation boundary, log mutation occurred.
- Include mutation rate and changed high-level stats.
- Do not store full genome copies.

**Steps:**
- [ ] Capture before/after primary stat values around mutation.
- [ ] Emit compact mutation event.
- [ ] Add event to tribe journal.
- [ ] Run `cargo check`.

**Acceptance:**
- Mutation history is visible without memory explosion.

---

## Track J — Intervention Toolkit

### Task J1: Define Intervention Request Types

**Goal:** Replace single-purpose God Mode with typed intervention API shapes.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/main.rs`

**Scope:**
- Define enum/request structs for:
  - `cull_population`
  - `spawn_food`
  - `drought`
  - `mutation_pulse`
- Do not implement all effects yet.

**Steps:**
- [ ] Add request enum with serde tags.
- [ ] Add `POST /api/interventions`.
- [ ] Handler can return `501`/error for unimplemented variants except one.
- [ ] Run `cargo check`.

**Acceptance:**
- Typed intervention API exists.

---

### Task J2: Implement Cull Population Intervention

**Goal:** Rebuild existing kill-half behavior as a typed intervention.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- Support global cull percentage.
- Optional selected tribe id.
- Emit intervention event if event system exists.
- Keep old `/api/god-mode` as compatibility wrapper if desired.

**Steps:**
- [ ] Implement `CullPopulation { scope, percent }`.
- [ ] Clamp percent to safe range.
- [ ] Return count affected.
- [ ] Run `cargo check`.

**Acceptance:**
- Old behavior exists as one intervention, not the whole toolkit.

---

### Task J3: Implement Spawn Food Intervention

**Goal:** Add constructive/natural chaos intervention.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/world.rs`

**Scope:**
- Add food to a tile radius or whole map if simple.
- Emit event if available.
- Do not add frontend UI yet.

**Steps:**
- [ ] Add method `spawn_food(region, amount)`.
- [ ] Clamp food to tile max or a documented cap.
- [ ] Return changed tile count.
- [ ] Run `cargo check`.

**Acceptance:**
- Backend can create food/resource bloom.

---

### Task J4: Frontend Intervention Menu V1

**Goal:** Replace single God Mode button with menu containing cull and spawn food.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Add two buttons:
  - Cull 50%
  - Spawn Food Globally
- Call `POST /api/neurosim/api/interventions`.
- Keep simple, no modals.

**Steps:**
- [ ] Add helper `sendIntervention`.
- [ ] Replace or supplement God Mode button.
- [ ] Show action result message.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- UI supports at least one destructive and one constructive intervention.

---

## Track K — Territory Actions

### Task K1: Claim Adjacent Neutral Tile

**Goal:** Add basic non-war territory growth.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/world.rs`

**Scope:**
- Tribes in Settling/Foraging can claim one adjacent neutral tile under simple conditions.
- Do not implement contested tiles.

**Steps:**
- [ ] Add helper to find neutral adjacent tile.
- [ ] Add claim action every N ticks or when expansion drive is high.
- [ ] Update tribe territory.
- [ ] Emit event if event system exists.
- [ ] Run `cargo check`.

**Acceptance:**
- Territory can grow without extinction/absorption.

---

### Task K2: Add Tile Owner Authority In WorldGrid

**Goal:** Move ownership toward world-level arrays.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/world.rs`
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- Add `tile_owner: Vec<Option<usize>>` or compact equivalent.
- Keep tribe `territory` for compatibility.
- Synchronize on initialization and claims.

**Steps:**
- [ ] Add owner storage to `WorldGrid`.
- [ ] Initialize home tile owners.
- [ ] Update owner on claim/absorption.
- [ ] Run `cargo check`.

**Acceptance:**
- World can answer tile owner directly.

---

### Task K3: Biome Composition Per Tribe

**Goal:** Support inspection and analytics by biome.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- Add method to compute selected tribe biome breakdown.
- Include in tribe snapshot endpoint.
- Do not optimize with cache yet.

**Steps:**
- [ ] Count territory tiles by biome for selected tribe.
- [ ] Add to tribe snapshot.
- [ ] Run `cargo check`.

**Acceptance:**
- Tribe dossier can show biome composition.

---

## Track L — War Visibility

### Task L1: Define WarState Struct

**Goal:** Track active wars as first-class records.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Optional create: `backend/genetic-neurosim/backend/src/war.rs`

**Scope:**
- Define:
  - war id
  - attacker
  - defender
  - start tick
  - status
  - casualties
  - battle tile if known
- Do not rewrite combat resolution yet.

**Steps:**
- [ ] Add struct/enums.
- [ ] Add `active_wars` collection.
- [ ] Create war record when target is assigned.
- [ ] Run `cargo check`.

**Acceptance:**
- Wars are tracked independently from red state dots.

---

### Task L2: War Snapshot Endpoint

**Goal:** Expose active wars to frontend.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/main.rs`

**Scope:**
- Add `GET /api/wars/active`.
- Return active war records.

**Steps:**
- [ ] Add serializable war summary.
- [ ] Add endpoint.
- [ ] Run `cargo check`.

**Acceptance:**
- Frontend can list active wars.

---

### Task L3: Frontend Active Wars Panel

**Goal:** Show who is fighting whom.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Fetch `/api/neurosim/api/wars/active`.
- Render war list.
- Do not draw battle lines yet.

**Steps:**
- [ ] Add war type.
- [ ] Poll or fetch on panel open.
- [ ] Render attacker, defender, duration, casualties.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- War is inspectable as data, not only color.

---

## Track M — Analytics And Sessions

### Task M1: Add Tribal Metrics To Status

**Goal:** Restore old live analytics with tribal metrics.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- Add metrics:
  - living tribes
  - total population
  - total territory tiles
  - active wars
  - active alliances
  - starvation count
- Do not add charts yet.

**Steps:**
- [ ] Add `TribalMetrics` struct.
- [ ] Populate in status.
- [ ] Run `cargo check`.

**Acceptance:**
- `/api/status` includes analytics-ready tribal metrics.

---

### Task M2: Frontend Live Analytics Panel

**Goal:** Restore chart panel with simple tribal metrics.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`
- Check dependency: frontend package may already include or not include Chart.js

**Scope:**
- If Chart.js is already available, use it.
- If not, create compact text/sparkline-free metrics first.
- Track last 160 status samples.

**Steps:**
- [ ] Poll status every 1s.
- [ ] Store bounded history.
- [ ] Render metrics or chart.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- User can see live trend metrics.
- History is bounded.

---

### Task M3: Sessions Panel Restore

**Goal:** Show saved recordings in the tribal page.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`

**Scope:**
- Fetch `/api/neurosim/api/recordings`.
- Render saved sessions list.
- Call replay endpoint on click.
- Do not implement replay scrubber.

**Steps:**
- [ ] Add recording type.
- [ ] Fetch recordings every few seconds or on panel open.
- [ ] Render list.
- [ ] Wire replay button.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- Saved sessions/replay are visible again.

---

## Track N — Performance And Memory

### Task N1: Backend Performance Metrics Skeleton

**Goal:** Measure tick timing without optimizing yet.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- Track:
  - last tick duration
  - average tick duration
  - max tick duration
- Include in status.

**Steps:**
- [ ] Add timing fields.
- [ ] Measure around `step()`.
- [ ] Add metrics to status.
- [ ] Run `cargo check`.

**Acceptance:**
- Backend reports tick timing.

---

### Task N2: Frame Size Metric

**Goal:** Track binary payload size.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- Record `last_frame_bytes`.
- Include in status.
- Do not change protocol.

**Steps:**
- [ ] Set metric in `pack_current_frame()`.
- [ ] Add to status.
- [ ] Run `cargo check`.

**Acceptance:**
- Status reports last frame size.

---

### Task N3: Event Buffer Memory Bound Test

**Goal:** Ensure logs cannot grow without limit.

**Files:**
- Modify: event storage file from G2
- Add tests if Rust test setup allows

**Scope:**
- Test ring buffer capacity or bounded behavior.
- Do not add new event types.

**Steps:**
- [ ] Add a small unit test that pushes more events than capacity.
- [ ] Assert retained count is capped.
- [ ] Run `cargo test`.

**Acceptance:**
- Event memory bound is tested.

---

### Task N4: Python Boundary Documentation

**Goal:** Make Python usage rules explicit for ML agents.

**Files:**
- Create: `docs/neurosim-python-ml-boundary.md`
- Modify: `docs/neurosim-tribal-simulation-critical-redesign.md` only to link new doc

**Scope:**
- Explain allowed Python:
  - offline ML
  - tuning
  - analysis
  - report generation
- Explain caution:
  - no accidental per-tick calls
  - no Python frame packing
  - benchmark before live inference

**Steps:**
- [ ] Write concise boundary doc.
- [ ] Link it from critical redesign.
- [ ] Run `rg "neurosim-python-ml-boundary" docs`.

**Acceptance:**
- Future ML agents know Python is allowed but bounded.

---

## Track O — Validation Scenarios

### Task O1: Scenario Config Type

**Goal:** Add a way to name deterministic validation scenarios.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`

**Scope:**
- Add scenario id to config/status.
- No scenario behavior yet.

**Steps:**
- [ ] Add `scenario_id: Option<String>` or enum.
- [ ] Include in status.
- [ ] Preserve default live dataset scenario.
- [ ] Run `cargo check`.

**Acceptance:**
- Run metadata can identify scenario.

---

### Task O2: Two Tribes One Border Scenario

**Goal:** Create the smallest war/territory validation scenario.

**Files:**
- Modify: `backend/genetic-neurosim/backend/src/simulation.rs`
- Modify: `backend/genetic-neurosim/backend/src/world.rs`

**Scope:**
- If `scenario_id=two_tribes_one_border`, create two tribes and adjacent home tiles.
- Use deterministic seed.
- Do not need UI scenario selector yet.

**Steps:**
- [ ] Add branch in initialization for scenario id.
- [ ] Create two simple cluster profiles if no clusters are loaded.
- [ ] Spawn adjacent.
- [ ] Run `cargo check`.

**Acceptance:**
- Scenario exists and is deterministic.

---

### Task O3: Frontend Scenario Selector

**Goal:** Let user choose validation scenario from UI.

**Files:**
- Modify: `frontend/src/pages/TribalSimulationPage.tsx`
- Backend dependency: O1/O2

**Scope:**
- Add selector with:
  - Dataset default
  - Two tribes one border
- Restart/reset after selection.

**Steps:**
- [ ] Add select control in controls panel.
- [ ] Send config patch or dedicated scenario endpoint.
- [ ] Trigger reset.
- [ ] Run `npm --prefix frontend run build`.

**Acceptance:**
- User can run small deterministic validation scenario.

---

## Recommended Build Order

This order gives visible wins while protecting architecture:

1. A2 — docs cross-link
2. B1 — paused state
3. B2 — pause/resume endpoints
4. C1 — design tokens
5. C2 — cockpit shell
6. C4 — pause/resume UI
7. D1 — world generation config
8. D2 — dynamic grid dimensions
9. E2 — world snapshot endpoint
10. E3 — draw real biomes
11. E4 — tile ownership endpoint
12. E5 — draw territory
13. G1 — event types
14. G2 — event buffers
15. G3 — lifecycle events
16. G4 — event endpoints
17. G5 — global event log
18. H1 — tribe snapshot
19. H2 — tribe dossier
20. I1 — brain schema
21. I4 — Brain tab
22. J1 — intervention request types
23. J2 — typed cull intervention
24. J3 — spawn food intervention
25. J4 — intervention menu
26. K1 — claim adjacent neutral tile
27. L1 — WarState
28. L2 — war endpoint
29. L3 — wars panel
30. M1 — tribal metrics
31. M2 — analytics panel
32. N1 — backend tick timing
33. N2 — frame size metric
34. O1 — scenario config
35. O2 — two tribes one border
36. O3 — scenario selector

## Tasks That Should Not Be Combined

Do not combine these in one 5-hour session:

- Dynamic world generation and hex rendering.
- Event storage and full event UI.
- Tribe inspection and neural graph rendering.
- War mechanics rewrite and war visualization.
- Replay chunking and snapshot storage.
- Python ML tooling and live Rust inference.
- Backend protocol redesign and cockpit UI redesign.

## Agent Prompt Template

Use this when dispatching one worker:

```text
You are implementing exactly Task <ID>: <name> from
docs/superpowers/plans/2026-05-03-neurosim-tribal-simulation-agent-tasks.md.

Read only:
- the task section
- docs/neurosim-tribal-simulation-critical-redesign.md sections directly referenced by the task
- current files listed in the task

Do not implement adjacent tasks.
Do not redesign unrelated UI.
Do not change thesis scope.
Keep the app buildable.

When done, report files changed and validation commands/results.
```

## Plan Self-Review

- Spec coverage: the plan covers cockpit recovery, controls, dynamic world generation, snapshots, territory, hex rendering, per-tribe logs, tribe inspection, neural/genetic visibility, interventions, war visibility, analytics, sessions, performance, memory, Python boundary, and validation scenarios.
- Vague-instruction scan: tasks avoid broad "do everything" instructions and define hard scope boundaries.
- Type consistency: endpoint paths use the existing Express proxy pattern `/api/neurosim/api/*` for frontend calls and Rust backend `/api/*` internally.
