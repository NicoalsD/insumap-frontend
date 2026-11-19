import * as THREE from 'three';

/**
 * Three.js scene of the triage map: every assigned patient is a sphere placed by time in range
 * (left to right), last glucose (height) and risk tier (depth, the most urgent in front). The
 * target range is a translucent slab, the "range band" of the product, so a sphere floating above
 * or sinking below it reads at a glance. Loaded on demand, so three stays out of the first paint.
 *
 * Rendering is on demand: frames run only while the view moves (drag, keys, the entrance or a
 * selection), never in an idle loop.
 */

export type MapRiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MapRangeState = 'VERY_LOW' | 'LOW' | 'IN_RANGE' | 'HIGH' | 'VERY_HIGH';

export interface MapPoint {
  readonly id: string;
  /** Share of the window in range, 0 to 100; null when the data is not enough. */
  readonly tirPct: number | null;
  /** Last glucose in mg/dL; null without readings. */
  readonly valueMgDl: number | null;
  readonly riskTier: MapRiskTier;
  readonly state: MapRangeState | null;
  readonly openAlerts: number;
}

export interface MapColors {
  readonly ranges: Readonly<Record<MapRangeState, string>>;
  readonly noData: string;
  readonly axis: string;
  readonly grid: string;
  readonly target: string;
  readonly selection: string;
}

export interface MapLabel {
  readonly text: string;
  readonly kind: 'axis' | 'tick';
  /** Position in data space: x is TIR %, y is mg/dL, z is a risk lane (0 = LOW .. 3 = CRITICAL). */
  readonly at: readonly [x: number, y: number, z: number];
}

export interface TriageMapSceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly labelLayer: HTMLElement;
  readonly colors: MapColors;
  readonly labels: readonly MapLabel[];
  /** Target range cut points (mg/dL) from the clinic profile. */
  readonly target: { readonly low: number; readonly high: number };
  readonly reducedMotion: boolean;
  /** Pointer over a patient (screen position in the canvas box), or null. */
  readonly onHover: (hit: { readonly id: string; readonly x: number; readonly y: number } | null) => void;
  readonly onSelect: (id: string) => void;
}

export interface TriageMapScene {
  setPoints(points: readonly MapPoint[]): void;
  setSelected(id: string | null): void;
  resetView(): void;
  /** Rotates the view by a step (keyboard). */
  rotate(dYaw: number, dPitch: number): void;
  dispose(): void;
}

// ---- Data space to scene space ----
const PERCENT_MAX = 100;
const GLUCOSE_MIN = 40;
const GLUCOSE_MAX = 400;
const WIDTH = 8;
const HEIGHT = 4;
const DEPTH = 4;
const LANES = 4;
const LANE_OF: Readonly<Record<MapRiskTier, number>> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

// ---- Look ----
const FIELD_OF_VIEW_DEGREES = 32;
const NEAR_PLANE = 0.1;
const FAR_PLANE = 100;
const CAMERA_DISTANCE = 12.5;
/** Low three-quarter view: heights (glucose) read against the band, the lanes still separate. */
const INITIAL_YAW = -0.45;
const INITIAL_PITCH = 0.24;
const MIN_PITCH = 0.08;
const MAX_PITCH = 1.35;
const DRAG_SENSITIVITY = 0.007;
const PIXEL_RATIO_LIMIT = 2;
const SPHERE_RADIUS = 0.2;
const ALERT_RADIUS_STEP = 0.05;
const MAX_ALERT_STEPS = 4;
const SPHERE_SEGMENTS = 24;
const TARGET_OPACITY = 0.14;
const TARGET_EDGE_OPACITY = 0.7;
const AMBIENT_INTENSITY = 0.75;
const KEY_INTENSITY = 1.1;
const RING_INNER = 0.3;
const RING_OUTER = 0.38;
const RING_SEGMENTS = 40;
const GRID_DIVISIONS = 10;
const STEM_OPACITY = 0.45;
/** Entrance: the spheres rise from the floor to their height. */
const ENTRANCE_MS = 900;
/** Moves between positions when the window or the filters change. */
const MOVE_MS = 600;
const STAGGER_MS = 35;
const HALF = 0.5;
/** The camera aims a little under the middle, so the floor and the band fill the view. */
const AIM_HEIGHT = 0.35;
const DOUBLE = 2;
/** Key light: above, to the left and in front of the map. */
const KEY_LIGHT_X = -3;
const KEY_LIGHT_Y = 8;
const KEY_LIGHT_Z = 6;
/** The selection ring floats just over the floor grid, so they never fight in the depth buffer. */
const RING_LIFT = 0.01;
const NDC_SPAN = 2;
const PERCENT = 100;
const EXPONENT = 10;
/** Moves travel along an arc: the lift is a share of the distance, never above the cap. */
const ARC_LIFT_SHARE = 0.35;
const ARC_MAX_LIFT = 1.2;
/** The last part of a move squashes the sphere a little as it lands. */
const LANDING_FROM = 0.72;
const SQUASH_AMOUNT = 0.18;

function sceneX(tirPct: number | null): number {
  const share = tirPct === null ? 0 : Math.min(PERCENT_MAX, Math.max(0, tirPct)) / PERCENT_MAX;
  return (share - HALF) * WIDTH;
}

function sceneY(valueMgDl: number): number {
  const clamped = Math.min(GLUCOSE_MAX, Math.max(GLUCOSE_MIN, valueMgDl));
  return ((clamped - GLUCOSE_MIN) / (GLUCOSE_MAX - GLUCOSE_MIN)) * HEIGHT;
}

function sceneZ(lane: number): number {
  return (lane / (LANES - 1) - HALF) * DEPTH;
}

/** Exponential ease-out: fast start, soft landing. */
function easeOut(t: number): number {
  return t >= 1 ? 1 : 1 - DOUBLE ** (-EXPONENT * t);
}

interface Sphere {
  readonly id: string;
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  readonly stem: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  from: THREE.Vector3;
  to: THREE.Vector3;
  delay: number;
}

/**
 * Creates the scene, or returns `null` when WebGL is unavailable. Never throws to the caller.
 *
 * Pattern: none (plain factory around a three.js renderer).
 */
export function createTriageMapScene(options: TriageMapSceneOptions): TriageMapScene | null {
  const { canvas, colors } = options;
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
  key.position.set(KEY_LIGHT_X, KEY_LIGHT_Y, KEY_LIGHT_Z);
  scene.add(key);

    const center = new THREE.Vector3(0, HEIGHT * AIM_HEIGHT, 0);

  // Floor grid and the three axes.
  const grid = new THREE.GridHelper(WIDTH, GRID_DIVISIONS, colors.grid, colors.grid);
  grid.scale.set(1, 1, DEPTH / WIDTH);
  scene.add(grid);
  const axisMaterial = new THREE.LineBasicMaterial({ color: colors.axis });
  const corner = new THREE.Vector3(-WIDTH * HALF, 0, DEPTH * HALF);
  const axes = new THREE.BufferGeometry().setFromPoints([
    corner,
    new THREE.Vector3(WIDTH * HALF, 0, DEPTH * HALF),
    corner,
    new THREE.Vector3(-WIDTH * HALF, HEIGHT, DEPTH * HALF),
    corner,
    new THREE.Vector3(-WIDTH * HALF, 0, -DEPTH * HALF),
  ]);
  scene.add(new THREE.LineSegments(axes, axisMaterial));

  // The range band: a translucent slab between the target cut points.
  const low = sceneY(options.target.low);
  const high = sceneY(options.target.high);
  const slabMaterial = new THREE.MeshBasicMaterial({
    color: colors.target,
    transparent: true,
    opacity: TARGET_OPACITY,
    depthWrite: false,
  });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, Math.max(0, high - low), DEPTH), slabMaterial);
  slab.position.set(0, low + (high - low) * HALF, 0);
  scene.add(slab);
  // Its edges, so the band reads as a volume and not as a floor.
  const edgeMaterial = new THREE.LineBasicMaterial({ color: colors.target, transparent: true, opacity: TARGET_EDGE_OPACITY });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), edgeMaterial);
  edges.position.copy(slab.position);
  scene.add(edges);

  // Selection ring, laid on the floor under the selected sphere.
  const ringMaterial = new THREE.MeshBasicMaterial({ color: colors.selection, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(RING_INNER, RING_OUTER, RING_SEGMENTS), ringMaterial);
  ring.rotation.x = -Math.PI * HALF;
  ring.visible = false;
  scene.add(ring);

  // Labels: text elements projected to the screen on every frame.
  const labelElements = options.labels.map((label) => {
    const element = document.createElement('span');
    element.className = 'triage-map__label';
    element.dataset['kind'] = label.kind;
    element.textContent = label.text;
    options.labelLayer.appendChild(element);
    const [tir, mgdl, lane] = label.at;
    return { element, position: new THREE.Vector3(sceneX(tir), sceneY(mgdl), sceneZ(lane)) };
  });

  const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
  let spheres: Sphere[] = [];
  let selectedId: string | null = null;
  let hoveredId: string | null = null;

  let yaw = INITIAL_YAW;
  let pitch = INITIAL_PITCH;
  const placeCamera = () => {
    camera.position.set(
      center.x + Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
      center.y + Math.sin(pitch) * CAMERA_DISTANCE,
      center.z + Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE,
    );
    camera.lookAt(center);
  };

  let disposed = false;
  let frame = 0;
  let animationStart = 0;
  let animationLength = 0;

  const placeLabels = () => {
    for (const { element, position } of labelElements) {
      const projected = position.clone().project(camera);
      element.hidden = projected.z < -1 || projected.z > 1;
      element.style.left = `${String(((projected.x + 1) / NDC_SPAN) * PERCENT)}%`;
      element.style.top = `${String(((1 - projected.y) / NDC_SPAN) * PERCENT)}%`;
    }
  };

  const placeRing = () => {
    const chosen = spheres.find((sphere) => sphere.id === selectedId);
    ring.visible = chosen !== undefined;
    if (chosen) ring.position.set(chosen.mesh.position.x, RING_LIFT, chosen.mesh.position.z);
  };

  const render = () => {
    if (disposed) return;
    placeRing();
    renderer.render(scene, camera);
    placeLabels();
  };

  const step = (now: number) => {
    frame = 0;
    let running = false;
    for (const sphere of spheres) {
      const t = animationLength === 0 ? 1 : (now - animationStart - sphere.delay) / animationLength;
      const clamped = Math.min(1, Math.max(0, t));
      const eased = easeOut(clamped);
      sphere.mesh.position.lerpVectors(sphere.from, sphere.to, eased);
      // Travel along an arc, not a straight line: the lift peaks halfway and is gone on landing.
      const distance = sphere.from.distanceTo(sphere.to);
      sphere.mesh.position.y += Math.sin(Math.PI * eased) * Math.min(ARC_MAX_LIFT, distance * ARC_LIFT_SHARE);
      // Squash on landing (follow-through), volume kept: wide and short, then round.
      const landing = clamped > LANDING_FROM ? (clamped - LANDING_FROM) / (1 - LANDING_FROM) : 0;
      const squash = Math.sin(Math.PI * landing) * SQUASH_AMOUNT;
      const base = typeof sphere.mesh.userData['baseScale'] === 'number' ? sphere.mesh.userData['baseScale'] : 1;
      const lift = sphere.id === selectedId ? 1 + HALF : 1;
      sphere.mesh.scale.set(base * lift * (1 + squash), base * lift * (1 - squash), base * lift * (1 + squash));
      const stem = sphere.stem.geometry.getAttribute('position') as THREE.BufferAttribute;
      stem.setXYZ(0, sphere.mesh.position.x, 0, sphere.mesh.position.z);
      stem.setXYZ(1, sphere.mesh.position.x, sphere.mesh.position.y, sphere.mesh.position.z);
      stem.needsUpdate = true;
      if (t < 1) running = true;
    }
    render();
    if (running) frame = requestAnimationFrame(step);
  };

  const animate = (length: number) => {
    animationStart = performance.now();
    animationLength = options.reducedMotion ? 0 : length;
    if (frame === 0) frame = requestAnimationFrame(step);
  };

  const highlight = () => {
    for (const sphere of spheres) {
      const emphasized = sphere.id === selectedId || sphere.id === hoveredId;
      sphere.mesh.material.emissiveIntensity = emphasized ? HALF : 0;
      const base = typeof sphere.mesh.userData['baseScale'] === 'number' ? sphere.mesh.userData['baseScale'] : 1;
      sphere.mesh.scale.setScalar(base * (sphere.id === selectedId ? 1 + HALF : 1));
    }
  };

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    render();
  };

  // ---- Pointer: drag to orbit, hover to name, click to select ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let drag: { x: number; y: number; moved: boolean } | null = null;

  const pick = (clientX: number, clientY: number): Sphere | null => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * NDC_SPAN - 1, -((clientY - rect.top) / rect.height) * NDC_SPAN + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(spheres.map((sphere) => sphere.mesh), false)[0];
    return hit ? (spheres.find((sphere) => sphere.mesh === hit.object) ?? null) : null;
  };

  const onPointerDown = (event: PointerEvent) => {
    drag = { x: event.clientX, y: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  };
  const DRAG_THRESHOLD = 4;
  const onPointerMove = (event: PointerEvent) => {
    if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) drag.moved = true;
      if (drag.moved) {
        yaw -= dx * DRAG_SENSITIVITY;
        pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitch + dy * DRAG_SENSITIVITY));
        drag.x = event.clientX;
        drag.y = event.clientY;
        placeCamera();
        render();
      }
      return;
    }
    const hit = pick(event.clientX, event.clientY);
    const nextId = hit?.id ?? null;
    canvas.style.cursor = hit ? 'pointer' : 'grab';
    if (nextId !== hoveredId) {
      hoveredId = nextId;
      highlight();
      render();
    }
    if (hit) {
      const rect = canvas.getBoundingClientRect();
      options.onHover({ id: hit.id, x: event.clientX - rect.left, y: event.clientY - rect.top });
    } else {
      options.onHover(null);
    }
  };
  const onPointerUp = (event: PointerEvent) => {
    const wasDrag = drag?.moved ?? false;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (wasDrag) return;
    const hit = pick(event.clientX, event.clientY);
    if (hit) options.onSelect(hit.id);
  };
  const onPointerLeave = () => {
    hoveredId = null;
    highlight();
    render();
    options.onHover(null);
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  placeCamera();
  resize();

  const clearSpheres = () => {
    for (const sphere of spheres) {
      scene.remove(sphere.mesh, sphere.stem);
      sphere.mesh.material.dispose();
      sphere.stem.geometry.dispose();
      sphere.stem.material.dispose();
    }
  };

  return {
    setPoints(points) {
      const previous = new Map(spheres.map((sphere) => [sphere.id, sphere.mesh.position.clone()]));
      const firstTime = spheres.length === 0;
      clearSpheres();
      spheres = points.map((point, index) => {
        const color = point.state === null ? colors.noData : colors.ranges[point.state];
        const material = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0,
          roughness: 0.35,
          metalness: 0.05,
          wireframe: point.tirPct === null || point.valueMgDl === null,
        });
        const mesh = new THREE.Mesh(geometry, material);
        const alertSteps = Math.min(MAX_ALERT_STEPS, point.openAlerts);
        const size = 1 + (alertSteps * ALERT_RADIUS_STEP) / SPHERE_RADIUS;
        mesh.userData['baseScale'] = size;
        const to = new THREE.Vector3(
          sceneX(point.tirPct),
          point.valueMgDl === null ? SPHERE_RADIUS : sceneY(point.valueMgDl),
          sceneZ(LANE_OF[point.riskTier]),
        );
        const from = previous.get(point.id) ?? new THREE.Vector3(to.x, firstTime ? 0 : to.y, to.z);
        mesh.position.copy(from);
        const stemGeometry = new THREE.BufferGeometry().setFromPoints([from.clone().setY(0), from.clone()]);
        const stem = new THREE.Line(
          stemGeometry,
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: STEM_OPACITY }),
        );
        scene.add(mesh, stem);
        return { id: point.id, mesh, stem, from, to, delay: firstTime ? index * STAGGER_MS : 0 };
      });
      highlight();
      animate(firstTime ? ENTRANCE_MS : MOVE_MS);
    },
    setSelected(id) {
      selectedId = id;
      highlight();
      render();
    },
    resetView() {
      yaw = INITIAL_YAW;
      pitch = INITIAL_PITCH;
      placeCamera();
      render();
    },
    rotate(dYaw, dPitch) {
      yaw += dYaw;
      pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitch + dPitch));
      placeCamera();
      render();
    },
    dispose() {
      disposed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      clearSpheres();
      geometry.dispose();
      slab.geometry.dispose();
      slabMaterial.dispose();
      edges.geometry.dispose();
      edgeMaterial.dispose();
      ring.geometry.dispose();
      ringMaterial.dispose();
      axes.dispose();
      axisMaterial.dispose();
      grid.dispose();
      for (const { element } of labelElements) element.remove();
      renderer.dispose();
    },
  };
}
