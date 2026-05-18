### **Art Style & UX Design Brief: Simulation Environment**

**1. Environment & World Design (Inspiration: Civilization VI)**
*   **Grid System:** The world is built on a **hexagonal tile** foundation. 
*   **Seamless Integration:** Settlements, terrain features, and water bodies must blend seamlessly into the tiles. Avoid harsh, visible seams where 3D models meet the ground texture. The transition from land to water should look natural and fluid.
*   **Prop & Foliage Placement:** Prop placement needs to feel organic yet readable. Trees and forests should be clustered naturally, specifically scaled and oriented to look their best from our fixed angled/isometric camera perspective. 
*   **Visual Fidelity:** Aim for a vibrant, clean, and slightly stylized aesthetic where readable gameplay space is prioritized over hyper-realism.

**2. Map Overlay & Territory Representation (Inspiration: Crusader Kings III)**
*   **On-Map Typography:** Tribe and settlement names should be displayed directly on the terrain. The text needs to be highly legible, clean, and positioned elegantly over the landmasses (potentially curving slightly to match the shape of the territory).
*   **Disputed Territories:** Contested or overlapping claims must be visually distinct without cluttering the map. Use clear visual patterns—such as the high-contrast diagonal striping seen in CK3—to highlight disputed borders and zones.

**3. Graphical User Interface / HUD (Inspiration: Crusader Kings III)**
*   **Primary Control Panel Location:** Shift the main simulation data and controls from the top-left (current state) to a dedicated, stylized container in the **bottom-right** of the screen.
*   **Data Readout:** This container must display essential simulation metrics cleanly, including the **Current Tick** and other vital active data (population, tribe counts, etc.).
*   **Time Controls:** The timeline container must include intuitive playback controls, allowing the user to easily **Pause** and **Continue** the simulation directly from that UI element.

**Current State vs. Target Goal:**
Looking at your current build (Image 3), the underlying hex logic and basic prop placement are already functioning. The next major steps for the agents will be smoothing out those hard hex outlines into the seamless Civ 6 terrain style, migrating that debug UI into a polished bottom-right CK3-style panel, and adding those clean, on-map territorial labels!