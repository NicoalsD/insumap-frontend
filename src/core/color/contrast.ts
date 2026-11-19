/** WCAG 2.2 relative luminance and contrast ratio for hex colors. No React, no DOM. */

const HEX_SHORT_LENGTH = 3;
const HEX_LONG_LENGTH = 6;
const HEX_RADIX = 16;
const HEX_CHANNEL_WIDTH = 2;
const RED_OFFSET = 0;
const GREEN_OFFSET = 2;
const BLUE_OFFSET = 4;
const CHANNEL_MAX = 255;
const SRGB_LINEAR_THRESHOLD = 0.04045;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA_DIVISOR = 1.055;
const SRGB_GAMMA = 2.4;
const LUMA_RED = 0.2126;
const LUMA_GREEN = 0.7152;
const LUMA_BLUE = 0.0722;
const CONTRAST_FLARE = 0.05;

/** WCAG AA minimum for normal text. */
export const CONTRAST_AA_TEXT = 4.5;
/** WCAG AA minimum for large text and non-text graphics (1.4.11). */
export const CONTRAST_AA_NON_TEXT = 3;

/** Parses `#rgb` or `#rrggbb` into 0-255 channels. Throws on anything else. */
export function parseHex(hex: string): [number, number, number] {
  const raw = hex.trim().replace(/^#/, '');
  const full =
    raw.length === HEX_SHORT_LENGTH
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (full.length !== HEX_LONG_LENGTH || !/^[0-9a-f]+$/i.test(full)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const channel = (offset: number) => parseInt(full.slice(offset, offset + HEX_CHANNEL_WIDTH), HEX_RADIX);
  return [channel(RED_OFFSET), channel(GREEN_OFFSET), channel(BLUE_OFFSET)];
}

function linearize(channel: number): number {
  const c = channel / CHANNEL_MAX;
  return c <= SRGB_LINEAR_THRESHOLD
    ? c / SRGB_LINEAR_DIVISOR
    : ((c + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_DIVISOR) ** SRGB_GAMMA;
}

/** Relative luminance per WCAG 2.2. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return LUMA_RED * linearize(r) + LUMA_GREEN * linearize(g) + LUMA_BLUE * linearize(b);
}

/** Contrast ratio between two hex colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + CONTRAST_FLARE) / (lo + CONTRAST_FLARE);
}
