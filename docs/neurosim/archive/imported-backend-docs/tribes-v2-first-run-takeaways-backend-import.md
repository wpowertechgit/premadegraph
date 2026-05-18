
# NeuroSim Tribal Simulation v2: First Execution Run Post-Mortem
Used image references: 
docs/assets/demo_shots/tribes-v2-21tick-start.png
docs/assets/demo_shots/tribes-v2-76tick-desperate.png
docs/assets/demo_shots/tribes-v2-114tick-conflict.png
docs/assets/demo_shots/tribes-v2-187tick-massextinction.png
docs/assets/demo_shots/tribes-v2-258tick-massfightings-someoccupying.png
docs/assets/demo_shots/tribes-v2-342tick-massmigration-migrationwhere.png
docs/assets/demo_shots/tribes-v2-832tick-massstarvation.png
docs/assets/demo_shots/tribes-v2-2842tick-lasttribe.png
docs/assets/demo_shots/tribes-v2-3085tick-extinction.png

**Objective:** To document and analyze the empirical results of the first multi-generational execution of the NeuroSim Tribes v2 prototype, identifying critical architectural anomalies and outlining required system corrections.

**Overview:** The simulation successfully initialized and progressed through multiple generations . However, the run exposed severe logic disconnects between the tribal state machine, spatial mechanics, and memory management . The following chronological breakdown details the observed systemic failures.

### Chronological Anomaly Report

*   **Phase 1: Initialization & Spatial Scatter Failure (Tick 21)**
    *   **Observation:** The initial spatial distribution protocol failed . Tribes spawned in four hyper-dense rows, leaving vast expanses of the map unutilized . 
    *   **Analysis:** The dynamic map generation did not scale algorithmically with the entity count . A population of 599 tribes requires significantly more surface area; an optimal distribution should afford each tribe a minimum of four hex-tiles with adequate buffer zones . 
    *   **Mechanic Failures:** The "Spawn Food" intervention failed to execute . Consequently, all tribes initialized in an immediate state of starvation .
    *   **UI/UX Notes:** The current map lacks zoom functionality . Future iterations require a 3D isometric perspective (akin to Civilization VI), custom territorial outlines for multi-tile empires, and dynamic nomenclature (e.g., "Tribe X's Land") . The behavior legend should be relegated to an informational tooltip to reduce UI clutter .

*   **Phase 2: Rapid Resource Deficit (Tick 76)**
    *   **Observation:** The global population rapidly entered a "Desperate" state, with observed populations dropping to 24/75 .
    *   **Analysis:** The foraging protocol failed because global food values registered at 0 . Scouts failed to detect or harvest resources, which theoretically should be distributed across tiles with varying abundance based on biome type . 
    *   **Required Feature:** We require a granular "Tile Inspection" tool to analyze biome type, current food yields, and agricultural potential to validate routing decisions .

*   **Phase 3: Spontaneous Global Conflict (Tick 114)**
    *   **Observation:** A massive spike in unprompted hostility occurred, with 322 out of 599 active tribes declaring war . 
    *   **Analysis:** The casus belli for these conflicts is entirely untrackable . Furthermore, the UI lacks visual frontlines, making spatial conflict unreadable . The combat logic itself appears non-decisive, resulting in perpetual, stagnant conflict states .

*   **Phase 4: Telemetry Failure & Mass Extinction (Tick 187)**
    *   **Observation:** The population plummeted to 319 active tribes, nearly emptying the southern hemisphere . 
    *   **Analysis:** The simulation lacks an event bus . Extinctions occur without generating logs detailing the specific entity identifier (e.g., `tribe#575-id:4`) or the cause of death.
    *   **Mechanic Failures:** Expected "Alliance" and "Foraging" mechanics were unobservable. The map remained entirely static, invalidating the "dynamic environment" parameter. Additionally, the "2 Tribes" control button lacks utility and should be replaced by structured, fine-tuned dataset mocks.

*   **Phase 5: State Persistence Anomalies (Tick 257)**
    *   **Observation:** The system reported 323 active wars, a statistical impossibility given the reduced population. 
    *   **Analysis:** The combat state machine is failing to terminate events, resulting in a backlog of "ghost wars". 

*   **Phase 6: Erroneous Mass Migration (Tick 342)**
    *   **Observation:** An estimated 90% of surviving tribes triggered a "Migrating" state without viable destinations, largely due to the global food absence . 
    *   **Behavioral Quirks:**  Conversely, a handful of isolated actors remained entirely stationary and unbothered,some in war with its neighbours along the riverside, demonstrating an almost Slavic stoicism in the face of global collapse

*   **Phase 7: Migration Stagnation (Tick 832)**
    *   **Observation:** The migration protocol failed to execute actual spatial translation. 
    *   **Analysis:** The entities entered a migratory state but refused to update their spatial coordinates—resembling an individual who speaks endlessly of leaving their 20,000-population hometown but remains there into their thirties. Consequently, the population succumbed to mass starvation, with a mathematically negligible percentage advancing to the second generation

*   **Phase 8: Terminal Memory Degradation (Tick 2842)**
    *   **Observation:** A single tribe remained active alongside 182 active "ghost wars". 
    *   **Analysis:** The entities were seemingly continuing their conflicts in the afterlife. Crucially, UI controls (including pause and god-mode interventions) became entirely unresponsive due to severe input lag. This strongly indicates a catastrophic memory leak caused by improper garbage collection of dead tribal entities. Chris Sawyer, the assembly language genius behind RollerCoaster Tycoon, is likely rolling in his grave—never mind, he is still alive, but he would be deeply disappointed by this memory management.

*   **Phase 9: Terminal State (Tick 3085)**
    *   **Observation:** The final tribe expired, successfully reaching Generation 3 and surviving 200 ticks in isolation
    *   **Conclusion:** While basic execution was achieved, the simulation falls short of the 7-8 generation longevity target

### Future Architectural Requirements
To resolve these issues, the following features are mandatory:
1.  **Post-Run Analytics Engine:** Implementation of end-state charts detailing survival metrics .
2.  **Seed Player Lineage:** The ability to trace and fetch the original seed players for each surviving (or extinct) tribe .
3.  **Extinction Summaries:** A structured log generated upon a cluster's death, summarizing total accomplishments, primary cause of death, and originating seed data .

***
What you are witnessing here is a classic symptom of decoupled state machines. The frontend UI is rendering *intent* (e.g., a dot turns blue for "Migrating"), but the backend Rust logic lacks the actual spatial execution (e.g., updating coordinates and pathfinding to a higher-yield food tile). The entities are acting out a script without a stage.

*   **The "Hometown" Migration Bug:** If they are flagged as migrating but not moving, your pathfinding algorithm (likely A* or a greedy search) is returning a null path. Because there is no food spawning on the map, the heuristic function evaluating "best next tile" likely evaluates every surrounding tile equally (as zero). With no gradient to follow, the movement vector remains zero, trapping them in place.
*   **The Need for the Event Bus:** Your frustration at Tick 187 over not knowing *why* things died perfectly validates the need for the append-only Event Bus you designed. Until you can click a dead tribe and read an event log that says `[Tick 180] Tribe #575 suffered Starvation Event (-5 pop)`, the simulation will remain an un-debuggable black box.