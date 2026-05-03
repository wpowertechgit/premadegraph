import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, Typography, Slider, Button, Stack, Paper, Chip
} from "@mui/material";
import {
  tileIdToAxial,
  axialToPixel,
  drawHexPath,
  computeHexSize,
  hexCanvasDims,
} from "../neurosimHex";

// ─── E1: Protocol version constants ─────────────────────────────────────────
// Current frame is V0 (legacy binary, no envelope header).
// Planned envelope: u16 protocol_version | u16 message_type | u32 payload_len | u64 tick | payload
export const PROTOCOL_VERSION = 1;
export const MESSAGE_TRIBE_FRAME_V0 = 0x0000; // legacy frame, no header
export const MESSAGE_WORLD_SNAPSHOT_V1 = 0x0001;
export const MESSAGE_TILE_DELTA_V1 = 0x0002;
export const MESSAGE_TRIBE_DELTA_V1 = 0x0003;
// ─────────────────────────────────────────────────────────────────────────────

const GRID_W = 40;
const GRID_H = 40;
const TILE_PX = 20; // 800px canvas / 40 tiles
const CANVAS_SIZE = GRID_W * TILE_PX; // 800

const BIOME_COLORS: Record<number, string> = {
  0: "#8BC34A", // Plains
  1: "#2E7D32", // Forest
  2: "#F9A825", // Desert
  3: "#607D8B", // Mountain
  4: "#388E3C", // Swamp (dark green)
  5: "#1565C0", // River
};

// Hash string to hue (0-360)
function strToHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

const BEHAVIOR_COLORS: Record<number, string> = {
  0: "#9E9E9E", // Settling
  1: "#4CAF50", // Foraging
  2: "#2196F3", // Migrating
  3: "#F44336", // AtWar
  4: "#FF9800", // Occupying
  5: "#00BCD4", // Peace
  6: "#3F51B5", // Allied
  7: "#FF5722", // Starving
  8: "#B71C1C", // Desperate
  9: "#000000", // Imploding
};

const BEHAVIOR_LABELS: Record<number, string> = {
  0: "Settling", 1: "Foraging", 2: "Migrating", 3: "At War",
  4: "Occupying", 5: "Peace", 6: "Allied", 7: "Starving",
  8: "Desperate", 9: "Imploding",
};

interface TribeFrame {
  id: number;
  population: number;
  homeTile: number;
  behavior: number;
  targetTribe: number;
  allyTribe: number;
  foodStores: number;
  aCombat: number;
  aRisk: number;
  aResource: number;
  aMapObj: number;
  territoryCount: number;
  generation: number;
}

interface SimFrame {
  tick: number;
  generation: number;
  tribes: TribeFrame[];
  foodTiles: Array<{ index: number; food: number }>;
}

// ─── E3: World snapshot types ─────────────────────────────────────────────
interface WorldTile {
  biome: number;
  max_food: number;
}

interface WorldSnapshot {
  width: number;
  height: number;
  seed: number;
  tiles: WorldTile[];
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── E5: Tile ownership types ─────────────────────────────────────────────
interface TileOwner {
  tile_id: number;
  owner_tribe_id: number | null;
  contested: boolean;
}

interface TileOwnershipSnapshot {
  tiles: TileOwner[];
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── H2: Tribe snapshot type ──────────────────────────────────────────────
interface TribeSnapshotStats {
  a_combat: number;
  a_risk: number;
  a_resource: number;
  a_map_objective: number;
  a_team: number;
  feed_risk: number;
  fight_conversion: number;
  damage_pressure: number;
  death_cost: number;
  survival_quality: number;
  economy: number;
  tempo: number;
  vision_control: number;
  objective_conversion: number;
  setup_control: number;
  protection_support: number;
}

interface TribeSnapshot {
  id: number;
  cluster_id: string;
  population: number;
  max_population: number;
  food_stores: number;
  behavior: string; // serde serializes BehaviorState enum as string name
  territory_count: number;
  target_tribe: number | null;
  ally_tribe: number | null;
  stats: TribeSnapshotStats;
  last_inputs: number[];
  last_outputs: number[];
  input_labels?: string[];
  output_labels?: string[];
  generation: number;
  ticks_alive: number;
  alive: boolean;
}

// Fallback labels used when backend doesn't include labels in snapshot
const INPUT_LABELS = [
  "food ratio", "pop ratio", "territory", "feed risk",
  "combat", "resource", "nearest enemy", "nearest ally",
];
const OUTPUT_LABELS = ["aggression", "resource drive", "goal drive"];
// ─────────────────────────────────────────────────────────────────────────────

function parseFrame(buf: ArrayBuffer): SimFrame {
  const view = new DataView(buf);
  let offset = 0;
  const readU32 = () => { const v = view.getUint32(offset, true); offset += 4; return v; };
  const readU16 = () => { const v = view.getUint16(offset, true); offset += 2; return v; };
  const readF32 = () => { const v = view.getFloat32(offset, true); offset += 4; return v; };
  const readU8 = () => { const v = view.getUint8(offset); offset += 1; return v; };

  const tickLo = readU32();
  const tickHi = readU32();
  const tick = tickLo + tickHi * 0x100000000;
  const tribeCount = readU32();
  const foodTileCount = readU32();
  const generation = readU32();

  const tribes: TribeFrame[] = [];
  for (let i = 0; i < tribeCount; i++) {
    const id = readU32();
    const population = readU32();
    const homeTile = readU16();
    const behavior = readU8();
    readU8(); // padding
    const foodStores = readF32();
    const aCombat = readF32();
    const aRisk = readF32();
    const aResource = readF32();
    const aMapObj = readF32();
    const territoryCount = readU16();
    const generation_tribe = readU16();
    tribes.push({ id, population, homeTile, behavior, targetTribe: 0xffff, allyTribe: 0xffff, foodStores, aCombat, aRisk, aResource, aMapObj, territoryCount, generation: generation_tribe });
  }

  const foodTiles: Array<{ index: number; food: number }> = [];
  for (let i = 0; i < foodTileCount; i++) {
    const index = readU16();
    const food = readF32();
    foodTiles.push({ index, food });
  }

  return { tick, generation, tribes, foodTiles };
}

// ─── E3: Fetch world snapshot (biomes), graceful fallback to all-plains ──────
async function fetchWorldSnapshot(
  biomeRef: React.MutableRefObject<Uint8Array>,
  gridWRef: React.MutableRefObject<number>,
  gridHRef: React.MutableRefObject<number>,
): Promise<void> {
  try {
    const res = await fetch("/api/neurosim/api/world-snapshot");
    if (!res.ok) return; // endpoint not yet implemented — keep plains fallback
    const snap: WorldSnapshot = await res.json();
    gridWRef.current = snap.width;
    gridHRef.current = snap.height;
    const total = snap.width * snap.height;
    const biomes = new Uint8Array(total);
    for (let i = 0; i < Math.min(total, snap.tiles.length); i++) {
      biomes[i] = snap.tiles[i].biome;
    }
    biomeRef.current = biomes;
  } catch {
    // backend not running or endpoint missing — retain all-plains default
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── E5: Fetch tile ownership, populate tribeTerritory and tribeColors ───────
async function fetchTileOwnership(
  tribeTerritory: React.MutableRefObject<Map<number, number>>,
  tribeColors: React.MutableRefObject<Map<number, string>>,
): Promise<void> {
  try {
    const res = await fetch("/api/neurosim/api/tile-ownership");
    if (!res.ok) return; // endpoint not yet implemented
    const snap: TileOwnershipSnapshot = await res.json();
    const territory = new Map<number, number>();
    for (const t of snap.tiles) {
      if (t.owner_tribe_id !== null) {
        territory.set(t.tile_id, t.owner_tribe_id);
        // assign stable color if not already assigned
        if (!tribeColors.current.has(t.owner_tribe_id)) {
          const hue = (t.owner_tribe_id * 137) % 360; // golden angle spread
          tribeColors.current.set(t.owner_tribe_id, `hsla(${hue},65%,55%,0.35)`);
        }
      }
    }
    tribeTerritory.current = territory;
  } catch {
    // endpoint missing — leave territory map empty
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export default function TribalSimulationPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const foodRef = useRef<Float32Array>(new Float32Array(GRID_W * GRID_H).fill(0.5));
  const biomeRef = useRef<Uint8Array>(new Uint8Array(GRID_W * GRID_H).fill(0));
  const tribeTerritory = useRef<Map<number, number>>(new Map()); // tileIdx -> tribeId
  const tribeColors = useRef<Map<number, string>>(new Map());
  // E3/E5: dynamic grid dims from world snapshot (fallback: 40x40)
  const gridWRef = useRef<number>(GRID_W);
  const gridHRef = useRef<number>(GRID_H);
  const [frame, setFrame] = useState<SimFrame | null>(null);
  const [connected, setConnected] = useState(false);
  const [tickRate, setTickRate] = useState(20);
  const [status, setStatus] = useState("Disconnected");

  // C3: Panel visibility state
  const [showControls, setShowControls] = useState(true);
  const [showEvents, setShowEvents] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  // C4: Pause state synced from backend
  const [paused, setPaused] = useState(false);

  // H2: Selected tribe and dossier panel
  const [showTribe, setShowTribe] = useState(false);
  const [selectedTribeId, setSelectedTribeId] = useState<number | null>(null);
  const [tribeSnapshot, setTribeSnapshot] = useState<TribeSnapshot | null>(null);
  // I4: Brain tab inside Tribe panel: "dossier" | "brain"
  const [tribeTab, setTribeTab] = useState<"dossier" | "brain">("dossier");

  // strToHue is used indirectly via tribeColors; keep reference stable
  const _strToHue = strToHue;

  const draw = useCallback((f: SimFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // F2: hex rendering — use dynamic grid dims from world snapshot if available
    const gw = gridWRef.current;
    const gh = gridHRef.current;
    const hexSize = computeHexSize(gw, gh, CANVAS_SIZE);
    const { w: canvasW, h: canvasH, originX, originY } = hexCanvasDims(gw, gh, hexSize);

    // Resizing clears the canvas
    canvas.width = canvasW;
    canvas.height = canvasH;

    // Draw hex tiles: biome fill → food overlay → territory tint
    for (let row = 0; row < gh; row++) {
      for (let col = 0; col < gw; col++) {
        const idx = row * gw + col;
        const biome = biomeRef.current[idx] ?? 0;
        const food = foodRef.current[idx] ?? 0.5;
        const { q, r } = tileIdToAxial(idx, gw);
        const { x, y } = axialToPixel(q, r, hexSize);
        const hx = x + originX;
        const hy = y + originY;

        ctx.fillStyle = BIOME_COLORS[biome] || "#8BC34A";
        drawHexPath(ctx, hx, hy, hexSize);
        ctx.fill();

        if (food > 0.05) {
          ctx.fillStyle = `rgba(0,200,0,${food * 0.3})`;
          drawHexPath(ctx, hx, hy, hexSize);
          ctx.fill();
        }

        // E5: territory tint from ownership snapshot
        const tribeId = tribeTerritory.current.get(idx);
        if (tribeId !== undefined) {
          ctx.fillStyle = tribeColors.current.get(tribeId) || "rgba(255,255,255,0.2)";
          drawHexPath(ctx, hx, hy, hexSize);
          ctx.fill();
        }
      }
    }

    // Draw tribe home tile markers at hex centers
    for (const tribe of f.tribes) {
      const { q, r } = tileIdToAxial(tribe.homeTile, gw);
      const { x, y } = axialToPixel(q, r, hexSize);
      const hx = x + originX;
      const hy = y + originY;

      // Behavior dot
      ctx.fillStyle = BEHAVIOR_COLORS[tribe.behavior] || "#fff";
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Population label (tiny)
      ctx.fillStyle = "#fff";
      ctx.font = "7px monospace";
      ctx.fillText(String(tribe.population), hx - 3, hy + hexSize - 2);
    }
  }, []);

  useEffect(() => {
    // E3: fetch world snapshot on mount — populates biomes and grid dims
    fetchWorldSnapshot(biomeRef, gridWRef, gridHRef);

    // E5: poll tile ownership every 2 s — populates tribeTerritory + colors
    const ownershipInterval = setInterval(() => {
      fetchTileOwnership(tribeTerritory, tribeColors);
    }, 2000);
    // initial fetch
    fetchTileOwnership(tribeTerritory, tribeColors);

    const ws = new WebSocket(`ws://${window.location.hostname}:3001/api/neurosim/ws/tribal-simulation`);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => { setConnected(true); setStatus("Connected"); };
    ws.onclose = () => { setConnected(false); setStatus("Disconnected"); };
    ws.onerror = () => setStatus("Error");

    ws.onmessage = (evt) => {
      if (!(evt.data instanceof ArrayBuffer)) return;
      const f = parseFrame(evt.data);

      // Update food tile cache
      for (const ft of f.foodTiles) {
        if (ft.index < foodRef.current.length) {
          foodRef.current[ft.index] = ft.food;
        }
      }

      // E5: assign stable colors for tribes seen in live frame (fallback when
      // tile-ownership endpoint is not yet available)
      for (const tribe of f.tribes) {
        if (!tribeColors.current.has(tribe.id)) {
          const hue = (tribe.id * 137) % 360;
          tribeColors.current.set(tribe.id, `hsla(${hue},65%,55%,0.35)`);
        }
      }

      setFrame(f);
      draw(f);
    };

    return () => {
      ws.close();
      clearInterval(ownershipInterval);
    };
  }, [draw]);

  const sendConfig = (patch: Record<string, unknown>) => {
    fetch("/api/neurosim/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(console.error);
  };

  const handleGodMode = () => {
    fetch("/api/neurosim/api/god-mode", { method: "POST" }).catch(console.error);
  };

  // J4: typed intervention helper
  const sendIntervention = (type: string, extra: Record<string, unknown> = {}) => {
    fetch("/api/neurosim/api/interventions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...extra }),
    }).catch(console.error);
  };

  // C4/C5: generic control POST + status refresh
  const sendControl = async (endpoint: string) => {
    try {
      await fetch(`/api/neurosim/api/control/${endpoint}`, { method: "POST" });
      const res = await fetch("/api/neurosim/api/status");
      if (res.ok) {
        const s = await res.json();
        setPaused(s.paused ?? false);
      }
    } catch {
      // backend unreachable — ignore
    }
  };

  // C4: status polling to keep paused badge in sync
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/neurosim/api/status");
        if (res.ok) {
          const s = await res.json();
          setPaused(s.paused ?? false);
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(poll);
  }, []);

  // H2: Fetch tribe snapshot whenever selectedTribeId changes, refresh every 1s
  useEffect(() => {
    if (selectedTribeId === null) { setTribeSnapshot(null); return; }
    let cancelled = false;
    const fetchSnap = async () => {
      try {
        const res = await fetch(`/api/neurosim/api/tribes/${selectedTribeId}`);
        if (!res.ok || cancelled) return;
        setTribeSnapshot(await res.json());
      } catch { /* backend unreachable */ }
    };
    fetchSnap();
    const iv = setInterval(fetchSnap, 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [selectedTribeId]);

  // H2: Canvas click — select nearest tribe home marker
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const gw = gridWRef.current;
    const hexSize = computeHexSize(gw, gridHRef.current, CANVAS_SIZE);
    const { originX, originY } = hexCanvasDims(gw, gridHRef.current, hexSize);
    let bestId = -1;
    let bestDist = Infinity;
    for (const tribe of frame.tribes) {
      const { q, r } = tileIdToAxial(tribe.homeTile, gw);
      const { x, y } = axialToPixel(q, r, hexSize);
      const dist = Math.hypot(mx - (x + originX), my - (y + originY));
      if (dist < bestDist) { bestDist = dist; bestId = tribe.id; }
    }
    if (bestId >= 0 && bestDist < hexSize * 3) {
      setSelectedTribeId(bestId);
      setShowTribe(true);
    }
  }, [frame]);

  // suppress unused warning for _strToHue — it's kept for future tribe-color seeding
  void _strToHue;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>Tribal Simulation</Typography>
      <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mb: 1 }}>
        Prototype: territory, logs, replay, and neural inspection are redesign targets
      </Typography>

      {/* C3: Panel toggle toolbar */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {([
          ["Controls",  showControls,  setShowControls],
          ["Tribe",     showTribe,     setShowTribe],
          ["Events",    showEvents,    setShowEvents],
          ["Analytics", showAnalytics, setShowAnalytics],
          ["Sessions",  showSessions,  setShowSessions],
        ] as [string, boolean, React.Dispatch<React.SetStateAction<boolean>>][]).map(([label, active, toggle]) => (
          <Button
            key={label}
            variant={active ? "contained" : "outlined"}
            size="small"
            onClick={() => toggle((v) => !v)}
            sx={{ textTransform: "uppercase", letterSpacing: 1, fontSize: "0.7rem" }}
          >
            {label}
          </Button>
        ))}
      </Stack>

      <Stack direction="row" spacing={2} alignItems="flex-start">
        {/* Canvas */}
        <Box>
          <canvas
            ref={canvasRef}
            style={{ border: "1px solid #333", display: "block", cursor: "pointer" }}
            onClick={handleCanvasClick}
          />
        </Box>

        {/* C3: Controls panel gated by showControls */}
        {showControls && (
          <Paper sx={{ p: 2, minWidth: 220 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={status}
                  color={connected ? "success" : "default"}
                  size="small"
                />
                {paused && <Chip label="PAUSED" color="warning" size="small" />}
              </Stack>

              {frame && (
                <>
                  <Typography variant="body2">Tick: {frame.tick}</Typography>
                  <Typography variant="body2">Generation: {frame.generation}</Typography>
                  <Typography variant="body2">Tribes alive: {frame.tribes.length}</Typography>
                </>
              )}

              {/* C4: Pause / Resume */}
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => sendControl(paused ? "resume" : "pause")}
                >
                  {paused ? "Resume" : "Pause"}
                </Button>
                {/* C5: Step Tick (only meaningful when paused) */}
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!paused}
                  onClick={() => sendControl("step-tick")}
                >
                  Step
                </Button>
              </Stack>

              {/* C5: Reset */}
              <Button
                variant="outlined"
                size="small"
                onClick={() => sendControl("reset")}
              >
                Reset Same Seed
              </Button>

              <Typography variant="caption">Tick Rate</Typography>
              <Slider
                min={1} max={60} value={tickRate}
                onChange={(_, v) => {
                  setTickRate(v as number);
                  sendConfig({ tick_rate: v });
                }}
                valueLabelDisplay="auto"
                size="small"
              />

              {/* J4: Intervention menu */}
              <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                Interventions
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => sendIntervention("cull_population", { scope: "global", percent: 0.5 })}
                >
                  Cull 50%
                </Button>
                <Button
                  variant="outlined"
                  color="success"
                  size="small"
                  onClick={() => sendIntervention("spawn_food", { scope: "global", amount: 0.5 })}
                >
                  Spawn Food
                </Button>
              </Stack>
              <Button
                variant="text"
                color="inherit"
                size="small"
                sx={{ fontSize: "0.65rem", color: "text.disabled" }}
                onClick={handleGodMode}
              >
                Legacy: Kill Half
              </Button>

              {/* Legend */}
              <Typography variant="caption" sx={{ mt: 1 }}>States:</Typography>
              {Object.entries(BEHAVIOR_LABELS).map(([k, label]) => (
                <Stack key={k} direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: BEHAVIOR_COLORS[Number(k)] }} />
                  <Typography variant="caption">{label}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        )}

        {/* H2 / I4: Tribe dossier + Brain tab panel */}
        {showTribe && (
          <Paper sx={{ p: 2, minWidth: 240, maxWidth: 300 }}>
            <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 1, display: "block", mb: 0.5 }}>
              Tribe {selectedTribeId !== null ? `#${selectedTribeId}` : "— click map to select"}
            </Typography>
            {/* I4: Tab bar */}
            <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
              {(["dossier", "brain"] as const).map((tab) => (
                <Button
                  key={tab}
                  size="small"
                  variant={tribeTab === tab ? "contained" : "outlined"}
                  onClick={() => setTribeTab(tab)}
                  sx={{ textTransform: "uppercase", letterSpacing: 1, fontSize: "0.6rem", minWidth: 60, py: 0.25 }}
                >
                  {tab}
                </Button>
              ))}
            </Stack>
            {tribeSnapshot ? (
              <>
                {tribeTab === "dossier" && (
                  <Stack spacing={0.5}>
                    <Typography variant="caption">Cluster: {tribeSnapshot.cluster_id}</Typography>
                    <Typography variant="caption">State: {tribeSnapshot.behavior}</Typography>
                    <Typography variant="caption">
                      Pop: {tribeSnapshot.population} / {tribeSnapshot.max_population}
                    </Typography>
                    <Typography variant="caption">Food: {tribeSnapshot.food_stores.toFixed(1)}</Typography>
                    <Typography variant="caption">Territory: {tribeSnapshot.territory_count} tiles</Typography>
                    <Typography variant="caption">Generation: {tribeSnapshot.generation}</Typography>
                    <Typography variant="caption">Ticks alive: {tribeSnapshot.ticks_alive}</Typography>
                    {tribeSnapshot.target_tribe !== null && (
                      <Typography variant="caption">Target: #{tribeSnapshot.target_tribe}</Typography>
                    )}
                    {tribeSnapshot.ally_tribe !== null && (
                      <Typography variant="caption">Ally: #{tribeSnapshot.ally_tribe}</Typography>
                    )}
                    <Typography variant="caption" sx={{ mt: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Stats
                    </Typography>
                    {(["a_combat","a_risk","a_resource","a_map_objective","a_team","feed_risk"] as const).map(k => (
                      <Stack key={k} direction="row" justifyContent="space-between">
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{k}</Typography>
                        <Typography variant="caption">{tribeSnapshot.stats[k].toFixed(3)}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}

                {/* I4: Brain tab — inputs, outputs, dominant drive highlight */}
                {tribeTab === "brain" && (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Neural Inputs ({tribeSnapshot.last_inputs.length})
                    </Typography>
                    {tribeSnapshot.last_inputs.map((v, i) => {
                      const label = (tribeSnapshot.input_labels ?? INPUT_LABELS)[i] ?? String(i);
                      return (
                        <Stack key={i} direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>{label}</Typography>
                          <Typography variant="caption">{v.toFixed(3)}</Typography>
                        </Stack>
                      );
                    })}
                    <Typography variant="caption" sx={{ mt: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Neural Outputs ({tribeSnapshot.last_outputs.length})
                    </Typography>
                    {(() => {
                      const maxOut = Math.max(...tribeSnapshot.last_outputs);
                      return tribeSnapshot.last_outputs.map((v, i) => {
                        const label = (tribeSnapshot.output_labels ?? OUTPUT_LABELS)[i] ?? String(i);
                        const isDominant = v === maxOut;
                        return (
                          <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" sx={{ color: isDominant ? "primary.main" : "text.secondary" }}>
                              {label}{isDominant ? " ▶" : ""}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: isDominant ? "bold" : "normal" }}>
                              {v.toFixed(3)}
                            </Typography>
                          </Stack>
                        );
                      });
                    })()}
                    <Typography variant="caption" sx={{ mt: 0.5, color: "text.disabled" }}>
                      gen {tribeSnapshot.generation} · {tribeSnapshot.ticks_alive} ticks
                    </Typography>
                  </Stack>
                )}
              </>
            ) : (
              <Typography variant="caption" sx={{ color: "text.disabled" }}>
                {selectedTribeId !== null ? "Loading…" : "Click a tribe marker on the map"}
              </Typography>
            )}
          </Paper>
        )}

        {/* C3: Events / Analytics / Sessions placeholders (collapsed unless toggled) */}
        {showEvents && (
          <Paper sx={{ p: 2, minWidth: 200 }}>
            <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
              Events
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: "text.disabled", mt: 1 }}>
              Event log — pending G4 endpoint
            </Typography>
          </Paper>
        )}
        {showAnalytics && (
          <Paper sx={{ p: 2, minWidth: 200 }}>
            <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
              Analytics
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: "text.disabled", mt: 1 }}>
              Live metrics — pending M1
            </Typography>
          </Paper>
        )}
        {showSessions && (
          <Paper sx={{ p: 2, minWidth: 200 }}>
            <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
              Sessions
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: "text.disabled", mt: 1 }}>
              Saved sessions — pending M3
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
