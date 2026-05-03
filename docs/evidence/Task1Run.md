Task completed: A1 and A2

Files changed:
- frontend/src/pages/TribalSimulationPage.tsx
- docs/DOCUMENT_MAP.md
- docs/neurosim-tribal-simulation-implementation.md
- docs/neurosim-tribal-simulation-design.md

Validation run:
- npm --prefix frontend run build -> ✓ built in 14.95s
- rg cross-link check -> 4 files matched (3 target docs + plan file itself)

Notes:
- Unused React import hint is pre-existing, not introduced by this change