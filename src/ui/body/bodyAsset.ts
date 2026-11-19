import type { PatientSex } from '@/services/dto/injection';
import { SITE_CODES, SPOT_COUNT, type SiteCode } from './siteCodes';

/**
 * The human body of the injection map: the MakeHuman base mesh (CC0) built by
 * `scripts/makehuman/build_body.py` into `public/models/makehuman-body.bin`. One file holds the female
 * body, the male-minus-female difference and four weight differences, so any patient's body is a
 * blend of the same vertices. Injection spots are vertex indices, valid for every blend.
 *
 * Frame (the one of `landing/art/bodySdf.ts`): soles at y = -2, the taller body 4 units high, the
 * face toward +z, the patient's left on +x.
 */

export const BODY_ASSET_FORMAT = 'insumap-body/1';
export const BODY_TARGETS = [
  'male',
  'female_max_weight',
  'female_min_weight',
  'male_max_weight',
  'male_min_weight',
] as const;
export type BodyTarget = (typeof BODY_TARGETS)[number];

export interface BodyAsset {
  readonly vertexCount: number;
  /** Female body, x y z per vertex. */
  readonly base: Float32Array;
  readonly indices: Uint16Array;
  readonly deltas: Readonly<
    Record<BodyTarget, { readonly data: Int16Array; readonly scale: number }>
  >;
  /** Vertex index of each spot (1 to 4) of each site. */
  readonly anchors: Readonly<Record<SiteCode, readonly number[]>>;
  readonly source: { readonly repo: string; readonly commit: string; readonly license: string };
}

/** How the patient's body looks: 0 female to 1 male, and -1 lean to 1 heavy. */
export interface BodyShape {
  readonly maleness: number;
  readonly weight: number;
}

export const NEUTRAL_SHAPE: BodyShape = { maleness: 0.5, weight: 0 };

/*
 * Art direction, not clinical values: how far the drawn body leans toward the lean or the heavy
 * MakeHuman extreme for a given BMI. The BMI itself comes from the API; nothing here classifies it.
 */
const BMI_NEUTRAL = 22;
const BMI_SPAN_HEAVY = 16;
const BMI_SPAN_LEAN = 6;
const MALENESS: Readonly<Record<PatientSex, number>> = {
  FEMALE: 0,
  MALE: 1,
  OTHER: 0.5,
  UNKNOWN: 0.5,
};
const COMPONENTS = 3;
const HEADER_BYTES = 4;
const ALIGN = 4;

/** The body for a patient's recorded sex and BMI. Without a BMI the build stays average. */
export function shapeFor(sex: PatientSex, bmi: number | null): BodyShape {
  const span = bmi !== null && bmi > BMI_NEUTRAL ? BMI_SPAN_HEAVY : BMI_SPAN_LEAN;
  const weight = bmi === null ? 0 : Math.max(-1, Math.min(1, (bmi - BMI_NEUTRAL) / span));
  return { maleness: MALENESS[sex], weight };
}

interface ArrayLayout {
  readonly offset: number;
  readonly length: number;
  readonly type: 'f32' | 'u16' | 'i16';
  readonly scale?: number;
}

interface Header {
  readonly format: string;
  readonly vertexCount: number;
  readonly arrays: Readonly<Record<string, ArrayLayout>>;
  readonly anchors: Readonly<Record<string, readonly number[]>>;
  readonly source: BodyAsset['source'];
}

/** Reads the file written by `build_body.py`. Throws on any other content. */
export function parseBodyAsset(buffer: ArrayBuffer): BodyAsset {
  const headerLength = new DataView(buffer).getUint32(0, true);
  const header = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, HEADER_BYTES, headerLength)),
  ) as Header;
  if (header.format !== BODY_ASSET_FORMAT) throw new Error(`Unknown body format: ${header.format}`);
  const start = HEADER_BYTES + headerLength;
  const dataStart = start + ((ALIGN - (start % ALIGN)) % ALIGN);
  const view = (name: string): ArrayLayout => {
    const layout = header.arrays[name];
    if (!layout) throw new Error(`Body file without ${name}`);
    return layout;
  };
  const floats = (layout: ArrayLayout) =>
    new Float32Array(buffer, dataStart + layout.offset, layout.length);
  const base = floats(view('base'));
  const indexLayout = view('indices');
  const indices = new Uint16Array(buffer, dataStart + indexLayout.offset, indexLayout.length);
  const deltas = Object.fromEntries(
    BODY_TARGETS.map((name) => {
      const layout = view(`delta:${name}`);
      return [
        name,
        {
          data: new Int16Array(buffer, dataStart + layout.offset, layout.length),
          scale: layout.scale ?? 1,
        },
      ];
    }),
  ) as Record<BodyTarget, { data: Int16Array; scale: number }>;
  const anchors = Object.fromEntries(
    SITE_CODES.map((site) => {
      const spots = header.anchors[site];
      if (spots?.length !== SPOT_COUNT) throw new Error(`Body file without the spots of ${site}`);
      return [site, spots];
    }),
  ) as Record<SiteCode, readonly number[]>;
  if (base.length !== header.vertexCount * COMPONENTS)
    throw new Error('Body file with a broken vertex array');
  return { vertexCount: header.vertexCount, base, indices, deltas, anchors, source: header.source };
}

/**
 * Writes the vertices of `shape` into `out` (allocated when omitted): the female body, plus the
 * male difference, plus the weight difference of each sex in its share.
 */
export function blendBody(asset: BodyAsset, shape: BodyShape, out?: Float32Array): Float32Array {
  const target = out ?? new Float32Array(asset.base.length);
  const male = Math.max(0, Math.min(1, shape.maleness));
  const heavy = Math.max(0, shape.weight);
  const lean = Math.max(0, -shape.weight);
  const shares: readonly (readonly [BodyTarget, number])[] = [
    ['male', male],
    ['female_max_weight', (1 - male) * heavy],
    ['female_min_weight', (1 - male) * lean],
    ['male_max_weight', male * heavy],
    ['male_min_weight', male * lean],
  ];
  const terms = shares
    .filter(([, factor]) => factor > 0)
    .map(([name, factor]) => ({
      data: asset.deltas[name].data,
      factor: factor * asset.deltas[name].scale,
    }));
  target.set(asset.base);
  for (const { data, factor } of terms) {
    for (let index = 0; index < data.length; index += 1) {
      target[index] = (target[index] ?? 0) + (data[index] ?? 0) * factor;
    }
  }
  return target;
}

let pending: Promise<BodyAsset> | null = null;

/** The body file, fetched once per page and shared by every map. */
export function loadBodyAsset(): Promise<BodyAsset> {
  pending ??= fetch(`${import.meta.env.BASE_URL}models/makehuman-body.bin`)
    .then((response) => {
      if (!response.ok) throw new Error(`Body file: HTTP ${String(response.status)}`);
      return response.arrayBuffer();
    })
    .then(parseBodyAsset)
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}
