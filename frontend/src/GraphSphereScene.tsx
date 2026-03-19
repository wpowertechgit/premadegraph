import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BirdseyeBuffers, BirdseyeManifest, BirdseyeNodeMeta } from "./graphSphereTypes";

type FocusRequest = {
  index: number;
  token: number;
} | null;

interface GraphSphereSceneProps {
  manifest: BirdseyeManifest;
  nodeMeta: BirdseyeNodeMeta;
  buffers: BirdseyeBuffers;
  selectedIndex: number | null;
  focusRequest: FocusRequest;
  onHoverIndexChange: (index: number | null) => void;
  onSelectedIndexChange: (index: number | null) => void;
}

type SceneRefs = {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  mainLines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  highlightLines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  selectionMarker: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  hoverRaycaster: THREE.Raycaster;
  edgeIndicesByNode: Uint32Array[];
  frameHandle: number;
  resizeObserver: ResizeObserver;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clusterColor(clusterId: string) {
  const palette = [
    "#4f8f55",
    "#6ea55a",
    "#8d9f56",
    "#b28d59",
    "#6f7f45",
    "#3f8a6f",
    "#9fb0b7",
    "#8a6c44",
  ];
  const baseHex = palette[hashString(clusterId || "birdseye") % palette.length] || "#6ea55a";
  const color = new THREE.Color(baseHex);
  const tweak = ((hashString(`${clusterId}:tone`) % 17) - 8) / 100;
  color.offsetHSL(tweak * 0.06, tweak * 0.15, tweak * 0.08);
  return color;
}

function positionAt(index: number, positions: Float32Array) {
  const offset = index * 3;
  return new THREE.Vector3(
    positions[offset] ?? 0,
    positions[offset + 1] ?? 0,
    positions[offset + 2] ?? 0,
  );
}

function edgeRelation(edgeProp: number) {
  return (edgeProp & 1) === 1 ? "enemy" : "ally";
}

function createNodeDiscTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const gradient = context.createRadialGradient(32, 32, 6, 32, 32, 30);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.72, "rgba(255,255,255,0.98)");
  gradient.addColorStop(0.86, "rgba(255,255,255,0.62)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(32, 32, 30, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createStarField(radius: number) {
  const starCount = 3600;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  for (let index = 0; index < starCount; index += 1) {
    const spread = radius * (6.5 + (index % 17) * 0.18);
    const theta = 2.3999631 * index;
    const y = 1 - (2 * index) / Math.max(starCount - 1, 1);
    const radial = Math.sqrt(Math.max(1 - y * y, 0));
    const offset = index * 3;
    positions[offset] = Math.cos(theta) * radial * spread;
    positions[offset + 1] = y * spread;
    positions[offset + 2] = Math.sin(theta) * radial * spread;

    const color = new THREE.Color(index % 11 === 0 ? "#d2e6ff" : "#f6f0d8");
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: radius * 0.012,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function createPlanetShell(radius: number) {
  const geometry = new THREE.SphereGeometry(radius * 0.986, 96, 96);
  const material = new THREE.MeshBasicMaterial({
    color: "#12304d",
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(geometry, material);
  shell.renderOrder = 0;
  return shell;
}

function createAtmosphereShell(radius: number) {
  const geometry = new THREE.SphereGeometry(radius * 1.03, 64, 64);
  const material = new THREE.MeshBasicMaterial({
    color: "#56a6e8",
    transparent: true,
    opacity: 0.08,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(geometry, material);
  shell.renderOrder = 0;
  return shell;
}

function focusCameraOnNode(
  refs: SceneRefs,
  manifest: BirdseyeManifest,
  positions: Float32Array,
  index: number,
) {
  const nodePosition = positionAt(index, positions);
  const direction = nodePosition.clone().normalize();
  const fallbackDirection = direction.lengthSq() === 0 ? new THREE.Vector3(0, 0, 1) : direction;
  const cameraOffset = fallbackDirection
    .clone()
    .multiplyScalar(manifest.sphereRadius * 0.3)
    .add(new THREE.Vector3(0, manifest.sphereRadius * 0.02, 0));

  refs.controls.target.copy(nodePosition);
  refs.camera.position.copy(nodePosition.clone().add(cameraOffset));
  refs.controls.update();
}

export default function GraphSphereScene({
  manifest,
  nodeMeta,
  buffers,
  selectedIndex,
  focusRequest,
  onHoverIndexChange,
  onSelectedIndexChange,
}: GraphSphereSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRefs = useRef<SceneRefs | null>(null);
  const lastHoveredIndexRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);
  const pointerDownRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#02050a");
    scene.fog = new THREE.FogExp2("#04070d", 0.00055);

    const camera = new THREE.PerspectiveCamera(
      50,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      manifest.sphereRadius * 90,
    );
    camera.position.set(0, manifest.sphereRadius * 0.28, manifest.sphereRadius * 5.9);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1), false);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.65;
    controls.panSpeed = 0.8;
    controls.zoomSpeed = 1.25;
    controls.minDistance = manifest.sphereRadius * 0.06;
    controls.maxDistance = manifest.sphereRadius * 18;
    controls.target.set(0, 0, 0);
    controls.keyPanSpeed = 24;
    controls.listenToKeyEvents(window);
    controls.zoomToCursor = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.DOLLY,
    };

    const starField = createStarField(manifest.sphereRadius);
    scene.add(starField);
    const planetShell = createPlanetShell(manifest.sphereRadius);
    scene.add(planetShell);
    const atmosphereShell = createAtmosphereShell(manifest.sphereRadius);
    scene.add(atmosphereShell);
    const nodeDiscTexture = createNodeDiscTexture();

    const nodeColors = new Float32Array(nodeMeta.clusterIds.length * 3);
    for (let index = 0; index < nodeMeta.clusterIds.length; index += 1) {
      const color = clusterColor(nodeMeta.clusterIds[index] || "birdseye:solo");
      const colorOffset = index * 3;
      nodeColors[colorOffset] = color.r;
      nodeColors[colorOffset + 1] = color.g;
      nodeColors[colorOffset + 2] = color.b;
    }

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute("position", new THREE.BufferAttribute(buffers.nodePositions, 3));
    nodeGeometry.setAttribute("color", new THREE.BufferAttribute(nodeColors, 3));
    const nodeMaterial = new THREE.PointsMaterial({
      size: manifest.sphereRadius * 0.0105,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.98,
      alphaMap: nodeDiscTexture ?? undefined,
      map: nodeDiscTexture ?? undefined,
      alphaTest: 0.18,
      depthWrite: false,
    });
    const points = new THREE.Points(nodeGeometry, nodeMaterial);
    points.renderOrder = 3;
    scene.add(points);

    const edgeCount = manifest.edgeCount;
    const edgePositions = new Float32Array(edgeCount * 6);
    const edgeColors = new Float32Array(edgeCount * 6);
    const edgeIndicesByNode = Array.from({ length: manifest.nodeCount }, () => [] as number[]);

    for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex += 1) {
      const sourceIndex = buffers.edgePairs[edgeIndex * 2] ?? 0;
      const targetIndex = buffers.edgePairs[edgeIndex * 2 + 1] ?? 0;
      const sourceOffset = sourceIndex * 3;
      const targetOffset = targetIndex * 3;
      const lineOffset = edgeIndex * 6;
      edgePositions[lineOffset] = buffers.nodePositions[sourceOffset] ?? 0;
      edgePositions[lineOffset + 1] = buffers.nodePositions[sourceOffset + 1] ?? 0;
      edgePositions[lineOffset + 2] = buffers.nodePositions[sourceOffset + 2] ?? 0;
      edgePositions[lineOffset + 3] = buffers.nodePositions[targetOffset] ?? 0;
      edgePositions[lineOffset + 4] = buffers.nodePositions[targetOffset + 1] ?? 0;
      edgePositions[lineOffset + 5] = buffers.nodePositions[targetOffset + 2] ?? 0;

      const relation = edgeRelation(buffers.edgeProps[edgeIndex] ?? 0);
      const color = new THREE.Color(relation === "enemy" ? "#9a5f3d" : "#4d6f92");
      edgeColors[lineOffset] = color.r;
      edgeColors[lineOffset + 1] = color.g;
      edgeColors[lineOffset + 2] = color.b;
      edgeColors[lineOffset + 3] = color.r;
      edgeColors[lineOffset + 4] = color.g;
      edgeColors[lineOffset + 5] = color.b;

      edgeIndicesByNode[sourceIndex]?.push(edgeIndex);
      edgeIndicesByNode[targetIndex]?.push(edgeIndex);
    }

    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
    edgeGeometry.setAttribute("color", new THREE.BufferAttribute(edgeColors, 3));
    const edgeMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.014,
      depthWrite: false,
    });
    const mainLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    mainLines.renderOrder = 1;
    scene.add(mainLines);

    const highlightGeometry = new THREE.BufferGeometry();
    const highlightMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const highlightLines = new THREE.LineSegments(highlightGeometry, highlightMaterial);
    highlightLines.renderOrder = 4;
    scene.add(highlightLines);

    const selectionMarker = new THREE.Mesh(
      new THREE.SphereGeometry(manifest.sphereRadius * 0.012, 18, 18),
      new THREE.MeshBasicMaterial({ color: "#f4f7fb", transparent: true, opacity: 0.92 }),
    );
    selectionMarker.visible = false;
    selectionMarker.renderOrder = 5;
    scene.add(selectionMarker);

    const hoverRaycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const pickNodeIndex = (event: PointerEvent) => {
      const distance = camera.position.distanceTo(controls.target);
      if (distance > manifest.sphereRadius * 5.8) {
        return null;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      hoverRaycaster.params.Points = {
        threshold: clamp(distance * 0.00075, manifest.sphereRadius * 0.0011, manifest.sphereRadius * 0.0042),
      };
      hoverRaycaster.setFromCamera(pointer, camera);
      const intersections = hoverRaycaster.intersectObject(points);
      const nextIndex = typeof intersections[0]?.index === "number" ? intersections[0].index : null;
      return nextIndex;
    };

    const updateHover = (event: PointerEvent) => {
      if (pointerDownRef.current && dragMovedRef.current) {
        renderer.domElement.style.cursor = "grabbing";
        return;
      }

      const nextIndex = pickNodeIndex(event);
      if (lastHoveredIndexRef.current !== nextIndex) {
        lastHoveredIndexRef.current = nextIndex;
        onHoverIndexChange(nextIndex);
      }
      renderer.domElement.style.cursor = nextIndex !== null ? "crosshair" : "grab";
    };

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownRef.current = true;
      dragMovedRef.current = false;
      dragStartRef.current = { x: event.clientX, y: event.clientY };
      renderer.domElement.style.cursor = "grabbing";
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerDownRef.current && dragStartRef.current) {
        const dx = event.clientX - dragStartRef.current.x;
        const dy = event.clientY - dragStartRef.current.y;
        if (dx * dx + dy * dy > 36) {
          dragMovedRef.current = true;
        }
      }
      updateHover(event);
    };

    const handlePointerLeave = () => {
      pointerDownRef.current = false;
      dragStartRef.current = null;
      dragMovedRef.current = false;
      if (lastHoveredIndexRef.current !== null) {
        lastHoveredIndexRef.current = null;
        onHoverIndexChange(null);
      }
      renderer.domElement.style.cursor = "grab";
    };

    const handlePointerUp = (event: PointerEvent) => {
      const wasDragging = dragMovedRef.current;
      pointerDownRef.current = false;
      dragStartRef.current = null;
      dragMovedRef.current = false;

      if (wasDragging) {
        renderer.domElement.style.cursor = "grab";
        return;
      }

      const nextIndex = pickNodeIndex(event);
      onSelectedIndexChange(nextIndex);
      renderer.domElement.style.cursor = nextIndex !== null ? "crosshair" : "grab";
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const width = Math.max(Math.floor(entry.contentRect.width), 1);
      const height = Math.max(Math.floor(entry.contentRect.height), 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(container);

    const sceneState: SceneRefs = {
      camera,
      scene,
      renderer,
      controls,
      points,
      mainLines,
      highlightLines,
      selectionMarker,
      hoverRaycaster,
      edgeIndicesByNode: edgeIndicesByNode.map((item) => Uint32Array.from(item)),
      frameHandle: 0,
      resizeObserver,
    };
    sceneRefs.current = sceneState;

    renderer.domElement.style.cursor = "grab";
    const animate = () => {
      const distance = camera.position.distanceTo(controls.target);
      const edgeOpacity = 0.003 + clamp((manifest.sphereRadius * 5.3 - distance) / (manifest.sphereRadius * 8.4), 0, 1) * 0.03;
      if (Math.abs(edgeMaterial.opacity - edgeOpacity) > 0.0015) {
        edgeMaterial.opacity = edgeOpacity;
      }
      controls.update();
      renderer.render(scene, camera);
      sceneState.frameHandle = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      resizeObserver.disconnect();
      controls.stopListenToKeyEvents();
      if (sceneRefs.current?.frameHandle) {
        cancelAnimationFrame(sceneRefs.current.frameHandle);
      }
      const starGeometry = starField.geometry as THREE.BufferGeometry;
      const starMaterial = starField.material as THREE.PointsMaterial;
      starGeometry.dispose();
      starMaterial.dispose();
      const planetGeometry = planetShell.geometry as THREE.BufferGeometry;
      const planetMaterial = planetShell.material as THREE.MeshBasicMaterial;
      planetGeometry.dispose();
      planetMaterial.dispose();
      const atmosphereGeometry = atmosphereShell.geometry as THREE.BufferGeometry;
      const atmosphereMaterial = atmosphereShell.material as THREE.MeshBasicMaterial;
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      nodeDiscTexture?.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      highlightGeometry.dispose();
      highlightMaterial.dispose();
      selectionMarker.geometry.dispose();
      selectionMarker.material.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRefs.current = null;
    };
  }, [buffers, manifest, nodeMeta, onHoverIndexChange, onSelectedIndexChange]);

  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) {
      return;
    }

    if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= manifest.nodeCount) {
      refs.highlightLines.visible = false;
      refs.selectionMarker.visible = false;
      return;
    }

    const incidentEdges = refs.edgeIndicesByNode[selectedIndex] ?? new Uint32Array();
    const highlightPositions = new Float32Array(incidentEdges.length * 6);
    const highlightColors = new Float32Array(incidentEdges.length * 6);

    for (let itemIndex = 0; itemIndex < incidentEdges.length; itemIndex += 1) {
      const edgeIndex = incidentEdges[itemIndex] ?? 0;
      const sourceIndex = buffers.edgePairs[edgeIndex * 2] ?? 0;
      const targetIndex = buffers.edgePairs[edgeIndex * 2 + 1] ?? 0;
      const sourceOffset = sourceIndex * 3;
      const targetOffset = targetIndex * 3;
      const bufferOffset = itemIndex * 6;

      highlightPositions[bufferOffset] = buffers.nodePositions[sourceOffset] ?? 0;
      highlightPositions[bufferOffset + 1] = buffers.nodePositions[sourceOffset + 1] ?? 0;
      highlightPositions[bufferOffset + 2] = buffers.nodePositions[sourceOffset + 2] ?? 0;
      highlightPositions[bufferOffset + 3] = buffers.nodePositions[targetOffset] ?? 0;
      highlightPositions[bufferOffset + 4] = buffers.nodePositions[targetOffset + 1] ?? 0;
      highlightPositions[bufferOffset + 5] = buffers.nodePositions[targetOffset + 2] ?? 0;

      const relation = edgeRelation(buffers.edgeProps[edgeIndex] ?? 0);
      const color = new THREE.Color(relation === "enemy" ? "#ff9c67" : "#87b9ff");
      highlightColors[bufferOffset] = color.r;
      highlightColors[bufferOffset + 1] = color.g;
      highlightColors[bufferOffset + 2] = color.b;
      highlightColors[bufferOffset + 3] = color.r;
      highlightColors[bufferOffset + 4] = color.g;
      highlightColors[bufferOffset + 5] = color.b;
    }

    refs.highlightLines.geometry.dispose();
    refs.highlightLines.geometry = new THREE.BufferGeometry();
    refs.highlightLines.geometry.setAttribute("position", new THREE.BufferAttribute(highlightPositions, 3));
    refs.highlightLines.geometry.setAttribute("color", new THREE.BufferAttribute(highlightColors, 3));
    refs.highlightLines.visible = incidentEdges.length > 0;

    const markerPosition = positionAt(selectedIndex, buffers.nodePositions);
    refs.selectionMarker.position.copy(markerPosition);
    refs.selectionMarker.visible = true;
  }, [buffers, manifest.nodeCount, selectedIndex]);

  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !focusRequest) {
      return;
    }

    if (focusRequest.index < 0 || focusRequest.index >= manifest.nodeCount) {
      return;
    }

    focusCameraOnNode(refs, manifest, buffers.nodePositions, focusRequest.index);
  }, [buffers.nodePositions, focusRequest, manifest, manifest.nodeCount]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
}
