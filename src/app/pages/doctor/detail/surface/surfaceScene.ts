import * as THREE from 'three';
import type { SurfaceGrid, SurfaceMesh } from '../model/surface';
import type { SurfaceLabel } from '../model/surfaceLabels';
import { HOURS_PER_DAY } from '../constants';

/**
 * Three.js scene of the glucose surface. Loaded on demand (`React.lazy`), so three stays out of the
 * first paint. It renders on demand: there is no animation loop, so `prefers-reduced-motion` needs
 * no extra handling; the view only moves when the doctor drags or presses an arrow key.
 */

const FIELD_OF_VIEW_DEGREES = 30;
const CAMERA_DISTANCE_FACTOR = 2.2;
/** Three-quarter view: the valleys and ridges of the surface are visible from above. */
const INITIAL_YAW = -0.75;
const INITIAL_PITCH = 0.6;
const PERCENT = 100;
const MIN_PITCH = 0.12;
const MAX_PITCH = 1.45;
const KEY_ROTATE_STEP = 0.1;
const DRAG_SENSITIVITY = 0.008;
const TARGET_OPACITY = 0.28;
const CURSOR_RADIUS = 0.05;
const CURSOR_SEGMENTS = 12;
const PIXEL_RATIO_LIMIT = 2;
const PLANE_MARGIN = 0.5;
const NEAR_PLANE = 0.01;
const FAR_PLANE = 100;
const AMBIENT_INTENSITY = 0.7;
const KEY_INTENSITY = 0.9;
const KEY_LIGHT_HEIGHT = 2;
const KEY_LIGHT_DEPTH = 2;
/** Half of a size: the centre of a box or of a span. */
const HALF = 0.5;
/** Pointer and clip space go from -1 to 1: a span of 2 starting at -1. */
const NDC_SPAN = 2;
/** Components of a position or a color. */
const ITEM_SIZE = 3;

export interface SurfaceSceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly grid: SurfaceGrid;
  readonly mesh: SurfaceMesh;
  /** Heights of the target range's lower and upper cut points, in scene units. */
  readonly targetHeights: { readonly low: number; readonly high: number };
  /** Height of the surface at a grid cell, in scene units (the same mapping the mesh uses). */
  readonly heightOfCell: (day: number, hour: number) => number;
  readonly cellSpacing: number;
  readonly axisColor: string;
  readonly targetColor: string;
  readonly cursorColor: string;
  /** Called while the pointer hovers the surface; `null` when it leaves. */
  readonly onHover: (cell: { readonly day: number; readonly hour: number } | null) => void;
  /** Text labels in scene coordinates, drawn in `labelLayer` over the canvas. */
  readonly labels: readonly SurfaceLabel[];
  readonly labelLayer: HTMLElement;
}

export interface SurfaceScene {
  setCursor(cell: { readonly day: number; readonly hour: number } | null): void;
  resetView(): void;
  dispose(): void;
}

/**
 * Creates the scene, or returns `null` when WebGL is unavailable, so the page keeps its textual
 * alternative and says so. Never throws to the caller.
 *
 * Pattern: none (plain factory around a three.js renderer).
 */
export function createSurfaceScene(options: SurfaceSceneOptions): SurfaceScene | null {
  const { canvas, grid, mesh, cellSpacing } = options;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_LIMIT));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW_DEGREES, 1, NEAR_PLANE, FAR_PLANE);
  scene.add(new THREE.AmbientLight('#ffffff', AMBIENT_INTENSITY));
  const key = new THREE.DirectionalLight('#ffffff', KEY_INTENSITY);
  key.position.set(1, KEY_LIGHT_HEIGHT, KEY_LIGHT_DEPTH);
  scene.add(key);

  const lastDay = Math.max(0, grid.dayKeys.length - 1);
  const lastHour = HOURS_PER_DAY - 1;
  const width = lastHour * cellSpacing;
  const depth = lastDay * cellSpacing;
  const center = new THREE.Vector3(width * HALF, 0, depth * HALF);

  // Surface.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, ITEM_SIZE));
  geometry.setAttribute('color', new THREE.BufferAttribute(mesh.colors, ITEM_SIZE));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  const surfaceMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 });
  const surface = new THREE.Mesh(geometry, surfaceMaterial);
  scene.add(surface);

  // Translucent slab of the target range, from the low to the high cut point.
  const slabHeight = Math.max(0, options.targetHeights.high - options.targetHeights.low);
  const slabGeometry = new THREE.BoxGeometry(width + PLANE_MARGIN, slabHeight, depth + PLANE_MARGIN);
  const slabMaterial = new THREE.MeshBasicMaterial({
    color: options.targetColor,
    transparent: true,
    opacity: TARGET_OPACITY,
    depthWrite: false,
  });
  const slab = new THREE.Mesh(slabGeometry, slabMaterial);
  slab.position.set(center.x, options.targetHeights.low + slabHeight * HALF, center.z);
  scene.add(slab);

  // Floor axes: hours along x, days along z.
  const axisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(width, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, depth),
  ]);
  const axisMaterial = new THREE.LineBasicMaterial({ color: options.axisColor });
  scene.add(new THREE.LineSegments(axisGeometry, axisMaterial));

  // Cursor marker.
  const cursorGeometry = new THREE.SphereGeometry(CURSOR_RADIUS, CURSOR_SEGMENTS, CURSOR_SEGMENTS);
  const cursorMaterial = new THREE.MeshBasicMaterial({ color: options.cursorColor });
  const cursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
  cursor.visible = false;
  scene.add(cursor);

  // Labels: plain text elements, projected to the screen on every render.
  const labelElements = options.labels.map((label) => {
    const element = document.createElement('span');
    element.className = 'surface-view__label';
    element.dataset['kind'] = label.kind;
    element.textContent = label.text;
    options.labelLayer.appendChild(element);
    return { element, position: new THREE.Vector3(...label.position) };
  });
  const placeLabels = () => {
    for (const { element, position } of labelElements) {
      const projected = position.clone().project(camera);
      const visible = projected.z > -1 && projected.z < 1;
      element.hidden = !visible;
      element.style.left = `${String(((projected.x + 1) / NDC_SPAN) * PERCENT)}%`;
      element.style.top = `${String(((1 - projected.y) / NDC_SPAN) * PERCENT)}%`;
    }
  };

  // View: spherical orbit around the centre of the surface.
  let yaw = INITIAL_YAW;
  let pitch = INITIAL_PITCH;
  const distance = Math.max(width, depth, slabHeight) * CAMERA_DISTANCE_FACTOR;
  const placeCamera = () => {
    camera.position.set(
      center.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      center.y + Math.sin(pitch) * distance,
      center.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.lookAt(center);
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let dragging: { x: number; y: number } | null = null;
  let disposed = false;

  const render = () => {
    if (disposed) return;
    renderer.render(scene, camera);
    placeLabels();
  };
  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    render();
  };
  const clampPitch = (value: number) => Math.min(MAX_PITCH, Math.max(MIN_PITCH, value));

  const pickCell = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((clientX - rect.left) / rect.width) * NDC_SPAN - 1,
      -((clientY - rect.top) / rect.height) * NDC_SPAN + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(surface, false)[0];
    if (!hit) {
      options.onHover(null);
      return;
    }
    const hour = Math.min(lastHour, Math.max(0, Math.round(hit.point.x / cellSpacing)));
    const day = Math.min(lastDay, Math.max(0, Math.round(hit.point.z / cellSpacing)));
    options.onHover({ day, hour });
  };

  const onPointerDown = (event: PointerEvent) => {
    dragging = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (dragging) {
      yaw -= (event.clientX - dragging.x) * DRAG_SENSITIVITY;
      pitch = clampPitch(pitch + (event.clientY - dragging.y) * DRAG_SENSITIVITY);
      dragging = { x: event.clientX, y: event.clientY };
      placeCamera();
      render();
      return;
    }
    pickCell(event.clientX, event.clientY);
  };
  const onPointerUp = (event: PointerEvent) => {
    dragging = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const onPointerLeave = () => {
    if (!dragging) options.onHover(null);
  };
  const rotations: Record<string, (() => void) | undefined> = {
    ArrowLeft: () => {
      yaw += KEY_ROTATE_STEP;
    },
    ArrowRight: () => {
      yaw -= KEY_ROTATE_STEP;
    },
    ArrowUp: () => {
      pitch = clampPitch(pitch + KEY_ROTATE_STEP);
    },
    ArrowDown: () => {
      pitch = clampPitch(pitch - KEY_ROTATE_STEP);
    },
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const rotate = rotations[event.key];
    if (!rotate) return;
    event.preventDefault();
    rotate();
    placeCamera();
    render();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('keydown', onKeyDown);
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(canvas);

  placeCamera();
  resize();
  render();

  return {
    setCursor(cell) {
      if (!cell) {
        cursor.visible = false;
      } else {
        cursor.visible = true;
        cursor.position.set(cell.hour * cellSpacing, options.heightOfCell(cell.day, cell.hour), cell.day * cellSpacing);
      }
      render();
    },
    resetView() {
      yaw = INITIAL_YAW;
      pitch = INITIAL_PITCH;
      placeCamera();
      render();
    },
    dispose() {
      disposed = true;
      observer?.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('keydown', onKeyDown);
      geometry.dispose();
      surfaceMaterial.dispose();
      slabGeometry.dispose();
      slabMaterial.dispose();
      axisGeometry.dispose();
      axisMaterial.dispose();
      cursorGeometry.dispose();
      cursorMaterial.dispose();
      options.labelLayer.replaceChildren();
      renderer.dispose();
    },
  };
}
