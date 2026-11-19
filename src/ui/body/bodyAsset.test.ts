import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blendBody, parseBodyAsset, shapeFor, type BodyAsset } from './bodyAsset';
import { SITE_CODES, type SiteCode } from './siteCodes';

/** The real file shipped in `public/models`, read from disk: the anchors are checked on the real mesh. */
function asset(): BodyAsset {
  // Vitest runs from the project root.
  const file = readFileSync('public/models/makehuman-body.bin');
  return parseBodyAsset(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
}

const FRONT: readonly SiteCode[] = ['ABDOMEN_LEFT', 'ABDOMEN_RIGHT', 'THIGH_LEFT', 'THIGH_RIGHT'];
const BACK_Z_MAX = 0.05;

function point(positions: Float32Array, index: number) {
  return {
    x: positions[index * 3] ?? 0,
    y: positions[index * 3 + 1] ?? 0,
    z: positions[index * 3 + 2] ?? 0,
  };
}

describe('MakeHuman body file', () => {
  const body = asset();

  it('is the CC0 MakeHuman mesh, with four spots per site', () => {
    expect(body.source.license).toBe('CC0-1.0');
    expect(body.vertexCount * 3).toBe(body.base.length);
    for (const site of SITE_CODES) expect(body.anchors[site]).toHaveLength(4);
  });

  it('stands in the frame: soles at -2, the male body 4 units tall, the female shorter', () => {
    const female = blendBody(body, { maleness: 0, weight: 0 });
    const male = blendBody(body, { maleness: 1, weight: 0 });
    const heights = (positions: Float32Array) => {
      let min = Infinity;
      let max = -Infinity;
      for (let index = 1; index < positions.length; index += 3) {
        min = Math.min(min, positions[index] ?? 0);
        max = Math.max(max, positions[index] ?? 0);
      }
      return { min, max };
    };
    expect(heights(male).min).toBeCloseTo(-2, 1);
    expect(heights(male).max).toBeCloseTo(2, 1);
    expect(heights(female).max).toBeLessThan(heights(male).max);
  });

  it('puts each site on its side and face, on both bodies and at both weight extremes', () => {
    for (const shape of [
      { maleness: 0, weight: -1 },
      { maleness: 1, weight: 1 },
      { maleness: 0.5, weight: 0 },
    ]) {
      const positions = blendBody(body, shape);
      for (const site of SITE_CODES) {
        for (const index of body.anchors[site]) {
          const p = point(positions, index);
          // The patient's left is +x.
          expect(Math.sign(p.x)).toBe(site.endsWith('LEFT') ? 1 : -1);
          if (FRONT.includes(site)) expect(p.z).toBeGreaterThan(0);
          else expect(p.z).toBeLessThan(BACK_Z_MAX);
          // Between the knees and the shoulders.
          expect(p.y).toBeGreaterThan(-1);
          expect(p.y).toBeLessThan(1.1);
        }
      }
    }
  });

  it('mirrors the right spots onto the left ones', () => {
    const positions = blendBody(body, { maleness: 0.5, weight: 0 });
    const left = body.anchors.ABDOMEN_LEFT.map((index) => point(positions, index));
    const right = body.anchors.ABDOMEN_RIGHT.map((index) => point(positions, index));
    const sum = (points: { x: number }[]) => points.reduce((total, p) => total + p.x, 0);
    expect(sum(left) + sum(right)).toBeCloseTo(0, 2);
  });
});

describe('shapeFor', () => {
  it('maps the recorded sex and leaves the build average without a BMI', () => {
    expect(shapeFor('FEMALE', null)).toEqual({ maleness: 0, weight: 0 });
    expect(shapeFor('MALE', null)).toEqual({ maleness: 1, weight: 0 });
    expect(shapeFor('UNKNOWN', null).maleness).toBe(0.5);
  });

  it('leans the body toward heavy or lean with the BMI, within -1 and 1', () => {
    expect(shapeFor('MALE', 30).weight).toBeGreaterThan(0);
    expect(shapeFor('MALE', 17).weight).toBeLessThan(0);
    expect(shapeFor('FEMALE', 80).weight).toBe(1);
    expect(shapeFor('FEMALE', 10).weight).toBe(-1);
  });
});
