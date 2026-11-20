import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { es } from '@/i18n/es';
import { server } from '@/mocks/server';
import { expectNoAxeViolations } from '@/test/axe';
import { signInAsPatient } from '../../patientTestUtils';

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
});
afterEach(() => {
  vi.unstubAllEnvs();
  server.events.removeAllListeners();
});

/** Captures every request body the app sends to one path, in order. */
function captureBodies(path: string): unknown[] {
  const bodies: unknown[] = [];
  server.events.on('request:start', async ({ request }) => {
    if (new URL(request.url).pathname.endsWith(path) && request.method === 'POST') {
      bodies.push(await request.clone().json());
    }
  });
  return bodies;
}

/** Captures the `kind` query of every injection-sites request. */
function captureKinds(): string[] {
  const kinds: string[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/patients/own/injection-sites')) kinds.push(url.searchParams.get('kind') ?? '');
  });
  return kinds;
}

/** The insulin wizard's section, so its radios are not confused with the home layer's. */
function recorderOf(): HTMLElement {
  const heading = screen.getByRole('heading', { name: es.patient.injection.record.title });
  const section = heading.closest('section');
  if (!section) throw new Error('insulin recorder not rendered');
  return section;
}

describe('home: where to inject', () => {
  it('shows today\'s site in plain words for the chosen kind, and asks for that kind on switch', async () => {
    const kinds = captureKinds();
    const { container } = await signInAsPatient();
    const today = await screen.findByText(/^Hoy: .+, punto \d$/);
    expect(today.textContent).toMatch(/punto [1-4]$/);
    expect(kinds).toContain('BOLUS');

    await userEvent.click(screen.getByRole('radio', { name: es.patient.injection.kinds.BASAL }));
    await waitFor(() => {
      expect(kinds).toContain('BASAL');
    });
    expect(await screen.findByText(/^Hoy: .+, punto \d$/)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('changes the site when the patient picks another allowed one on the body', async () => {
    await signInAsPatient();
    const before = (await screen.findByText(/^Hoy: .+, punto \d$/)).textContent;
    // The body in the middle of the home is the control; its native list is the keyboard path.
    const stage = screen.getByRole('region', { name: es.patient.injection.stageLabel });
    const options = within(stage)
      .getAllByRole('radio')
      .filter((radio) => radio.getAttribute('name')?.includes('site') && !(radio as HTMLInputElement).disabled);
    const other = options.find((radio) => !(radio as HTMLInputElement).checked);
    if (!other) throw new Error('expected another selectable site');
    await userEvent.click(other);
    await waitFor(() => {
      expect(screen.getByText(/^Hoy: .+, punto \d$/).textContent).not.toBe(before);
    });
    expect(screen.getByText(es.patient.injection.chooseOther)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: es.patient.injection.backToSuggestion }));
    expect(screen.getByText(/^Hoy: .+, punto \d$/).textContent).toBe(before);
  });
});

describe('insulin dose registration', () => {
  it('registers a dose with the site and spot on the map, then shows the rotated next suggestion', async () => {
    const bodies = captureBodies('/insulin-doses');
    await signInAsPatient();
    await userEvent.click(await screen.findByRole('button', { name: es.patient.injection.record.open }));
    const recorder = recorderOf();
    await userEvent.click(within(recorder).getByRole('radio', { name: es.patient.injection.kinds.BOLUS }));
    await userEvent.click(within(recorder).getByRole('button', { name: es.patient.injection.record.next }));
    await userEvent.type(within(recorder).getByLabelText(es.patient.injection.record.units.label), '2');
    await userEvent.click(within(recorder).getByRole('button', { name: es.patient.injection.record.next }));
    expect(await within(recorder).findByText(es.patient.injection.record.site.suggested)).toBeInTheDocument();
    await userEvent.click(within(recorder).getByRole('button', { name: es.patient.injection.record.save }));

    expect(await screen.findByText(/^Guardado en .+, punto \d\.$/)).toBeInTheDocument();
    const next = await screen.findByText(/^Siguiente sugerencia: .+, punto \d\.$/);
    expect(next).toBeInTheDocument();
    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({ kind: 'BOLUS', units: 2 });
    expect(bodies[0]).toHaveProperty('injection_site');
    expect(bodies[0]).toHaveProperty('injection_spot');
  });

  it('refuses units that are not a positive number and never fills them in for the patient', async () => {
    await signInAsPatient();
    await userEvent.click(await screen.findByRole('button', { name: es.patient.injection.record.open }));
    const recorder = recorderOf();
    await userEvent.click(within(recorder).getByRole('radio', { name: es.patient.injection.kinds.BASAL }));
    await userEvent.click(within(recorder).getByRole('button', { name: es.patient.injection.record.next }));
    expect(within(recorder).getByLabelText(es.patient.injection.record.units.label)).toHaveValue('');
    await userEvent.type(within(recorder).getByLabelText(es.patient.injection.record.units.label), 'abc');
    await userEvent.click(within(recorder).getByRole('button', { name: es.patient.injection.record.next }));
    expect(await screen.findByText(es.patient.injection.record.units.invalid)).toBeInTheDocument();
  });
});

describe('plan: where each insulin goes', () => {
  it('lists the allowed sites in text and says any rotation zone when the plan allows all', async () => {
    const { router, container } = await signInAsPatient();
    await router.navigate('/patient/plan');
    expect(await screen.findByText(/Sitios permitidos: .*abdomen izquierdo/)).toBeInTheDocument();
    expect(screen.getAllByText(es.patient.injection.plan.any).length).toBeGreaterThan(0);
    await expectNoAxeViolations(container);
  });
});
