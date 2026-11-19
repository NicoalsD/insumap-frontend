import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTRAST_AA_TEXT, contrastRatio } from '@/core/color/contrast';
import { RANGE_STATES } from '@/core/glucose/thresholds';

/** Token values of the light theme and the dark override, read from the stylesheet (no copy of the palette here). */
const css = readFileSync(resolvePath(process.cwd(), 'src/styles/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function block(marker: RegExp): string {
  const start = css.search(marker);
  const open = css.indexOf('{', start);
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    i += 1;
  }
  return css.slice(open + 1, i - 1);
}

function tokens(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) out[name] = value.trim();
  }
  return out;
}

const light = tokens(block(/^:root\s*\{/m));
const dark = { ...light, ...tokens(block(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not/)) };

function hex(theme: Record<string, string>, name: string): string {
  let value = theme[name];
  for (let hops = 0; value?.startsWith('var(') && hops < 5; hops += 1) {
    value = theme[value.slice('var('.length, -1).trim()];
  }
  if (!value?.startsWith('#')) throw new Error(`${name} is not a hex token (${String(value)})`);
  return value;
}

const slug = (state: string) => state.toLowerCase().replaceAll('_', '-');

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('range band contrast, %s theme', (_name, theme) => {
  it.each(RANGE_STATES.map((state) => [state]))('text on the %s segment reaches AA (4.5:1)', (state) => {
    const fill = hex(theme, `--color-range-${slug(state)}`);
    const on = hex(theme, `--color-range-${slug(state)}-on`);
    expect(contrastRatio(on, fill)).toBeGreaterThanOrEqual(CONTRAST_AA_TEXT);
  });

  it.each(RANGE_STATES.map((state) => [state]))('range text of %s reaches AA on the surface and its subtle tint', (state) => {
    const text = hex(theme, `--color-range-${slug(state)}-text`);
    expect(contrastRatio(text, hex(theme, '--color-surface'))).toBeGreaterThanOrEqual(CONTRAST_AA_TEXT);
    expect(contrastRatio(text, hex(theme, `--color-range-${slug(state)}-subtle`))).toBeGreaterThanOrEqual(CONTRAST_AA_TEXT);
  });
});
