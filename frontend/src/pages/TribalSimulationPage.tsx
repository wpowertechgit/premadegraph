import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, Typography, Slider, Button, Stack, Paper, Chip
} from "@mui/material";

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

export default function TribalSimulationPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const foodRef = useRef<Float32Array>(new Float32Array(GRID_W * GRID_H).fill(0.5));
  const biomeRef = useRef<Uint8Array>(new Uint8Array(GRID_W * GRID_H).fill(0));
  const tribeTerritory = useRef<Map<number, number>>(new Map()); // tileIdx -> tribeId
  const tribeColors = useRef<Map<number, string>>(new Map());
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

    // Draw tiles
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const idx = y * GRID_W + x;
        const biome = biomeRef.current[idx];
        const food = foodRef.current[idx];
        const px = x * TILE_PX;
        const py = y * TILE_PX;

        ctx.fillStyle = BIOME_COLORS[biome] || "#8BC34A";
        ctx.fillRect(px, py, TILE_PX, TILE_PX);

        // Food overlay (greenish alpha)
        ctx.fillStyle = `rgba(0,200,0,${food * 0.3})`;
        ctx.fillRect(px, py, TILE_PX, TILE_PX);

        // Territory tint
        const tribeId = tribeTerritory.current.get(idx);
        if (tribeId !== undefined) {
          const color = tribeColors.current.get(tribeId) || "rgba(255,255,255,0.2)";
          ctx.fillStyle = color;
          ctx.fillRect(px, py, TILE_PX, TILE_PX);
        }
      }
    }

    // Draw tribe home tile markers
    for (const tribe of f.tribes) {
      const tx = tribe.homeTile % GRID_W;
      const ty = Math.floor(tribe.homeTile / GRID_W);
      const px = tx * TILE_PX;
      const py = ty * TILE_PX;

      // Behavior dot
      ctx.fillStyle = BEHAVIOR_COLORS[tribe.behavior] || "#fff";
      ctx.beginPath();
      ctx.arc(px + TILE_PX / 2, py + TILE_PX / 2, 5, 0, Math.PI * 2);
      ctx.fill();

      // Population label (tiny)
      ctx.fillStyle = "#fff";
      ctx.font = "8px monospace";
      ctx.fillText(String(tribe.population), px + 2, py + TILE_PX - 2);
    }
  }, []);

  useEffect(() => {
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
        foodRef.current[ft.index] = ft.food;
      }

      setFrame(f);
      draw(f);
    };

    return () => ws.close();
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

      <Stack direction="row" spacing={2} alignItems="flex-start">
        {/* Canvas */}
        <Box>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
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
