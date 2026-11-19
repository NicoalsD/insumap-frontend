import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildOrgans, buildSensor, buildSkeleton, buildVessels, softDotTexture, type Theme } from './anatomy';
import { buildBloodstream, buildDataStream, createMolecules } from './bloodstream';
import type { BodyMeshData } from './bodySdf';
import { buildScanner } from './scanner';
import { createShellMaterial, type ShellLook } from './shellMaterial';

/**
 * The landing's 3D human body. `hero` shows the figure on its scanner, turning slowly with the
 * pointer. `story` is driven by scroll: the camera goes from the whole body to the glucose sensor,
 * dives into the bloodstream and comes back out while the readings stream away. Art direction
 * only: every number here is framing, light, color or timing.
 */

export interface BodyScene {
  /** Scroll progress of the story, 0 to 1. */
  setProgress(progress: number): void;
  /** Starts or stops the looping motion (WCAG 2.2.2 pause control). */
  setPlaying(playing: boolean): void;
  dispose(): void;
}

export interface BodySceneOptions {
  readonly reducedMotion: boolean;
  readonly mode: 'hero' | 'story';
  readonly mesh: BodyMeshData;
}

const LOOKS: Record<Theme, ShellLook> = {
  light: {
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
  },
  // Night: a hologram of light slices, the organs glowing through it.
  dark: {
    base: '#6f86ff',
    baseAlpha: 0.05,
    rim: '#c3d0ff',
    rimAlpha: 0.95,
    rimPower: 2.1,
    specular: 0.35,
    scan: '#e6ebff',
    contour: 0.75,
    contourDensity: 24,
    additive: true,
  },
};
const NIGHT = '#11132e';
const MAX_PIXEL_RATIO = 2;
const FOV = 28;
const HERO_YAW = -0.42;
const STORY_YAW = -0.55;
/**
 * Story chapters, as scroll ranges where the camera holds still: whole body, sensor, vessel entry,
 * deep in the vessel, back out. Between holds the camera travels.
 */
const HOLDS: readonly (readonly [number, number])[] = [
  [0, 0.06],
  [0.16, 0.3],
  [0.42, 0.45],
  [0.6, 0.66],
  [0.86, 1],
];

const smooth = (t: number) => t * t * (3 - 2 * t);
const window01 = (value: number, edge0: number, edge1: number) => smooth(THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1));

function fitDistance(height: number, width: number, aspect: number, margin: number): number {
  const half = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
  return Math.max(height / 2 / half, width / 2 / (half * aspect)) * margin;
}

/** A point on a sphere around `target`, by azimuth and elevation in radians. */
function orbit(target: THREE.Vector3, azimuth: number, elevation: number, distance: number): THREE.Vector3 {
  return new THREE.Vector3(
    target.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
    target.y + Math.sin(elevation) * distance,
    target.z + Math.cos(azimuth) * Math.cos(elevation) * distance,
  );
}

/** Returns `null` when WebGL is unavailable; the page stays complete without it. */
export function createBodyScene(canvas: HTMLCanvasElement, options: BodySceneOptions): BodyScene | null {
  const { reducedMotion, mode, mesh } = options;
  const theme: Theme = mode === 'story' ? 'dark' : 'light';
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: theme === 'light', antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  if (theme === 'dark') renderer.setClearColor(NIGHT, 1);
  else renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = theme === 'dark' ? 0.35 : 0.6;
  const fog = new THREE.Fog(NIGHT, 1, 1000);
  if (theme === 'dark') scene.fog = fog;

  scene.add(new THREE.HemisphereLight('#f4f5ff', '#8f9cff', theme === 'dark' ? 0.55 : 1));
  const key = new THREE.DirectionalLight('#ffffff', theme === 'dark' ? 1.1 : 1.5);
  key.position.set(2.5, 4, 5);
  const rim = new THREE.DirectionalLight('#7f95ff', theme === 'dark' ? 2.2 : 1.4);
  rim.position.set(-4, 2, -4);
  const fill = new THREE.DirectionalLight('#ffd6e4', 0.4);
  fill.position.set(-3, -1, 3);
  scene.add(key, rim, fill);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.02, 80);
  const headlamp = new THREE.PointLight('#ffd7de', 0, 7, 1.4);
  camera.add(headlamp);
  scene.add(camera);

  const dot = softDotTexture();

  // ---- The figure (everything that turns with the body) ----
  const figure = new THREE.Group();
  figure.rotation.y = mode === 'hero' ? HERO_YAW : STORY_YAW;
  scene.add(figure);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeBoundingSphere();
  // Depth prepass: only the front-most skin is shaded, and the organs behind it stay visible.
  const prepass = new THREE.Mesh(
    geometry,
    // Pushed slightly back so the skin always wins the depth test against its own prepass.
    new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }),
  );
  prepass.renderOrder = 1;
  const skin = createShellMaterial(LOOKS[theme]);
  const shell = new THREE.Mesh(geometry, skin.material);
  shell.renderOrder = 2;
  figure.add(prepass, shell);

  const organs = buildOrgans(theme);
  const skeleton = buildSkeleton(theme);
  const vessels = buildVessels(theme, dot);
  const sensor = buildSensor(mesh.sensor.position, mesh.sensor.normal, theme);
  figure.add(organs.group, skeleton.group, vessels.group, sensor.group);

  // Glucose around the sensor filament, seen in the close-up.
  const sensorPoint = new THREE.Vector3(...mesh.sensor.position);
  const sensorNormal = new THREE.Vector3(...mesh.sensor.normal).normalize();
  const filamentTip = sensorPoint.clone().addScaledVector(sensorNormal, -0.07);
  const nearMolecules = createMolecules(9, theme);
  nearMolecules.group.visible = mode === 'story';
  figure.add(nearMolecules.group);
  // Glucose in the fluid under the skin, around the filament tip (never outside the arm).
  const nearState = Array.from({ length: 9 }, (_, i) => ({
    offset: new THREE.Vector3(Math.sin(i * 2.1) * 0.03, Math.cos(i * 1.7) * 0.035, Math.sin(i * 3.3) * 0.025).addScaledVector(
      sensorNormal,
      -0.02,
    ),
    phase: i * 0.7,
  }));

  const dataStream = buildDataStream(sensorPoint, sensorNormal, theme, dot);
  dataStream.points.visible = mode === 'story';
  figure.add(dataStream.points);

  const scanner = buildScanner(theme);
  scene.add(scanner.group);

  // Materials that are opaque by design fade through transparency inside the vessel; the ones
  // that are already transparent (signal rings, particles) simply hide with the figure.
  const opaque = (list: THREE.Material[]) => list.filter((material) => !material.transparent);
  const fadeable = opaque(sensor.materials);
  /** Organs, bones and vessels also recede during the sensor close-up, so the sensor leads. */
  const recessive = opaque([...organs.materials, ...skeleton.materials]);
  const vesselTubes = opaque(vessels.materials);
  dataStream.material.opacity = 0;

  // ---- Story only: the vessel, placed where the camera dives in under the sensor ----
  const bloodstream = mode === 'story' ? buildBloodstream(theme) : null;
  if (bloodstream) {
    figure.updateMatrixWorld(true);
    const worldSensor = figure.localToWorld(sensorPoint.clone());
    const worldNormal = sensorNormal.clone().applyQuaternion(figure.quaternion);
    bloodstream.group.position.copy(worldSensor).addScaledVector(worldNormal, -0.32);
    bloodstream.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);
    bloodstream.group.visible = false;
    scene.add(bloodstream.group);
  }

  // ---- Camera ----
  const target = new THREE.Vector3();
  const keys: { position: THREE.Vector3; target: THREE.Vector3 }[] = [];

  const frameHero = () => {
    const distance = fitDistance(4.25, 2.1, camera.aspect, 1.04);
    const lookAt = new THREE.Vector3(0, -0.06, 0);
    camera.position.copy(orbit(lookAt, 0, 0.06, distance));
    target.copy(lookAt);
    camera.lookAt(target);
  };

  const buildKeys = () => {
    keys.length = 0;
    figure.updateMatrixWorld(true);
    const worldSensor = figure.localToWorld(sensorPoint.clone());
    const whole = fitDistance(4.25, 2.3, camera.aspect, 1.06);
    const center = new THREE.Vector3(0, -0.04, 0);
    // Angles are relative to the body, so the wide views stay three-quarter, never in profile.
    const yaw = figure.rotation.y;
    keys.push({ position: orbit(center, yaw - 0.8, 0.1, whole), target: center.clone() });
    // Sensor close-up from the outer back of the arm, so the torso stays out of the background.
    const view = new THREE.Vector3(0.72, 0.2, -0.66).normalize().applyQuaternion(figure.quaternion);
    keys.push({
      position: worldSensor.clone().addScaledVector(view, 1.75),
      target: worldSensor.clone().add(new THREE.Vector3(0, 0.06, 0)),
    });
    if (bloodstream) {
      bloodstream.group.updateMatrixWorld(true);
      const local = (u: number) => bloodstream.group.localToWorld(bloodstream.path.getPointAt(u));
      keys.push({ position: bloodstream.group.localToWorld(new THREE.Vector3(0, 0, 0.45)), target: local(0.08) });
      keys.push({ position: local(0.1), target: local(0.2) });
    }
    keys.push({ position: orbit(center, yaw + 0.42, 0.12, whole * 1.04), target: center.clone() });
  };

  // ---- State ----
  let targetProgress = 0;
  let progress = 0;
  let playing = !reducedMotion;
  let visible = true;
  let time = 0;
  let last = performance.now();
  let appear = reducedMotion ? 1 : 0;
  let insideLast = -1;
  const pointer = new THREE.Vector2();
  const nearQuaternion = new THREE.Quaternion();
  const nearEuler = new THREE.Euler();
  const nearPosition = new THREE.Vector3();

  let focusLast = -1;
  const fade = (materials: THREE.Material[], opacity: number) => {
    const transparent = opacity < 0.999;
    for (const material of materials) {
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = opacity;
    }
  };
  const setFigureFade = (inside: number, focus = 0) => {
    if (Math.abs(inside - insideLast) < 1e-4 && Math.abs(focus - focusLast) < 1e-4) return;
    insideLast = inside;
    focusLast = focus;
    fade(fadeable, 1 - inside);
    fade(recessive, (1 - inside) * (1 - 0.8 * focus));
    fade(vesselTubes, (1 - inside) * (1 - 0.6 * focus));
    figure.visible = inside < 0.985;
    scanner.group.visible = inside < 0.985;
  };

  /** Applies the story progress: camera chapters, fades and fog inside the vessel. */
  const applyProgress = () => {
    if (mode !== 'story' || keys.length < HOLDS.length) return;
    // Find the hold the progress is in, or the travel between two holds.
    let from = keys[0];
    let to = keys[0];
    let t = 0;
    for (let i = 0; i < HOLDS.length; i++) {
      const [start, end] = HOLDS[i] ?? [0, 1];
      if (progress <= end) {
        to = keys[i];
        if (progress >= start || i === 0) {
          from = to;
          t = 0;
        } else {
          from = keys[i - 1];
          const previousEnd = HOLDS[i - 1]?.[1] ?? 0;
          t = smooth(THREE.MathUtils.clamp((progress - previousEnd) / (start - previousEnd), 0, 1));
        }
        break;
      }
    }
    if (!from || !to) return;
    camera.position.lerpVectors(from.position, to.position, t);
    target.lerpVectors(from.target, to.target, t);
    camera.lookAt(target);

    const inside = window01(progress, 0.3, 0.38) * (1 - window01(progress, 0.72, 0.82));
    const focus = window01(progress, 0.06, 0.16) * (1 - window01(progress, 0.36, 0.42));
    setFigureFade(inside, focus);
    if (bloodstream) {
      bloodstream.group.visible = inside > 0.015;
      for (const material of bloodstream.materials) material.opacity = inside;
    }
    fog.near = inside > 0 ? 0.6 : 1;
    fog.far = inside > 0 ? THREE.MathUtils.lerp(60, 6.5, inside) : 1000;
    headlamp.intensity = inside * 1.5;
    dataStream.material.opacity = window01(progress, 0.84, 0.94);
  };

  const render = () => {
    skin.scanY.value = scanner.scanY();
    skin.opacity.value = appear * (1 - Math.max(0, insideLast));
    renderer.render(scene, camera);
  };

  const animate = (delta: number) => {
    time += delta;
    appear = Math.min(1, appear + delta * 1.4);
    vessels.update(delta);
    sensor.update(time);
    scanner.update(time);
    dataStream.update(delta);
    // Heartbeat: a double pulse every ~0.85 s.
    const beat = (time * 1.18) % 1;
    const pulse = Math.exp(-(((beat - 0.1) / 0.045) ** 2)) + 0.55 * Math.exp(-(((beat - 0.27) / 0.05) ** 2));
    organs.heart.scale.setScalar(1 + pulse * 0.07);
    organs.pancreasMaterial.emissiveIntensity = (theme === 'dark' ? 1.2 : 0.55) * (0.85 + 0.15 * Math.sin(time * 1.6));
    nearState.forEach((state, i) => {
      nearPosition.copy(filamentTip).add(state.offset).addScaledVector(state.offset, Math.sin(time * 0.8 + state.phase) * 0.2);
      nearQuaternion.setFromEuler(nearEuler.set(time * 0.4 + state.phase, time * 0.3, 0));
      nearMolecules.set(i, nearPosition, nearQuaternion, 0.16);
    });
    nearMolecules.commit();
    if (bloodstream?.group.visible) bloodstream.update(delta, time);
    if (mode === 'hero') {
      const yaw = HERO_YAW + Math.sin(time * 0.22) * 0.32 + pointer.x * 0.3;
      figure.rotation.y += (yaw - figure.rotation.y) * 0.04;
    }
  };

  const tick = () => {
    const now = performance.now();
    const elapsed = (now - last) / 1000;
    last = now;
    animate(Math.min(elapsed, 1 / 20));
    // Ease the camera toward the scroll position so wheel steps do not jump; uses the real frame
    // time, so a slow device catches up instead of lagging behind the scroll.
    progress += (targetProgress - progress) * (1 - Math.exp(-Math.min(elapsed, 0.5) * 6));
    applyProgress();
    render();
  };

  const syncLoop = () => {
    const run = playing && visible;
    if (run) last = performance.now();
    renderer.setAnimationLoop(run ? tick : null);
  };

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    if (mode === 'hero') frameHero();
    else {
      buildKeys();
      applyProgress();
    }
    render();
  };

  const onPointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
      THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1),
    );
  };

  // First frame: settle every animated part once so a paused or reduced-motion scene is complete.
  animate(0);
  scanner.update(2.6);
  setFigureFade(0);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    syncLoop();
  });
  visibility.observe(canvas);
  if (mode === 'hero') window.addEventListener('pointermove', onPointer, { passive: true });
  resize();
  syncLoop();

  return {
    setProgress(next) {
      targetProgress = THREE.MathUtils.clamp(next, 0, 1);
      if (!playing || !visible) {
        progress = targetProgress;
        applyProgress();
        render();
      }
    },
    setPlaying(next) {
      if (reducedMotion) return;
      playing = next;
      if (!next) {
        progress = targetProgress;
        applyProgress();
        render();
      }
      syncLoop();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('pointermove', onPointer);
      resizeObserver.disconnect();
      visibility.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.InstancedMesh) {
          (object.geometry as THREE.BufferGeometry).dispose();
          const list = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of list as THREE.Material[]) material.dispose();
        }
      });
      dot.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
