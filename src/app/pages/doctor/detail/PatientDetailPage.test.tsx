import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { apiError } from '@/mocks/http';
import { wireTimelineDose } from '@/mocks/wire';
import { server } from '@/mocks/server';
import { DEMO_TOTP_CODE, DOCTOR_ACCOUNT } from '@/mocks/fixtures/people';
import { patientId } from '@/mocks/fixtures/ids';
import { RECENT_DOSES_SHOWN } from './model/injectionHistory';
import { TIMELINE_PAGE_SIZE } from './constants';

const HOUR_MS = 3_600_000;
import { apiUrl } from '@/services/http/apiUrl';
import { expectNoAxeViolations } from '@/test/axe';
import { renderApp } from '@/test/renderApp';

/** Camila: critical, one pending suggestion, two open alerts and a repeated night hypoglycemia. */
const PATIENT = patientId(1);
const PATIENT_NAME = 'Camila Restrepo Ossa';
const LONG_REASON = 'Revisión clínica con la paciente: se ajusta la dosis según la tendencia nocturna.';
const TEST_TIMEOUT_MS = 20000;
/** The 3D chunk loads on first use; its fallback can take longer than the default wait. */
const LAZY_TIMEOUT_MS = 5000;

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
  // jsdom has no WebGL: the surface falls back to its textual alternative in every test.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Signs in as the example doctor through the real login and MFA steps, then opens the record. */
async function openRecord(id: string = PATIENT, path?: string) {
  const view = renderApp('/login');
  await userEvent.type(await screen.findByLabelText(es.access.login.email), DOCTOR_ACCOUNT.email);
  await userEvent.type(screen.getByLabelText(es.access.login.password), DOCTOR_ACCOUNT.password);
  await userEvent.click(screen.getByRole('button', { name: es.access.login.submit }));
  await userEvent.type(await screen.findByLabelText(es.access.mfa.code), DEMO_TOTP_CODE);
  await screen.findByRole('heading', { level: 1, name: /^Buen(os|as) (días|tardes|noches),/ });
  await view.router.navigate(path ?? `/doctor/patients/${id}`);
  return view;
}

describe('patient detail (P19 AGP, P06 adapters, P08 layout, P15 window in URL)', () => {
  it(
    'renders the header, metrics, AGP, surface, patterns, rail and passes axe',
    async () => {
      const { container } = await openRecord();
      expect(await screen.findByRole('heading', { level: 1, name: PATIENT_NAME })).toBeInTheDocument();
      expect(screen.getByText(format(es.detail.header.profile, { profile: 'Adulto estándar' }))).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: es.detail.metrics.title })).toBeInTheDocument();
      expect(screen.getByRole('slider', { name: es.detail.agp.cursorLabel })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: es.detail.surface.title })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: es.detail.patterns.title })).toBeInTheDocument();
      expect(screen.getAllByText(es.notices.aiSuggestion).length).toBeGreaterThan(0);
      expect(screen.getByRole('heading', { level: 2, name: es.detail.alerts.title })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: es.detail.notes.title })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: es.detail.messages.title })).toBeInTheDocument();
      await expectNoAxeViolations(container);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'shows the nocturnal hypoglycemia pattern with the profile cut point and the day count',
    async () => {
      await openRecord();
      expect(await screen.findByText(/Hipoglucemia nocturna repetida/)).toBeInTheDocument();
      expect(screen.getByText(/bajo 70 mg\/dL/)).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'shows the injection sites from her recorded doses, with the last doses and no suggested dose',
    async () => {
      const { container } = await openRecord();
      expect(await screen.findByRole('heading', { level: 2, name: es.detail.injection.title })).toBeInTheDocument();
      await waitFor(() => {
        expect(container.querySelectorAll('.injection-panel__recent li').length).toBeGreaterThan(0);
      });
      expect(container.querySelectorAll('.injection-panel__recent li').length).toBeLessThanOrEqual(RECENT_DOSES_SHOWN);
      const panel = container.querySelector('.injection-panel');
      expect(panel).not.toBeNull();
      expect(within(panel as HTMLElement).queryByText(/sugerid/i)).toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'shows the review aid when one site holds more than 40 % of her recent doses',
    async () => {
      const now = Date.now();
      const dose = (n: number, site: string) => ({
        id: `e5000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
        insulin_product_id: null,
        kind: 'BOLUS',
        units: 6,
        administered_at: new Date(now - n * HOUR_MS).toISOString(),
        treatment_plan_id: null,
        injection_site: site,
        injection_spot: 1,
        simulated: false,
      });
      const items = [
        ...Array.from({ length: 6 }, (_, i) => dose(i + 1, 'ABDOMEN_LEFT')),
        dose(20, 'THIGH_RIGHT'),
      ];
      server.use(
        http.get(apiUrl('/patients/:patient_id/timeline'), () =>
          HttpResponse.json({ items: items.map(wireTimelineDose), next_cursor: null, simulated: false }),
        ),
      );
      await openRecord();
      expect(await screen.findByText(es.detail.injection.concentrationTitle)).toBeInTheDocument();
      expect(screen.getByRole('note')).toHaveTextContent('Abdomen, lado izquierdo');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'says once that there is no previous window, and paints no delta',
    async () => {
      const { container } = await openRecord();
      await screen.findByRole('heading', { level: 2, name: es.detail.metrics.title });
      expect(screen.getAllByText(es.detail.metrics.deltaUnavailable)).toHaveLength(1);
      expect(container.querySelectorAll('.metrics-row__delta')).toHaveLength(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'shows twelve timeline entries first, and "Ver más" adds the next ones',
    async () => {
      await openRecord();
      await screen.findByRole('heading', { level: 2, name: es.detail.timeline.title });
      const items = () => document.querySelectorAll('.timeline__item').length;
      // The readings arrive page by page; the list fills when the last one lands.
      await waitFor(() => { expect(items()).toBe(TIMELINE_PAGE_SIZE); });
      await userEvent.click(await screen.findByRole('button', { name: es.detail.timeline.showMore }));
      await waitFor(() => { expect(items()).toBe(TIMELINE_PAGE_SIZE * 2); });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'changes the window from the selector and keeps it in the URL',
    async () => {
      const view = await openRecord();
      const sevenDays = await screen.findByRole('radio', { name: format(es.detail.header.windowOption, { days: 7 }) });
      await userEvent.click(sevenDays);
      expect(sevenDays).toBeChecked();
      await waitFor(() => {
        expect(view.router.state.location.search).toContain('window=7d');
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'moves the AGP cursor with the arrow keys and writes the values as text',
    async () => {
      await openRecord();
      const slider = await screen.findByRole('slider', { name: es.detail.agp.cursorLabel });
      slider.focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(slider).toHaveAttribute('aria-valuenow', '1');
      expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('mediana'));
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'falls back to the textual surface when WebGL is unavailable, and keeps the table',
    async () => {
      await openRecord();
      expect(await screen.findByText(es.detail.surface.fallback, undefined, { timeout: LAZY_TIMEOUT_MS })).toBeInTheDocument();
      expect(screen.getByText(es.detail.surface.tableToggle)).toBeInTheDocument();
      expect(screen.getByRole('slider', { name: es.detail.surface.dayControl })).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'approves a suggestion and shows its decided status',
    async () => {
      await openRecord();
      await userEvent.click(await screen.findByRole('button', { name: es.detail.ai.approve }));
      expect(await screen.findByText(es.detail.ai.decided)).toBeInTheDocument();
      expect(await screen.findByText(es.detail.ai.status.APPROVED)).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'requires a reason to reject, then rejects with it',
    async () => {
      await openRecord();
      await userEvent.click(await screen.findByRole('button', { name: es.detail.ai.reject }));
      const reason = screen.getByLabelText(es.detail.ai.reason);
      await userEvent.click(screen.getByRole('button', { name: es.detail.ai.confirmReject }));
      expect(reason).toHaveAttribute('aria-invalid', 'true');
      await userEvent.type(reason, LONG_REASON);
      await userEvent.click(screen.getByRole('button', { name: es.detail.ai.confirmReject }));
      expect(await screen.findByText(es.detail.ai.status.REJECTED)).toBeInTheDocument();
      expect(await screen.findByText(format(es.detail.ai.decisionReason, { reason: LONG_REASON }))).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'modifies the dose with a new value and a required reason',
    async () => {
      await openRecord();
      await userEvent.click(await screen.findByRole('button', { name: es.detail.ai.modify }));
      const dose = screen.getByLabelText(es.detail.ai.newDose);
      await userEvent.clear(dose);
      await userEvent.type(dose, '0');
      await userEvent.click(screen.getByRole('button', { name: es.detail.ai.confirmModify }));
      expect(dose).toHaveAttribute('aria-invalid', 'true');
      await userEvent.clear(dose);
      await userEvent.type(dose, '17');
      await userEvent.click(screen.getByRole('button', { name: es.detail.ai.confirmModify }));
      expect(screen.getByLabelText(es.detail.ai.reason)).toHaveAttribute('aria-invalid', 'true');
      await userEvent.type(screen.getByLabelText(es.detail.ai.reason), LONG_REASON);
      await userEvent.click(screen.getByRole('button', { name: es.detail.ai.confirmModify }));
      expect(await screen.findByText(es.detail.ai.status.APPROVED_WITH_CHANGES)).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'acknowledges an open alert',
    async () => {
      await openRecord();
      const [acknowledge] = await screen.findAllByRole('button', { name: es.detail.alerts.acknowledge });
      await userEvent.click(acknowledge as HTMLElement);
      expect(await screen.findByText(es.detail.alerts.acknowledged)).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'saves a clinical note and sends a message',
    async () => {
      await openRecord();
      const note = await screen.findByLabelText(es.detail.notes.label);
      await userEvent.type(note, 'Revisada la curva nocturna.');
      await userEvent.click(screen.getByRole('button', { name: es.detail.notes.submit }));
      expect(await screen.findByText(es.detail.notes.saved)).toBeInTheDocument();
      expect(await screen.findByText('Revisada la curva nocturna.')).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(es.detail.messages.label), 'Llame si tiene síntomas.');
      await userEvent.click(screen.getByRole('button', { name: es.detail.messages.submit }));
      expect(await screen.findByText(es.detail.messages.sent)).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'shows the empty surface state when the window has no readings',
    async () => {
      server.use(
        http.get(apiUrl('/patients/:patient_id/readings'), () => HttpResponse.json({ items: [], next_cursor: null })),
      );
      await openRecord();
      expect(await screen.findByText(es.detail.surface.empty)).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'shows an error with retry when the record cannot be loaded',
    async () => {
      server.use(
        http.get(apiUrl('/patients/:patient_id/overview'), () => apiError('NOT_FOUND')),
      );
      await openRecord();
      const alert = await screen.findByRole('alert');
      expect(within(alert).getByRole('heading', { name: es.detail.errorTitle })).toBeInTheDocument();
      expect(within(alert).getByRole('button', { name: es.states.retry })).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS,
  );
});
