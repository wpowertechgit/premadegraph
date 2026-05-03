// Hex coordinate utilities for NeuroSim tribal simulation.
// Pointy-top hexagons with odd-r offset coordinates.
// Backend tile IDs are row-major (row * gridW + col); these helpers convert them
// to axial hex coordinates and then to canvas pixel positions.

export interface AxialCoord {
  q: number;
  r: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export const SQRT3 = Math.sqrt(3);

/** Row-major tile ID → axial hex coordinates (odd-r offset, pointy-top). */
export function tileIdToAxial(tileId: number, gridW: number): AxialCoord {
  const col = tileId % gridW;
  const row = Math.floor(tileId / gridW);
  return { q: col - (row - (row & 1)) / 2, r: row };
}

/** Axial hex coordinates → pixel center (pointy-top hexes). */
export function axialToPixel(q: number, r: number, hexSize: number): PixelPoint {
  return {
    x: hexSize * (SQRT3 * q + (SQRT3 / 2) * r),
    y: hexSize * 1.5 * r,
  };
}

/** Six corner points of a pointy-top hex centered at (cx, cy). */
export function hexCorners(cx: number, cy: number, hexSize: number): PixelPoint[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return { x: cx + hexSize * Math.cos(angle), y: cy + hexSize * Math.sin(angle) };
  });
}

/**
 * Largest integer hexSize such that a gridW×gridH grid fits within maxPx in
 * both canvas dimensions (width and height).
 */
export function computeHexSize(gridW: number, gridH: number, maxPx: number): number {
  const fromW = (maxPx - 1) / (1 + SQRT3 * gridW);
  const fromH = (maxPx - 1) / (1.5 * gridH + 0.5);
  return Math.max(1, Math.floor(Math.min(fromW, fromH)));
}

/**
 * Canvas pixel dimensions and drawing origin for a hex grid.
 * originX/originY are the pixel offset added to axialToPixel results so tiles
 * near the edges are not clipped.
 */
export function hexCanvasDims(
  gridW: number,
  gridH: number,
  hexSize: number,
): { w: number; h: number; originX: number; originY: number } {
  const originX = hexSize;
  const originY = hexSize;
  const w = Math.ceil(hexSize * (1 + SQRT3 * gridW)) + 1;
  const h = Math.ceil(hexSize * (1.5 * gridH + 0.5)) + 1;
  return { w, h, originX, originY };
}

/** Pixel center of a tile given hex size and drawing origin. */
export function tileCenter(
  tileId: number,
  gridW: number,
  hexSize: number,
  originX: number,
  originY: number,
): PixelPoint {
  const { q, r } = tileIdToAxial(tileId, gridW);
  const { x, y } = axialToPixel(q, r, hexSize);
  return { x: x + originX, y: y + originY };
}

/**
 * Trace the hex polygon path into ctx without filling/stroking.
 * Call ctx.fill() or ctx.stroke() after.
 */
export function drawHexPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hexSize: number,
): void {
  const corners = hexCorners(cx, cy, hexSize);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 6; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
}
