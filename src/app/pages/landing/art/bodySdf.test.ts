import { describe, expect, it } from 'vitest';
import { bodySdf, buildBodyMesh } from './bodySdf';

describe('body signed distance field', () => {
  it('is negative inside the body and positive outside it', () => {
    expect(bodySdf(0, 0.9, 0)).toBeLessThan(0); // chest
    expect(bodySdf(0, 1.75, 0)).toBeLessThan(0); // head
    expect(bodySdf(0.17, -1.2, 0)).toBeLessThan(0); // right calf
    expect(bodySdf(0.62, 0.3, 0)).toBeLessThan(0); // right forearm
    expect(bodySdf(0, 2.3, 0)).toBeGreaterThan(0); // above the head
    expect(bodySdf(0.45, 0.4, 0)).toBeGreaterThan(0); // gap between waist and arm
    expect(bodySdf(0, -1.2, 0)).toBeGreaterThan(0); // gap between the legs
  });
});

describe('body mesh', () => {
  const mesh = buildBodyMesh();

  it('builds an indexed surface that stands 4 units tall', () => {
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.indices.length).toBeGreaterThan(30000);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < mesh.positions.length; i += 3) {
      minY = Math.min(minY, mesh.positions[i] ?? 0);
      maxY = Math.max(maxY, mesh.positions[i] ?? 0);
    }
    expect(minY).toBeCloseTo(-2, 1);
    expect(maxY).toBeCloseTo(2, 1);
  });

  it('winds every face outward, matching the field normals', () => {
    let outward = 0;
    const triangles = mesh.indices.length / 3;
    const p = (index: number, axis: number) => mesh.positions[index * 3 + axis] ?? 0;
    const n = (index: number, axis: number) => mesh.normals[index * 3 + axis] ?? 0;
    for (let t = 0; t < triangles; t++) {
      const a = mesh.indices[t * 3] ?? 0;
      const b = mesh.indices[t * 3 + 1] ?? 0;
      const c = mesh.indices[t * 3 + 2] ?? 0;
      const ux = p(b, 0) - p(a, 0), uy = p(b, 1) - p(a, 1), uz = p(b, 2) - p(a, 2);
      const vx = p(c, 0) - p(a, 0), vy = p(c, 1) - p(a, 1), vz = p(c, 2) - p(a, 2);
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * n(a, 0) + cy * n(a, 1) + cz * n(a, 2) > 0) outward++;
    }
    expect(outward / triangles).toBeGreaterThan(0.99);
  });

  it('places the sensor on the surface of the right upper arm, facing out', () => {
    const [x, y, z] = mesh.sensor.position;
    expect(Math.abs(bodySdf(x, y, z))).toBeLessThan(1e-3);
    expect(x).toBeGreaterThan(0.5);
    expect(y).toBeGreaterThan(0.6);
    expect(mesh.sensor.normal[0]).toBeGreaterThan(0.5);
  });
});
