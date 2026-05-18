# **Tribal NeuroSim v3: Territory & Expansion Mechanics**

## **Advanced Tile Ownership, Disputed Zones, and Fractional Control**

### **1\. The Core Philosophy of Territory**

In NeuroSim v3, the restriction of "one tribe per tile" is completely abolished. A tribe is not a static dot on a single hex; it is a dynamic, expanding entity.  
A tribe can claim and control as many adjacent tiles as its neural network deems necessary and statistically viable. However, the simulation rejects passive "land-grabbing" (the "Siberian Strategy"). A tribe cannot endlessly claim territory without the population, military presence (A\_combat), and infrastructure (A\_resource) to maintain it. If a territory is stretched too thin, it becomes vulnerable to starvation or hostile takeovers.

### **2\. The Main Camp & Outpost Expansion**

When visualizing the map, the territory is strictly divided by usage and hierarchy:

* **The Main Camp (The Core):** Every tribe possesses a central hex tile designated as their "Main Camp." This is where the core population resides. When zooming in on the Main Camp, individual citizens (agents) can be observed performing localized actions.  
* **The Claimed Wilderness (Outposts & Exploitation):** Adjacent claimed tiles act as resource nodes. A tribe can physically build on these tiles (e.g., establishing agriculture, logging camps, or fortifications) depending on the tile's native biome properties (fertility, woodland density).  
* **The Baseline Economy:** A single initial spawn tile is mathematically guaranteed to sustain 80% of a baseline tribe's population under average conditions. However, if a tribe possesses a high A\_resource artifact (Resource Tempo) and the tile possesses high abundance stats, the tribe can optimize output to 100% self-sufficiency. Extra tiles are claimed strictly to cover deficits (poor native fertility) or to fuel population explosions and military funding.

### **3\. Binary Diplomacy: The "No Middle Ground" Rule**

To maintain a high-stakes, deterministic simulation, economic cooperation without structural binding is prohibited. Diplomacy in NeuroSim v3 is strictly binary:

* **Option A: Total War.** Tribes fight for dominance, attempting to eradicate the opponent or force them off the territory.  
* **Option B: Full Alliance & Merger.** Tribes agree to a binding alliance, eventually merging into a higher-tier entity (City/Kingdom).

There are no superficial trade agreements. The neural network must calculate whether a neighboring entity is worth absorbing into the societal structure or eliminating.

### **4\. Fractional Ownership & Disputed Zones (The Float Mechanic)**

Tiles are no longer owned in a binary "1 or 0" state. Tile control is calculated using a fractional (float) system, creating organic borders and contested regions.

* **Fractional Claiming:** A single hex tile can be occupied by multiple factions. For example, Tribe A might control 70% of a tile (the bottom-left sector), while Tribe B controls 30% (the top-right sector). Visually, the UI will render precise, dynamic borders cutting through the hex tile.  
* **The Dispute Penalty:** If two or more factions claim the same tile, the tile is flagged as Disputed. A disputed tile does not operate at full efficiency. A flat **\-40% Efficiency Penalty** is immediately applied to all operations on that tile due to the inherent friction, sabotage, and tension of shared occupation.  
  * *Mathematical Impact:* If Tribe A controls 70% of a disputed tile, its actual resource/economic yield from that tile is calculated as: (0.70) \* (1.00 \- 0.40) \= 42% net yield.

### **5\. Resolving Disputes & The Casus Belli**

The Dispute Penalty creates natural, mathematically driven friction. The neural networks of the involved tribes must continuously evaluate the situation:

* **Passive Acceptance:** If Tribe A calculates that the penalized yield (e.g., 42%) is still mathematically sufficient to maintain their survival threshold (heavily influenced by their A\_risk / Risk Discipline artifact), they may tolerate the status quo to avoid the cost of war.  
* **Aggressive Resolution (Casus Belli):** If the penalty starves the tribe or limits critical expansion, it generates a valid *Casus Belli*. The tribe will attempt to force the opposing faction off the tile through:  
  1. *Military Threat (Intimidation):* Using a superior A\_combat stat to force a retreat without bloodshed.  
  2. *Total War:* Initiating combat to eradicate the opponent's presence on the tile.  
  3. *Diplomatic Merger:* Using high A\_team (Team Enablement) to form an alliance, thereby merging the factions, erasing the border, and removing the \-40% Dispute Penalty.

### **6\. Technical Implementation Note (Data Structure)**

To handle fractional ownership efficiently in the Rust backend without overloading the tick loop: The tile data array must track ownership using a compact structure, avoiding heavy vectors where possible.  
`struct TileControl {`  
    `tribe_id: u32,`  
    `control_percentage: f32, // e.g., 0.70 for 70%`  
`}`  
`// Inside the main tile array:`  
`tile_occupants: Vec<ArrayVec<TileControl, 4>> // Max 4 factions per tile to cap memory`  
`tile_is_disputed: Vec<bool>`

This ensures the engine can rapidly calculate the Dispute Penalty and render fractional borders without sacrificing the 4-6 GB RAM budget.