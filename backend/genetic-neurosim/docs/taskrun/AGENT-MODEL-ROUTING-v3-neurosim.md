# Agent Model Routing For V3 NeuroSim Tasks

This file is coordination guidance only. The authoritative task scope remains:

`docs/taskrun/MASTER-TASK-LIST-v3-neurosim-simulation.md`

Use the suggested model when assigning subagents. If a task touches rendering math, FBX loading, performance, or cross-system contracts, prefer a stronger reasoning model and review the result.

| Task | Suggested model | Status | Notes |
|------|-----------------|--------|-------|
| R8 | DeepSeek V4-Pro / Codex | Open | Expansion pacing, claim cost, defendability, deterministic tick targets |
| M2 follow-up | DeepSeek V4-Pro | Done | Settlement visibility, transforms, scale, materials, LOD |
| M3 follow-up | DeepSeek V4-Pro | Done | Exact hex-edge border geometry; review visually |
| M4 | DeepSeek V4-Pro | Done | Semantic zoom, LOD, camera, visibility |
| M5 | Gemini Flash / DeepSeek V4-Flash | Open | Debug HUD data display |
| M6 | Codex / DeepSeek V4-Pro | Open | Live Rust frame rendering and fallback logic |
| M7 | DeepSeek V4-Pro | Open | Biome visuals must integrate with M15 rules |
| M8 | Gemini Flash / DeepSeek V4-Flash | Open | Banner/profile wiring unless procedural generation grows |
| M9 | Gemini Flash / DeepSeek V4-Flash | Open | Lineage/tombstone UI over existing state |
| M10 | Gemini Flash / DeepSeek V4-Flash | Open | Fonts and UI art direction |
| M11 | DeepSeek V4-Pro | Done | Parchment/table affects camera clipping, depth, lighting |
| M12 | DeepSeek V4-Pro + second Pro review | Done | FBX trap zone: transforms, winding, textures, normals, 32-bit indices |
| M13 | DeepSeek V4-Pro / Codex | Done | Settlement renderer, LOD, high-poly performance |
| M14 | DeepSeek V4-Pro | Done | Subtle heightmap relief without chunk mountains |
| M15 | DeepSeek V4-Pro | Done | Prop placement rules, determinism, performance caps |
| M16 | Codex / DeepSeek V4-Pro | Done | Selection, exact hex hit testing, inspection UI |
| M17 | Codex / DeepSeek V4-Pro | Open | Render metrics and performance budget |
| M18 | DeepSeek V4-Flash | Open | Local demo generation polish |
| M18B | DeepSeek V4-Pro | Open | Deterministic merger/Empire stress scenario |
| M19 | Gemini Flash / DeepSeek V4-Flash | Open | Screenshot harness and visual checklist |
| M20 | Claude Sonnet / DeepSeek V4-Pro | Open | Tribe stakes and gameplay readability |
| N1 | DeepSeek V4-Flash | Open | Node endpoint forwarding |
| N2 | Codex / DeepSeek V4-Pro | Open | Dataset bootstrap and cross-system contract |
| N3 | DeepSeek V4-Flash | Open | Export endpoints if schemas are clear |
| I1 | Codex / DeepSeek V4-Pro | Open | Scale test and bottleneck diagnosis |
| I2 | Codex / DeepSeek V4-Pro | Open | Deterministic replay correctness |
| I3 | Claude Sonnet / Codex | Open | Full V3 mechanics compliance audit |

## Assignment Rule

- Flash models are fine for scoped wiring, docs, HUDs, endpoints, reports, and checklists.
- Pro models should handle rendering math, runtime assets, simulation behavior, determinism, and performance.
- M12 should always get a second Pro-class review before it is considered done.
- Every agent must still create/update the matching `docs/taskrun/Task*Run.md` report.
