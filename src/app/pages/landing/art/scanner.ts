import * as THREE from 'three';
import type { Theme } from './anatomy';

/**
 * The monitoring rig around the body: a scan ring that sweeps from feet to head and a platform of
 * concentric rings under the feet with a soft contact shadow. Art direction only.
 */

export interface Scanner {
  readonly group: THREE.Group;
  readonly materials: THREE.Material[];
  /** Height of the scan plane in body units, for the skin's band. */
  readonly scanY: () => number;
  update(time: number): void;
}

const FLOOR = -2.005;
const SWEEP = { bottom: -1.9, top: 1.95, period: 7 };

export function buildScanner(theme: Theme): Scanner {
  const group = new THREE.Group();
  const accent = theme === 'dark' ? '#9fb4ff' : '#1f4bff';
  const blending = theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending;

  // Scan plane: a thin ring plus a faint disc that fades toward the center.
  const ringMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.85, depthWrite: false, blending });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.0045, 8, 160), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  const discMaterial = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(accent) }, uStrength: { value: theme === 'dark' ? 0.22 : 0.12 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float alpha = smoothstep(0.35, 1.0, r) * (1.0 - smoothstep(0.98, 1.0, r)) * uStrength;
        gl_FragColor = vec4(uColor, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 96), discMaterial);
  disc.rotation.x = -Math.PI / 2;
  const plane = new THREE.Group();
  plane.add(ring, disc);
  plane.renderOrder = 3;
  ring.renderOrder = 3;
  disc.renderOrder = 3;
  group.add(plane);

  // Platform under the feet.
  const platformMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(accent) },
      uShadow: { value: new THREE.Color(theme === 'dark' ? '#000000' : '#15173a') },
      uLine: { value: theme === 'dark' ? 0.55 : 0.42 },
      uShadowStrength: { value: theme === 'dark' ? 0.0 : 0.2 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uShadow;
      uniform float uLine;
      uniform float uShadowStrength;
      varying vec2 vUv;
      float ringLine(float r, float radius, float width) {
        float aa = fwidth(r) * 1.2;
        return 1.0 - smoothstep(width, width + aa, abs(r - radius));
      }
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float angle = atan(p.y, p.x);
        float lines = ringLine(r, 0.42, 0.004) + ringLine(r, 0.66, 0.003) + ringLine(r, 0.9, 0.004);
        float tick = step(0.82, r) * step(r, 0.88) * (1.0 - smoothstep(0.0, 0.02, abs(fract(angle / 6.2831853 * 48.0) - 0.5) * 2.0 - 0.9));
        float fade = 1.0 - smoothstep(0.75, 1.0, r);
        float alpha = clamp(lines + tick * 0.6, 0.0, 1.0) * uLine * fade;
        float shadow = (1.0 - smoothstep(0.0, 0.42, r)) * uShadowStrength;
        vec3 color = mix(uShadow, uColor, alpha / max(alpha + shadow, 0.0001));
        gl_FragColor = vec4(color, max(alpha, shadow));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const platform = new THREE.Mesh(new THREE.CircleGeometry(1.08, 128), platformMaterial);
  platform.rotation.x = -Math.PI / 2;
  platform.position.y = FLOOR;
  group.add(platform);

  let currentY = SWEEP.bottom;
  return {
    group,
    materials: [ringMaterial, discMaterial, platformMaterial],
    scanY: () => currentY,
    update(time) {
      // Ease in and out at both ends, like a scanner head.
      const phase = (Math.sin((time / SWEEP.period) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      currentY = SWEEP.bottom + (SWEEP.top - SWEEP.bottom) * phase;
      plane.position.y = currentY;
      // Narrow the ring smoothly where the body is narrow (shoulders, then neck and head).
      const step = (edge0: number, edge1: number) => {
        const t = Math.min(1, Math.max(0, (currentY - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
      };
      const width = 0.95 - 0.17 * step(1.0, 1.2) - 0.36 * step(1.28, 1.48);
      plane.scale.setScalar(width / 0.95);
    },
  };
}
