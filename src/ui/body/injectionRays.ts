import { SPOT_COUNT, type BodyView, type SiteCode, type SpotNumber } from './siteCodes';

/**
 * Where each injection marker sits on the figure, as a ray for `surfacePoint(origin, direction)`.
 *
 * Body frame (the same as `landing/art/bodySdf.ts`): the figure stands 4 units tall, feet at y = -2,
 * head at y = 2, and its face points to +z. So a front camera sits at +z and a back camera at -z.
 * The patient's RIGHT side is at negative x, which is the viewer's left when facing the figure.
 * The landing's mesh names its +x arm "right"; this module follows the clinical convention instead.
 *
 * Pure math, no three.js: the scene uses it to place markers, and the tests check the rays against
 * the real surface.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type Triple = readonly [number, number, number];

export interface InjectionRay {
  /** A point outside the body, `RAY_DISTANCE` units from the anchor along `direction`. */
  readonly origin: Triple;
  /** Outward unit normal of the face: the direction from the body toward the camera. */
  readonly direction: Triple;
}

/** Distance from the anchor to the ray origin, in body units. */
export const RAY_DISTANCE = 3;
/**
 * Half the spacing between spots, per region, in body units (1 unit is about 42 cm, so 0.06 is about
 * 2.5 cm between centers). The arm is narrow (radius about 0.08), so its spots sit closer across the
 * limb and farther apart along it; otherwise the outer spots would slide off the silhouette.
 */
const REGION_HALF_SPACING: Record<Region, { readonly across: number; readonly up: number }> = {
  ABDOMEN: { across: 0.06, up: 0.06 },
  THIGH: { across: 0.06, up: 0.06 },
  ARM: { across: 0.035, up: 0.06 },
  BUTTOCK: { across: 0.06, up: 0.06 },
};

type Region = 'ABDOMEN' | 'THIGH' | 'ARM' | 'BUTTOCK';

interface Face {
  readonly view: BodyView;
  /** Approximate point on the skin of the patient's left side (x > 0). */
  readonly anchor: Vec3;
  /** Outward direction of the face, for the left side (not normalized). */
  readonly normal: Vec3;
}

/**
 * Canonical faces, for the patient's LEFT (x > 0). Abdomen and thigh are on the front; arm and
 * buttock on the back, where the brief puts them. Anchors are approximate: `surfacePoint` finds the
 * true skin, and the tests bound the distance between the two.
 */
const REGION_FACES: Record<Region, Face> = {
  // Lower abdomen, beside the navel (about waist height).
  ABDOMEN: { view: 'front', anchor: { x: 0.13, y: 0.22, z: 0.18 }, normal: { x: 0.2, y: 0, z: 1 } },
  // Anterior-outer thigh, well above the knee and below the hip.
  THIGH: { view: 'front', anchor: { x: 0.25, y: -0.5, z: 0.1 }, normal: { x: 0.6, y: 0, z: 0.8 } },
  // Posterior-outer upper arm (back view).
  ARM: { view: 'back', anchor: { x: 0.55, y: 0.85, z: -0.05 }, normal: { x: 1, y: 0, z: -0.6 } },
  // Upper outer buttock (back view).
  BUTTOCK: {
    view: 'back',
    anchor: { x: 0.2, y: 0.2, z: -0.2 },
    normal: { x: 0.7, y: 0.35, z: -0.6 },
  },
};

/** Region and side of each site. `sign` mirrors x: -1 is the patient's right. */
const SITE_FACE: Record<SiteCode, { readonly region: Region; readonly sign: number }> = {
  ABDOMEN_RIGHT: { region: 'ABDOMEN', sign: -1 },
  ABDOMEN_LEFT: { region: 'ABDOMEN', sign: 1 },
  THIGH_RIGHT: { region: 'THIGH', sign: -1 },
  THIGH_LEFT: { region: 'THIGH', sign: 1 },
  ARM_RIGHT: { region: 'ARM', sign: -1 },
  ARM_LEFT: { region: 'ARM', sign: 1 },
  BUTTOCK_RIGHT: { region: 'BUTTOCK', sign: -1 },
  BUTTOCK_LEFT: { region: 'BUTTOCK', sign: 1 },
};

/** Offset of each spot in the face's tangent plane: column (-1 left, 1 right) and row (-1 bottom, 1 top). */
const SPOT_GRID: Record<SpotNumber, { readonly column: number; readonly row: number }> = {
  1: { column: -1, row: 1 },
  2: { column: 1, row: 1 },
  3: { column: -1, row: -1 },
  4: { column: 1, row: -1 },
};

const UP: Vec3 = { x: 0, y: 1, z: 0 };

/** The view that shows a site: the camera side that faces its skin. */
export function siteView(site: SiteCode): BodyView {
  return REGION_FACES[SITE_FACE[site].region].view;
}

/**
 * The ray that finds a spot's skin point, for a site seen from `view`. Returns `null` when the site
 * faces away from that view, so a marker is only drawn and picked on the side the camera shows.
 */
export function injectionRay(
  site: SiteCode,
  view: BodyView,
  spot: SpotNumber,
): InjectionRay | null {
  if (siteView(site) !== view) return null;
  const { region, sign } = SITE_FACE[site];
  const face = REGION_FACES[region];
  const normal = unit(mirror(face.normal, sign));
  const { first, second } = tangents(normal);
  const grid = SPOT_GRID[spot];
  const spacing = REGION_HALF_SPACING[region];
  const offset = add(
    scale(first, grid.column * spacing.across),
    scale(second, grid.row * spacing.up),
  );
  const anchor = add(mirror(face.anchor, sign), offset);
  const origin = add(anchor, scale(normal, RAY_DISTANCE));
  return { origin: toTriple(origin), direction: toTriple(normal) };
}

/** Every spot number of a site, in order. */
export function spotNumbers(): readonly SpotNumber[] {
  return Array.from({ length: SPOT_COUNT }, (_, index) => (index + 1) as SpotNumber);
}

function mirror(v: Vec3, sign: number): Vec3 {
  return { x: v.x * sign, y: v.y, z: v.z };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v: Vec3, factor: number): Vec3 {
  return { x: v.x * factor, y: v.y * factor, z: v.z * factor };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z);
  return scale(v, 1 / length);
}

/** Two unit vectors spanning the face: `first` runs across the body, `second` runs up it. */
function tangents(normal: Vec3): { first: Vec3; second: Vec3 } {
  const first = unit(cross(UP, normal));
  const second = unit(cross(normal, first));
  return { first, second };
}

function toTriple(v: Vec3): Triple {
  return [v.x, v.y, v.z];
}
