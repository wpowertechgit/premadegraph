# UX & Design System Guide: Signed Balance & Assortativity Frontend

## Color Semantics & Interpretation Palette

### Interpretation Colors (Scientific)

These colors should be used consistently across both pages and any comparison views to convey statistical meaning:

```
BALANCED / POSITIVE ASSORTATIVITY
  Primary:   #7fd2c3 (mint)          // "things align well"
  Secondary: #d7fbf5 (mint soft)     // lighter version for backgrounds
  Usage: Balanced triads, positive coefficients, good results

UNBALANCED / NEGATIVE ASSORTATIVITY
  Primary:   #ef9b7d (coral)         // "contradiction, tension"
  Secondary: #ffc4a5 (coral soft)    // lighter version
  Usage: Unbalanced triads, negative coefficients, issues

NEUTRAL / INCONCLUSIVE
  Primary:   #f0bb74 (accent/gold)   // "middle ground"
  Secondary: #f7d5a9 (accent soft)   // lighter version
  Usage: Near-zero coefficients, edge cases, insufficient data

HIGHLIGHT / EMPHASIS
  Primary:   #ffd700 (bright gold)   // for focus
  Secondary: #c19a3b (gold muted)    // for secondary emphasis
  Usage: Most unstable nodes, strongest findings

DATA SERIES (for distributions)
  Series 1:  #7fd2c3 (mint)          // balanced triads, positive edges
  Series 2:  #ef9b7d (coral)         // unbalanced triads, negative edges
  Series 3:  #f0bb74 (accent)        // neutral/tied/excluded
  Series 4:  #c8bea8 (muted)         // background/baseline
```

### Contrast & Accessibility

```
Text Color: #f7f2e8 (primary text, good contrast on dark bg)
Text Color: #c8bea8 (secondary text, muted)
Text Color: #c6badf (for amethyst theme, where applicable)
```

---

## Component Architecture

### Shared Interpretation Components

Create these reusable components in a new file `src/analyticsComponents.tsx`:

```typescript
// CoefficientBadge: Shows coefficient value with color coding
interface CoefficientBadgeProps {
  value: number | null;
  metric: "balance" | "assortativity";
  size?: "sm" | "md" | "lg";
}

// BalanceBar: Diverging bar for ±1 range values (balance, assortativity)
interface BalanceBarProps {
  value: number | null;
  label?: string;
  minLabel?: string;
  maxLabel?: string;
  metric?: "balance" | "assortativity";
}

// DistributionBars: Stacked bar showing category distribution
interface DistributionBarsProps {
  categories: Array<{ label: string; count: number; type: "balanced" | "unbalanced" | "neutral" }>;
  total: number;
  showPercentages?: boolean;
}

// InterpretationBanner: "Here's what this result means" message
interface InterpretationBannerProps {
  finding: "high-balance" | "low-balance" | "high-assortativity" | "low-assortativity" | "neutral";
  context?: "global" | "within-cluster" | "cross-cluster" | "strong-ties" | "weak-ties";
}

// ParameterGuide: Collapsible explanation of what each parameter does
interface ParameterGuideProps {
  parameters: Array<{ key: string; label: string; explanation: string; impact: string }>;
}

// MethodologyCard: Box explaining a methodological choice
interface MethodologyCardProps {
  title: string;
  description: string;
  ruleText: string;
  impact: "high" | "medium" | "low";
}

// EdgeCategoryLegend: Explains within/cross/strong/weak categories
interface EdgeCategoryLegendProps {
  categories: Array<{ name: string; count: number; sampleSize: number; coefficient?: number | null }>;
}
```

### Existing Component Enhancements

**SignedBalancePage.tsx** additions:
```
- InterpretationBanner (top section)
- TriadPattern visualization (with real node labels + position hints)
- ParameterGuide (collapsible section)
- TopNodesEnhanced (with instability bars + cluster hints)
- ClusterComparison (vs. global baseline)
```

**AssortativityPage.tsx** additions:
```
- InterpretationBanner (top section)
- EdgeCategoryLegend (explains within/cross breakdown)
- CoefficientComparison (table or mini-charts showing all metrics)
- SampleBreakdown (shows edge counts per category)
```

---

## Information Architecture for Combined View

### Route Structure

```
/analytics/signed-balance-assortativity
├─ Section 1: Executive Summary
│  ├─ Finding 1: Balance ratio
│  ├─ Finding 2: Assortativity coefficients
│  └─ Interpretation: "What this means"
│
├─ Section 2: Interpretation Matrix
│  └─ 2×2 grid showing all combinations + yours
│
├─ Section 3: Methodology & Parameters
│  ├─ Signed Balance params
│  ├─ Assortativity params
│  └─ Rules / design choices
│
├─ Section 4: Detailed Results
│  ├─ [Tab] Signed Balance
│  ├─ [Tab] Assortativity
│  └─ [Tab] Parameter Sensitivity (optional)
│
└─ Section 5: Next Steps & Export
   ├─ "Run both analyses"
   ├─ "Compare parameters"
   ├─ "Export as PDF"
   └─ "View on 3D graph"
```

### Navigation Flow

```
SignedBalancePage
    ↓
[View Full Results]
    ↓
DualAnalyticsView
    ↓
[See Assortativity Details]
    ↓
AssortativityPage (with "back to dual view" link)
```

---

## Visual Hierarchy & Spacing Rules

### Typography

```
Page Title:        2.4rem, weight 800, color: ink
Section Title:     1.8rem, weight 700, color: ink
Subsection Title:  1.2rem, weight 600, color: ink
Label / Card Title: 1.02rem, weight 800, color: ink
Body Text:         1.0rem, weight 400, color: ink
Secondary Text:    0.95rem, weight 400, color: muted
Meta/Label:        0.82rem, weight 500, color: muted
```

### Spacing Grid (base unit: 0.25rem = 4px)

```
Section gaps:       2.0rem (8 units)
Card padding:       1.0-1.2rem (4-5 units)
Element gap:        0.75rem (3 units)
Tight grouping:     0.4-0.5rem (2 units)
Horizontal space:   1.5rem (6 units) between columns
```

### Card Styling

```
Standard Card:
  border-radius: 20-28px
  border: 1px solid rgba(240, 198, 132, 0.18)
  background: linear-gradient(160deg, rgba(47, 29, 18, 0.96) 0%, ...)
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.28)
  padding: 1.0-1.2rem

Soft Card (secondary):
  border-radius: 16-22px
  border: 1px solid rgba(240, 198, 132, 0.18)
  background: linear-gradient(160deg, rgba(21, 31, 34, 0.84) 0%, ...)
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04)
  padding: 0.85rem

Folded/Origami (signed balance theme):
  border-radius: 32px
  border: 1px solid rgba(213, 196, 255, 0.16)
  background: linear-gradient(145deg, rgba(34, 21, 58, 0.96) ...)
  box-shadow: 0 28px 80px rgba(10, 4, 18, 0.45)
```

---

## Interpretation Language & Phrasing

### For Signed Balance

**High Balance (>65%)**
```
"Most local relationship patterns are coherent."
"Ally/enemy patterns form stable triads."
"The network exhibits structural balance at the local level."
"Players form intentional, coherent team structures."
```

**Low Balance (<40%)**
```
"Local relationship patterns contain substantial contradictions."
"Ally/enemy patterns frequently form unstable triads."
"The network exhibits local instability."
"Many team compositions contradict expected patterns."
```

**Triad Explanations**
```
+++ (all allies)
  "Friend of my friend is my friend — the most stable pattern."

+-- (two enemies of each other, both ally third player)
  "Enemy of my enemy is my friend — a stable alliance pattern."

++- (two allies connected, both enemy to third)
  "Friend of my friend is my enemy — structurally contradictory."

--- (all enemies)
  "Enemy of my enemy is STILL my enemy — unstable and unusual."
```

### For Assortativity

**Positive Coefficient (>+0.2)**
```
"Connected players tend to have similar performance levels."
"Higher-skilled players concentrate in the same teams."
"The network shows positive assortative mixing."
"Performance similarity predicts connection."
```

**Negative Coefficient (<-0.2)**
```
"Connected players tend to have dissimilar performance levels."
"Skill levels are anti-correlated with team membership."
"The network shows negative assortative mixing."
"High and low performers frequently play together."
```

**Neutral / Near-Zero**
```
"Player performance is largely uncorrelated with team selection."
"Performance similarity doesn't predict connection."
"The network shows near-random mixing on this metric."
```

### Combined Interpretations

**Both Strong**
```
"This network exhibits both structural coherence (balanced triads)
and intentional skill-based team formation (assortative clustering).
This strongly suggests premade teams form through conscious,
strategic decisions about both relationships and skill levels."
```

**Balance Strong, Assortativity Weak**
```
"While the network forms stable local relationship patterns,
performance similarity doesn't drive team selection. Teams are
coherent in their social structure but orthogonal to skill levels."
```

**Balance Weak, Assortativity Strong**
```
"While similar performers cluster together, their local relationship
patterns are contradictory and unstable. This might indicate that
skill-based clustering can exist even without relationship coherence,
or that performance similarity is insufficient for stable triads."
```

---

## Interactive Elements & Interactions

### Parameter Controls

**Design Pattern**: Slider + label + small explanation

```
┌─────────────────────────────────┐
│ Min Edge Support    [2 ▮▮▮░░░] │
│ Description: Edges must appear  │
│ in at least this many matches   │
│                                 │
│ 🔍 Why it matters:              │
│ • Higher = only strong edges    │
│ • Lower = includes weak signals │
│ [Try: Conservative (5) / Normal │
│  (2) / Permissive (1)]          │
└─────────────────────────────────┘
```

**Preset Buttons**

```
[⚡ Presets]
├─ Conservative: Strict filtering, fewer edges
├─ Recommended: Balanced filtering (default)
└─ Permissive: Include weak signals
```

### Result Cards

**Hoverable Info State**

```
Normal state: Shows main metric + brief description
Hover state:  Adds small interpretation suggestion
Focus state:  Shows full explanation + links
```

**Copy to Clipboard**

```
All numeric results should have subtle copy button:
┌────────────────────────┐
│ r = +0.427    [📋]    │  ← Click to copy value
└────────────────────────┘
```

### Links & Cross-References

**In-page Navigation**
```
[See detailed parameter breakdown ↓]
[Back to top ↑]
```

**Cross-page Links**
```
SignedBalancePage:
  [📊 Compare with assortativity findings]
  → Opens DualAnalyticsView or AssortativityPage with context

AssortativityPage:
  [🔗 See structural balance analysis]
  → Opens DualAnalyticsView or SignedBalancePage with context
```

---

## Error & Edge Case States

### Insufficient Data

```
⚠️  Insufficient Data

This analysis requires more data points to run reliably.
Current status:
  • Players with metrics: 12 (need ≥ 25)
  • Edges meeting threshold: 8 (need ≥ 50)

Try:
  [Lower edge support threshold] or [Lower player match count]
```

### Partial Results

```
✓ Analysis Completed (with warnings)

Note: Some edges were skipped
  • 245 edges excluded (low co-play support)
  • 18 edges excluded (missing metric values)
  • 3 edges excluded (player below match count threshold)

This affects sample size but not result validity.
[Learn more about filtering rules]
```

### Extreme Values

```
⚡ Unusual Result

This coefficient is unusually high (r = 0.89).
This might indicate:
  • Very small sample size (check sample size above)
  • Extreme skew in metric distribution
  • Genuine very strong effect

Recommendation: Compare with different parameters [Run comparison]
```

---

## Animation & Transition Guidelines

### Page Transitions (Existing)

```
Keep existing transitions:
  • 160ms swap between pages
  • 320ms total transition time
  • Fade+slide effect
```

### Component Animations (New)

```
Collapsible sections:
  • 200ms ease-in-out
  • Smooth height transition

Bar chart fills:
  • 400ms ease-out (on first load)
  • 0ms (on parameter update) - instant refresh

Number formatting:
  • Crossfade or instant (no long animations for text)

Hover effects:
  • 100ms transition on color/background
  • No delays
```

### Loading States

```
Show skeleton loaders for:
  • Cards while awaiting results
  • Charts while computing
  • Not animations/spinners (use static placeholder)
```

---

## Responsive Design

### Breakpoints (per existing theme)

```
Mobile (<640px):
  • Single column layout
  • Collapse parameter panel to vertical stack
  • Stack charts vertically
  • Buttons full-width where possible

Tablet (640px - 1024px):
  • 2-column grid where beneficial
  • Side panel for parameters
  • Horizontal stacked charts

Desktop (>1024px):
  • Current 3-column or multi-panel layout
  • Side panel with parameters
  • Full information density
```

### Mobile Considerations

```
Touch-friendly:
  • Minimum 44px tap targets
  • Spacing for accidental taps
  • No hover-only content

Performance:
  • Reduce 3D sphere complexity on mobile
  • Lazy-load large tables
  • Defer heavy calculations

Readability:
  • Increase line height (1.6-1.8x)
  • Larger text (base 1.1rem instead of 1.0rem)
  • Reduce card padding slightly
```

---

## Component Implementation Order

### Highest Priority (Phase 1)

1. `InterpretationBanner.tsx` - used by both pages
2. Enhanced SignedBalancePage with interpretation
3. Enhanced AssortativityPage with interpretation
4. Update existing theme with interpretation colors

### Medium Priority (Phase 2)

5. `DualAnalyticsView.tsx` - combined page
6. `InterpretationMatrix.tsx` - comparison grid
7. Route setup for new page
8. Navigation updates

### Lower Priority (Phase 3+)

9. `ParameterComparison.tsx` - sensitivity analysis
10. `ReportExporter.tsx` - PDF/markdown export
11. Graph sphere integration features

---

## Testing Checklist

### Visual Regression Testing

- [ ] Signed balance page at mobile/tablet/desktop
- [ ] Assortativity page at mobile/tablet/desktop
- [ ] Dual analytics page at all breakpoints
- [ ] All interpretation banners at different findings
- [ ] Color blindness simulation (red/green/blue)

### Interaction Testing

- [ ] Parameter sliders work smoothly
- [ ] Preset buttons apply correctly
- [ ] Cross-page links navigate properly
- [ ] Back button works from dual view
- [ ] Copy-to-clipboard works

### Accessibility Testing

- [ ] Screen reader announces all labels
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color not sole differentiator
- [ ] Sufficient contrast ratios

### Performance Testing

- [ ] Page loads in <2s on slow connection
- [ ] Result updates in <500ms
- [ ] No jank during animations
- [ ] 3D graph sphere smooth on target hardware

---

## Documentation for Future Developers

### Colors Used

Include a visual reference in theme.ts:

```typescript
// Interpretation Semantics
const INTERPRETATION_PALETTE = {
  balanced: "#7fd2c3",        // Positive/Balanced (mint)
  unbalanced: "#ef9b7d",      // Negative/Unbalanced (coral)
  neutral: "#f0bb74",         // Neutral/Inconclusive (gold)
  emphasis: "#ffd700",        // Highlight/Important
};
```

### Component Props Documentation

Each new component should have:
- Purpose comment block
- Props interface with JSDoc
- Usage example
- Accessibility notes

Example:

```typescript
/**
 * InterpretationBanner
 * 
 * Displays a contextual message explaining what a statistical finding means.
 * Color-coded by finding type (balanced/unbalanced/neutral).
 * 
 * Use when:
 * - Showing top-level result summary
 * - Need to guide user interpretation
 * - Explaining edge cases or warnings
 * 
 * Accessibility: Semantic HTML, sufficient color contrast, screen-reader friendly
 */
export interface InterpretationBannerProps {
  /**  Type of finding being explained ("high-balance" | "low-balance" | ...) */
  finding: ...
  /** Optional context for more specific message ("within-cluster" | ...) */
  context?: ...
}
```

---

## Related Existing Components

- `theme.ts` - existing color palette and style functions
- `buttonStyle()`, `inputStyle()`, `pageShellStyle()` from theme
- `useI18n()` for translations
- `GraphSphereScene` for 3D visualization (reference architecture)
- Mock data functions in `signedBalanceMock.ts` and `assortativityMock.ts`

---

## Migration Path for Existing Pages

### Minimum Changes Needed

1. Add interpretation banners (2 new components)
2. Wrap existing result sections in interpretation cards
3. Add parameter guides (1 new component)
4. Update colors to use `INTERPRETATION_PALETTE`

### Recommended Enhancements

5. Enhance triad visualization with player info
6. Add breakdown legend for edge categories
7. Improve top nodes display formatting
8. Better error messaging

### Optional (Later Phase)

9. Add preset buttons
10. Add sensitivity analysis view
11. Add export functionality
