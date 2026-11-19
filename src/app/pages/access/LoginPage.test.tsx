import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/mocks/http';
import { server } from '@/mocks/server';
import {
  DEMO_RECOVERY_CODE,
  DEMO_TOTP_CODE,
  DOCTOR_ACCOUNT,
  ENROLLMENT_ACCOUNT,
  PATIENT_ACCOUNT,
} from '@/mocks/fixtures/people';
import { es } from '@/i18n/es';
import { apiUrl } from '@/services/http/apiUrl';
import { expectNoAxeViolations } from '@/test/axe';
import { renderApp } from '@/test/renderApp';

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function fillCredentials(email: string, password: string) {
  await userEvent.type(await screen.findByLabelText(es.access.login.email), email);
  await userEvent.type(screen.getByLabelText(es.access.login.password), password);
}

async function submitCredentials(email: string, password: string) {
  await fillCredentials(email, password);
  await userEvent.click(screen.getByRole('button', { name: es.access.login.submit }));
}

describe('login page', () => {
  it('signs in a doctor with MFA and lands on the triage', async () => {
    const { container, router } = renderApp('/login');
    await submitCredentials(DOCTOR_ACCOUNT.email, DOCTOR_ACCOUNT.password);
    expect(await screen.findByRole('heading', { level: 1, name: es.access.mfa.title })).toBeInTheDocument();
    const code = screen.getByLabelText(es.access.mfa.code);
    expect(code).toHaveAttribute('inputmode', 'numeric');
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    await expectNoAxeViolations(container);
    // Six digits submit by themselves: no button press.
    await userEvent.type(code, DEMO_TOTP_CODE);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/doctor/triage');
    });
  });

  it('signs in a patient straight to the patient home', async () => {
    const { router } = renderApp('/login');
    await submitCredentials(PATIENT_ACCOUNT.email, PATIENT_ACCOUNT.password);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/patient');
    });
  });

  it('shows the API message for wrong credentials and keeps the form', async () => {
    renderApp('/login');
    await submitCredentials(PATIENT_ACCOUNT.email, 'contraseña-equivocada');
    expect(await screen.findByRole('alert')).toHaveTextContent(es.apiErrors.INVALID_CREDENTIALS);
    expect(screen.getByLabelText(es.access.login.email)).toHaveValue(PATIENT_ACCOUNT.email);
  });

  it('shows the rate limit message the API sends', async () => {
    server.use(
      http.post(apiUrl('/auth/login'), () => apiError('RATE_LIMITED', { retry_after: 60 })),
    );
    renderApp('/login');
    await submitCredentials(PATIENT_ACCOUNT.email, PATIENT_ACCOUNT.password);
    expect(await screen.findByRole('alert')).toHaveTextContent(es.apiErrors.RATE_LIMITED);
  });

  it('checks the fields before calling the API and focuses the first error', async () => {
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: es.access.login.submit }));
    const email = screen.getByLabelText(es.access.login.email);
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveFocus();
    expect(screen.getAllByText(es.validation.required)).toHaveLength(2);
  });

  it('toggles password visibility without changing the field name or autocomplete', async () => {
    renderApp('/login');
    const password = await screen.findByLabelText(es.access.login.password);
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).toHaveAttribute('name', 'password');
    const toggle = screen.getByRole('button', { name: es.access.login.showPassword });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(password).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('accepts a recovery code when the authenticator is not at hand', async () => {
    const { router } = renderApp('/login');
    await submitCredentials(DOCTOR_ACCOUNT.email, DOCTOR_ACCOUNT.password);
    await userEvent.click(await screen.findByRole('button', { name: es.access.mfa.useRecovery }));
    const code = screen.getByLabelText(es.access.mfa.recoveryCode);
    expect(code).toHaveAttribute('autocomplete', 'off');
    await userEvent.type(code, DEMO_RECOVERY_CODE);
    await userEvent.click(screen.getByRole('button', { name: es.access.mfa.verify }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/doctor/triage');
    });
  });

  it('keeps the challenge on a wrong code and clears the field', async () => {
    renderApp('/login');
    await submitCredentials(DOCTOR_ACCOUNT.email, DOCTOR_ACCOUNT.password);
    const code = await screen.findByLabelText(es.access.mfa.code);
    await userEvent.type(code, '000000');
    expect(await screen.findByText(es.apiErrors.INVALID_CREDENTIALS)).toBeInTheDocument();
    expect(code).toHaveValue('');
    expect(code).toHaveFocus();
  });

  it('goes back to the password step when the challenge expired', async () => {
    server.use(
      http.post(apiUrl('/auth/mfa/verify'), () => apiError('UNAUTHENTICATED')),
    );
    renderApp('/login');
    await submitCredentials(DOCTOR_ACCOUNT.email, DOCTOR_ACCOUNT.password);
    await userEvent.type(await screen.findByLabelText(es.access.mfa.code), DEMO_TOTP_CODE);
    expect(await screen.findByLabelText(es.access.login.password)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(es.auth.sessionExpired);
  });

  it('sends a staff account without MFA to the enrollment page', async () => {
    const { router } = renderApp('/login');
    await submitCredentials(ENROLLMENT_ACCOUNT.email, ENROLLMENT_ACCOUNT.password);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/mfa/enrollment');
    });
  });

  it('honours an internal ?next= path and ignores an external one', async () => {
    const internal = renderApp('/login?next=/doctor/alerts');
    await submitCredentials(DOCTOR_ACCOUNT.email, DOCTOR_ACCOUNT.password);
    await userEvent.type(await screen.findByLabelText(es.access.mfa.code), DEMO_TOTP_CODE);
    await waitFor(() => {
      expect(internal.router.state.location.pathname).toBe('/doctor/alerts');
    });
    internal.unmount();

    const external = renderApp('/login?next=//evil.test');
    await submitCredentials(PATIENT_ACCOUNT.email, PATIENT_ACCOUNT.password);
    await waitFor(() => {
      expect(external.router.state.location.pathname).toBe('/patient');
    });
  });

  it('explains an expired session and links to patient activation', async () => {
    renderApp('/login?reason=expired');
    expect(await screen.findByText(es.auth.sessionExpired)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: es.access.login.activate });
    expect(link).toHaveAttribute('href', '/activate');
    const form = screen.getByLabelText(es.access.login.email).closest('form');
    expect(form).toBeInstanceOf(HTMLFormElement);
    expect(within(form as HTMLFormElement).getByRole('button', { name: es.access.login.submit })).toBeInTheDocument();
  });

  it('has no axe violations on the password step', async () => {
    const { container } = renderApp('/login');
    await screen.findByLabelText(es.access.login.email);
    await expectNoAxeViolations(container);
  });
});
