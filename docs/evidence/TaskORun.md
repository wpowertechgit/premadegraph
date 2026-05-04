# Task O Run — Track O: Validation Scenarios

**Date:** 2026-05-04
**Tasks implemented:** O1, O2, O3

---

## O1 — Scenario Config Type

**Goal:** Add `scenario_id: Option<String>` to simulation config and status.

**Changes in `simulation.rs`:**

- Added `scenario_id: Option<String>` (serde default `None`) to `ControlConfig`
- Added `scenario_id: Option<String>` to `ConfigPatch` — empty string clears, non-empty sets
- Added `scenario_id: Option<String>` to `StatusResponse`
- Updated `status()` to include `scenario_id`
- Updated `apply_config_patch()` — empty string → `None`; non-empty string → `Some(v)`

**Acceptance:** Run metadata now carries active scenario id. Default live dataset path unchanged.

---

## O2 — Two Tribes One Border Scenario

**Goal:** Deterministic 2-tribe validation scenario in Rust.

**Changes in `world.rs`:**

- Added `WorldGenerationConfig::two_tribes_scenario()` factory
  - Seed: `42_002`
  - 6x6 grid (36 tiles), 2 tribes, 100 initial population
  - `min_tiles: 36` ensures fixed small map

**Changes in `simulation.rs`:**

- Added `scenario_cluster(id, a_combat, a_resource) -> ClusterProfile` free function
  - Constructs a fully-specified minimal profile for scenario use
- Modified `reinitialize()` to branch:
  - `scenario_id == "two_tribes_one_border"` → calls `initialize_two_tribes_scenario()`
  - Otherwise → existing live dataset path
- Added `initialize_two_tribes_scenario()` method:
  - Uses `WorldGenerationConfig::two_tribes_scenario()` (fixed seed, 6x6)
  - Creates two profiles: `scenario-alpha` (a_combat 0.65) and `scenario-beta` (a_resource 0.6)
  - Spawns tribes on adjacent center tiles: `total/2 - 1` and `total/2`
  - Sets tile ownership and emits `TribeSpawned` events

**Acceptance:** Scenario is deterministic (seed 42_002), two tribes adjacent, activates only after reset with scenario set.

---

## O3 — Frontend Scenario Selector

**Goal:** Let user choose validation scenario from UI.

**Changes in `TribalSimulationPage.tsx`:**

- Added `scenario` state (`string`, default `""` = dataset default)
- Added `handleScenarioChange(id: string)`:
  - POSTs `{ scenario_id: id }` to `/api/neurosim/api/config`
  - Calls `sendControl("reset")` to reinitialize with new scenario
- Added "Scenario" section in the Controls panel with two buttons:
  - **Dataset** — highlighted when `scenario === ""`
  - **2 Tribes** — highlighted when `scenario === "two_tribes_one_border"`

**Acceptance:** User can switch between dataset and 2-tribe scenario; triggers reset on selection.

---

## Validation

### Rust (`cargo check`)

```
Checking neurosim-backend v0.2.0
Finished `dev` profile [unoptimized + debuginfo] target(s) in 12.14s
```

14 pre-existing warnings only (dead code, private interface). Zero errors.

### Frontend (`npm --prefix frontend run build`)

```
970 modules transformed.
TribalSimulationPage-Dt0TEgQ_.js  36.50 kB (11.91 kB gzip)
built in 6.00s
```

Build clean. Chunk size warning is pre-existing on main bundle.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/genetic-neurosim/backend/src/simulation.rs` | O1: scenario_id in ControlConfig/ConfigPatch/StatusResponse + apply_config_patch; O2: scenario_cluster helper, reinitialize branch, initialize_two_tribes_scenario |
| `backend/genetic-neurosim/backend/src/world.rs` | O2: WorldGenerationConfig::two_tribes_scenario() |
| `frontend/src/pages/TribalSimulationPage.tsx` | O3: scenario state, handleScenarioChange, Dataset/2 Tribes buttons in Controls panel |
| `docs/evidence/TaskORun.md` | this report |

---

## Notes

- "Do not touch backend" was interpreted as: do not modify Node.js/Express (`server.js`). Rust simulation files are Track O's specified backend.
- "Do not add controls" was interpreted as: do not add controls beyond what O3 requires. Only the scenario selector was added.
- "Do not redesign the page" honored: only a 2-button labeled group was inserted into the existing Controls panel.
- Empty string `""` is used as a sentinel for "clear scenario" in `ConfigPatch` because `Option<String>` + `#[serde(default)]` cannot distinguish JSON-absent from JSON-null without `Option<Option<String>>`. Documented in code comment.
