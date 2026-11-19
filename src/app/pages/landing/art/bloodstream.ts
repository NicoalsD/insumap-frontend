import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noise3, type Theme } from './anatomy';

/**
 * Inside the vessel: a tunnel wall, red and white blood cells and glucose molecules flowing past
 * the camera. Also the glucose molecules around the sensor filament and the data stream that
 * leaves the sensor. Art direction only.
 */

// ---------------------------------------------------------------------------------------------
// Glucose molecules (instanced): a six-atom ring (five carbons, one oxygen) with hydroxyl groups.

interface Atom {
  readonly position: THREE.Vector3;
  readonly carbon: boolean;
}

const GLUCOSE: { atoms: Atom[]; bonds: [number, number][] } = (() => {
  const atoms: Atom[] = [];
  const bonds: [number, number][] = [];
  const ring = 0.09;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    atoms.push({
      position: new THREE.Vector3(Math.cos(angle) * ring, i % 2 === 0 ? 0.016 : -0.016, Math.sin(angle) * ring),
      carbon: i !== 0,
    });
    bonds.push([i, (i + 1) % 6]);
  }
  // Hydroxyl oxygens on carbons 1 to 4, alternating up and down.
  for (let i = 1; i <= 4; i++) {
    const angle = (i / 6) * Math.PI * 2;
    atoms.push({ position: new THREE.Vector3(Math.cos(angle) * 0.165, i % 2 === 0 ? 0.06 : -0.06, Math.sin(angle) * 0.165), carbon: false });
    bonds.push([i, atoms.length - 1]);
  }
  // Carbon 6 and its hydroxyl on carbon 5.
  const angle5 = (5 / 6) * Math.PI * 2;
  atoms.push({ position: new THREE.Vector3(Math.cos(angle5) * 0.17, 0.06, Math.sin(angle5) * 0.17), carbon: true });
  bonds.push([5, atoms.length - 1]);
  atoms.push({ position: new THREE.Vector3(Math.cos(angle5) * 0.24, 0.11, Math.sin(angle5) * 0.24), carbon: false });
  bonds.push([atoms.length - 2, atoms.length - 1]);
  return { atoms, bonds };
})();

export interface Molecules {
  readonly group: THREE.Group;
  readonly materials: THREE.Material[];
  /** Writes molecule `index` with the given transform. Call `commit()` after a batch. */
  set(index: number, position: THREE.Vector3, rotation: THREE.Quaternion, scale: number): void;
  commit(): void;
}

export function createMolecules(count: number, theme: Theme): Molecules {
  const group = new THREE.Group();
  const carbons = GLUCOSE.atoms.filter((atom) => atom.carbon);
  const oxygens = GLUCOSE.atoms.filter((atom) => !atom.carbon);
  const carbonMaterial = new THREE.MeshStandardMaterial({
    color: '#ffb21f',
    emissive: '#ff9d00',
    emissiveIntensity: theme === 'dark' ? 0.9 : 0.35,
    roughness: 0.35,
    transparent: true,
  });
  const oxygenMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#dfe5ff',
    emissiveIntensity: theme === 'dark' ? 0.45 : 0.1,
    roughness: 0.35,
    transparent: true,
  });
  const bondMaterial = new THREE.MeshStandardMaterial({ color: '#f4f0ff', roughness: 0.5, transparent: true });
  const atomGeometry = new THREE.SphereGeometry(1, 16, 12);
  const carbonMesh = new THREE.InstancedMesh(atomGeometry, carbonMaterial, count * carbons.length);
  const oxygenMesh = new THREE.InstancedMesh(atomGeometry, oxygenMaterial, count * oxygens.length);
  const bondMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8), bondMaterial, count * GLUCOSE.bonds.length);
  for (const mesh of [carbonMesh, oxygenMesh, bondMesh]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  // Local matrices of every atom and bond inside one molecule.
  const local = (atoms: Atom[], radius: number) =>
    atoms.map((atom) => new THREE.Matrix4().compose(atom.position, new THREE.Quaternion(), new THREE.Vector3(radius, radius, radius)));
  const carbonLocal = local(carbons, 0.03);
  const oxygenLocal = local(oxygens, 0.027);
  const up = new THREE.Vector3(0, 1, 0);
  const bondLocal = GLUCOSE.bonds.map(([a, b]) => {
    const from = GLUCOSE.atoms[a]?.position ?? new THREE.Vector3();
    const to = GLUCOSE.atoms[b]?.position ?? new THREE.Vector3();
    const direction = to.clone().sub(from);
    return new THREE.Matrix4().compose(
      from.clone().add(to).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize()),
      new THREE.Vector3(0.009, direction.length(), 0.009),
    );
  });

  const world = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const scaleVector = new THREE.Vector3();
  return {
    group,
    materials: [carbonMaterial, oxygenMaterial, bondMaterial],
    set(index, position, rotation, scale) {
      world.compose(position, rotation, scaleVector.setScalar(scale));
      carbonLocal.forEach((m, i) => carbonMesh.setMatrixAt(index * carbonLocal.length + i, out.multiplyMatrices(world, m)));
      oxygenLocal.forEach((m, i) => oxygenMesh.setMatrixAt(index * oxygenLocal.length + i, out.multiplyMatrices(world, m)));
      bondLocal.forEach((m, i) => bondMesh.setMatrixAt(index * bondLocal.length + i, out.multiplyMatrices(world, m)));
    },
    commit() {
      carbonMesh.instanceMatrix.needsUpdate = true;
      oxygenMesh.instanceMatrix.needsUpdate = true;
      bondMesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The vessel

const TUNNEL_PATH = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(0, 0, 0.8),
    new THREE.Vector3(0.12, -0.08, -2),
    new THREE.Vector3(-0.22, 0.16, -4.5),
    new THREE.Vector3(0.16, -0.1, -7),
    new THREE.Vector3(0, 0.06, -9.5),
    new THREE.Vector3(-0.12, 0, -12),
  ],
  false,
  'centripetal',
);
const TUNNEL_RADIUS = 0.8;
const RED_CELLS = 120;
const WHITE_CELLS = 6;
const TUNNEL_MOLECULES = 42;

export interface Bloodstream {
  readonly group: THREE.Group;
  readonly materials: THREE.Material[];
  readonly path: THREE.CatmullRomCurve3;
  update(delta: number, time: number): void;
}

function redCellGeometry(): THREE.LatheGeometry {
  const profile: [number, number][] = [
    [0.0005, 0.012],
    [0.03, 0.016],
    [0.06, 0.03],
    [0.09, 0.042],
    [0.115, 0.036],
    [0.13, 0.015],
    [0.133, 0],
    [0.13, -0.015],
    [0.115, -0.036],
    [0.09, -0.042],
    [0.06, -0.03],
    [0.03, -0.016],
    [0.0005, -0.012],
  ];
  return new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    40,
  );
}

function bumpyBall(): THREE.BufferGeometry {
  // Shared vertices, so the relief shades smooth instead of faceted.
  const ico = new THREE.IcosahedronGeometry(1, 4);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const geometry = mergeVertices(ico);
  const position = geometry.getAttribute('position');
  const p = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    p.multiplyScalar(1 + (noise3(p.x * 4, p.y * 4, p.z * 4) - 0.5) * 0.35);
    position.setXYZ(i, p.x, p.y, p.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function buildBloodstream(theme: Theme): Bloodstream {
  const group = new THREE.Group();

  // Wall: inside of a tube, mottled with noise in the vertex colors.
  const wallGeometry = new THREE.TubeGeometry(TUNNEL_PATH, 320, TUNNEL_RADIUS, 72, false);
  const wallPosition = wallGeometry.getAttribute('position');
  const colors = new Float32Array(wallPosition.count * 3);
  const deep = new THREE.Color('#2a0410');
  const bright = new THREE.Color('#8a1730');
  const mixed = new THREE.Color();
  const p = new THREE.Vector3();
  for (let i = 0; i < wallPosition.count; i++) {
    p.fromBufferAttribute(wallPosition, i);
    const n = noise3(p.x * 3, p.y * 3, p.z * 0.9) * 0.7 + noise3(p.x * 11, p.y * 11, p.z * 3) * 0.3;
    mixed.copy(deep).lerp(bright, n);
    colors.set([mixed.r, mixed.g, mixed.b], i * 3);
  }
  wallGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const wallMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    roughness: 0.55,
    metalness: 0,
    emissive: '#2a0510',
    emissiveIntensity: theme === 'dark' ? 0.6 : 0.3,
    transparent: true,
  });
  group.add(new THREE.Mesh(wallGeometry, wallMaterial));

  // Red cells.
  const cellMaterial = new THREE.MeshPhysicalMaterial({
    color: '#b5122f',
    emissive: '#4a0412',
    emissiveIntensity: 0.35,
    roughness: 0.4,
    clearcoat: 0.6,
    sheen: 0.5,
    sheenColor: new THREE.Color('#ff7d93'),
    transparent: true,
  });
  const cells = new THREE.InstancedMesh(redCellGeometry(), cellMaterial, RED_CELLS);
  cells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cells.frustumCulled = false;
  group.add(cells);

  // White cells.
  const whiteMaterial = new THREE.MeshPhysicalMaterial({
    color: '#f2eefc',
    emissive: '#b9b2e8',
    emissiveIntensity: 0.25,
    roughness: 0.6,
    sheen: 0.6,
    transparent: true,
  });
  const whites = new THREE.InstancedMesh(bumpyBall(), whiteMaterial, WHITE_CELLS);
  whites.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  whites.frustumCulled = false;
  group.add(whites);

  const molecules = createMolecules(TUNNEL_MOLECULES, theme);
  group.add(molecules.group);

  // Each body in the stream: position along the path, offset in the cross-section, spin.
  const frames = TUNNEL_PATH.computeFrenetFrames(400, false);
  // Bodies travel in a ring around the axis: the center stays clear for the camera.
  const spawn = (radiusLimit: number, clear = 0.3) => ({
    u: Math.random(),
    angle: Math.random() * Math.PI * 2,
    radius: clear + Math.sqrt(Math.random()) * (radiusLimit - clear),
    speed: 0.012 + Math.random() * 0.01,
    rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
    spin: new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, 0),
  });
  const red = Array.from({ length: RED_CELLS }, () => spawn(TUNNEL_RADIUS * 0.82));
  const white = Array.from({ length: WHITE_CELLS }, () => spawn(TUNNEL_RADIUS * 0.6));
  const glucose = Array.from({ length: TUNNEL_MOLECULES }, () => spawn(TUNNEL_RADIUS * 0.72, 0.32));

  const point = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const place = (body: ReturnType<typeof spawn>): THREE.Vector3 => {
    const index = Math.min(400, Math.max(0, Math.round(body.u * 400)));
    const normal = frames.normals[index];
    const binormal = frames.binormals[index];
    TUNNEL_PATH.getPointAt(body.u, point);
    if (normal && binormal) {
      point.addScaledVector(normal, Math.cos(body.angle) * body.radius);
      point.addScaledVector(binormal, Math.sin(body.angle) * body.radius);
    }
    return point;
  };

  const update = (delta: number, time: number) => {
    const advance = (body: ReturnType<typeof spawn>) => {
      // Flow toward the start of the tunnel, where the camera looks from.
      body.u -= body.speed * delta;
      if (body.u < 0.01) body.u = 1;
      body.rotation.x += body.spin.x * delta;
      body.rotation.y += body.spin.y * delta;
    };
    red.forEach((body, i) => {
      advance(body);
      quaternion.setFromEuler(body.rotation);
      matrix.compose(place(body), quaternion, scale.setScalar(1));
      cells.setMatrixAt(i, matrix);
    });
    cells.instanceMatrix.needsUpdate = true;
    white.forEach((body, i) => {
      advance(body);
      quaternion.setFromEuler(body.rotation);
      matrix.compose(place(body), quaternion, scale.setScalar(0.13));
      whites.setMatrixAt(i, matrix);
    });
    whites.instanceMatrix.needsUpdate = true;
    glucose.forEach((body, i) => {
      advance(body);
      quaternion.setFromEuler(body.rotation);
      molecules.set(i, place(body), quaternion, 0.6 + Math.sin(time + i) * 0.04);
    });
    molecules.commit();
  };
  update(0, 0);

  return {
    group,
    materials: [wallMaterial, cellMaterial, whiteMaterial, ...molecules.materials],
    path: TUNNEL_PATH,
    update,
  };
}

// ---------------------------------------------------------------------------------------------
// Data stream: readings leaving the sensor toward the clinic.

export interface DataStream {
  readonly points: THREE.Points;
  readonly material: THREE.PointsMaterial;
  update(delta: number): void;
}

export function buildDataStream(from: THREE.Vector3, normal: THREE.Vector3, theme: Theme, dot: THREE.Texture): DataStream {
  const out = normal.clone().normalize();
  const path = new THREE.CatmullRomCurve3([
    from.clone().addScaledVector(out, 0.05),
    from.clone().addScaledVector(out, 0.35).add(new THREE.Vector3(0, 0.3, 0)),
    from.clone().addScaledVector(out, 0.7).add(new THREE.Vector3(0, 1.0, 0.1)),
    from.clone().addScaledVector(out, 0.9).add(new THREE.Vector3(0, 2.0, 0.2)),
  ]);
  const count = 90;
  const positions = new Float32Array(count * 3);
  const state = Array.from({ length: count }, () => ({ t: Math.random(), speed: 0.18 + Math.random() * 0.12, jitter: Math.random() }));
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute('position', attribute);
  const material = new THREE.PointsMaterial({
    color: theme === 'dark' ? '#b9c8ff' : '#1f4bff',
    map: dot,
    size: theme === 'dark' ? 0.045 : 0.032,
    transparent: true,
    depthWrite: false,
    blending: theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 5;
  const p = new THREE.Vector3();
  const update = (delta: number) => {
    state.forEach((particle, index) => {
      particle.t = (particle.t + particle.speed * delta) % 1;
      path.getPointAt(particle.t, p);
      const wobble = Math.sin(particle.t * 12 + particle.jitter * 6) * 0.025;
      positions.set([p.x + wobble, p.y, p.z + wobble], index * 3);
    });
    attribute.needsUpdate = true;
  };
  update(0);
  return { points, material, update };
}
