# **Tribal NeuroSim v3: Offspring Mechanics & Evolutionary Lineage**

## **1\. Generation 1: The Seed Population & Match Weighting**

The initial population (Generation 1\) is populated directly from the dataset clusters. To ensure statistical accuracy, the number of entities representing a specific player within a tribe is weighted by their match count in the dataset.

* **The Weighting Formula:** Players who dominated their cluster with more matches get a higher representation in the seed population.  
  * *Example:* In a cluster of 10 players, if Player A has 40 matches and Player B has 5 matches, Player A might be represented by 8 entities in the starting tribe, while Player B is represented by 1\.  
* **The "No One Left Behind" Rule:** Regardless of how small a player's match count is (e.g., 3-4 matches compared to someone with 35), *every player in the cluster is guaranteed at least one entity* in the initial generation. This preserves outlier genetic traits that might prove crucial during later mutations.

## **2\. Entity Identification (The Ledger ID System)**

To prevent memory leaks and encoding errors caused by raw strings (e.g., Japanese, Korean, or special characters in player names), the Rust backend will strictly use numerical IDs or hashes. The Node.js/C\# layer will map these IDs back to the real player names only when exporting the End Analytics.

* **Baseline Format Concept:** \[TribeID\]-\[EntityID\]-\[Generation\]-\[Seed/LineageID\]  
* **Gen 1 Example:** t1e3g1s45 (Tribe 1, Entity 3, Generation 1, Seed Player ID 45).  
* *Note:* The actual strings will not be passed around in the Rust tick loop. Rust will use a struct like Entity { id: u32, generation: u8, lineage\_hash: u64 } to stay within the 4-6 GB RAM budget.

## **3\. Reproduction Rules (The Unisex Breeding Model)**

The simulation employs a simplified, unisex breeding model to focus purely on statistical and genetic evolution rather than biological gender constraints.

* **Minimum Threshold:** As long as there are at least **2 living entities** within a tribe's population, the tribe can produce offspring for the next generation.  
* **Same-Gene Breeding:** Inbreeding/Same-gene pooling is permitted. Two entities originating from the exact same seed (e.g., two Seed A entities) can breed. The resulting offspring will heavily inherit Seed A's baseline stats, creating a highly specialized (but potentially vulnerable) lineage.

## **4\. Inheritance & The Mutation Rate**

When a new entity is born, its attributes are not just a static copy of its parents.

* **Genitor Blending:** The offspring inherits a blended array of the 5 core artifacts (A\_combat, A\_risk, A\_resource, A\_map\_objective, A\_team) calculated from its two genitors (parents).  
* **The Mutation Rate:** Every birth is subject to a configurable mutation roll. This means even if two identical Seed A entities breed, the offspring might experience an increase or decrease in specific stats. Over hundreds of ticks, continuous mutation allows tribes to adapt to their environment (e.g., surviving a desert) even if their original seed dataset was poorly optimized for it.

## **5\. Complex Lineage & Cross-Tribe Breeding (Post-Merger)**

When tribes ally and merge into Cities or Kingdoms, their populations mix. This leads to complex, cross-tribe genetic lineages.

* **The Lineage String Expansion:** A 2nd generation offspring looks like this: \[t1e1g1sA-t1e2g1sB\]-g2 (Parent A \+ Parent B).  
* **The Merger Complexity:** By Generation 3, after a tribal merger, an offspring's lineage could theoretically look like this: \[\[t1e1g1s1-t1e1g1s2\]-\[t7e6g1s71-t7e3g1s15\]\] \- \[\[t1e1g2s1-t1e1g2s26\]-\[t6e6g1s9-t7e3g2s15\]\] \- g3  
* **Lineage Tracing (The Solution):** To prevent these strings from growing exponentially and crashing the system, the Rust backend will track lineage relationally rather than as raw text.  
  * Every entity simply stores: parent\_a\_id and parent\_b\_id.  
  * When the simulation ends, the Node.js backend acts as a genealogist. It recursively traces these IDs backward through the Ledger to construct the massive family trees and attribute the final Kingdom's success to the exact original Seed Players.

