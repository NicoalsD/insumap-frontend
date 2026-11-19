import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Runs axe-core on a rendered container and fails with the violations listed.
 * `color-contrast` is off because jsdom cannot compute layout or styles; contrast is verified on
 * the tokens by `src/styles/tokens.contrast.test.ts`.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
  expect(summary).toEqual([]);
}
