/* eslint-disable @typescript-eslint/no-magic-numbers -- Art direction of the 3D scene (camera framing, marker sizes in pixels, label layout, timing, colors), like landing/art which is exempt. None of these numbers is a clinical value; thresholds and dosing never live here. */
import * as THREE from 'three';
import { surfacePoint, type BodyMeshData } from '@/app/pages/landing/art/bodySdf';
import { createShellMaterial, type ShellLook } from '@/app/pages/landing/art/shellMaterial';
import { defaultSpotFor, type InjectionSiteEntry } from './injectionModel';
import { injectionRay, siteView, spotNumbers } from './injectionRays';
import {
  SITE_CODES,
  type BodyView,
  type InjectionState,
  type SiteCode,
  type SpotNumber,
} from './siteCodes';

/**
 * The 3D body with one marker per spot of each injection site. Loaded on demand by
 * `InjectionBodyMap`. It draws a clear blue glass figure (no organs), places the markers with the
 * skin rays of `injectionRays.ts`, and turns the camera between the front and the back.
 *
 * Markers keep a constant size on screen: their geometry is written in CSS pixels and the group is
 * scaled by the world size of one pixel each frame. Labels are HTML owned by React; this scene only
 * positions them beside the body, on the side of the patient's limb, with a leader line to the spot.
 */

/** A floating label: the site and the spot its leader line points at. */
export interface InjectionLabel {
  readonly site: SiteCode;
  readonly spot: SpotNumber;
}

export interface InjectionScenePlan {
  readonly view: BodyView;
  readonly sites: readonly InjectionSiteEntry[];
  readonly selectedSite: SiteCode | null;
  readonly selectedSpot: number | null;
  /** Continuous motion (sway and pulse). Off with reduced motion or when paused. */
  readonly playing: boolean;
  /** The labelled sites: suggested, selected, hovered or focused. Only these get text on the canvas. */
  readonly labels: readonly InjectionLabel[];
  /** Read-only: the markers show but cannot be picked, and the pointer keeps its normal shape. */
  readonly readOnly: boolean;
}

export interface InjectionScene {
  apply(plan: InjectionScenePlan): void;
  dispose(): void;
}

export interface InjectionSceneOptions {
  readonly canvas: HTMLCanvasElement;
  /** Overlay holding `[data-label]` elements and `[data-leader]` lines, positioned over the canvas. */
  readonly labelHost: HTMLElement;
  readonly reducedMotion: boolean;
  readonly mesh: BodyMeshData;
  /** Called on a click or tap on a selectable marker. */
  readonly onPick: (site: SiteCode, spot: SpotNumber) => void;
  /** Called when the pointer moves onto or off a site's markers. */
  readonly onHover: (site: SiteCode | null) => void;
}

/** Clear blue glass: the light look of the landing (`bodyScene.ts`, LOOKS.light). */
const GLASS: ShellLook = {
  base: '#a9b5f3',
  baseAlpha: 0.4,
  rim: '#2536c4',
  rimAlpha: 0.95,
  rimPower: 1.5,
  specular: 0.65,
  scan: '#1f4bff',
  contour: 0,
  contourDensity: 0,
  additive: false,
};

/** Token values for the markers. CSS tokens cannot reach WebGL, so these mirror `styles/tokens.css`. */
const INK = new THREE.Color('#15173a');
const COBALT = new THREE.Color('#1f4bff');
const MUTED = new THREE.Color('#5a5f8a');
const CRITICAL = new THREE.Color('#b3261e');

const PIXEL_RATIO_LIMIT = 2;
const FOV = 28;
/** Visible height of the framing, in body units, per view: the torso and thighs (front), arms and buttocks (back). */
const FRAME_HEIGHT = 3.4;
/** Centred so the top of the frame (2.15) clears the head (2.0); the bottom (-1.25) keeps the thighs. */
const FRAME_CENTER_Y = 0.45;
/** Narrowest visible width that still fits the arms, in body units (the figure is about 1.6 wide). */
const FRAME_MIN_WIDTH = 2;
const ELEVATION = 0.06;
/** The front faces the camera at azimuth 0 (+z); the back at pi (-z). */
const VIEW_AZIMUTH: Record<BodyView, number> = { front: 0, back: Math.PI };
const VIEW_DAMPING = 5;
const SWAY_AMPLITUDE = 0.12;
const SWAY_RATE = 0.6;
const PULSE_RATE = 3;
const MAX_FRAME_SECONDS = 0.05;
const AZIMUTH_EPSILON = 1e-3;

/** Marker sizes in CSS pixels. The dot is at least 10 px across; the tap target is 44 px. */
const DISC_RADIUS_PX = 6;
const RING_INNER_PX = 8.5;
const RING_OUTER_PX = 10.5;
const SELECTION_INNER_PX = 13;
const SELECTION_OUTER_PX = 14.5;
const CROSS_LENGTH_PX = 14;
const CROSS_WIDTH_PX = 2.4;
const HAND_LENGTH_PX = 5;
const HAND_WIDTH_PX = 1.6;
const HIT_TARGET_PX = 44;
const MARKER_LIFT = 0.008;
const QUARTER_TURN = Math.PI / 2;
const DIAGONAL = Math.PI / 4;
const PULSE_GROWTH = 0.6;
const SEGMENTS_DISC = 24;
const SEGMENTS_RING = 32;
const SPHERE_WIDTH_SEGMENTS = 12;
const SPHERE_HEIGHT_SEGMENTS = 8;
const ALLOWED_OPACITY = 0.55;
const SOLID_OPACITY = 0.9;
const AVOID_OPACITY = 0.6;
const PULSE_BASE_OPACITY = 0.35;
const PULSE_SWING_OPACITY = 0.55;

/** Label layout, in CSS pixels: a column on each side of the body, labels kept apart vertically. */
const LABEL_INSET_PX = 12;
const LABEL_GAP_PX = 34;

interface Marker {
  readonly site: SiteCode;
  readonly spot: SpotNumber;
  readonly normal: THREE.Vector3;
  readonly root: THREE.Group;
  /** Child of `root`, scaled to a constant pixel size each frame. */
  readonly visual: THREE.Group;
  readonly fill: THREE.Mesh;
  readonly ring: THREE.Mesh;
  readonly selection: THREE.Mesh;
  readonly cross: THREE.Group;
  readonly clock: THREE.Group;
  readonly hit: THREE.Mesh;
  /** True for the spot the brief marks as suggested: a filled dot with a pulsing ring. */
  suggested: boolean;
}

interface Placed {
  readonly site: SiteCode;
  readonly element: HTMLElement;
  readonly leader: SVGLineElement | null;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly side: 'left' | 'right';
}

/** Returns `null` when WebGL is unavailable; the page then shows the list alone. */
export function createInjectionScene(options: InjectionSceneOptions): InjectionScene | null {
  const { canvas, labelHost, reducedMotion, mesh, onPick, onHover } = options;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_LIMIT));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.02, 80);
  const figure = new THREE.Group();
  scene.add(figure);

  // ---- Glass body: depth prepass, then the translucent skin (no organs) ----
  const bodyGeometry = new THREE.BufferGeometry();
  bodyGeometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  bodyGeometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  bodyGeometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  bodyGeometry.computeBoundingSphere();
  const prepassMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 2,
  });
  const prepass = new THREE.Mesh(bodyGeometry, prepassMaterial);
  prepass.renderOrder = 1;
  const skin = createShellMaterial(GLASS);
  const shell = new THREE.Mesh(bodyGeometry, skin.material);
  shell.renderOrder = 2;
  figure.add(prepass, shell);

  // ---- Marker geometry, written in CSS pixels (the visual group scales it to the screen) ----
  const discGeometry = new THREE.CircleGeometry(DISC_RADIUS_PX, SEGMENTS_DISC).rotateX(
    -QUARTER_TURN,
  );
  const ringGeometry = new THREE.RingGeometry(RING_INNER_PX, RING_OUTER_PX, SEGMENTS_RING).rotateX(
    -QUARTER_TURN,
  );
  const selectionGeometry = new THREE.RingGeometry(
    SELECTION_INNER_PX,
    SELECTION_OUTER_PX,
    SEGMENTS_RING,
  ).rotateX(-QUARTER_TURN);
  const crossGeometry = new THREE.PlaneGeometry(CROSS_LENGTH_PX, CROSS_WIDTH_PX).rotateX(
    -QUARTER_TURN,
  );
  // A clock hand pivots at the centre: the plane is shifted so it starts at the origin.
  const handGeometry = new THREE.PlaneGeometry(HAND_WIDTH_PX, HAND_LENGTH_PX)
    .rotateX(-QUARTER_TURN)
    .translate(0, 0, HAND_LENGTH_PX / 2);
  const hitGeometry = new THREE.SphereGeometry(1, SPHERE_WIDTH_SEGMENTS, SPHERE_HEIGHT_SEGMENTS);
  const disposables: { dispose(): void }[] = [
    bodyGeometry,
    prepassMaterial,
    skin.material,
    discGeometry,
    ringGeometry,
    selectionGeometry,
    crossGeometry,
    handGeometry,
    hitGeometry,
  ];
  const fadingMaterial = (color: THREE.Color, opacity: number): THREE.MeshBasicMaterial => {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    disposables.push(material);
    return material;
  };

  const worldUp = new THREE.Vector3(0, 1, 0);
  const markers: Marker[] = [];
  const markerIndex = new Map<string, Marker>();
  for (const site of SITE_CODES) {
    // The site's own face decides its ray; all eight sites are built, and the view hides the others.
    const view = siteView(site);
    for (const spot of spotNumbers()) {
      const ray = injectionRay(site, view, spot);
      if (!ray) continue;
      const hit = surfacePoint(ray.origin, ray.direction);
      const position = new THREE.Vector3(...hit.position);
      const normal = new THREE.Vector3(...hit.normal).normalize();
      const root = new THREE.Group();
      root.position.copy(position).addScaledVector(normal, MARKER_LIFT);
      root.quaternion.setFromUnitVectors(worldUp, normal);

      const visual = new THREE.Group();
      const fill = new THREE.Mesh(discGeometry, fadingMaterial(COBALT, 1));
      const ring = new THREE.Mesh(ringGeometry, fadingMaterial(COBALT, SOLID_OPACITY));
      const selection = new THREE.Mesh(selectionGeometry, fadingMaterial(INK, 1));
      const cross = new THREE.Group();
      for (const angle of [DIAGONAL, -DIAGONAL]) {
        const bar = new THREE.Mesh(crossGeometry, fadingMaterial(CRITICAL, 1));
        bar.rotation.y = angle;
        cross.add(bar);
      }
      const clock = new THREE.Group();
      for (const angle of [0, -QUARTER_TURN]) {
        const hand = new THREE.Mesh(handGeometry, fadingMaterial(MUTED, 1));
        hand.rotation.y = angle;
        clock.add(hand);
      }
      visual.add(fill, ring, selection, cross, clock);
      // Invisible proxy, resized every frame to 44 px, so a tap lands on a large enough target.
      const hitMesh = new THREE.Mesh(
        hitGeometry,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      disposables.push(hitMesh.material);
      root.add(visual, hitMesh);
      figure.add(root);

      const marker: Marker = {
        site,
        spot,
        normal,
        root,
        visual,
        fill,
        ring,
        selection,
        cross,
        clock,
        hit: hitMesh,
        suggested: false,
      };
      markers.push(marker);
      markerIndex.set(`${site}:${spot}`, marker);
    }
  }

  // ---- State ----
  let plan: InjectionScenePlan = {
    readOnly: false,
    view: 'front',
    sites: [],
    selectedSite: null,
    selectedSpot: null,
    playing: false,
    labels: [],
  };
  let targetAzimuth = VIEW_AZIMUTH.front;
  let azimuth = VIEW_AZIMUTH.front;
  let time = 0;
  let last = performance.now();
  let visible = true;
  let cssWidth = 1;
  let cssHeight = 1;
  let distance = 1;
  let worldPerPixel = 1;
  let loopRunning = false;
  let disposed = false;
  let hoveredSite: SiteCode | null = null;
  const stateOf = new Map<SiteCode, InjectionState>();

  /** Distance that fits the framing height, and the framing width on a narrow canvas. */
  const fitDistance = (): void => {
    const half = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    const aspect = cssWidth / cssHeight;
    distance = Math.max(FRAME_HEIGHT / 2 / half, FRAME_MIN_WIDTH / 2 / (half * aspect));
  };

  const placeCamera = (): void => {
    const swaying = plan.playing && !reducedMotion;
    const angle = azimuth + (swaying ? Math.sin(time * SWAY_RATE) * SWAY_AMPLITUDE : 0);
    const centerY = FRAME_CENTER_Y;
    const center = new THREE.Vector3(0, centerY, 0);
    camera.position.set(
      Math.sin(angle) * Math.cos(ELEVATION) * distance,
      centerY + Math.sin(ELEVATION) * distance,
      Math.cos(angle) * Math.cos(ELEVATION) * distance,
    );
    camera.lookAt(center);
    camera.updateMatrixWorld();
    worldPerPixel = (2 * distance * Math.tan(THREE.MathUtils.degToRad(FOV) / 2)) / cssHeight;
  };

  /** Applies the plan to every marker: the shape of its state, the selection and the view. */
  const updateVisuals = (): void => {
    stateOf.clear();
    const entries = new Map<SiteCode, InjectionSiteEntry>();
    for (const entry of plan.sites) {
      stateOf.set(entry.site, entry.state);
      entries.set(entry.site, entry);
    }
    for (const marker of markers) {
      const entry = entries.get(marker.site);
      const state = stateOf.get(marker.site);
      const selected = plan.selectedSite === marker.site && plan.selectedSpot === marker.spot;
      marker.suggested =
        state === 'SUGGESTED' && entry !== undefined && defaultSpotFor(entry) === marker.spot;
      marker.root.visible = siteView(marker.site) === plan.view;

      // Shape carries the state, so it reads without color: filled dot (suggested), ring (allowed),
      // clock (recently used), X (avoid). Color only reinforces it.
      marker.fill.visible = marker.suggested;
      marker.ring.visible = state !== undefined;
      marker.clock.visible = state === 'RECENT';
      marker.cross.visible = state === 'AVOID';
      marker.selection.visible = selected;

      const ringMaterial = marker.ring.material as THREE.MeshBasicMaterial;
      ringMaterial.color.copy(state === 'AVOID' ? CRITICAL : state === 'RECENT' ? MUTED : COBALT);
      ringMaterial.opacity =
        state === 'ALLOWED' ? ALLOWED_OPACITY : state === 'AVOID' ? AVOID_OPACITY : SOLID_OPACITY;
    }
  };

  const updateMarkerMotion = (): void => {
    const pulsing = plan.playing && !reducedMotion;
    const pulse = 0.5 + 0.5 * Math.sin(time * PULSE_RATE);
    const hitRadius = (HIT_TARGET_PX / 2) * worldPerPixel;
    for (const marker of markers) {
      marker.visual.scale.setScalar(worldPerPixel);
      marker.hit.scale.setScalar(hitRadius);
      if (marker.suggested && pulsing) {
        marker.ring.scale.setScalar(1 + PULSE_GROWTH * pulse);
        (marker.ring.material as THREE.MeshBasicMaterial).opacity =
          PULSE_BASE_OPACITY + PULSE_SWING_OPACITY * (1 - pulse);
      } else {
        marker.ring.scale.setScalar(1);
        const state = stateOf.get(marker.site);
        (marker.ring.material as THREE.MeshBasicMaterial).opacity =
          state === 'ALLOWED' ? ALLOWED_OPACITY : state === 'AVOID' ? AVOID_OPACITY : SOLID_OPACITY;
      }
    }
  };

  /**
   * Places the labels from the plan. Each side of the body has its own column (the patient's right
   * on the viewer's left), labels are kept apart vertically, and a leader line joins the label to
   * its spot. A label is hidden when its site is on the other view or turns away from the camera.
   */
  const placeLabels = (): void => {
    const boxes = labelHost.querySelectorAll<HTMLElement>('[data-label]');
    const leaders = new Map<string, SVGLineElement>();
    for (const line of labelHost.querySelectorAll<SVGLineElement>('[data-leader]')) {
      const site = line.dataset['leader'];
      if (site !== undefined) leaders.set(site, line);
    }
    const placed: Placed[] = [];
    for (const element of boxes) {
      const site = element.dataset['label'] as SiteCode;
      const label = plan.labels.find((item) => item.site === site);
      const marker = label ? markerIndex.get(`${site}:${label.spot}`) : undefined;
      const leader = leaders.get(site) ?? null;
      const facing =
        marker !== undefined &&
        marker.normal.dot(camera.position.clone().sub(marker.root.position)) > 0;
      if (!marker || !visible || !marker.root.visible || !facing) {
        element.hidden = true;
        leader?.setAttribute('visibility', 'hidden');
        continue;
      }
      const projected = marker.root.position.clone().project(camera);
      element.hidden = false;
      placed.push({
        site,
        element,
        leader,
        anchorX: ((projected.x + 1) / 2) * cssWidth,
        anchorY: ((1 - projected.y) / 2) * cssHeight,
        side: site.endsWith('RIGHT') ? 'left' : 'right',
      });
    }
    for (const side of ['left', 'right'] as const) {
      const column = placed
        .filter((item) => item.side === side)
        .sort((a, b) => a.anchorY - b.anchorY);
      let previous = Number.NEGATIVE_INFINITY;
      for (const item of column) {
        const labelY = Math.max(item.anchorY, previous + LABEL_GAP_PX);
        previous = labelY;
        const width = item.element.offsetWidth;
        const labelX = side === 'left' ? LABEL_INSET_PX : cssWidth - LABEL_INSET_PX - width;
        item.element.style.transform = `translate3d(${labelX.toFixed(1)}px, ${labelY.toFixed(1)}px, 0)`;
        if (item.leader) {
          const edgeX = side === 'left' ? labelX + width : labelX;
          item.leader.setAttribute('x1', item.anchorX.toFixed(1));
          item.leader.setAttribute('y1', item.anchorY.toFixed(1));
          item.leader.setAttribute('x2', edgeX.toFixed(1));
          item.leader.setAttribute('y2', labelY.toFixed(1));
          item.leader.setAttribute('visibility', 'visible');
        }
      }
    }
  };

  const frame = (): void => {
    placeCamera();
    updateMarkerMotion();
    placeLabels();
    renderer.render(scene, camera);
  };

  const moving = (): boolean => Math.abs(targetAzimuth - azimuth) > AZIMUTH_EPSILON;
  const needsLoop = (): boolean =>
    visible && !disposed && ((plan.playing && !reducedMotion) || moving());

  const tick = (now: number): void => {
    const dt = Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
    last = now;
    if (plan.playing && !reducedMotion) time += dt;
    if (reducedMotion) azimuth = targetAzimuth;
    else azimuth += (targetAzimuth - azimuth) * (1 - Math.exp(-VIEW_DAMPING * dt));
    frame();
    if (!needsLoop()) stopLoop();
  };

  const startLoop = (): void => {
    if (loopRunning || !needsLoop()) return;
    loopRunning = true;
    last = performance.now();
    renderer.setAnimationLoop(tick);
  };
  const stopLoop = (): void => {
    if (!loopRunning) return;
    loopRunning = false;
    renderer.setAnimationLoop(null);
  };

  const resize = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    cssWidth = width;
    cssHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fitDistance();
    frame();
  };

  // ---- Picking: markers first (cheap); the skin is only tested when a marker is under the pointer ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pick = (clientX: number, clientY: number): Marker | null => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      (-(clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const targets: THREE.Object3D[] = [];
    for (const marker of markers) if (marker.root.visible) targets.push(marker.hit);
    const nearest = raycaster.intersectObjects(targets, false)[0];
    if (!nearest) return null;
    const skin = raycaster.intersectObject(shell, false)[0];
    if (skin && skin.distance < nearest.distance) return null;
    return markers.find((marker) => marker.hit === nearest.object) ?? null;
  };
  const selectable = (marker: Marker): boolean => {
    const state = stateOf.get(marker.site);
    return state !== undefined && state !== 'AVOID';
  };
  const onClick = (event: MouseEvent): void => {
    const marker = pick(event.clientX, event.clientY);
    if (plan.readOnly) return;
    if (marker && selectable(marker)) onPick(marker.site, marker.spot);
  };
  const onPointerMove = (event: PointerEvent): void => {
    const marker = pick(event.clientX, event.clientY);
    canvas.style.cursor = !plan.readOnly && marker && selectable(marker) ? 'pointer' : '';
    const site = marker?.site ?? null;
    if (site !== hoveredSite) {
      hoveredSite = site;
      onHover(site);
    }
  };
  const onPointerLeave = (): void => {
    canvas.style.cursor = '';
    if (hoveredSite !== null) {
      hoveredSite = null;
      onHover(null);
    }
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible) frame();
    if (visible) startLoop();
    else stopLoop();
  });
  visibility.observe(canvas);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.addEventListener('pointerleave', onPointerLeave);
  resize();

  return {
    apply(next: InjectionScenePlan): void {
      if (disposed) return;
      plan = next;
      targetAzimuth = VIEW_AZIMUTH[plan.view];
      if (reducedMotion) azimuth = targetAzimuth;
      updateVisuals();
      frame();
      if (needsLoop()) startLoop();
      else stopLoop();
    },
    dispose(): void {
      disposed = true;
      stopLoop();
      resizeObserver.disconnect();
      visibility.disconnect();
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      for (const element of labelHost.querySelectorAll<HTMLElement>('[data-label]'))
        element.hidden = true;
      for (const item of disposables) item.dispose();
      renderer.dispose();
      // Frees the WebGL context now, not when the browser gets around to it.
      renderer.forceContextLoss();
    },
  };
}

/* eslint-enable @typescript-eslint/no-magic-numbers -- End of the scene art constants block opened at the top of this file. */
