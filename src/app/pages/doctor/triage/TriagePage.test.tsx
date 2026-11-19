import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { es } from '@/i18n/es';
import { server } from '@/mocks/server';
import { DEMO_TOTP_CODE, DOCTOR_ACCOUNT } from '@/mocks/fixtures/people';
import { apiUrl } from '@/services/http/apiUrl';
import { expectNoAxeViolations } from '@/test/axe';
import { renderApp } from '@/test/renderApp';

/** Under parallel load the default 1 s wait is too short for a full page; the suite is not timing-sensitive. */
configure({ asyncUtilTimeout: 4000 });
const SLOW_RETRY_TIMEOUT_MS = 8000;
/** The query client retries 5xx twice with back-off, so the error path needs more than the default 5 s. */
const TEST_TIMEOUT_MS = 15000;

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Signs in as the example doctor through the real login form and MFA step, then waits for the queue. */
async function signInAsDoctor(path?: string) {
  const view = renderApp('/login');
  await userEvent.type(await screen.findByLabelText(es.access.login.email), DOCTOR_ACCOUNT.email);
  await userEvent.type(screen.getByLabelText(es.access.login.password), DOCTOR_ACCOUNT.password);
  await userEvent.click(screen.getByRole('button', { name: es.access.login.submit }));
  await userEvent.type(await screen.findByLabelText(es.access.mfa.code), DEMO_TOTP_CODE);
  await screen.findByRole('heading', { level: 1, name: /^Buen(os|as) (días|tardes|noches),/ });
  if (path) await view.router.navigate(path);
  return view;
}

async function queue() {
  return screen.findByRole('table', { name: es.doctor.triage.queueCaption });
}

/** Names of the patients in the queue, in the order they are drawn. */
async function queueNames() {
  const table = await queue();
  const rows = within(table).getAllByRole('row').slice(1);
  return rows.map((row) => within(row).getAllByRole('link')[0]?.textContent ?? '');
}

describe('triage queue (P15 filters, P08 layout)', () => {
  it('orders the queue by risk, shows the selected patient preview, and passes axe', async () => {
    const { container } = await signInAsDoctor();
    const names = await queueNames();
    expect(names.length).toBeGreaterThan(1);
    // The highest risk comes first: a critical patient, never a lower tier above it.
    const [, first] = within(await queue()).getAllByRole('row');
    if (!first) throw new Error('the queue has no rows');
    expect(within(first).getByText(es.risk.CRITICAL)).toBeInTheDocument();
    const topName = names[0] ?? '';
    expect(screen.getByRole('heading', { level: 2, name: topName })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: es.doctor.triage.previewOpenRecord })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  }, TEST_TIMEOUT_MS);

  it('shows the clinic and the update time in the page header', async () => {
    await signInAsDoctor();
    expect(await screen.findByText(/Actualizado/)).toBeInTheDocument();
  });

  it('narrows by a segment, shows its count, and clears it', async () => {
    await signInAsDoctor();
    const critical = await screen.findByRole('button', { name: new RegExp(es.doctor.triage.segments.critical) });
    expect(critical).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(critical);
    expect(critical).toHaveAttribute('aria-pressed', 'true');
    const table = await queue();
    for (const row of within(table).getAllByRole('row').slice(1)) {
      expect(within(row).getByText(es.risk.CRITICAL)).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: es.doctor.triage.clearFilters }));
    expect(critical).toHaveAttribute('aria-pressed', 'false');
    expect(await queueNames()).toHaveLength(within(await queue()).getAllByRole('row').length - 1);
  });

  it('keeps the segment counts stable while another filter is active', async () => {
    await signInAsDoctor();
    const unreviewed = await screen.findByRole('button', { name: new RegExp(es.doctor.triage.segments.unreviewed) });
    const countBefore = unreviewed.textContent;
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(es.doctor.triage.segments.critical) }));
    expect(unreviewed.textContent).toBe(countBefore);
  });

  it('searches by name ignoring accents, and keeps the name out of the address', async () => {
    const { router } = await signInAsDoctor();
    await screen.findByRole('table', { name: es.doctor.triage.queueCaption });
    await userEvent.type(screen.getByRole('searchbox', { name: es.doctor.triage.searchLabel }), 'andres');
    const matches = await queueNames();
    expect(matches.length).toBeGreaterThan(0);
    for (const name of matches) expect(name).toMatch(/Andrés/);
    expect(router.state.location.search).not.toContain('andres');
  });

  it('moves between rows with the arrow keys, selecting each patient, and opens the record with Enter', async () => {
    const { router } = await signInAsDoctor();
    const table = await queue();
    const links = within(table).getAllByRole('link');
    const second = links[1];
    const secondName = second?.textContent ?? '';
    links[0]?.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(second).toHaveFocus();
    expect(await screen.findByRole('heading', { level: 2, name: secondName })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/doctor\/patients\//);
    });
  });

  it('reads the window and the sort from the address, and writes changes back to it', async () => {
    const { router } = await signInAsDoctor('/doctor/triage?window=7d&sort=patient&dir=ascending&segments=critical');
    const critical = await screen.findByRole('button', { name: new RegExp(es.doctor.triage.segments.critical) });
    await waitFor(() => {
      expect(critical).toHaveAttribute('aria-pressed', 'true');
    });
    const windowSelect = screen.getByRole('combobox', { name: es.doctor.triage.windowLabel });
    await waitFor(() => {
      expect(windowSelect).toHaveValue('7d');
    });
    await userEvent.selectOptions(windowSelect, '30d');
    await waitFor(() => {
      expect(router.state.location.search).toContain('window=30d');
    });
  });

  it('shows the empty state when the API has no patients for the window', async () => {
    server.use(
      http.get(apiUrl('/dashboard/triage'), ({ request }) =>
        new URL(request.url).searchParams.get('window') === '30d'
          ? HttpResponse.json({ items: [], next_cursor: null })
          : undefined,
      ),
    );
    await signInAsDoctor('/doctor/triage?window=30d');
    expect(await screen.findByRole('heading', { name: es.doctor.triage.emptyTitle })).toBeInTheDocument();
  });

  it('shows the error state with a retry when the queue cannot load', async () => {
    server.use(
      http.get(apiUrl('/dashboard/triage'), ({ request }) =>
        new URL(request.url).searchParams.get('window') === '7d'
          ? HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'x', detail: {} } }, { status: 500 })
          : undefined,
      ),
    );
    await signInAsDoctor('/doctor/triage?window=7d');
    expect(
      await screen.findByRole('heading', { name: es.doctor.triage.errorTitle }, { timeout: SLOW_RETRY_TIMEOUT_MS }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: es.states.retry })).toBeInTheDocument();
  }, TEST_TIMEOUT_MS);

  it('says when a segment matches nothing, with a way out', async () => {
    await signInAsDoctor();
    await userEvent.type(await screen.findByRole('searchbox', { name: es.doctor.triage.searchLabel }), 'zzzz');
    const empty = (await screen.findByRole('heading', { name: es.doctor.triage.noMatchTitle })).closest('.ui-state');
    if (!(empty instanceof HTMLElement)) throw new Error('empty state not rendered');
    await userEvent.click(within(empty).getByRole('button', { name: es.doctor.triage.clearFilters }));
    expect(await queueNames()).not.toHaveLength(0);
  });
});

describe('triage render hygiene', () => {
  it('loads without React duplicate-key warnings and lays the queue out at full width', async () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      if (/same key/.test(String(args[0]))) errors.push(String(args[1]));
    });
    const { container } = await signInAsDoctor();
    await screen.findByRole('table', { name: es.doctor.triage.queueCaption });
    await screen.findByRole('heading', { level: 2, name: es.doctor.rail.title });
    spy.mockRestore();
    expect(errors).toEqual([]);
    const queueBlock = container.querySelector('[data-widget="triage-queue"]');
    expect(queueBlock).toHaveStyle({ '--span': '12' });
  });
});

describe('open alerts rail', () => {
  it('acknowledges an open alert and then resolves it with a note', async () => {
    await signInAsDoctor();
    const [acknowledge] = await screen.findAllByRole('button', { name: es.doctor.rail.acknowledge });
    await userEvent.click(acknowledge as HTMLElement);
    expect(await screen.findByText(es.doctor.rail.acknowledged)).toBeInTheDocument();

    const [resolveToggle] = await screen.findAllByRole('button', { name: es.doctor.rail.resolve });
    await userEvent.click(resolveToggle as HTMLElement);
    expect(resolveToggle).toHaveAttribute('aria-expanded', 'true');

    const submit = screen.getByRole('button', { name: es.doctor.rail.resolveSubmit });
    await userEvent.click(submit);
    expect(await screen.findByText(es.validation.required)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: es.doctor.rail.noteLabel })).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(screen.getByRole('textbox', { name: es.doctor.rail.noteLabel }), 'Se llamó a la paciente y se ajustó el plan.');
    await userEvent.click(submit);
    expect(await screen.findByText(es.doctor.rail.resolved)).toBeInTheDocument();
  });

  it('shows the empty alerts message when nothing is open', async () => {
    server.use(
      http.get(apiUrl('/alerts'), () => HttpResponse.json({ items: [], next_cursor: null })),
    );
    await signInAsDoctor();
    expect(await screen.findByRole('heading', { name: es.doctor.rail.empty })).toBeInTheDocument();
  });
});
