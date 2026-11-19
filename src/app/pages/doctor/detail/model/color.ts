const HEX_RADIX = 16;
const CHANNEL_MAX = 255;
/** Digits per channel in `#rrggbb`. */
const DIGITS_PER_CHANNEL = 2;
const SHORT_HEX_LENGTH = 3;
const CHANNEL_COUNT = 3;
const LAST_CHANNEL = CHANNEL_COUNT - 1;
const LONG_HEX_LENGTH = DIGITS_PER_CHANNEL * CHANNEL_COUNT;

export type Rgb = readonly [number, number, number];

/**
 * `#rgb` or `#rrggbb` to RGB in 0 to 1. A value that is not a hex color (a token the browser did
 * not resolve) gives `fallback`, so the surface still draws in a neutral color.
 *
 * Pattern: none (plain function; tested in color.test.ts).
 */
export function parseHexColor(value: string, fallback: Rgb): Rgb {
  const raw = value.trim().replace(/^#/, '');
  const digits =
    raw.length === SHORT_HEX_LENGTH
      ? raw
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : raw;
  if (digits.length !== LONG_HEX_LENGTH || !/^[0-9a-f]+$/i.test(digits)) return fallback;
  const channel = (index: number) =>
    Number.parseInt(digits.slice(index * DIGITS_PER_CHANNEL, (index + 1) * DIGITS_PER_CHANNEL), HEX_RADIX) /
    CHANNEL_MAX;
  return [channel(0), channel(1), channel(LAST_CHANNEL)];
}
