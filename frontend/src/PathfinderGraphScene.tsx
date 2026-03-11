import React, { useEffect, useRef, useState } from "react";
import {
  type CanvasFrame,
  type GraphNode,
  type GraphSnapshot,
  type PathfinderRunResponse,
  type RelationType,
} from "./pathfinderTypes";

interface PathfinderGraphSceneProps {
  snapshot: GraphSnapshot;
  run: PathfinderRunResponse | null;
  frame: CanvasFrame;
  sourcePlayerId: string;
  targetPlayerId: string;
  variant: "preview" | "overlay";
}

function edgeKey(from: string, to: string): string {
  return [from, to].sort().join("|");
}

function getNodeById(snapshot: GraphSnapshot) {
  const map = new Map<string, GraphNode>();
  for (const node of snapshot.nodes) {
    map.set(node.id, node);
  }
  return map;
}

function getBaseEdgeColor(relation: RelationType) {
  return relation === "enemy" ? "#b85b2d" : "#5a6674";
}

function getNodeFill(nodeId: string, frame: CanvasFrame, sourcePlayerId: string, targetPlayerId: string) {
  if (frame.pathNodeIds.includes(nodeId) && frame.isTerminal) {
    return "#2fb36d";
  }
  if (frame.activeNodeId === nodeId) {
    return "#d6a341";
  }
  if (frame.frontierNodeIds.includes(nodeId)) {
    return "#be8a2d";
  }
  if (frame.visitedNodeIds.includes(nodeId)) {
    return "#4d92c3";
  }
  if (nodeId === sourcePlayerId) {
    return "#6f8fb7";
  }
  if (nodeId === targetPlayerId) {
    return "#c47650";
  }
  return "#6b7280";
}

export default function PathfinderGraphScene({
  snapshot,
  run,
  frame,
  sourcePlayerId,
  targetPlayerId,
  variant,
}: PathfinderGraphSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 960, height: variant === "overlay" ? 660 : 360 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setDimensions({
        width: Math.floor(entry.contentRect.width),
        height: Math.max(Math.floor(entry.contentRect.height), variant === "overlay" ? 660 : 360),
      });
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [variant]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(dimensions.width * pixelRatio);
    canvas.height = Math.floor(dimensions.height * pixelRatio);
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, dimensions.width, dimensions.height);
    context.fillStyle = "#1f2328";
    context.fillRect(0, 0, dimensions.width, dimensions.height);

    const nodeMap = getNodeById(snapshot);
    const padding = variant === "overlay" ? 72 : 46;
    const project = (node: GraphNode) => {
      const baseX = padding + (node.x / 100) * (dimensions.width - padding * 2);
      const baseY = padding + (node.y / 100) * (dimensions.height - padding * 2);
      return {
        x: dimensions.width / 2 + (baseX - dimensions.width / 2) * zoom + offset.x,
        y: dimensions.height / 2 + (baseY - dimensions.height / 2) * zoom + offset.y,
      };
    };

    context.strokeStyle = "#2b3138";
    context.lineWidth = 1;
    for (let line = padding; line < dimensions.width; line += 64) {
      context.beginPath();
      context.moveTo(line, 0);
      context.lineTo(line, dimensions.height);
      context.stroke();
    }
    for (let line = padding; line < dimensions.height; line += 64) {
      context.beginPath();
      context.moveTo(0, line);
      context.lineTo(dimensions.width, line);
      context.stroke();
    }

    for (const edge of snapshot.edges) {
      const source = nodeMap.get(edge.from);
      const target = nodeMap.get(edge.to);
      if (!source || !target) {
        continue;
      }

      const sourcePoint = project(source);
      const targetPoint = project(target);
      const key = edgeKey(edge.from, edge.to);
      const highlightState = frame.edgeStateByKey[key];
      const isPathEdge = frame.pathEdgeKeys.includes(key) && frame.isTerminal;

      let stroke = getBaseEdgeColor(edge.relation);
      let width = variant === "overlay" ? 1.5 : 1.2;
      let alpha = run ? 0.28 : 0.52;

      if (highlightState === "exploring") {
        stroke = "#d6a341";
        width = 2.5;
        alpha = 1;
      } else if (highlightState === "seen") {
        stroke = edge.relation === "enemy" ? "#d28e63" : "#7a8798";
        alpha = 0.88;
      } else if (highlightState === "resolved" || isPathEdge) {
        stroke = "#2fb36d";
        width = 3;
        alpha = 1;
      }

      context.save();
      context.globalAlpha = alpha;
      context.strokeStyle = stroke;
      context.lineWidth = width;
      if (edge.relation === "enemy") {
        context.setLineDash([8, 6]);
      }
      context.beginPath();
      context.moveTo(sourcePoint.x, sourcePoint.y);
      context.lineTo(targetPoint.x, targetPoint.y);
      context.stroke();
      context.restore();
    }

    const visibleNodeIds = run
      ? new Set<string>([...snapshot.nodes.map((node) => node.id), ...frame.revealedNodeIds])
      : new Set<string>(snapshot.nodes.map((node) => node.id));

    for (const node of snapshot.nodes) {
      if (!visibleNodeIds.has(node.id)) {
        continue;
      }

      const point = project(node);
      const fill = getNodeFill(node.id, frame, sourcePlayerId, targetPlayerId);
      const radiusBase = variant === "overlay" ? 9 : 6;
      const radius =
        frame.activeNodeId === node.id ? radiusBase + 2 : frame.pathNodeIds.includes(node.id) && frame.isTerminal ? radiusBase + 1 : radiusBase;

      context.beginPath();
      context.fillStyle = fill;
      context.strokeStyle = "#dfe4ea";
      context.lineWidth = variant === "overlay" ? 1.2 : 1;
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      const shouldLabel =
        variant === "overlay" ||
        node.id === sourcePlayerId ||
        node.id === targetPlayerId ||
        frame.activeNodeId === node.id ||
        frame.pathNodeIds.includes(node.id);

      if (shouldLabel) {
        context.fillStyle = "#e5e7eb";
        context.font = variant === "overlay" ? "12px Segoe UI" : "11px Segoe UI";
        context.textAlign = "center";
        context.fillText(node.label, point.x, point.y - radius - 10);
      }
    }
  }, [dimensions, frame, offset.x, offset.y, run, snapshot, sourcePlayerId, targetPlayerId, variant, zoom]);

  const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (event) => {
    dragStateRef.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove: React.PointerEventHandler<HTMLCanvasElement> = (event) => {
    if (!dragStateRef.current.active) {
      return;
    }

    const deltaX = event.clientX - dragStateRef.current.x;
    const deltaY = event.clientY - dragStateRef.current.y;
    dragStateRef.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
    };

    setOffset((currentValue) => ({
      x: currentValue.x + deltaX,
      y: currentValue.y + deltaY,
    }));
  };

  const stopDrag: React.PointerEventHandler<HTMLCanvasElement> = (event) => {
    dragStateRef.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel: React.WheelEventHandler<HTMLCanvasElement> = (event) => {
    event.preventDefault();
    setZoom((currentValue) => {
      const nextValue = event.deltaY < 0 ? currentValue * 1.08 : currentValue / 1.08;
      return Math.min(2.8, Math.max(0.75, Number(nextValue.toFixed(2))));
    });
  };

  const controlsStyle: React.CSSProperties = {
    position: "absolute",
    top: 14,
    right: 14,
    display: "flex",
    gap: "0.45rem",
    zIndex: 2,
  };

  const toolButtonStyle: React.CSSProperties = {
    borderRadius: "10px",
    border: "1px solid #3b434d",
    background: "#252a31",
    color: "#e5e7eb",
    padding: "0.45rem 0.7rem",
    fontSize: "0.84rem",
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: variant === "overlay" ? "100%" : "390px",
        borderRadius: "16px",
        overflow: "hidden",
        background: "#1f2328",
      }}
    >
      <div style={controlsStyle}>
        <button type="button" style={toolButtonStyle} onClick={() => setZoom((value) => Math.max(0.75, Number((value / 1.15).toFixed(2))))}>
          -
        </button>
        <button type="button" style={toolButtonStyle} onClick={() => setZoom(1)}>
          Fit
        </button>
        <button type="button" style={toolButtonStyle} onClick={() => setZoom((value) => Math.min(2.8, Number((value * 1.15).toFixed(2))))}>
          +
        </button>
        <button type="button" style={toolButtonStyle} onClick={() => setOffset({ x: 0, y: 0 })}>
          Center
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={(event) => {
          if (dragStateRef.current.active) {
            stopDrag(event);
          }
        }}
        onWheel={handleWheel}
        style={{
          width: "100%",
          height: "100%",
          cursor: dragStateRef.current.active ? "grabbing" : "grab",
          display: "block",
        }}
      />
    </div>
  );
}
