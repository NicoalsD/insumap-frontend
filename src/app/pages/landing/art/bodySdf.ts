import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';

/**
 * The human body as one signed distance field (ellipsoids and round cones joined with smooth
 * minimums), meshed with marching cubes into a single smooth surface. Pure math, no WebGL: it runs
 * in a worker and in tests. Units: the figure stands 4 units tall, soles at y = -2, head at y = 2,
 * facing +z. Art direction only: every number here is anatomy proportion or mesh resolution.
 */

export interface BodyMeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  /** Glucose sensor on the back of the right upper arm: surface point and outward normal. */
  readonly sensor: { readonly position: readonly [number, number, number]; readonly normal: readonly [number, number, number] };
}

interface Primitive {
  readonly ellipsoid: boolean;
  // Ellipsoid: center and radii. Round cone: a, b - a and precomputed terms.
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly rx: number;
  readonly ry: number;
  readonly rz: number;
  readonly bax: number;
  readonly bay: number;
  readonly baz: number;
  readonly l2: number;
  readonly rr: number;
  readonly a2: number;
  readonly il2: number;
  readonly r1: number;
  readonly r2: number;
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

interface Group {
  readonly prims: readonly Primitive[];
  readonly k: number;
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  /** Clips the group below this height (flat soles). */
  readonly floorY: number | null;
}

type V3 = readonly [number, number, number];

const FAR = 10;
const PAD = 0.12;

function ellipsoid(c: V3, r: V3): Primitive {
  const [cx, cy, cz] = c;
  const [rx, ry, rz] = r;
  return {
    ellipsoid: true,
    cx, cy, cz, rx, ry, rz,
    bax: 0, bay: 0, baz: 0, l2: 0, rr: 0, a2: 0, il2: 0, r1: 0, r2: 0,
    min: [cx - rx - PAD, cy - ry - PAD, cz - rz - PAD],
    max: [cx + rx + PAD, cy + ry + PAD, cz + rz + PAD],
  };
}

function roundCone(a: V3, r1: number, b: V3, r2: number): Primitive {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const r = Math.max(r1, r2) + PAD;
  return {
    ellipsoid: false,
    cx: ax, cy: ay, cz: az, rx: 0, ry: 0, rz: 0,
    bax, bay, baz, l2, rr, a2: l2 - rr * rr, il2: 1 / l2, r1, r2,
    min: [Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.min(az, bz) - r],
    max: [Math.max(ax, bx) + r, Math.max(ay, by) + r, Math.max(az, bz) + r],
  };
}

function group(prims: readonly Primitive[], k: number, floorY: number | null = null): Group {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis] ?? Infinity, p.min[axis] ?? Infinity);
      max[axis] = Math.max(max[axis] ?? -Infinity, p.max[axis] ?? -Infinity);
    }
  }
  return { prims, k, min, max, floorY };
}

const mirror = ([x, y, z]: V3): V3 => [-x, y, z];

function armGroup(side: 1 | -1): Group {
  const s = (v: V3): V3 => (side === 1 ? v : mirror(v));
  return group(
    [
      ellipsoid(s([0.42, 1.17, -0.015]), [0.125, 0.135, 0.12]),
      roundCone(s([0.455, 1.12, -0.015]), 0.092, s([0.575, 0.5, -0.02]), 0.068),
      roundCone(s([0.575, 0.5, -0.02]), 0.07, s([0.675, -0.05, 0.03]), 0.045),
      ellipsoid(s([0.7, -0.18, 0.045]), [0.042, 0.105, 0.07]),
    ],
    0.05,
  );
}

function legGroup(side: 1 | -1): Group {
  const s = (v: V3): V3 => (side === 1 ? v : mirror(v));
  return group(
    [
      roundCone(s([0.185, 0.04, -0.01]), 0.17, s([0.165, -0.92, 0]), 0.098),
      ellipsoid(s([0.165, -0.95, 0.02]), [0.092, 0.1, 0.092]),
      roundCone(s([0.165, -0.98, -0.005]), 0.092, s([0.162, -1.28, -0.035]), 0.098),
      roundCone(s([0.162, -1.28, -0.035]), 0.098, s([0.158, -1.86, -0.02]), 0.055),
      roundCone(s([0.158, -1.94, -0.04]), 0.062, s([0.175, -1.955, 0.19]), 0.048),
    ],
    0.05,
    -2,
  );
}

const TORSO = group(
  [
    ellipsoid([0, 1.0, 0], [0.33, 0.33, 0.2]),
    ellipsoid([0, 1.17, -0.01], [0.39, 0.13, 0.17]),
    ellipsoid([0, 0.6, 0.015], [0.27, 0.3, 0.175]),
    ellipsoid([0, 0.18, -0.005], [0.335, 0.24, 0.2]),
    ellipsoid([0.12, 0.08, -0.075], [0.155, 0.17, 0.15]),
    ellipsoid([-0.12, 0.08, -0.075], [0.155, 0.17, 0.15]),
    roundCone([0, 1.37, -0.03], 0.1, [0.36, 1.24, -0.03], 0.085),
    roundCone([0, 1.37, -0.03], 0.1, [-0.36, 1.24, -0.03], 0.085),
  ],
  0.14,
);

const HEAD = group(
  [
    roundCone([0, 1.33, -0.02], 0.1, [0, 1.56, -0.02], 0.085),
    ellipsoid([0, 1.76, -0.01], [0.185, 0.235, 0.215]),
    ellipsoid([0, 1.62, 0.045], [0.14, 0.13, 0.145]),
    ellipsoid([0, 1.705, 0.205], [0.03, 0.055, 0.04]),
    ellipsoid([0.185, 1.72, -0.01], [0.022, 0.05, 0.035]),
    ellipsoid([-0.185, 1.72, -0.01], [0.022, 0.05, 0.035]),
  ],
  0.06,
);

const ARM_R = armGroup(1);
const ARM_L = armGroup(-1);
const LEG_R = legGroup(1);
const LEG_L = legGroup(-1);

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function primitiveDistance(p: Primitive, x: number, y: number, z: number): number {
  if (p.ellipsoid) {
    const dx = x - p.cx;
    const dy = y - p.cy;
    const dz = z - p.cz;
    const ex = dx / p.rx;
    const ey = dy / p.ry;
    const ez = dz / p.rz;
    const k0 = Math.sqrt(ex * ex + ey * ey + ez * ez);
    const fx = dx / (p.rx * p.rx);
    const fy = dy / (p.ry * p.ry);
    const fz = dz / (p.rz * p.rz);
    const k1 = Math.sqrt(fx * fx + fy * fy + fz * fz);
    return k1 === 0 ? -Math.min(p.rx, p.ry, p.rz) : (k0 * (k0 - 1)) / k1;
  }
  // Round cone (Inigo Quilez): single square root.
  const pax = x - p.cx;
  const pay = y - p.cy;
  const paz = z - p.cz;
  const yy = pax * p.bax + pay * p.bay + paz * p.baz;
  const zz = yy - p.l2;
  const qx = pax * p.l2 - p.bax * yy;
  const qy = pay * p.l2 - p.bay * yy;
  const qz = paz * p.l2 - p.baz * yy;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = yy * yy * p.l2;
  const z2 = zz * zz * p.l2;
  const k = Math.sign(p.rr) * p.rr * p.rr * x2;
  if (Math.sign(zz) * p.a2 * z2 > k) return Math.sqrt(x2 + z2) * p.il2 - p.r2;
  if (Math.sign(yy) * p.a2 * y2 < k) return Math.sqrt(x2 + y2) * p.il2 - p.r1;
  return (Math.sqrt(x2 * p.a2 * p.il2) + yy * p.rr) * p.il2 - p.r1;
}

function inside(min: readonly number[], max: readonly number[], x: number, y: number, z: number): boolean {
  return (
    x >= (min[0] ?? 0) && x <= (max[0] ?? 0) && y >= (min[1] ?? 0) && y <= (max[1] ?? 0) && z >= (min[2] ?? 0) && z <= (max[2] ?? 0)
  );
}

function groupDistance(g: Group, x: number, y: number, z: number): number {
  if (!inside(g.min, g.max, x, y, z)) return FAR;
  let d = FAR;
  for (const p of g.prims) {
    if (!inside(p.min, p.max, x, y, z)) continue;
    d = smin(d, primitiveDistance(p, x, y, z), g.k);
  }
  if (g.floorY !== null) d = Math.max(d, g.floorY - y);
  return d;
}

/** Signed distance to the body surface (negative inside). */
export function bodySdf(x: number, y: number, z: number): number {
  let d = smin(groupDistance(TORSO, x, y, z), groupDistance(HEAD, x, y, z), 0.08);
  d = smin(d, Math.min(groupDistance(ARM_R, x, y, z), groupDistance(ARM_L, x, y, z)), 0.06);
  d = smin(d, Math.min(groupDistance(LEG_R, x, y, z), groupDistance(LEG_L, x, y, z)), 0.1);
  return d;
}

/** Outward unit normal from the field gradient (tetrahedron technique). */
export function bodyNormal(x: number, y: number, z: number, epsilon = 0.004): [number, number, number] {
  const a = bodySdf(x + epsilon, y - epsilon, z - epsilon);
  const b = bodySdf(x - epsilon, y - epsilon, z + epsilon);
  const c = bodySdf(x - epsilon, y + epsilon, z - epsilon);
  const d = bodySdf(x + epsilon, y + epsilon, z + epsilon);
  const nx = a - b - c + d;
  const ny = -a - b + c + d;
  const nz = -a + b - c + d;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

/** Sphere-traces from outside along `-direction` to the surface; returns the hit and its normal. */
export function surfacePoint(origin: V3, direction: V3): { position: [number, number, number]; normal: [number, number, number] } {
  const length = Math.hypot(...direction) || 1;
  const dx = direction[0] / length;
  const dy = direction[1] / length;
  const dz = direction[2] / length;
  let x = origin[0] + dx * 0.6;
  let y = origin[1] + dy * 0.6;
  let z = origin[2] + dz * 0.6;
  // Steps are capped: outside the pruning boxes the field reads FAR, which would jump through.
  for (let step = 0; step < 256; step++) {
    const d = Math.min(bodySdf(x, y, z), 0.04);
    if (Math.abs(d) < 1e-5) break;
    x -= dx * d;
    y -= dy * d;
    z -= dz * d;
  }
  return { position: [x, y, z], normal: bodyNormal(x, y, z) };
}

// Marching cubes corner offsets and edges, in the order of three's edgeTable / triTable.
const CORNERS: readonly V3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
/** [from corner, to corner, axis (0 x, 1 y, 2 z)] */
const EDGES: readonly (readonly [number, number, number])[] = [
  [0, 1, 0],
  [1, 2, 1],
  [3, 2, 0],
  [0, 3, 1],
  [4, 5, 0],
  [5, 6, 1],
  [7, 6, 0],
  [4, 7, 1],
  [0, 4, 2],
  [1, 5, 2],
  [2, 6, 2],
  [3, 7, 2],
];

/** Meshes the body. `cell` is the grid spacing in body units. */
export function buildBodyMesh(cell = 0.022): BodyMeshData {
  const bounds = { min: [-0.84, -2.04, -0.29], max: [0.84, 2.04, 0.29] } as const;
  const nx = Math.ceil((bounds.max[0] - bounds.min[0]) / cell) + 1;
  const ny = Math.ceil((bounds.max[1] - bounds.min[1]) / cell) + 1;
  const nz = Math.ceil((bounds.max[2] - bounds.min[2]) / cell) + 1;
  const field = new Float32Array(nx * ny * nz);
  const index = (i: number, j: number, k: number): number => i + nx * (j + ny * k);

  for (let k = 0; k < nz; k++) {
    const z = bounds.min[2] + k * cell;
    for (let j = 0; j < ny; j++) {
      const y = bounds.min[1] + j * cell;
      for (let i = 0; i < nx; i++) {
        field[index(i, j, k)] = bodySdf(bounds.min[0] + i * cell, y, z);
      }
    }
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  // One vertex per crossed grid edge, shared by the cubes around it.
  const edgeVertex = new Int32Array(nx * ny * nz * 3).fill(-1);
  const corner = new Float64Array(8);
  const edgeIds = new Int32Array(12);

  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let cubeIndex = 0;
        for (let c = 0; c < 8; c++) {
          const [ox = 0, oy = 0, oz = 0] = CORNERS[c] ?? [];
          const value = field[index(i + ox, j + oy, k + oz)] ?? FAR;
          corner[c] = value;
          // Bit set where the corner is outside (three's convention, which yields outward winding).
          if (value > 0) cubeIndex |= 1 << c;
        }
        const bits = edgeTable[cubeIndex] ?? 0;
        if (bits === 0) continue;

        for (let e = 0; e < 12; e++) {
          if ((bits & (1 << e)) === 0) continue;
          const [from = 0, to = 0, axis = 0] = EDGES[e] ?? [];
          const [fx = 0, fy = 0, fz = 0] = CORNERS[from] ?? [];
          const base = index(i + fx, j + fy, k + fz);
          const key = base * 3 + axis;
          let vertex = edgeVertex[key] ?? -1;
          if (vertex < 0) {
            const v0 = corner[from] ?? 0;
            const v1 = corner[to] ?? 0;
            const t = Math.min(1, Math.max(0, v0 / (v0 - v1)));
            const x = bounds.min[0] + (i + fx + (axis === 0 ? t : 0)) * cell;
            const y = bounds.min[1] + (j + fy + (axis === 1 ? t : 0)) * cell;
            const z = bounds.min[2] + (k + fz + (axis === 2 ? t : 0)) * cell;
            vertex = positions.length / 3;
            positions.push(x, y, z);
            normals.push(...bodyNormal(x, y, z, cell * 0.35));
            edgeVertex[key] = vertex;
          }
          edgeIds[e] = vertex;
        }

        const offset = cubeIndex << 4;
        for (let t = 0; (triTable[offset + t] ?? -1) !== -1; t += 3) {
          indices.push(
            edgeIds[triTable[offset + t] ?? 0] ?? 0,
            edgeIds[triTable[offset + t + 1] ?? 0] ?? 0,
            edgeIds[triTable[offset + t + 2] ?? 0] ?? 0,
          );
        }
      }
    }
  }

  // The sensor sits on the back-outer side of the right upper arm, where a CGM is worn.
  const sensor = surfacePoint([0.505, 0.86, -0.017], [1, 0.05, -0.3]);
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    sensor,
  };
}
