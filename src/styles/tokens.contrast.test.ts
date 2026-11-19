import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTRAST_AA_NON_TEXT, CONTRAST_AA_TEXT, contrastRatio } from '@/core/color/contrast';

type Theme = Record<string, string>;

const css = readFileSync(resolvePath(process.cwd(), 'src/styles/tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

function declarations(block: string): Theme {
  const out: Theme = {};
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) out[name] = value.trim();
  }
  return out;
}

function blockAfter(marker: RegExp): string {
  const start = css.search(marker);
  if (start < 0) throw new Error(`Block not found: ${String(marker)}`);
  const open = css.indexOf('{', css.indexOf(':root', start));
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    i += 1;
  }
  return css.slice(open + 1, i - 1);
}

const light = declarations(blockAfter(/^:root\s*\{/m));
const dark: Theme = { ...light, ...declarations(blockAfter(/@media \(prefers-color-scheme: dark\)/)) };

function resolve(theme: Theme, name: string): string {
  let value = theme[name];
  for (let hops = 0; value?.startsWith('var(') && hops < 5; hops += 1) {
    value = theme[value.slice('var('.length, -1).trim()];
  }
  if (!value?.startsWith('#')) throw new Error(`${name} does not resolve to hex (${value})`);
  return value;
}

const SURFACES = ['--color-canvas', '--color-surface', '--color-surface-sunken', '--color-surface-hover'];
const TEXT_ON_SURFACES = [
  '--color-text',
  '--color-text-muted',
  '--color-text-placeholder',
  '--color-link',
  '--color-primary',
  '--color-success',
  '--color-warning',
  '--color-info',
  '--color-critical-subtle-text',
  '--color-range-very-low-text',
  '--color-range-low-text',
  '--color-range-in-range-text',
  '--color-range-high-text',
  '--color-range-very-high-text',
];
const RANGES = ['very-low', 'low', 'in-range', 'high', 'very-high'];
const TEXT_PAIRS: [string, string][] = [
  ['--color-primary-text', '--color-primary'],
  ['--color-primary-text', '--color-primary-hover'],
  ['--color-primary-subtle-text', '--color-primary-subtle'],
  ['--color-critical-text', '--color-critical'],
  ['--color-critical-subtle-text', '--color-critical-subtle'],
  ['--color-success', '--color-success-subtle'],
  ['--color-warning', '--color-warning-subtle'],
  ['--color-info', '--color-info-subtle'],
  ['--color-simulated-text', '--color-simulated'],
  ['--color-selection-text', '--color-selection'],
  ['--color-shell-text', '--color-shell'],
  ['--color-shell-text-muted', '--color-shell'],
  ['--color-shell-text', '--color-shell-active'],
  ['--color-shell-text', '--color-shell-raised'],
  ...RANGES.flatMap((r): [string, string][] => [
    [`--color-range-${r}-on`, `--color-range-${r}`],
    [`--color-range-${r}-text`, `--color-range-${r}-subtle`],
  ]),
];
const NON_TEXT_ON_SURFACES = [
  '--color-focus',
  '--color-border-strong',
  '--color-scrollbar-thumb',
  ...RANGES.map((r) => `--color-range-${r}`),
];
const NON_TEXT_PAIRS: [string, string][] = [
  ['--color-shell-focus', '--color-shell'],
  ['--color-scrollbar-thumb', '--color-scrollbar-track'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme tokens', (_name, theme) => {
  it.each(SURFACES.flatMap((s) => TEXT_ON_SURFACES.map((t) => [t, s])))(
    'text %s on %s is at least 4.5:1',
    (fg, bg) => {
      expect(contrastRatio(resolve(theme, fg), resolve(theme, bg))).toBeGreaterThanOrEqual(
        CONTRAST_AA_TEXT,
      );
    },
  );

  it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrastRatio(resolve(theme, fg), resolve(theme, bg))).toBeGreaterThanOrEqual(
      CONTRAST_AA_TEXT,
    );
  });

  it.each(SURFACES.flatMap((s) => NON_TEXT_ON_SURFACES.map((t) => [t, s])))(
    'graphic %s on %s is at least 3:1',
    (fg, bg) => {
      expect(contrastRatio(resolve(theme, fg), resolve(theme, bg))).toBeGreaterThanOrEqual(
        CONTRAST_AA_NON_TEXT,
      );
    },
  );

  it.each(NON_TEXT_PAIRS)('graphic %s on %s is at least 3:1', (fg, bg) => {
    expect(contrastRatio(resolve(theme, fg), resolve(theme, bg))).toBeGreaterThanOrEqual(
      CONTRAST_AA_NON_TEXT,
    );
  });

  it('keeps very low and low distinguishable by lightness, not only hue', () => {
    expect(
      contrastRatio(resolve(theme, '--color-range-very-low'), resolve(theme, '--color-range-low')),
    ).toBeGreaterThanOrEqual(1.5);
  });
});
