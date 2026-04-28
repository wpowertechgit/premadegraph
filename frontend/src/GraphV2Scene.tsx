import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { GraphV2Buffers, GraphV2Manifest, GraphV2NodeMeta } from "./graphV2Types";

interface GraphV2SceneProps {
  manifest: GraphV2Manifest;
  nodeMeta: GraphV2NodeMeta;
  buffers: GraphV2Buffers;
  showEnemyEdges: boolean;
  showBridgeEdges: boolean;
  showRawInternalEdges: boolean;
  selectedSourceId: string;
  selectedTargetId: string;
  pathNodeIds: string[];
  onNodeClick: (nodeId: string) => void;
  onHoverIndexChange: (index: number | null) => void;
}

type SceneRefs = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  nodeMesh: THREE.InstancedMesh;
  nodeHaloMesh: THREE.InstancedMesh;
  clusterFillMesh: THREE.Mesh;
  clusterOutlineMesh: THREE.Mesh;
  clusterUnityMesh: THREE.Mesh;
  allyInternalLines: THREE.LineSegments;
  allyBridgeLines: THREE.LineSegments;
  enemyLines: THREE.LineSegments;
  pathLines: THREE.LineSegments;
  mutablePositions: Float32Array;
  edgeIndexRows: EdgeIndexRow[];
  nodeIdToIndex: Map<string, number>;
  lastHighlightedIndices: Set<number>;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
};

type EdgeIndexRow = [sourceIndex: number, targetIndex: number, isEnemy: boolean, isBridge: boolean];
type ClusterVisualEntry = {
  clusterId: string;
  members: number[];
  center: [number, number];
  radius: number;
  color: THREE.Color;
};

const NODE_RADIUS = 5.2;
const NODE_HALO_RADIUS = 8.8;
const HIGHLIGHT_BEST_OP = 1;
const HIGHLIGHT_WORST_FEED = 2;

function unpackRelation(edgeProp: number) {
  return (edgeProp & 1) === 1 ? "enemy" : "ally";
}

function metricAt(metrics: Uint32Array, index: number, offset: number, stride: number) {
  return metrics[index * stride + offset] ?? 0;
}

function nodeColor(meta: GraphV2NodeMeta, index: number) {
  const flags = meta.highlightFlags[index] ?? 0;
  if ((flags & HIGHLIGHT_BEST_OP) && (flags & HIGHLIGHT_WORST_FEED)) {
    return new THREE.Color("#ffd65a");
  }
  if (flags & HIGHLIGHT_BEST_OP) {
    return new THREE.Color("#2fde82");
  }
  if (flags & HIGHLIGHT_WORST_FEED) {
    return new THREE.Color("#ff4d5f");
  }
  return new THREE.Color("#8fdcff");
}

function clusterColor(clusterId: string) {
  let hash = 2166136261;
  for (let index = 0; index < clusterId.length; index += 1) {
    hash ^= clusterId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const hue = ((Math.abs(hash) % 360) + 360) % 360;
  return new THREE.Color().setHSL(hue / 360, 0.72, 0.58);
}

function createInstancedCircleMaterial(opacity: number) {
  return new THREE.RawShaderMaterial({
    transparent: opacity < 1,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      precision highp float;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      attribute vec3 position;
      attribute mat4 instanceMatrix;
      attribute vec3 instanceColor;
      varying vec3 vColor;
      void main() {
        vColor = instanceColor;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, ${opacity.toFixed(3)});
      }
    `,
  });
}

function buildClusterVisualEntries(meta: GraphV2NodeMeta, positions: Float32Array): ClusterVisualEntry[] {
  const membersByCluster = new Map<string, number[]>();
  for (let index = 0; index < meta.clusterIds.length; index += 1) {
    const clusterId = meta.clusterIds[index] || "graph-v2:unclustered";
    const members = membersByCluster.get(clusterId) ?? [];
    members.push(index);
    membersByCluster.set(clusterId, members);
  }

  const entries: ClusterVisualEntry[] = [];
  for (const [clusterId, members] of membersByCluster) {
    if (members.length < 2) {
      continue;
    }

    let centerX = 0;
    let centerY = 0;
    for (const memberIndex of members) {
      centerX += positions[memberIndex * 2];
      centerY += positions[memberIndex * 2 + 1];
    }
    centerX /= members.length;
    centerY /= members.length;

    let radius = 36;
    for (const memberIndex of members) {
      const dx = positions[memberIndex * 2] - centerX;
      const dy = positions[memberIndex * 2 + 1] - centerY;
      radius = Math.max(radius, Math.hypot(dx, dy) + 24);
    }

    members.sort((left, right) => {
      const leftAngle = Math.atan2(positions[left * 2 + 1] - centerY, positions[left * 2] - centerX);
      const rightAngle = Math.atan2(positions[right * 2 + 1] - centerY, positions[right * 2] - centerX);
      return leftAngle - rightAngle || meta.ids[left].localeCompare(meta.ids[right]);
    });

    entries.push({
      clusterId,
      members,
      center: [centerX, centerY],
      radius,
      color: clusterColor(clusterId),
    });
  }

  entries.sort((left, right) => left.clusterId.localeCompare(right.clusterId));
  return entries;
}

function pushTriangleColor(colors: number[], color: THREE.Color, vertexCount: number) {
  for (let index = 0; index < vertexCount; index += 1) {
    colors.push(color.r, color.g, color.b);
  }
}

function createClusterFillMesh(entries: ClusterVisualEntry[]) {
  const vertices: number[] = [];
  const colors: number[] = [];
  const segments = 28;

  for (const entry of entries) {
    const color = entry.color;
    for (let segment = 0; segment < segments; segment += 1) {
      const a0 = (segment / segments) * Math.PI * 2;
      const a1 = ((segment + 1) / segments) * Math.PI * 2;
      vertices.push(
        entry.center[0],
        entry.center[1],
        -4,
        entry.center[0] + Math.cos(a0) * entry.radius,
        entry.center[1] + Math.sin(a0) * entry.radius,
        -4,
        entry.center[0] + Math.cos(a1) * entry.radius,
        entry.center[1] + Math.sin(a1) * entry.radius,
        -4,
      );
      pushTriangleColor(colors, color, 3);
    }
  }

  return createColoredMesh(vertices, colors, 0.055, 1);
}

function createClusterOutlineMesh(entries: ClusterVisualEntry[]) {
  const vertices: number[] = [];
  const colors: number[] = [];
  const segments = 36;
  const thickness = 9;

  for (const entry of entries) {
    const color = entry.color;
    const innerRadius = entry.radius;
    const outerRadius = entry.radius + thickness;
    for (let segment = 0; segment < segments; segment += 1) {
      const a0 = (segment / segments) * Math.PI * 2;
      const a1 = ((segment + 1) / segments) * Math.PI * 2;
      const inner0: [number, number] = [
        entry.center[0] + Math.cos(a0) * innerRadius,
        entry.center[1] + Math.sin(a0) * innerRadius,
      ];
      const outer0: [number, number] = [
        entry.center[0] + Math.cos(a0) * outerRadius,
        entry.center[1] + Math.sin(a0) * outerRadius,
      ];
      const inner1: [number, number] = [
        entry.center[0] + Math.cos(a1) * innerRadius,
        entry.center[1] + Math.sin(a1) * innerRadius,
      ];
      const outer1: [number, number] = [
        entry.center[0] + Math.cos(a1) * outerRadius,
        entry.center[1] + Math.sin(a1) * outerRadius,
      ];
      vertices.push(
        inner0[0],
        inner0[1],
        1,
        outer0[0],
        outer0[1],
        1,
        outer1[0],
        outer1[1],
        1,
        inner0[0],
        inner0[1],
        1,
        outer1[0],
        outer1[1],
        1,
        inner1[0],
        inner1[1],
        1,
      );
      pushTriangleColor(colors, color, 6);
    }
  }

  return createColoredMesh(vertices, colors, 0.52, 12);
}

function pushThickSegment(
  vertices: number[],
  colors: number[],
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness: number,
  z: number,
  color: THREE.Color,
) {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) {
    return;
  }
  const px = (-dy / length) * thickness * 0.5;
  const py = (dx / length) * thickness * 0.5;

  vertices.push(
    startX - px,
    startY - py,
    z,
    startX + px,
    startY + py,
    z,
    endX + px,
    endY + py,
    z,
    startX - px,
    startY - py,
    z,
    endX + px,
    endY + py,
    z,
    endX - px,
    endY - py,
    z,
  );
  pushTriangleColor(colors, color, 6);
}

function createClusterUnityMesh(entries: ClusterVisualEntry[], positions: Float32Array) {
  const vertices: number[] = [];
  const colors: number[] = [];

  for (const entry of entries) {
    const color = entry.color.clone().lerp(new THREE.Color("#b8efff"), 0.25);
    for (const memberIndex of entry.members) {
      pushThickSegment(
        vertices,
        colors,
        entry.center[0],
        entry.center[1],
        positions[memberIndex * 2],
        positions[memberIndex * 2 + 1],
        4.8,
        4,
        color,
      );
    }

    for (let index = 0; index < entry.members.length; index += 1) {
      const current = entry.members[index];
      const next = entry.members[(index + 1) % entry.members.length];
      pushThickSegment(
        vertices,
        colors,
        positions[current * 2],
        positions[current * 2 + 1],
        positions[next * 2],
        positions[next * 2 + 1],
        3.3,
        5,
        color,
      );
    }
  }

  return createColoredMesh(vertices, colors, 0.56, 18);
}

function createColoredMesh(vertices: number[], colors: number[], opacity: number, renderOrder: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

function computeBounds(positions: Float32Array) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < positions.length; index += 2) {
    minX = Math.min(minX, positions[index]);
    maxX = Math.max(maxX, positions[index]);
    minY = Math.min(minY, positions[index + 1]);
    maxY = Math.max(maxY, positions[index + 1]);
  }

  if (!Number.isFinite(minX)) {
    return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
  }
  return { minX, minY, maxX, maxY };
}

function screenToWorld(event: PointerEvent | WheelEvent, element: HTMLElement, camera: THREE.OrthographicCamera) {
  const rect = element.getBoundingClientRect();
  const pointer = new THREE.Vector3(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    0,
  );
  pointer.unproject(camera);
  return pointer;
}

function createLineSegments(
  positions: Float32Array,
  edgeRows: EdgeIndexRow[],
  relation: "ally-internal" | "ally-bridge" | "enemy",
) {
  const selectedRows = edgeRows.filter(([, , isEnemy, isBridge]) => {
    if (relation === "enemy") {
      return isEnemy;
    }
    return !isEnemy && (relation === "ally-bridge") === isBridge;
  });
  const linePositions = new Float32Array(selectedRows.length * 6);

  selectedRows.forEach(([sourceIndex, targetIndex], rowIndex) => {
    linePositions[rowIndex * 6] = positions[sourceIndex * 2];
    linePositions[rowIndex * 6 + 1] = positions[sourceIndex * 2 + 1];
    linePositions[rowIndex * 6 + 2] = 0;
    linePositions[rowIndex * 6 + 3] = positions[targetIndex * 2];
    linePositions[rowIndex * 6 + 4] = positions[targetIndex * 2 + 1];
    linePositions[rowIndex * 6 + 5] = 0;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  geometry.userData.edgeRows = selectedRows;
  const material = new THREE.LineBasicMaterial({
    color:
      relation === "enemy"
        ? "#ff6b57"
        : relation === "ally-bridge"
          ? "#52c7ff"
          : "#a9defc",
    transparent: true,
    opacity:
      relation === "enemy"
        ? 0.075
        : relation === "ally-bridge"
          ? 0.26
          : 0.045,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = relation === "ally-bridge" ? 8 : relation === "enemy" ? 6 : 4;
  return lines;
}

function updateLineGeometry(lines: THREE.LineSegments, positions: Float32Array) {
  const geometry = lines.geometry;
  const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
  const edgeRows = geometry.userData.edgeRows as EdgeIndexRow[];
  edgeRows.forEach(([sourceIndex, targetIndex], rowIndex) => {
    attribute.array[rowIndex * 6] = positions[sourceIndex * 2];
    attribute.array[rowIndex * 6 + 1] = positions[sourceIndex * 2 + 1];
    attribute.array[rowIndex * 6 + 3] = positions[targetIndex * 2];
    attribute.array[rowIndex * 6 + 4] = positions[targetIndex * 2 + 1];
  });
  attribute.needsUpdate = true;
}

function setInstancePosition(mesh: THREE.InstancedMesh, index: number, x: number, y: number, scale = 1) {
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(x, y, 2),
    new THREE.Quaternion(),
    new THREE.Vector3(scale, scale, scale),
  );
  mesh.setMatrixAt(index, matrix);
  mesh.instanceMatrix.needsUpdate = true;
}

function updatePathGeometry(refs: SceneRefs, pathNodeIds: string[]) {
  const positions: number[] = [];
  for (let index = 0; index < pathNodeIds.length - 1; index += 1) {
    const sourceIndex = refs.nodeIdToIndex.get(pathNodeIds[index]);
    const targetIndex = refs.nodeIdToIndex.get(pathNodeIds[index + 1]);
    if (sourceIndex === undefined || targetIndex === undefined) {
      continue;
    }
    positions.push(
      refs.mutablePositions[sourceIndex * 2],
      refs.mutablePositions[sourceIndex * 2 + 1],
      5,
      refs.mutablePositions[targetIndex * 2],
      refs.mutablePositions[targetIndex * 2 + 1],
      5,
    );
  }
  refs.pathLines.geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  refs.pathLines.geometry.computeBoundingSphere();
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

export default function GraphV2Scene({
  manifest,
  nodeMeta,
  buffers,
  showEnemyEdges,
  showBridgeEdges,
  showRawInternalEdges,
  selectedSourceId,
  selectedTargetId,
  pathNodeIds,
  onNodeClick,
  onHoverIndexChange,
}: GraphV2SceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const refsRef = useRef<SceneRefs | null>(null);
  const selectedIdsRef = useRef({ source: selectedSourceId, target: selectedTargetId });

  useEffect(() => {
    selectedIdsRef.current = { source: selectedSourceId, target: selectedTargetId };
  }, [selectedSourceId, selectedTargetId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x071019, 1);
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200);
    camera.position.set(0, 0, 100);

    const bounds = computeBounds(buffers.nodePositions);
    const width = Math.max(bounds.maxX - bounds.minX, 400);
    const height = Math.max(bounds.maxY - bounds.minY, 300);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const baseZoom = Math.min(container.clientWidth / width, container.clientHeight / height) * 0.86;
    camera.zoom = Math.max(baseZoom, 0.04);
    camera.position.x = centerX;
    camera.position.y = centerY;
    camera.updateProjectionMatrix();

    const mutablePositions = new Float32Array(buffers.nodePositions);
    const nodeIdToIndex = new Map(nodeMeta.ids.map((id, index) => [id, index]));
    const edgeRows: EdgeIndexRow[] = [];
    for (let index = 0; index < manifest.edgeCount; index += 1) {
      const sourceIndex = buffers.edgePairs[index * 2];
      const targetIndex = buffers.edgePairs[index * 2 + 1];
      const isEnemy = unpackRelation(buffers.edgeProps[index]) === "enemy";
      const isBridge =
        !isEnemy &&
        nodeMeta.clusterIds[sourceIndex] !== nodeMeta.clusterIds[targetIndex];
      edgeRows.push([
        sourceIndex,
        targetIndex,
        isEnemy,
        isBridge,
      ]);
    }

    const clusterVisualEntries = buildClusterVisualEntries(nodeMeta, mutablePositions);
    const clusterFillMesh = createClusterFillMesh(clusterVisualEntries);
    const clusterOutlineMesh = createClusterOutlineMesh(clusterVisualEntries);
    const clusterUnityMesh = createClusterUnityMesh(clusterVisualEntries, mutablePositions);
    scene.add(clusterFillMesh);
    scene.add(clusterOutlineMesh);
    scene.add(clusterUnityMesh);

    const allyInternalLines = createLineSegments(mutablePositions, edgeRows, "ally-internal");
    const allyBridgeLines = createLineSegments(mutablePositions, edgeRows, "ally-bridge");
    const enemyLines = createLineSegments(mutablePositions, edgeRows, "enemy");
    allyInternalLines.visible = showRawInternalEdges;
    allyBridgeLines.visible = showBridgeEdges;
    enemyLines.visible = showEnemyEdges && showBridgeEdges;
    scene.add(allyInternalLines);
    scene.add(allyBridgeLines);
    scene.add(enemyLines);

    const pathLines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: "#ffe16a",
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    pathLines.renderOrder = 40;
    scene.add(pathLines);

    const haloGeometry = new THREE.CircleGeometry(NODE_HALO_RADIUS, 18);
    const haloMaterial = createInstancedCircleMaterial(0.24);
    const nodeHaloMesh = new THREE.InstancedMesh(haloGeometry, haloMaterial, manifest.nodeCount);
    nodeHaloMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(manifest.nodeCount * 3), 3);
    nodeHaloMesh.renderOrder = 26;
    nodeHaloMesh.frustumCulled = false;

    const geometry = new THREE.CircleGeometry(NODE_RADIUS, 18);
    const material = createInstancedCircleMaterial(1);
    const nodeMesh = new THREE.InstancedMesh(geometry, material, manifest.nodeCount);
    nodeMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(manifest.nodeCount * 3), 3);
    nodeMesh.renderOrder = 30;
    nodeMesh.frustumCulled = false;
    for (let index = 0; index < manifest.nodeCount; index += 1) {
      const degree = metricAt(buffers.nodeMetrics, index, 0, manifest.nodeMetricStride);
      const scale = 0.74 + Math.min(Math.sqrt(degree), 8) * 0.09;
      const color = nodeColor(nodeMeta, index);
      setInstancePosition(
        nodeMesh,
        index,
        mutablePositions[index * 2],
        mutablePositions[index * 2 + 1],
        scale,
      );
      setInstancePosition(
        nodeHaloMesh,
        index,
        mutablePositions[index * 2],
        mutablePositions[index * 2 + 1],
        scale,
      );
      nodeMesh.setColorAt(index, color);
      nodeHaloMesh.setColorAt(index, color);
    }
    if (nodeMesh.instanceColor) {
      nodeMesh.instanceColor.needsUpdate = true;
    }
    if (nodeHaloMesh.instanceColor) {
      nodeHaloMesh.instanceColor.needsUpdate = true;
    }
    scene.add(nodeHaloMesh);
    scene.add(nodeMesh);

    const refs: SceneRefs = {
      renderer,
      scene,
      camera,
      nodeMesh,
      nodeHaloMesh,
      clusterFillMesh,
      clusterOutlineMesh,
      clusterUnityMesh,
      allyInternalLines,
      allyBridgeLines,
      enemyLines,
      pathLines,
      mutablePositions,
      edgeIndexRows: edgeRows,
      nodeIdToIndex,
      lastHighlightedIndices: new Set(),
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
    };
    refsRef.current = refs;
    updatePathGeometry(refs, pathNodeIds);

    let animationFrame = 0;
    let panning = false;
    let draggingNode: number | null = null;
    let pointerDownWorld = new THREE.Vector3();
    let pointerDownScreen = { x: 0, y: 0 };
    let cameraStart = new THREE.Vector3();

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      const aspect = width / height;
      const viewHeight = 1200;
      camera.left = (-viewHeight * aspect) / 2;
      camera.right = (viewHeight * aspect) / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    resize();

    const raycastNode = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      refs.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      refs.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      refs.raycaster.setFromCamera(refs.pointer, camera);
      const hit = refs.raycaster.intersectObject(nodeMesh, false)[0];
      return hit?.instanceId ?? null;
    };

    const pointerDown = (event: PointerEvent) => {
      renderer.domElement.setPointerCapture(event.pointerId);
      pointerDownScreen = { x: event.clientX, y: event.clientY };
      pointerDownWorld = screenToWorld(event, renderer.domElement, camera);
      cameraStart = camera.position.clone();
      draggingNode = raycastNode(event);
      panning = draggingNode === null;
    };

    const pointerMove = (event: PointerEvent) => {
      const world = screenToWorld(event, renderer.domElement, camera);
      if (draggingNode !== null) {
        mutablePositions[draggingNode * 2] = world.x;
        mutablePositions[draggingNode * 2 + 1] = world.y;
        setInstancePosition(nodeMesh, draggingNode, world.x, world.y, 1.28);
        setInstancePosition(nodeHaloMesh, draggingNode, world.x, world.y, 1.28);
        updateLineGeometry(allyInternalLines, mutablePositions);
        updateLineGeometry(allyBridgeLines, mutablePositions);
        updateLineGeometry(enemyLines, mutablePositions);
        updatePathGeometry(refs, pathNodeIds);
        return;
      }
      if (panning) {
        camera.position.x = cameraStart.x - (world.x - pointerDownWorld.x);
        camera.position.y = cameraStart.y - (world.y - pointerDownWorld.y);
        camera.updateProjectionMatrix();
        return;
      }
      onHoverIndexChange(raycastNode(event));
    };

    const pointerUp = (event: PointerEvent) => {
      const distance = Math.hypot(event.clientX - pointerDownScreen.x, event.clientY - pointerDownScreen.y);
      if (draggingNode !== null) {
        const index = draggingNode;
        const degree = metricAt(buffers.nodeMetrics, index, 0, manifest.nodeMetricStride);
        const scale = 0.74 + Math.min(Math.sqrt(degree), 8) * 0.09;
        setInstancePosition(nodeMesh, index, mutablePositions[index * 2], mutablePositions[index * 2 + 1], scale);
        setInstancePosition(nodeHaloMesh, index, mutablePositions[index * 2], mutablePositions[index * 2 + 1], scale);
        if (distance < 5) {
          onNodeClick(nodeMeta.ids[index]);
        }
      }
      draggingNode = null;
      panning = false;
    };

    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const before = screenToWorld(event, renderer.domElement, camera);
      camera.zoom *= event.deltaY > 0 ? 0.9 : 1.1;
      camera.zoom = THREE.MathUtils.clamp(camera.zoom, 0.025, 3.8);
      camera.updateProjectionMatrix();
      const after = screenToWorld(event, renderer.domElement, camera);
      camera.position.x += before.x - after.x;
      camera.position.y += before.y - after.y;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      const pulse = 1 + Math.sin(performance.now() * 0.0012) * 0.015;
      const sourceIndex = refs.nodeIdToIndex.get(selectedIdsRef.current.source);
      const targetIndex = refs.nodeIdToIndex.get(selectedIdsRef.current.target);
      const activeHighlights = new Set<number>();
      for (const index of [sourceIndex, targetIndex]) {
        if (index !== undefined) activeHighlights.add(index);
      }
      for (const index of refs.lastHighlightedIndices) {
        if (activeHighlights.has(index)) {
          continue;
        }
        const degree = metricAt(buffers.nodeMetrics, index, 0, manifest.nodeMetricStride);
        const scale = 0.74 + Math.min(Math.sqrt(degree), 8) * 0.09;
        setInstancePosition(nodeMesh, index, mutablePositions[index * 2], mutablePositions[index * 2 + 1], scale);
        setInstancePosition(nodeHaloMesh, index, mutablePositions[index * 2], mutablePositions[index * 2 + 1], scale);
      }
      for (const index of activeHighlights) {
        setInstancePosition(
          nodeMesh,
          index,
          mutablePositions[index * 2],
          mutablePositions[index * 2 + 1],
          1.55 * pulse,
        );
        setInstancePosition(
          nodeHaloMesh,
          index,
          mutablePositions[index * 2],
          mutablePositions[index * 2 + 1],
          1.55 * pulse,
        );
      }
      refs.lastHighlightedIndices = activeHighlights;
      renderer.render(scene, camera);
    };

    window.addEventListener("resize", resize);
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("wheel", wheel);
      refsRef.current = null;
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [buffers, manifest, nodeMeta, onHoverIndexChange, onNodeClick]);

  useEffect(() => {
    if (refsRef.current) {
      refsRef.current.enemyLines.visible = showEnemyEdges && showBridgeEdges;
    }
  }, [showBridgeEdges, showEnemyEdges]);

  useEffect(() => {
    if (refsRef.current) {
      refsRef.current.allyBridgeLines.visible = showBridgeEdges;
      refsRef.current.enemyLines.visible = showEnemyEdges && showBridgeEdges;
    }
  }, [showBridgeEdges, showEnemyEdges]);

  useEffect(() => {
    if (refsRef.current) {
      refsRef.current.allyInternalLines.visible = showRawInternalEdges;
    }
  }, [showRawInternalEdges]);

  useEffect(() => {
    if (refsRef.current) {
      updatePathGeometry(refsRef.current, pathNodeIds);
    }
  }, [pathNodeIds]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}
