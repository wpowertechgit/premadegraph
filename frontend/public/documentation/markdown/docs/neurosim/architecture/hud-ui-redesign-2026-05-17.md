# HUD & UI Redesign Plan — 2026-05-17

## Problem

Current UI is entirely hand-drawn with a 1×1 pixel texture and a bitmap `FontRenderer`. Everything is pixelated, panel sizing is manual, scroll/click areas are fragile rectangles, and there is no visual hierarchy. Looks like a debug overlay from 2009, not a thesis demo from 2026.

---

## Goals

1. Modern, readable HUD that does not embarrass the thesis presentation
2. Proper font rendering (no more bitmap aliasing at non-native sizes)
3. Consistent design language: dark glass panels, thin borders, accent colours already defined in `EscMenu.cs`
4. All panels mouse-driven — no key-only controls
5. Minimal scope: UI only, zero simulation logic changes

---

## Approach: Embedded Web Overlay (Electron-style)

The fastest path to a real-looking UI in 2026 is a transparent browser overlay rendered on top of the MonoGame window. The MonoGame window keeps doing all 3D rendering; a borderless `WebView2` (or CEF) window sits on top and draws the HUD in HTML/CSS/JS.

**Data flow:**

```
Rust backend (port 8000)
        │  REST + WebSocket frames
        ▼
Node bridge (port 3001)  ──── existing today
        │
        ├─► MonoGame client  (3D world render, no HUD)
        │
        └─► WebView2 overlay  (HUD, panels, tombstone ledger)
              └─ reads /api/neurosim/desktop/v1/* same endpoints
```

The overlay is a small React/Vite app (can live in `client-overlay/`) that polls or subscribes to the same endpoints the C# client already uses.

---

## What the Overlay Replaces

| Current (C# pixel art) | Replacement (HTML overlay) |
|---|---|
| `DebugHud` — tick, pop, wars, polity | Compact top-left status bar |
| `TombstonePanel` — pixelated list | Styled scrollable table, real fonts |
| `EscMenu` — pixel buttons | Proper modal with CSS transitions |
| `SelectionPanel` — tribe detail | Side panel card with stats bars |
| `LineageInspectorPanel` | Collapsible tree view |

---

## Overlay App Structure

```
client-overlay/
  src/
    App.tsx                  — root, transparent background, no chrome
    components/
      StatusBar.tsx          — top-left: tick / alive / wars / polity tiers
      TombstoneLedger.tsx    — bottom-left panel, paginated table
      TribeCard.tsx          — right panel, selected tribe detail
      EscMenu.tsx            — modal, triggered by ESC key event from MonoGame
    hooks/
      useSimStatus.ts        — polls /status every 500ms
      useTombstones.ts       — polls /tombstones every 8s
      useFrameStream.ts      — WebSocket subscriber for live tribe data
    index.css                — glass morphism base, CSS variables for colours
  vite.config.ts
  package.json
```

---

## Design Language

Inherit colour palette already defined in `EscMenu.cs` and `TombstonePanel.cs`:

```css
:root {
  --bg-panel:    rgba(12, 14, 16, 0.85);
  --border:      rgba(255, 255, 255, 0.08);
  --accent:      #67bcff;
  --text:        #e4ebe0;
  --muted:       #8e9a94;
  --danger:      #f55252;
  --success:     #5cdc84;
  --backdrop:    blur(8px) saturate(1.4);
}
```

Panel style: `background: var(--bg-panel); backdrop-filter: var(--backdrop); border: 1px solid var(--border); border-radius: 6px;`

Font: **Inter** (variable, woff2 bundled) — no more bitmap aliasing.

---

## MonoGame Side Changes (minimal)

1. Strip all `DebugHud`, `TombstonePanel`, `EscMenu`, `SelectionPanel`, `LineageInspectorPanel` draw calls from `GameRoot.cs`.
2. Keep the panels as C# types but stop calling `Draw()` on them — overlay replaces the visual.
3. Add one new REST route to Rust: `GET /api/desktop/v1/selected-tribe` — returns the currently selected tribe id so the overlay knows what to show in the side card. (Or just include `selected_tribe_id` in the existing `/status` response.)
4. ESC key: MonoGame catches ESC, sends `POST /api/desktop/v1/ui/esc-pressed`; overlay listens and opens its own modal. No more MonoGame-side EscMenu rendering.

---

## Implementation Steps

### Step 1 — Scaffold overlay app (1–2h)
- `npm create vite@latest client-overlay -- --template react-ts`
- Add `WebView2` NuGet to MonoGame project
- Transparent, always-on-top, borderless window anchored over MonoGame viewport
- Confirm overlay renders a `<div>Hello</div>` on top of 3D scene

### Step 2 — Status bar (1h)
- `useSimStatus` hook polling `/status` every 500ms
- Render: `Tick: 2134 | Alive: 47 | Wars: 12 | E:1 K:3 D:8 C:14 T:21`
- Top-left, 40px tall, full width, glass bg

### Step 3 — Tombstone ledger (1–2h)
- `useTombstones` polling every 8s
- Styled `<table>` with sticky header, scroll, sort on column click
- Shows: Tick, Cluster ID, Cause, PUUIDs (first 3, monospace)
- Toggle with K key (overlay listens to `window.addEventListener('keydown')`)

### Step 4 — Tribe side card (1–2h)
- `useFrameStream` subscribes to WebSocket for live per-tribe data
- Right-side panel: polity badge, population bar, food bar, territory count, behavior state, artifact radar (five axes as a mini bar chart)
- Appears when a tribe is selected (click on map → MonoGame updates `/status` `selected_tribe_id`)

### Step 5 — ESC menu (30min)
- CSS modal with `backdrop-filter: blur`
- Three buttons: Resume / Verbose Logs / Exit
- Exit calls `POST /api/desktop/v1/control/exit` → MonoGame exits

### Step 6 — Strip C# pixel panels (1h)
- Remove `Draw()` calls from `GameRoot.cs`
- Keep the underlying data/logic intact (tombstone fetch, selection system, etc.)
- Run `dotnet test` to confirm nothing broke

---

## Risks

| Risk | Mitigation |
|---|---|
| WebView2 not available on user machine | Bundle FixedVersionRuntime in build output |
| Overlay click-through needed for world map interaction | Set `CoreWebView2Controller.DefaultBackgroundColor` transparent; pass `pointer-events: none` on non-interactive areas |
| Z-order fighting MonoGame window | Use `SetWindowPos` HWND_TOPMOST on overlay only |
| IPC latency for selected-tribe sync | Add `selected_tribe_id` field to existing `/status` JSON — zero new round trips |

---

## What This Does NOT Change

- Simulation logic
- Rust backend
- Node bridge
- 3D rendering (terrain, banners, war lines)
- FrameV1 binary protocol
- Any thesis-facing data

---

## Estimated Total Time

| Phase | Time |
|---|---|
| Scaffold + WebView2 embed | 1–2h |
| Status bar | 1h |
| Tombstone ledger | 1–2h |
| Tribe card | 1–2h |
| ESC menu | 30min |
| Strip C# panels | 1h |
| **Total** | **~7–9h** |
