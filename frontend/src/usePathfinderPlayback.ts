import { useEffect, useMemo, useState } from "react";
import {
  type CanvasFrame,
  type PathfinderRunResponse,
  type PlaybackState,
} from "./pathfinderTypes";

function edgeKey(from: string, to: string): string {
  return [from, to].sort().join("|");
}

function buildFrame(
  run: PathfinderRunResponse | null,
  currentStepIndex: number,
  playbackState: PlaybackState,
): CanvasFrame {
  if (!run) {
    return {
      stepNumber: 0,
      activeNodeId: null,
      frontierNodeIds: [],
      visitedNodeIds: [],
      revealedNodeIds: [],
      revealedEdgeKeys: [],
      edgeStateByKey: {},
      pathNodeIds: [],
      pathEdgeKeys: [],
      isTerminal: false,
      phase: null,
    };
  }

  const revealedNodes = new Set<string>();
  const revealedEdges = new Set<string>();
  const edgeStateByKey: Record<string, CanvasFrame["edgeStateByKey"][string]> = {};
  let activeNodeId: string | null = null;
  let frontierNodeIds: string[] = [];
  let visitedNodeIds: string[] = [];
  let stepNumber = 0;
  let phase: CanvasFrame["phase"] = null;

  const limit = Math.min(currentStepIndex, Math.max(run.trace.length - 1, 0));
  for (let index = 0; index < run.trace.length && index <= limit; index += 1) {
    const traceStep = run.trace[index];
    activeNodeId = traceStep.activeNodeId;
    frontierNodeIds = traceStep.frontierNodeIds;
    visitedNodeIds = traceStep.visitedNodeIds;
    stepNumber = traceStep.step;
    phase = traceStep.phase;

    for (const nodeId of traceStep.frontierNodeIds) {
      revealedNodes.add(nodeId);
    }
    for (const nodeId of traceStep.visitedNodeIds) {
      revealedNodes.add(nodeId);
    }
    if (traceStep.activeNodeId) {
      revealedNodes.add(traceStep.activeNodeId);
    }

    for (const edge of traceStep.highlightedEdges) {
      const key = edgeKey(edge.from, edge.to);
      revealedEdges.add(key);
      edgeStateByKey[key] = edge.state;
      revealedNodes.add(edge.from);
      revealedNodes.add(edge.to);
    }
  }

  const showResolvedPath =
    playbackState === "finished" ||
    phase === "resolve" ||
    run.status === "same_source_target";

  const pathEdgeKeys = run.path.edges.map((edge) => edgeKey(edge.from, edge.to));
  const pathNodeIds = run.path.nodes;

  if (showResolvedPath) {
    for (const key of pathEdgeKeys) {
      revealedEdges.add(key);
      edgeStateByKey[key] = "resolved";
    }
    for (const nodeId of pathNodeIds) {
      revealedNodes.add(nodeId);
    }
  }

  return {
    stepNumber,
    activeNodeId,
    frontierNodeIds,
    visitedNodeIds,
    revealedNodeIds: Array.from(revealedNodes),
    revealedEdgeKeys: Array.from(revealedEdges),
    edgeStateByKey,
    pathNodeIds,
    pathEdgeKeys,
    isTerminal: showResolvedPath || phase === "complete",
    phase,
  };
}

export function usePathfinderPlayback(run: PathfinderRunResponse | null) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    if (!run) {
      setPlaybackState("idle");
      setCurrentStepIndex(0);
      return;
    }

    setCurrentStepIndex(0);
    setPlaybackState(run.trace.length > 0 ? "ready" : "finished");
  }, [run]);

  useEffect(() => {
    if (!run || playbackState !== "playing" || run.trace.length === 0) {
      return undefined;
    }

    const delay = Math.max(240, Math.floor(900 / playbackSpeed));
    const timer = window.setTimeout(() => {
      setCurrentStepIndex((currentValue) => {
        const lastIndex = run.trace.length - 1;
        if (currentValue >= lastIndex) {
          setPlaybackState("finished");
          return lastIndex;
        }
        return currentValue + 1;
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [playbackSpeed, playbackState, run]);

  const frame = useMemo(
    () => buildFrame(run, currentStepIndex, playbackState),
    [currentStepIndex, playbackState, run],
  );

  const canStep = Boolean(run && run.trace.length > 0);

  const play = () => {
    if (!run || run.trace.length === 0) {
      return;
    }
    setPlaybackState("playing");
  };

  const pause = () => {
    if (playbackState === "playing") {
      setPlaybackState("paused");
    }
  };

  const restart = () => {
    setCurrentStepIndex(0);
    if (run) {
      setPlaybackState(run.trace.length > 0 ? "ready" : "finished");
    }
  };

  const stepForward = () => {
    if (!run || run.trace.length === 0) {
      return;
    }

    setCurrentStepIndex((currentValue) => {
      const nextValue = Math.min(currentValue + 1, run.trace.length - 1);
      if (nextValue === run.trace.length - 1) {
        setPlaybackState("finished");
      } else {
        setPlaybackState("paused");
      }
      return nextValue;
    });
  };

  const stepBackward = () => {
    if (!canStep) {
      return;
    }

    setCurrentStepIndex((currentValue) => {
      const nextValue = Math.max(currentValue - 1, 0);
      setPlaybackState("paused");
      return nextValue;
    });
  };

  return {
    playbackState,
    currentStepIndex,
    playbackSpeed,
    setPlaybackSpeed,
    frame,
    play,
    pause,
    restart,
    stepForward,
    stepBackward,
    canStep,
  };
}
