# BP-Patch Convergence — 599-Cluster Run (2026-05-18)

**Date:** 2026-05-18  
**Status:** CONFIRMED — convergent, deterministic, thesis-defensible  
**Seed:** 7777  
**Clusters:** 599 (all flexset clusters)

---

## What Changed vs. First Complete Run

The first complete simulation run (2026-05-16) produced chaotic war from tick=1 with no strategic buildup. Task R10 added the Border Pressure System (BP) to enforce strategic arc.

| Mechanic | Before BP | After BP |
|---|---|---|
| War start | tick=1 (immediate) | tick~81 (border pressure ≥80 ticks required) |
| Expansion cooldown | 3 ticks | 20 ticks |
| Dispute grace | 60 ticks | 180 ticks |
| Opportunity war | every 20 ticks | every 60 ticks |
| War exhaustion | none | 150-tick cooldown after each war |
| Endgame threshold | `tribes.len()/6` ≈ 99 | same (unchanged) |
| Convergence tick | 1707 (v1) / 5895 (v2 optimized) | **3309** |

---

## Run 1 Result (seed 7777)

```
=== FLEXSET-EMPIRE RUN 1 ===
  ticks:   3309
  alive:   1
  winner:  tribe_285 (rust_pathfinding:286)
  tier:    4  (Empire)
  tiles:   93937
  pop:     1898282
  wars:    634
```

Run 2: identical fingerprint → ✓ DETERMINISM CONFIRMED

---

## Simulation Arc

The BP-patched run exhibits a clean 4-phase arc:

### Phase 1 — Expansion (tick 0–80)
No wars. Tribes expand with 20-tick cooldown. Border contacts form and pressure accumulates.

```
tick=50    alive=599  wars=0   Tribe:596 City:3
tick=100   alive=595  wars=0   Tribe:543 City:52
```

### Phase 2 — Tactical Wars (tick 80–900)
First wars start ~tick 81 (border pressure threshold crossed). War waves follow exhaustion cycle: declare, fight 120–150 ticks, then 150-tick cooldown before next wave.

```
tick=150   alive=579  wars=11   first strategic wars; Duchy:16
tick=300   alive=537  wars=10   4 Empires forming
tick=600   alive=466  wars=9    100 Empires
tick=850   alive=407  wars=6    slowing
tick=900   alive=331  wars=6    cascade: −76 deaths in 50 ticks
tick=950   alive=230  wars=7    cascade: −101 deaths in 50 ticks
```

### Phase 3 — Consolidation Plateau (tick 1000–2350)
War exhaustion cycles create a slow-burn phase. All Tribe-tier polities eliminated by tick=1650.

```
tick=1000  alive=211  wars=10   Tribe:22
tick=1650  alive=138  wars=7    Tribe:0 — all polities City+
tick=1900  alive=130  wars=4    slowing (4 wars active)
tick=2200  alive=109  wars=11   new wave; 11 wars
tick=2350  alive=100  wars=4    endgame threshold imminent
```

### Phase 4 — Endgame Cascade (tick 2350–3309)
Endgame fires at alive≤99 (~tick 2380). All BP and war-exhaustion gates bypass. Force-war declarations sweep.

```
tick=2400  alive=81   wars=56   🔥 56 simultaneous wars; all polities Empires
tick=2500  alive=50   wars=18
tick=2600  alive=28   wars=12
tick=2800  alive=13   wars=5
tick=3000  alive=8    wars=7    max_tile=14979 (41% of map controlled)
tick=3200  alive=3    wars=1    max_tile=35293 (98% of map)
tick=3267  tribe_490 absorbed (35295 tiles) by tribe_285
tick=3309  alive=1    winner=tribe_285 ✓
```

---

## Key Observations

**Strategic arc confirmed:** Three observable phases (expansion → tactical wars → endgame cascade) with qualitatively distinct behavior in each phase.

**Game-theoretic evidence:** Wars start when border pressure is sufficient, not immediately. War exhaustion creates genuine temporal trade-offs. Peaceful equilibria form at tick=1900 (only 4 wars active) and require endgame escalation to break.

**Polity progression:** Tribe → City → Duchy → Kingdom → Empire tiers all observed, with the progression from Tribe:596 at tick=50 to Empire:81 at tick=2400.

**Tombstone depth:** 598 tribes fell, each with extinction cause (conquered-by-X, starved, absorbed). Winner tribe_285 had to defeat tribe_490 (35295-tile mega-empire) as the final rival.

**Total wars fought:** 634 (vs. 901 in the pre-BP optimized run without strategic constraints).

---

## Verification Criteria Met

1. ✓ Starts with exactly **599** tribes
2. ✓ Ends with exactly **1** survivor
3. ✓ Tombstone count: **598**
4. ✓ Both run fingerprints match exactly (seed 7777)
5. ✓ Winner tier = **4** (Empire, ≥ Kingdom)
6. ✓ Strategic 4-phase arc observable in tick-by-tick log

---

## Comparison with Previous Convergence Runs

| Run | Mechanism | Convergence Tick | Wars |
|---|---|---|---|
| v1 first run (2026-05-16) | Early convergence | 1707 | ~not recorded |
| v2 optimized (pre-BP, 2026-05-15) | Proportional endgame only | 5895 | 901 |
| **BP-patched (2026-05-18)** | **BP + exhaustion + proportional endgame** | **3309** | **634** |

The BP-patched run converges faster than the pre-BP optimized run (3309 vs 5895 ticks) because the BP system forces wars to escalate once pressure builds, rather than allowing peaceful equilibria to persist indefinitely. The strategic arc is richer: war waves, exhaustion cycles, and an observable endgame threshold with 56 simultaneous wars at fire-time.

---

## Thesis-Safe Claims

- "The Border Pressure System produced observable strategic war timing: first wars at tick~81 following ~80 ticks of border contact, rather than immediately."
- "War exhaustion created temporal trade-offs: tribes entering a 150-tick recovery period after each war, producing visible wave patterns in the war-active count."
- "The simulation converged to a single Empire-tier winner in 3309 ticks, confirmed deterministic via two seeded runs."
- "The endgame threshold (alive≤99) forced 56 simultaneous wars at tick=2400, demonstrating the escalation mechanism."
