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

  // suppress unused warning for _strToHue — it's kept for future tribe-color seeding
  void _strToHue;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>Tribal Simulation</Typography>
      <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mb: 1 }}>
        Prototype: territory, logs, replay, and neural inspection are redesign targets
      </Typography>

      <Stack direction="row" spacing={2} alignItems="flex-start">
        {/* Canvas */}
        <Box>
          <canvas
            ref={canvasRef}
            style={{ border: "1px solid #333", display: "block" }}
          />
        </Box>

        {/* Controls */}
        <Paper sx={{ p: 2, minWidth: 220 }}>
          <Stack spacing={2}>
            <Chip
              label={status}
              color={connected ? "success" : "default"}
              size="small"
            />

            {frame && (
              <>
                <Typography variant="body2">Tick: {frame.tick}</Typography>
                <Typography variant="body2">Generation: {frame.generation}</Typography>
                <Typography variant="body2">Tribes alive: {frame.tribes.length}</Typography>
              </>
            )}

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

            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleGodMode}
            >
              God Mode (Kill Half)
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
      </Stack>
    </Box>
  );
}
