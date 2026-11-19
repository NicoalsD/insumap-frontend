import * as THREE from 'three';

/**
 * Material of the body's skin: a glass shell that is clear where it faces the camera and dense at
 * the silhouette (fresnel), with a glossy highlight, optional scan contour lines and the sweeping
 * band of the scanner. Drawn after a depth prepass, so only the front-most surface shows and the
 * organs behind it stay visible.
 */

export interface ShellLook {
  readonly base: string;
  readonly baseAlpha: number;
  readonly rim: string;
  readonly rimAlpha: number;
  readonly rimPower: number;
  readonly specular: number;
  readonly scan: string;
  /** Strength of the horizontal contour lines (the hologram look), 0 to 1. */
  readonly contour: number;
  /** Contour lines per body unit. */
  readonly contourDensity: number;
  /** Additive light (dark grounds): the skin glows instead of veiling what is behind it. */
  readonly additive: boolean;
}

export interface Shell {
  readonly material: THREE.ShaderMaterial;
  /** Height of the scanner band, in the body's own units. */
  readonly scanY: THREE.IUniform<number>;
  readonly opacity: THREE.IUniform<number>;
}

export function createShellMaterial(look: ShellLook): Shell {
  const scanY: THREE.IUniform<number> = { value: -10 };
  const opacity: THREE.IUniform<number> = { value: 1 };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(look.base) },
      uBaseAlpha: { value: look.baseAlpha },
      uRim: { value: new THREE.Color(look.rim) },
      uRimAlpha: { value: look.rimAlpha },
      uRimPower: { value: look.rimPower },
      uSpecular: { value: look.specular },
      uLight: { value: new THREE.Vector3(0.45, 0.8, 0.6).normalize() },
      uScanY: scanY,
      uScanColor: { value: new THREE.Color(look.scan) },
      uScanWidth: { value: 0.05 },
      uContour: { value: look.contour },
      uContourDensity: { value: look.contourDensity },
      uOpacity: opacity,
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vPositionW;
      varying float vLocalY;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vPositionW = world.xyz;
        vLocalY = position.y;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        // Same matrix chain as three's built-in materials, so the depth prepass matches exactly.
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform float uBaseAlpha;
      uniform vec3 uRim;
      uniform float uRimAlpha;
      uniform float uRimPower;
      uniform float uSpecular;
      uniform vec3 uLight;
      uniform float uScanY;
      uniform vec3 uScanColor;
      uniform float uScanWidth;
      uniform float uContour;
      uniform float uContourDensity;
      uniform float uOpacity;
      varying vec3 vNormalW;
      varying vec3 vPositionW;
      varying float vLocalY;

      void main() {
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(cameraPosition - vPositionW);
        float facing = clamp(dot(n, v), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, uRimPower);
        // Soft diffuse term so the volume reads, then the rim takes over at the silhouette.
        float diffuse = clamp(dot(n, uLight) * 0.5 + 0.5, 0.0, 1.0);
        vec3 color = mix(uBase * mix(0.78, 1.0, diffuse), uRim, fresnel);
        float alpha = mix(uBaseAlpha, uRimAlpha, fresnel);

        // Glossy highlight of the key light.
        vec3 halfway = normalize(uLight + v);
        float spec = pow(clamp(dot(n, halfway), 0.0, 1.0), 70.0) * uSpecular;
        color += vec3(spec);
        alpha = max(alpha, spec);

        // Horizontal contour lines, anti-aliased with the screen-space derivative.
        float rows = vLocalY * uContourDensity;
        float distanceToLine = abs(fract(rows - 0.5) - 0.5);
        float line = (1.0 - smoothstep(0.0, fwidth(rows) * 1.3, distanceToLine)) * uContour;
        // Lines brighten toward the silhouette, where a hologram's slices read best.
        line *= 0.55 + 0.45 * fresnel;
        color = mix(color, uRim, line);
        alpha = max(alpha, line);

        // The scanner band.
        float band = 1.0 - smoothstep(0.0, uScanWidth, abs(vLocalY - uScanY));
        color = mix(color, uScanColor, band * 0.9);
        alpha = max(alpha, band * 0.85);

        gl_FragColor = vec4(color, alpha * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: look.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  return { material, scanY, opacity };
}
