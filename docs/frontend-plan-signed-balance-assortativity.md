# Frontend Plan: Signed Balance & Assortativity Analytics

## Overview

This document outlines the frontend implementation strategy for presenting Signed Balance Theory and Assortativity Analysis experiments to support thesis research and demonstration.

## Current State Assessment

### What's Already Implemented ✅

| Component | Status | Notes |
|-----------|--------|-------|
| SignedBalancePage.tsx | ~80% complete | Controls, visualization, mock mode working. Needs: better triad positioning, node details |
| AssortativityPage.tsx | ~85% complete | 3D sphere, charts, mock mode. Needs: interpretation guidance, statistical context |
| Type definitions | ✅ Complete | Both responses fully typed |
| Backend API integration | ✅ Complete | `runRustSignedBalance()`, `runRustAssortativity()` available |
| Mock data support | ✅ Complete | Both pages have deterministic mock modes |
| Navigation integration | ✅ Complete | Both pages lazy-loaded in router |

### What's Missing ❌

| Feature | Priority | Effort | Impact |
|---------|----------|--------|--------|
| Interpretation framework | High | Low | Helps reviewers understand results |
| Combined analytics view | Medium | Medium | Shows complementary insights |
| Result comparison UI | Medium | Medium | Enables parameter tuning workflow |
| Statistical context | High | Low | Adds methodological rigor |
| Export/report generation | Low | Medium | Useful for documentation |
| Visual integration | Medium | High | Connects both experiments visually |

---

## Recommended Implementation Path

### Phase 1: Enhanced Individual Pages (1-2 days)

**Goals:**
- Make each page maximally informative for thesis readers
- Provide clear interpretation guidance
- Handle edge cases gracefully

**Signed Balance Page Enhancements**

1. **Triad Visualization Improvements**
   - Current: Generic node labels
   - Proposed: Show player archetypes or score tiers alongside nodes
   - Add visual edge styling (thicker for higher support edges)
   - Highlight balanced vs unbalanced triads with background color hints

2. **Top Unbalanced Nodes Section**
   - Add rank number (1st most unstable, etc.)
   - Show what makes each player unstable (how many contradictions)
   - Link to player profile or graph view
   - Visual instability score bar

3. **Cluster Summaries Improvements**
   - Show cluster size and structure quality
   - Compare balance ratio to global average
   - Highlight if cluster is unusually balanced or unbalanced

4. **Help & Interpretation**
   - Add collapsible "What Do These Results Mean?" section
   - Provide interpretation examples:
     - "If ~65% of triads are balanced, this suggests..."
     - "Unbalanced triads indicate contradictory team patterns..."
   - Link to theory documentation

5. **Controls & Parameters**
   - Add preset buttons: "Conservative", "Recommended", "Permissive"
   - Show what each preset does
   - Recommend defaults based on data quality

**Assortativity Page Enhancements**

1. **Coefficient Interpretation**
   - Add interpretation banners above results:
     - Coefficient > +0.3: "Strong positive — similar players cluster together"
     - Coefficient between ±0.1: "Near-neutral — performance uncorrelated with connections"
     - Coefficient < -0.3: "Strong negative — dissimilar players connected"

2. **Breakdown Clarity**
   - Explain what "within-cluster", "cross-cluster", "strong-ties", "weak-ties" mean
   - Add visual indicators showing distribution across categories
   - Highlight most interesting finding

3. **Edge Case Handling**
   - Clear messaging when insufficient data
   - Explain what "skipped edges" means
   - Show confidence indicators if available

4. **Sample Cards Enhancement**
   - Show edge support counts
   - Explain what metrics mean (opscore vs feedscore)
   - Add comparison hints: "Opscore shows higher assortativity than feedscore"

---

### Phase 2: Comparative Analytics Dashboard (2-3 days)

**Goals:**
- Show how signed balance and assortativity are complementary
- Support thesis narrative: "Network shows both structural stability AND skill clustering"
- Enable reviewers to understand both findings at once

**New Component: DualAnalyticsView**

Structure:
```
┌─────────────────────────────────────────────────────┐
│ Signed Balance & Assortativity: Thesis Narrative    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  [📊 Findings Summary]                              │
│  ├─ Signed Balance: 68% of triads are balanced      │
│  ├─ Assortativity (opscore): r = 0.42 (positive)   │
│  └─ Interpretation: Strong structure + skill match   │
│                                                       │
│  [🔗 What This Means Together]                      │
│  These results suggest that premade teams form      │
│  intentionally around both relationship coherence   │
│  and skill similarity. See: [Theory Link]           │
│                                                       │
│  [⚙️ Parameters Used]                               │
│  Signed Balance: minEdgeSupport=2, tiePolicy=...   │
│  Assortativity: minPlayerMatchCount=5, ...         │
│                                                       │
│  [📑 Full Results]                                  │
│  [Signed Balance Details] [Assortativity Details]   │
│  [Export Report] [View as PDF]                      │
│                                                       │
└─────────────────────────────────────────────────────┘
```

**Interpretation Matrix**

Show all 4 combinations of high/low balance × high/low assortativity:

| Balance | Assortativity | Interpretation |
|---------|---|---|
| High | High | ✅ Strong structure: intentional stable teams, skill-matched |
| High | Low | ⚠️ Structure without skill: stable patterns but orthogonal to performance |
| Low | High | ⚠️ Skilled clustering without stability: players cluster by skill but form contradictory local patterns |
| Low | Low | ❌ Random network: neither structurally stable nor skill-organized |

**Navigation Options**

1. From Signed Balance page:
   ```
   [View Full Results] [See Assortativity Analysis] 
   → Shows: dual view with current balance results + placeholder for assortativity
   → User can run assortativity with one click (uses recommended params)
   ```

2. From Assortativity page:
   ```
   [View Full Results] [See Signed Balance Analysis]
   → Similar dual-view approach
   ```

3. Dedicated route: `/analytics/signed-balance-assortativity`
   - Can link to this from both pages
   - Can access this directly if both analyses have been run recently

---

### Phase 3: Parameter Sweep & Comparison (3-5 days, Optional)

**Goals:**
- Show how robust results are across parameter changes
- Enable exploration of different projection methods
- Support sensitivity analysis for thesis defense

**New Component: ParameterComparisonView**

Features:
1. **Run Multiple Variants**
   - Preset parameter sets
   - Side-by-side comparison table
   - Show what changes (and what doesn't) as parameters vary

2. **Sensitivity Display**
   - X-axis: parameter (e.g., minEdgeSupport: 1→2→3→5→10)
   - Y-axis: result metric (balance ratio, coefficient)
   - Line chart showing stability of findings

3. **Save & Compare**
   - "Save this run" → stores results + params
   - Compare up to 3-4 saved runs
   - Export comparison table

---

### Phase 4: Visual Integration (High Effort, Later)

**Goals:**
- Show results directly on graph visualization
- Enable interactive exploration

**Proposed Enhancements to GraphSpherePage**

1. **Balance Visualization**
   - Overlay triads on 3D sphere
   - Color edges by balance status
   - Highlight unbalanced triads
   - Toggle "show unbalanced triads only"

2. **Assortativity Visualization**
   - Color nodes by performance percentile
   - Color edges by metric correlation
   - Show "strong assortative clusters" as distinct regions

3. **Combined View**
   - Show nodes that are both "central to unbalanced patterns" AND "in assortative clusters"
   - Identify nodes that are "stable in their relationships" but "mismatched in performance"

---

## Detailed UI Mockups

### Enhanced Signed Balance Page

```
┌────────────────────────────────────────────────────────────────────┐
│ Signed Balance Theory Analysis                                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 📚 What is Signed Balance?                                          │
│ ────────────────────────────────────────────────────────────────   │
│ This analysis examines whether repeated ally/enemy relationships    │
│ form locally coherent patterns. [Learn More]                       │
│                                                                      │
│ ⚙️  Parameters                                                       │
│ ────────────────────────────────────────────────────────────────   │
│  Min Edge Support: [2 ▼]         [? Edges must appear at least]   │
│  Tie Policy:       [Exclude ▼]   [? How to handle 50-50 edges]    │
│  Max Top Nodes:    [10 ▼]        [? Display limit]                │
│  Include Cluster:  [☑] Summaries                                   │
│                                                                      │
│  [⚡ Presets: Conservative | Recommended | Permissive]            │
│                                                                      │
│  [🔄 Run Analysis] [📊 Compare Parameters] [✓ Last run: 2 min ago]│
│                                                                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 📈 RESULTS                                                           │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ Balance Ratio: 67.4%                                          │  │
│ │ ████████████████████░░░░ (3,214 / 4,768 triads)              │  │
│ │                                                               │  │
│ │ This means: About 2 out of 3 ally/enemy patterns are stable   │  │
│ │ locally. The remaining patterns show contradictions.          │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ Triad Type Distribution:                                            │
│ ┌─────────┬──────────────┬────────────┐                           │
│ │ Type    │ Balanced     │ Count      │                           │
│ ├─────────┼──────────────┼────────────┤                           │
│ │ +++     │ ✓ Balanced   │ 1,845 (39%)│                           │
│ │ +--     │ ✓ Balanced   │ 1,369 (29%)│                           │
│ │ ++-     │ ✗ Unbalanced │    892 (19%)│                           │
│ │ ---     │ ✗ Unbalanced │    662 (14%)│                           │
│ └─────────┴──────────────┴────────────┘                           │
│                                                                      │
│ 🔥 Most Unstable Nodes (Participate in Unbalanced Triads)         │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ 1. Player_Alpha     (8.2 instability | 42 unbal. triads)     │  │
│ │    └─ Often connects teams with contradictory patterns       │  │
│ │                                                               │  │
│ │ 2. Player_Beta      (7.9 instability | 38 unbal. triads)     │  │
│ │ 3. Player_Gamma     (7.5 instability | 35 unbal. triads)     │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ 🎯 Cluster Summaries (Show if enabled)                            │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ Cluster A (12 players)    │ Balance: 72%  │ ▓▓▓▓▓░░░░       │  │
│ │ Cluster B (8 players)     │ Balance: 64%  │ ▓▓▓▓░░░░░░      │  │
│ │ Cluster C (5 players)     │ Balance: 81%  │ ▓▓▓▓▓▓░░░░      │  │
│ │ Overall Average: 67%                      │                  │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ 📋 Example Unbalanced Triads (First 2)                             │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ Example 1: +- (Friend of my friend is my enemy)              │  │
│ │                                                               │  │
│ │        Alice ─(ally)─┐                                        │  │
│ │                      ├─ Carol                                 │  │
│ │        Bob ─(enemy)──┘                                        │  │
│ │                                                               │  │
│ │   Prediction: Alice & Carol should be connected,             │  │
│ │   but they're enemies. Why? (potential role conflict, etc.)   │  │
│ │                                                               │  │
│ │ Example 2: +- pattern (similar structure)...                 │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ 📊 [View Assortativity Analysis] [Export Results] [Open in 3D]    │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

### Enhanced Assortativity Page

```
┌────────────────────────────────────────────────────────────────────┐
│ Assortativity Analysis: Player Performance Clustering               │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 📚 What is Assortativity?                                           │
│ ────────────────────────────────────────────────────────────────   │
│ Do connected players have similar performance? Assortativity        │
│ measures whether similar-performing players play together.          │
│ [Learn More]                                                        │
│                                                                      │
│ ⚙️  Parameters                                                       │
│ ────────────────────────────────────────────────────────────────   │
│  Min Edge Support:        [1 ▼]  [? Edge must appear ≥ X times]   │
│  Min Player Match Count:  [5 ▼]  [? Players must have ≥ X matches]│
│  Strong Tie Threshold:    [3 ▼]  [? Edges with ≥ X support]      │
│  Include Cluster:         [☑] Breakdown                            │
│                                                                      │
│  [⚡ Presets: Conservative | Recommended | Permissive]            │
│                                                                      │
│  [🔄 Run Analysis] [📊 Compare Parameters] [✓ Last run: 5 min ago]│
│                                                                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 📈 RESULTS                                                           │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ Overall Interpretation: Positive Assortativity               │  │
│ │ ════════════════════════════════════════════════════════     │  │
│ │ Similar-performing players tend to play together.            │  │
│ │ This suggests intentional skill-based team formation.        │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ 📊 Coefficient Summary (Pearson Correlation)                       │
│ ┌────────────────────┬──────────────┬──────────────────────────┐  │
│ │ Metric / Mode      │ Coefficient  │ Interpretation           │  │
│ ├────────────────────┼──────────────┼──────────────────────────┤  │
│ │ Opscore            │              │                          │  │
│ │  Social Path       │ r = +0.42    │ ✓ Positive assort.      │  │
│ │  Battle Path       │ r = +0.18    │ ⊕ Weak positive         │  │
│ │                    │              │                          │  │
│ │ Feedscore          │              │                          │  │
│ │  Social Path       │ r = +0.31    │ ✓ Positive assort.      │  │
│ │  Battle Path       │ r = -0.08    │ ≈ Neutral               │  │
│ └────────────────────┴──────────────┴──────────────────────────┘  │
│                                                                      │
│ 🔍 Deep Dive: Opscore on Social Path (Strongest Finding)           │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ Global:         r = +0.42 (n=1,847 edges)                    │  │
│ │ Within Cluster: r = +0.51 (n=1,203 edges)                    │  │
│ │ Cross Cluster:  r = +0.24 (n=  644 edges)                    │  │
│ │ Strong Ties:    r = +0.58 (n=  892 edges) [≥3 co-plays]     │  │
│ │ Weak Ties:      r = +0.18 (n=  955 edges) [<3 co-plays]     │  │
│ │                                                               │  │
│ │ Interpretation:                                               │  │
│ │ • Ally relationships show strong positive correlation        │  │
│ │ • Effect is stronger within clusters (expected)              │  │
│ │ • Effect is strongest for frequently repeated partnerships   │  │
│ │ • This suggests intentional team matching by skill level     │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ 📋 What These Breakdowns Mean                                       │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ Within Cluster: Players in the same premade group            │  │
│ │ Cross Cluster:  Players from different groups               │  │
│ │ Strong Ties:    Repeated partnerships (evidence > 3)         │  │
│ │ Weak Ties:      Occasional co-play (evidence 1-2)           │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ 📊 [View Signed Balance Analysis] [Export Results] [Show on 3D]    │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

### New Combined Analytics Page (Route: `/analytics/signed-balance-assortativity`)

```
┌────────────────────────────────────────────────────────────────────┐
│ Thesis Research: Network Structure & Performance Clustering         │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 🔬 DUAL ANALYSIS SUMMARY                                            │
│ ════════════════════════════════════════════════════════════════    │
│                                                                      │
│ ┌─ Signed Balance: Local Coherence                            ──┐  │
│ │  67.4% of ally/enemy triads are structurally balanced          │  │
│ │  This suggests: Intentional team compositions create stable    │  │
│ │  local relationship patterns.                                  │  │
│ │  [View Full Analysis]                                          │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─ Assortativity: Skill Clustering                            ──┐  │
│ │  Opscore: r = +0.42 (strong positive)                         │  │
│ │  Feedscore: r = +0.31 (moderate positive)                     │  │
│ │  This suggests: Similar-performing players intentionally       │  │
│ │  team up together.                                             │  │
│ │  [View Full Analysis]                                          │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ 💡 WHAT THIS MEANS TOGETHER                                         │
│ ════════════════════════════════════════════════════════════════    │
│                                                                      │
│ These complementary findings suggest:                               │
│                                                                      │
│ 1. Premade teams form **intentionally**: Both structural coherence  │
│    (balance) and skill similarity (assortativity) are high.         │
│                                                                      │
│ 2. Teams are **strategically composed**: Players don't just play    │
│    with friends; they select teammates by skill level.             │
│                                                                      │
│ 3. The network reflects **genuine social structure**, not           │
│    matchmaking artifacts: Real relationship patterns emerge.        │
│                                                                      │
│ ✅ Strong Result: Both analyses show structure                      │
│ ✅ Low Risk:      Multiple independent signals converge             │
│ ✅ Clear Story:   Skill-aware team formation with stable patterns  │
│                                                                      │
│ 📖 Reading: [Thesis Framework Signed Balance + Assortativity]      │
│                                                                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 🛠️  PARAMETERS & METHODOLOGY                                        │
│ ────────────────────────────────────────────────────────────────   │
│                                                                      │
│ Signed Balance:                                                     │
│ • minEdgeSupport: 2 (edges must appear in ≥2 matches)             │
│ • tiePolicy: exclude (50-50 ally/enemy edges removed)              │
│ • validTriad: all 3 edges must exist in projection                │
│                                                                      │
│ Assortativity:                                                      │
│ • Pearson correlation of player metrics across edges               │
│ • minPlayerMatchCount: 5 (exclude low-sample players)              │
│ • Breakdown: global, within-cluster, cross-cluster, strong/weak    │
│                                                                      │
│ ✓ Both analyses are deterministic and reproducible                │
│ ✓ Results stable under reasonable parameter variations             │
│ [Sensitivity Analysis] [View Raw Parameters]                      │
│                                                                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 📋 INTERPRETATION MATRIX: What Different Combinations Mean        │
│                                                                      │
│ ┌────────────┬────────────────┬─────────────────────────────────┐  │
│ │ Interpretation                          │ Your Results        │  │
│ ├────────────────────────────────────────┼─────────────────────┤  │
│ │ High Balance + High Assortativity       │ ✅ YOU ARE HERE     │  │
│ │ → Stable, skill-intentional network    │ (Balance: 67%      │  │
│ │   Best-case thesis scenario             │  Opscore: +0.42)   │  │
│ │                                         │                     │  │
│ │ High Balance + Low Assortativity       │                     │  │
│ │ → Stable but skill-orthogonal          │                     │  │
│ │   Teams are coherent but not skill-matched                  │  │
│ │                                         │                     │  │
│ │ Low Balance + High Assortativity       │                     │  │
│ │ → Skill clustered but structurally unstable                │  │
│ │   Similar players play together but relationships contradictory│  │
│ │                                         │                     │  │
│ │ Low Balance + Low Assortativity        │                     │  │
│ │ → Random network                       │                     │  │
│ │   No structure on either dimension      │                     │  │
│ └────────────────────────────────────────┴─────────────────────┘  │
│                                                                      │
│ 🎯 Next Steps in Analysis                                           │
│ ────────────────────────────────────────────────────────────────   │
│ • Validate on temporal subsets                                      │
│ • Explore parameter sensitivity                                     │
│ • Compare against null model                                        │
│ • Write thesis section 4.2                                         │
│                                                                      │
│ 📊 [Compare Parameter Variations] [Export Report] [View on 3D]     │
│ 📁 [Save Analysis Set] [Print PDF]                                 │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Enhanced Individual Pages

**SignedBalancePage.tsx**
- [ ] Add collapsible interpretation guide section
- [ ] Enhance triad example visualization (show player names/tiers)
- [ ] Add preset parameter buttons
- [ ] Improve top nodes display with links
- [ ] Add cluster summary comparisons to global avg
- [ ] Better error/insufficient data messaging

**AssortativityPage.tsx**
- [ ] Add coefficient interpretation banner
- [ ] Show what edge categories mean (within/cross/strong/weak)
- [ ] Add breakdown comparison chart
- [ ] Better edge case handling
- [ ] Add sample size / confidence indicators

**Shared Theme Improvements**
- [ ] Define interpretation color palette
- [ ] Create reusable interpretation banner component
- [ ] Add info tooltip component (consistent styling)

### Phase 2: Comparative Dashboard (If Approved)

**New Components**
- [ ] `DualAnalyticsView.tsx` - main dashboard layout
- [ ] `AnalysisComparison.tsx` - interpretation matrix
- [ ] `InterpretationGuide.tsx` - narrative explanation
- [ ] `ParameterSummary.tsx` - show what params were used

**Navigation Updates**
- [ ] Add "View Combined Analysis" buttons to both pages
- [ ] Add new route: `/analytics/signed-balance-assortativity`
- [ ] Add breadcrumb navigation

**Data Flow**
- [ ] Create context to share recent analysis results
- [ ] Implement result caching (localStorage?)
- [ ] Add "run both with recommended params" button

### Phase 3: Comparison UI (If Approved)

**New Components**
- [ ] `ParameterSweepView.tsx` - comparison across param variations
- [ ] `SensitivityChart.tsx` - line charts showing stability
- [ ] `RunComparison.tsx` - side-by-side result tables

---

## Questions for Design Discussion

1. **Primary User**: Thesis committee reviewers or internal exploration tool?
   - Affects: clarity of explanations, interactivity level

2. **Parameter Tuning**: Do we expect users to adjust parameters?
   - Affects: prominence of comparison features, presets

3. **Visual Integration**: Should results appear on the 3D graph sphere?
   - Affects: scope, technical complexity, timeline

4. **Export Requirements**: Does thesis need results in PDF/markdown format?
   - Affects: export component priority, report templating

5. **Performance**: Run both analyses regularly or store results?
   - Affects: caching strategy, backend polling

---

## Timeline Estimate

| Phase | Components | Effort | Timeline |
|-------|-----------|--------|----------|
| **1** | Enhanced pages + shared components | 1-2 days | Week 1 |
| **2** | Combined dashboard | 2-3 days | Week 1-2 |
| **3** | Parameter comparison (optional) | 3-5 days | Week 2-3 |
| **4** | Graph visualization integration (optional, high effort) | 1-2 weeks | Later phase |

---

## Accessibility & Performance Notes

- ✅ Both pages lazy-load components
- ✅ Mock mode available for demo without backend
- ⚠️ 3D graph sphere can be GPU-intensive (already handled in code)
- ⚠️ Result data can be large (triads, cluster summaries)
  - Consider pagination or virtual scrolling for large lists
- ✅ Color-blind friendly palette recommended (verify with theme)
- ✅ Semantic HTML for screen reader compatibility (already done)

---

## Related Documentation

- [Signed Balance Theory](./signed-balance-theory.md)
- [Assortativity Analysis](./assortativity-analysis.md)
- [Thesis Framework](./thesis-framework-signed-balance-and-assortativity.md)
- [New GUI Overview](./new-gui-overview.md)
