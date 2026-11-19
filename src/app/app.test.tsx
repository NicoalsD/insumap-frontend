import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TOTP_CODE, DOCTOR_ACCOUNT, PATIENT_ACCOUNT } from '@/mocks/fixtures/people';
import { es } from '@/i18n/es';
import { expectNoAxeViolations } from '@/test/axe';
import { renderApp } from '@/test/renderApp';

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Signs in through the real login page; the doctor goes through the MFA step. */
async function signIn(path: string, account: { email: string; password: string }, mfa = false) {
  const view = renderApp('/login');
  await userEvent.type(await screen.findByLabelText(es.access.login.email), account.email);
  await userEvent.type(screen.getByLabelText(es.access.login.password), account.password);
  await userEvent.click(screen.getByRole('button', { name: es.access.login.submit }));
  if (mfa) await userEvent.type(await screen.findByLabelText(es.access.mfa.code), DEMO_TOTP_CODE);
  await waitFor(() => {
    expect(view.router.state.location.pathname).not.toBe('/login');
  });
  if (path !== view.router.state.location.pathname) await view.router.navigate(path);
  return view;
}

describe('app shell, guards and access', () => {
  it('sends an anonymous visitor from a guarded route to the landing', async () => {
    const { router } = renderApp('/doctor/triage');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('shows the login page with no role shortcuts and no simulated-data notice', async () => {
    const { container } = renderApp('/login');
    expect(await screen.findByRole('heading', { level: 1, name: es.access.login.title })).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /Entrar como/ })).toHaveLength(0);
    expect(screen.queryByText(/simulad/i)).toBeNull();
    expect(screen.getByText(es.notices.medicalDisclaimer)).toBeVisible();
    await expectNoAxeViolations(container);
  });

  it('keeps a patient in the patient zone and answers the doctor zone with the no-access screen', async () => {
    const { router } = await signIn('/patient', PATIENT_ACCOUNT);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/patient');
    });
    await router.navigate('/doctor/triage');
    expect(await screen.findByRole('heading', { name: es.states.forbiddenTitle })).toBeInTheDocument();
  });

  it('restores a doctor session from the refresh cookie after a reload', async () => {
    const first = await signIn('/doctor/triage', DOCTOR_ACCOUNT, true);
    await waitFor(() => {
      expect(first.router.state.location.pathname).toBe('/doctor/triage');
    });
    first.unmount();
    const second = renderApp('/doctor/alerts');
    // Only the refresh cookie can put a token back in memory after a reload.
    await waitFor(() => {
      expect(second.client.tokens.get()).not.toBeNull();
    });
    expect(second.router.state.location.pathname).toBe('/doctor/alerts');
  });

  it('answers unknown addresses with the not-found screen', async () => {
    renderApp('/no-existe');
    expect(await screen.findByRole('heading', { name: es.states.notFoundTitle })).toBeInTheDocument();
  });
});
