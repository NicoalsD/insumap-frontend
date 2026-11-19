import { configure, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { es } from '@/i18n/es';
import { DEMO_TOTP_CODE, DOCTOR_ACCOUNT } from '@/mocks/fixtures/people';
import { expectNoAxeViolations } from '@/test/axe';
import { renderApp } from '@/test/renderApp';

const WAIT_MS = 4000;
configure({ asyncUtilTimeout: WAIT_MS });

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function signInAndOpenAlerts() {
  const view = renderApp('/login');
  await userEvent.type(await screen.findByLabelText(es.access.login.email), DOCTOR_ACCOUNT.email);
  await userEvent.type(screen.getByLabelText(es.access.login.password), DOCTOR_ACCOUNT.password);
  await userEvent.click(screen.getByRole('button', { name: es.access.login.submit }));
  await userEvent.type(await screen.findByLabelText(es.access.mfa.code), DEMO_TOTP_CODE);
  // The panel greets the doctor once its queue and 3D map are ready; under a loaded run that takes a while.
  await screen.findByRole('heading', { level: 1, name: /^Buen(os|as) (días|tardes|noches),/ }, { timeout: 4000 });
  await view.router.navigate('/doctor/alerts');
  return view;
}

describe('alerts page', () => {
  it('lists the alerts of assigned patients with their patient links and passes axe', async () => {
    const { container } = await signInAndOpenAlerts();
    expect(await screen.findByRole('heading', { level: 1, name: es.nav.alerts })).toBeInTheDocument();
    const table = await screen.findByRole('region', { name: es.doctor.alerts.caption });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    expect(within(rows[0] as HTMLElement).getByRole('link')).toHaveAttribute('href', expect.stringMatching(/^\/doctor\/patients\//));
    await expectNoAxeViolations(container);
  });

  it('filters by status through the API and shows the empty message when none match', async () => {
    await signInAndOpenAlerts();
    await screen.findByRole('region', { name: es.doctor.alerts.caption });
    const status = screen.getByRole('combobox', { name: es.doctor.alerts.filterStatus });
    await userEvent.selectOptions(status, es.doctor.alertStatus.RESOLVED);
    expect(await screen.findByRole('heading', { name: es.doctor.alerts.empty })).toBeInTheDocument();
  });

  it('acknowledges an alert from its row', async () => {
    await signInAndOpenAlerts();
    const table = await screen.findByRole('region', { name: es.doctor.alerts.caption });
    const [acknowledge] = within(table).getAllByRole('button', { name: es.doctor.rail.acknowledge });
    await userEvent.click(acknowledge as HTMLElement);
    expect(await screen.findByText(es.doctor.rail.acknowledged, undefined, { timeout: WAIT_MS })).toBeInTheDocument();
  });
});
