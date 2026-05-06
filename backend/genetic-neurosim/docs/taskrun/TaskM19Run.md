# Task M19 Run — Visual Screenshot Acceptance Harness

**Date:** 2026-05-06
**Status:** Done

## What Was Done

Added deterministic screenshot capture triggered by F6 key. Captures 3 frames at close (150), mid (350), and far (650) camera distances with the camera centered on the map. Saves PNGs to a timestamped folder. Created the visual acceptance checklist for future regression prevention.

### Files Changed

| File | Change |
|------|--------|
| `client-monogame/Diagnostics/ScreenshotCapture.cs` | **Created** — multi-frame screenshot state machine. `QueueCapture()` begins sequence; `BeginDraw()` returns RenderTarget2D; `EndDraw()` saves PNG and presents to back buffer. Captures at distances [150, 350, 650] with labels [close, mid, far]. Output: `screenshots/yyyy-MM-dd_HHmmss/m19_{label}.png`. |
| `client-monogame/Input/KeyboardCommandController.cs` | **Modified** — added `CaptureScreenshots` (Keys.F6) to `ReadCommands()` and `PlayableCommandSet` record |
| `client-monogame/GameRoot.cs` | **Modified** — added `_screenshotCapture` field, camera override logic in `Draw()` (saves/restores Distance/FocalPoint/Yaw/Pitch), RenderTarget2D redirect during capture frames, map center computation on F6 press |
| `docs/taskrun/visual-acceptance-checklist.md` | **Created** — structured checklist covering close/mid/far zoom criteria and regression checks |

### Design Decisions

- **Multi-frame capture**: Each zoom level gets its own frame so lighting, LOD, and visibility systems apply normally. A single-frame multi-capture would require re-drawing the scene 3 times with different matrices, which interacts poorly with `SpriteBatch` begin/end state and double the render cost.
- **Camera restore**: Original camera Distance, FocalPoint, Yaw, and Pitch are saved before override and restored after the capture frame. The camera is only restored if it was actually overridden or changed.
- **RenderTarget→PNG→Backbuffer**: Scene renders to a `RenderTarget2D`, which is saved as PNG via `SaveAsPng()`, then drawn to the back buffer as a full-screen quad so the player sees what was captured.
- **F6 key**: Chosen to avoid collision with existing debug keys (F5=isolated viewer, Escape=quit, Space=pause, R=reset, Tab=next, N=step, +/-=speed).
- **Deterministic framing**: Camera centers on tile grid midpoint. Yaw and pitch fixed at 35 degrees. No randomness.

### Usage

```
1. Launch client-monogame
2. Press F6 at any point during simulation
3. 3 frames captured automatically (one per zoom level)
4. PNGs saved to screenshots/<timestamp>/m19_close.png, m19_mid.png, m19_far.png
5. Check docs/taskrun/visual-acceptance-checklist.md against screenshots
```

## Validation

- **Build:** `TribalNeuroSim.Client.csproj` compiles with 0 errors
- **Build:** `TribalNeuroSim.Client.Tests.csproj` compiles with 0 errors
- **Runtime:** Cannot validate screenshot capture visually in this session (requires Windows MonoGame runtime with GPU, active simulation, and visual inspection of output PNGs). Expected behavior:
  - F6 press schedules 3-frame capture
  - Frame 1 renders at distance=150 centered on map → `m19_close.png`
  - Frame 2 renders at distance=350 centered on map → `m19_mid.png`
  - Frame 3 renders at distance=650 centered on map → `m19_far.png`
  - Camera restores to player's previous view after capture
  - Debug HUD rendered during capture shows F6 override status

## Risks / Follow-ups

- **Screenshot folder location**: Saved relative to `AppDomain.CurrentDomain.BaseDirectory` (the build output folder, e.g. `bin/Debug/net8.0/screenshots/`). May not be intuitive. Could add a console log or HUD notification showing save path.
- **No HUD suppression**: Debug HUD and selection panel render into screenshots. May want a `--clean-screenshots` flag for promotional/paper screenshots that hides all UI.
- **Single viewpoint**: Only center-map captures are supported. Future could add F7 for "selected tribe" screenshot, F8 for "isolated model" screenshot.
- **No automated comparison**: Visual acceptance checklist is manual. Could add pixel-diff against reference screenshots in a CI test harness, but that requires a headless GPU context.
- **Capture during isolated viewer**: F6 is ignored during isolated viewer mode (the isolated viewer `return` short-circuits before screenshot logic). Could support screenshot during isolated viewer as a follow-up.
