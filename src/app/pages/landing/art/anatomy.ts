import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Inner anatomy of the landing body: organs, a light skeleton, arteries and veins with flowing
 * blood, and the glucose sensor with its signal. Built from three primitives deformed with value
 * noise. Art direction only: every number here is position, size, color or timing.
 */

export type Theme = 'light' | 'dark';

type P = readonly [number, number, number];
const v = ([x, y, z]: P): THREE.Vector3 => new THREE.Vector3(x, y, z);
const mirrorX = ([x, y, z]: P): P => [-x, y, z];

// ---------------------------------------------------------------------------------------------
// Noise and geometry helpers

function hash(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1]. */
export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(ix + dx, iy + dy, iz + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), sx), lerp(c(0, 1, 0), c(1, 1, 0), sx), sy),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), sx), lerp(c(0, 1, 1), c(1, 1, 1), sx), sy),
    sz,
  );
}

/** A smooth closed unit blob (merged icosphere) ready to be deformed. */
function blob(detail: number): THREE.BufferGeometry {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  return mergeVertices(ico);
}

/** Applies `shape` to every vertex, then adds noise relief along the radial direction. */
function sculpt(
  geometry: THREE.BufferGeometry,
  shape: (p: THREE.Vector3) => void,
  relief: { amount: number; frequency: number; seed: number },
): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  // Relief follows the surface normal when the geometry has one (tubes); blobs use the radius.
  const normal = geometry.hasAttribute('normal') ? geometry.getAttribute('normal') : null;
  const p = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    if (normal) dir.fromBufferAttribute(normal, i);
    else dir.copy(p).normalize();
    const n = noise3(p.x * relief.frequency + relief.seed, p.y * relief.frequency, p.z * relief.frequency) - 0.5;
    p.addScaledVector(dir, n * 2 * relief.amount);
    shape(p);
    position.setXYZ(i, p.x, p.y, p.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A tube whose radius follows `radius(u)`, u in [0, 1] along the path. */
function taperedTube(
  path: THREE.Curve<THREE.Vector3>,
  radius: (u: number) => number,
  segments = 96,
  radial = 16,
): THREE.TubeGeometry {
  const geometry = new THREE.TubeGeometry(path, segments, 1, radial, false);
  const position = geometry.getAttribute('position');
  const p = new THREE.Vector3();
  const centers = Array.from({ length: segments + 1 }, (_, i) => path.getPointAt(i / segments));
  for (let i = 0; i < position.count; i++) {
    const ring = Math.floor(i / (radial + 1));
    const center = centers[Math.min(ring, segments)];
    if (!center) continue;
    p.fromBufferAttribute(position, i).sub(center).multiplyScalar(radius(ring / segments)).add(center);
    position.setXYZ(i, p.x, p.y, p.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function curve(points: readonly P[]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points.map(v), false, 'centripetal');
}

function organMaterial(color: string, emissive: number, theme: Theme, roughness = 0.42): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: theme === 'dark' ? emissive * 1.6 : emissive,
    roughness,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
    sheen: 0.4,
    sheenColor: new THREE.Color('#ffffff'),
  });
}

/** Soft round sprite for particles and glows. */
export function softDotTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const half = size / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------------------------------------------------------------------------------------------
// Organs

export interface Organs {
  readonly group: THREE.Group;
  readonly heart: THREE.Mesh;
  readonly pancreas: THREE.Mesh;
  readonly pancreasMaterial: THREE.MeshPhysicalMaterial;
  readonly materials: THREE.Material[];
}

export function buildOrgans(theme: Theme): Organs {
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, position?: P): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.copy(v(position));
    group.add(mesh);
    if (!materials.includes(material)) materials.push(material);
    return mesh;
  };

  // Brain and cerebellum.
  const brainMaterial = organMaterial('#e3a3c4', 0.12, theme, 0.55);
  add(
    sculpt(blob(5), (p) => p.multiply(new THREE.Vector3(0.145, 0.115, 0.17)), { amount: 0.06, frequency: 7, seed: 3 }),
    brainMaterial,
    [0, 1.815, -0.02],
  );
  add(
    sculpt(blob(3), (p) => p.multiply(new THREE.Vector3(0.075, 0.05, 0.06)), { amount: 0.08, frequency: 9, seed: 5 }),
    brainMaterial,
    [0, 1.685, -0.115],
  );

  // Lungs: flat on the inner side, concave over the diaphragm.
  const lungMaterial = organMaterial('#f2b2c5', 0.1, theme, 0.6);
  for (const side of [1, -1] as const) {
    add(
      sculpt(
        blob(4),
        (p) => {
          if (p.x * side < 0) p.x *= 0.45;
          if (p.y < -0.55) p.y = -0.55 + (p.y + 0.55) * 0.25;
          p.multiply(new THREE.Vector3(0.13, 0.25, 0.12));
        },
        { amount: 0.05, frequency: 3, seed: side * 7 },
      ),
      lungMaterial,
      [side * 0.165, 1.02, -0.025],
    );
  }

  // Heart: a tapered blob, apex down and to the body's left.
  const heart = add(
    sculpt(
      blob(4),
      (p) => {
        const taper = 1 - 0.5 * Math.max(0, -p.y);
        p.x *= taper;
        p.z *= taper;
        p.multiply(new THREE.Vector3(0.075, 0.095, 0.07));
      },
      { amount: 0.06, frequency: 4, seed: 11 },
    ),
    organMaterial('#d8304a', 0.22, theme, 0.35),
    [0.045, 0.94, 0.07],
  );
  heart.rotation.set(-0.25, 0, 0.55);

  // Liver: a wedge, thick on the body's right.
  add(
    sculpt(
      blob(4),
      (p) => {
        const thickness = 1.15 - 0.55 * ((p.x + 1) / 2);
        p.y *= thickness;
        p.multiply(new THREE.Vector3(0.2, 0.105, 0.125));
      },
      { amount: 0.04, frequency: 3, seed: 13 },
    ),
    organMaterial('#a3364f', 0.1, theme, 0.4),
    [-0.08, 0.735, 0.035],
  ).rotation.set(0, 0, -0.18);

  // Stomach: a J-shaped tube.
  add(
    taperedTube(
      curve([
        [0.05, 0.87, 0.05],
        [0.14, 0.83, 0.06],
        [0.175, 0.75, 0.065],
        [0.13, 0.69, 0.07],
        [0.04, 0.695, 0.07],
      ]),
      (u) => 0.03 + 0.03 * Math.sin(Math.PI * Math.min(1, u * 1.4)),
    ),
    organMaterial('#ee93b4', 0.1, theme, 0.45),
  );

  // Pancreas: the organ this product exists for. Head on the body's right, tail toward the left.
  const pancreasMaterial = organMaterial('#ffab1f', theme === 'dark' ? 0.75 : 0.55, theme, 0.35);
  const pancreasPath = curve([
    [-0.11, 0.54, 0.1],
    [-0.04, 0.565, 0.115],
    [0.05, 0.585, 0.11],
    [0.14, 0.61, 0.1],
    [0.22, 0.65, 0.08],
  ]);
  const pancreas = add(
    sculpt(
      taperedTube(pancreasPath, (u) => 0.058 - 0.03 * u, 120, 20),
      () => undefined,
      { amount: 0.006, frequency: 40, seed: 17 },
    ),
    pancreasMaterial,
  );

  // Kidneys: bean shapes behind the gut.
  const kidneyMaterial = organMaterial('#b0354c', 0.1, theme, 0.4);
  for (const side of [1, -1] as const) {
    add(
      sculpt(
        blob(3),
        (p) => {
          if (p.x * side < 0 && Math.abs(p.y) < 0.45) p.x *= 0.55;
          p.multiply(new THREE.Vector3(0.045, 0.08, 0.04));
        },
        { amount: 0.03, frequency: 3, seed: side * 19 },
      ),
      kidneyMaterial,
      [side * 0.13, 0.5, -0.1],
    ).rotation.set(0, 0, side * 0.18);
  }

  // Intestines: the large intestine frames the coiled small intestine.
  const serpentine: P[] = [];
  const rows = 5;
  for (let row = 0; row < rows; row++) {
    const y = 0.43 - row * 0.055;
    const forward = row % 2 === 0;
    for (let step = 0; step <= 8; step++) {
      const t = step / 8;
      const x = (forward ? -0.13 + t * 0.26 : 0.13 - t * 0.26) + Math.sin(t * 9 + row) * 0.012;
      serpentine.push([x, y + Math.sin(t * 13 + row * 2) * 0.012, 0.07 + Math.cos(t * 7 + row) * 0.02]);
    }
  }
  add(new THREE.TubeGeometry(curve(serpentine), 360, 0.022, 10, false), organMaterial('#f0a28c', 0.08, theme, 0.5));
  add(
    new THREE.TubeGeometry(
      curve([
        [-0.17, 0.13, 0.05],
        [-0.195, 0.3, 0.05],
        [-0.18, 0.48, 0.05],
        [0, 0.5, 0.07],
        [0.18, 0.48, 0.05],
        [0.195, 0.3, 0.05],
        [0.17, 0.14, 0.05],
        [0.07, 0.08, 0.04],
      ]),
      160,
      0.032,
      12,
      false,
    ),
    organMaterial('#e3876f', 0.08, theme, 0.5),
  );

  return { group, heart, pancreas, pancreasMaterial, materials };
}

// ---------------------------------------------------------------------------------------------
// Skeleton

export function buildSkeleton(theme: Theme): { group: THREE.Group; materials: THREE.Material[] } {
  const group = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({
    color: theme === 'dark' ? '#dfe3ff' : '#f3f1fb',
    emissive: theme === 'dark' ? '#8ea2ff' : '#000000',
    emissiveIntensity: theme === 'dark' ? 0.18 : 0,
    roughness: 0.55,
    clearcoat: 0.3,
  });

  // Spine: vertebrae along an S curve.
  const spine = curve([
    [0, 0.06, -0.11],
    [0, 0.34, -0.095],
    [0, 0.68, -0.13],
    [0, 1.04, -0.145],
    [0, 1.3, -0.1],
    [0, 1.56, -0.055],
  ]);
  const vertebrae = 26;
  const vertebra = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.033, 0.036, 14), material, vertebrae);
  const up = new THREE.Vector3(0, 1, 0);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  for (let i = 0; i < vertebrae; i++) {
    const u = i / (vertebrae - 1);
    const scale = 1.15 - u * 0.45;
    quaternion.setFromUnitVectors(up, spine.getTangentAt(u));
    matrix.compose(spine.getPointAt(u), quaternion, new THREE.Vector3(scale, 1, scale));
    vertebra.setMatrixAt(i, matrix);
  }
  group.add(vertebra);

  // Ribs, clavicles and the iliac crests as thin tubes.
  const bones: P[][] = [];
  for (let rib = 0; rib < 9; rib++) {
    const y = 1.24 - rib * 0.058;
    const width = 0.21 + Math.sin((rib / 8) * Math.PI) * 0.09;
    for (const side of [1, -1]) {
      bones.push([
        [side * 0.02, y, -0.14],
        [side * width * 0.75, y - 0.01, -0.12],
        [side * width, y - 0.06, 0.0],
        [side * width * 0.82, y - 0.12, 0.13],
        [side * 0.07, y - 0.16 - rib * 0.01, 0.18],
      ]);
    }
  }
  for (const side of [1, -1]) {
    bones.push([
      [side * 0.03, 1.27, 0.12],
      [side * 0.18, 1.29, 0.08],
      [side * 0.34, 1.28, 0],
    ]);
    bones.push([
      [side * 0.05, 0.06, -0.12],
      [side * 0.22, 0.27, -0.07],
      [side * 0.27, 0.24, 0.05],
      [side * 0.14, 0.09, 0.12],
    ]);
  }
  for (const points of bones) {
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve(points), 48, 0.0075, 6, false), material));
  }
  return { group, materials: [material] };
}

// ---------------------------------------------------------------------------------------------
// Vessels and blood flow

const ARTERIES: readonly (readonly P[])[] = (() => {
  const aorta: P[] = [
    [0.03, 0.99, 0.06],
    [0.0, 1.12, 0.03],
    [-0.02, 1.09, -0.05],
    [0.0, 0.8, -0.08],
    [0.0, 0.4, -0.06],
    [0.0, 0.1, -0.03],
  ];
  const leg: P[] = [
    [0.0, 0.1, -0.03],
    [0.09, 0.0, 0.0],
    [0.17, -0.35, 0.04],
    [0.16, -0.9, -0.03],
    [0.16, -1.4, -0.04],
    [0.16, -1.85, 0.0],
    [0.17, -1.93, 0.12],
  ];
  const carotid: P[] = [
    [0.0, 1.12, 0.03],
    [0.04, 1.3, 0.02],
    [0.05, 1.55, 0.0],
    [0.06, 1.72, 0.0],
  ];
  const arm: P[] = [
    [0.0, 1.12, 0.03],
    [0.18, 1.2, 0.0],
    [0.38, 1.18, -0.01],
    [0.5, 0.95, -0.01],
    [0.57, 0.5, 0.0],
    [0.65, 0.05, 0.03],
    [0.7, -0.18, 0.05],
  ];
  return [aorta, leg, leg.map(mirrorX), carotid, carotid.map(mirrorX), arm, arm.map(mirrorX)];
})();

/** Veins run beside the arteries, slightly outward and forward, and carry blood back. */
const VEINS: readonly (readonly P[])[] = ARTERIES.map((points) =>
  points.map(([x, y, z]): P => [x + (x >= 0 ? 0.024 : -0.024), y, z + 0.018]).reverse(),
);

export interface Vessels {
  readonly group: THREE.Group;
  readonly materials: THREE.Material[];
  /** Advances the blood particles by `delta` seconds. */
  update(delta: number): void;
}

export function buildVessels(theme: Theme, dot: THREE.Texture): Vessels {
  const group = new THREE.Group();
  const arteryMaterial = new THREE.MeshStandardMaterial({
    color: '#e0384e',
    emissive: '#e0384e',
    emissiveIntensity: theme === 'dark' ? 0.55 : 0.2,
    roughness: 0.4,
  });
  const veinMaterial = new THREE.MeshStandardMaterial({
    color: '#3d5fe6',
    emissive: '#3d5fe6',
    emissiveIntensity: theme === 'dark' ? 0.55 : 0.2,
    roughness: 0.4,
  });
  const arteryCurves = ARTERIES.map(curve);
  const veinCurves = VEINS.map(curve);
  arteryCurves.forEach((path, index) => {
    group.add(new THREE.Mesh(new THREE.TubeGeometry(path, 96, index === 0 ? 0.018 : 0.009, 8, false), arteryMaterial));
  });
  veinCurves.forEach((path, index) => {
    group.add(new THREE.Mesh(new THREE.TubeGeometry(path, 96, index === 0 ? 0.016 : 0.008, 8, false), veinMaterial));
  });

  const flows = [
    { curves: arteryCurves, color: '#ff4d63' },
    { curves: veinCurves, color: '#5b7cff' },
  ].map(({ curves, color }) => {
    const count = 180;
    const positions = new Float32Array(count * 3);
    const state = Array.from({ length: count }, (_, i) => ({
      curve: curves[i % curves.length] ?? curves[0],
      t: Math.random(),
      speed: 0.12 + Math.random() * 0.1,
    }));
    const geometry = new THREE.BufferGeometry();
    const attribute = new THREE.BufferAttribute(positions, 3);
    geometry.setAttribute('position', attribute);
    const material = new THREE.PointsMaterial({
      color,
      map: dot,
      size: theme === 'dark' ? 0.05 : 0.04,
      transparent: true,
      depthWrite: false,
      blending: theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const points = new THREE.Points(geometry, material);
    group.add(points);
    const place = () => {
      state.forEach((particle, index) => {
        const p = particle.curve?.getPointAt(particle.t % 1);
        if (p) positions.set([p.x, p.y, p.z], index * 3);
      });
      attribute.needsUpdate = true;
    };
    place();
    return { state, place, material };
  });

  return {
    group,
    materials: [arteryMaterial, veinMaterial, ...flows.map((flow) => flow.material)],
    update(delta) {
      for (const flow of flows) {
        for (const particle of flow.state) particle.t += particle.speed * delta;
        flow.place();
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Glucose sensor

export interface Sensor {
  readonly group: THREE.Group;
  readonly materials: THREE.Material[];
  /** Animates the signal rings; `time` in seconds. */
  update(time: number): void;
}

export function buildSensor(position: P, normal: P, theme: Theme): Sensor {
  const group = new THREE.Group();
  const n = v(normal).normalize();
  group.position.copy(v(position));
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);

  const puckProfile: P[] = [
    [0, 0.03, 0],
    [0.03, 0.03, 0],
    [0.055, 0.026, 0],
    [0.07, 0.016, 0],
    [0.075, 0.005, 0],
    [0.075, 0, 0],
  ];
  const puckMaterial = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
  const puck = new THREE.Mesh(
    new THREE.LatheGeometry(puckProfile.map(([x, y]) => new THREE.Vector2(x, y)), 48),
    puckMaterial,
  );
  puck.position.y = 0.004;
  const patchMaterial = new THREE.MeshStandardMaterial({ color: '#eef0fb', roughness: 0.8, side: THREE.DoubleSide });
  const patch = new THREE.Mesh(new THREE.CircleGeometry(0.1, 48), patchMaterial);
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.003;
  const ringAccent = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.004, 8, 48),
    new THREE.MeshBasicMaterial({ color: theme === 'dark' ? '#9fb4ff' : '#1f4bff' }),
  );
  ringAccent.rotation.x = Math.PI / 2;
  ringAccent.position.y = 0.032;
  // The filament that sits under the skin.
  const filament = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 8),
    new THREE.MeshStandardMaterial({ color: '#dfe5ff', emissive: '#9fb4ff', emissiveIntensity: 0.6 }),
  );
  filament.position.y = -0.035;
  group.add(patch, puck, ringAccent, filament);

  // Signal: three rings expanding over the skin.
  const pulseMaterials = [0, 1, 2].map(
    () =>
      new THREE.MeshBasicMaterial({
        color: theme === 'dark' ? '#9fb4ff' : '#1f4bff',
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
  );
  const pulses = pulseMaterials.map((material) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    ring.renderOrder = 4;
    group.add(ring);
    return ring;
  });

  return {
    group,
    materials: [puckMaterial, patchMaterial, ...pulseMaterials],
    update(time) {
      pulses.forEach((ring, index) => {
        const phase = (time * 0.55 + index / pulses.length) % 1;
        const scale = 0.08 + phase * 0.16;
        ring.scale.setScalar(scale);
        const material = pulseMaterials[index];
        if (material) material.opacity = (1 - phase) * 0.85;
      });
    },
  };
}
