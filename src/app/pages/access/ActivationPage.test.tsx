import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/mocks/http';
import { DEMO_ACTIVATION } from '@/mocks/fixtures/people';
import { server } from '@/mocks/server';
import { es } from '@/i18n/es';
import { apiUrl } from '@/services/http/apiUrl';
import { expectNoAxeViolations } from '@/test/axe';
import { renderApp } from '@/test/renderApp';

const STRONG_PASSWORD = 'contraseña-segura-2026';

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function fillCode(code: string = DEMO_ACTIVATION.code, birthDate: string = DEMO_ACTIVATION.birthDate) {
  await userEvent.type(await screen.findByLabelText(es.access.activation.code), code);
  fireEvent.change(screen.getByLabelText(es.access.activation.birthDate), { target: { value: birthDate } });
  await userEvent.click(screen.getByRole('button', { name: es.access.activation.verify }));
}

describe('patient activation', () => {
  it('checks the code and birth date, then activates the account and opens the patient home', async () => {
    const { container, router } = renderApp('/activate');
    await fillCode();
    expect(await screen.findByRole('heading', { level: 1, name: es.access.activation.createTitle })).toBeInTheDocument();
    expect(screen.queryByLabelText(es.access.activation.email)).toBeNull();
    await expectNoAxeViolations(container);

    const password = screen.getByLabelText(es.access.activation.password);
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.type(password, 'corta');
    expect(await screen.findByText(/^Al menos \d+ caracteres$/)).toBeInTheDocument();
    expect(screen.getByText(/^Como máximo \d+ caracteres$/)).toBeInTheDocument();
    // Five characters: the minimum is pending, the maximum is already met.
    expect(screen.getByText(es.access.activation.rulePending)).toBeInTheDocument();
    expect(screen.getByText(es.access.activation.ruleMet)).toBeInTheDocument();

    await userEvent.clear(password);
    await userEvent.type(password, STRONG_PASSWORD);
    expect(screen.getAllByText(es.access.activation.ruleMet).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: es.access.activation.complete }));
    expect(await screen.findByText(es.access.activation.privacyRequired)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: new RegExp(es.access.activation.privacy.slice(0, 30)) }));
    await userEvent.click(screen.getByRole('button', { name: es.access.activation.complete }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/patient');
    });
  });

  it('keeps the AI consent optional and unchecked by default', async () => {
    renderApp('/activate');
    await fillCode();
    const ai = await screen.findByRole('checkbox', { name: new RegExp(es.access.activation.ai.slice(0, 30)) });
    expect(ai).not.toBeChecked();
  });

  it('answers a wrong code with the API message and stays on the code step', async () => {
    renderApp('/activate');
    await fillCode('AAAA-BBBB-CCCC-DDDD');
    expect(await screen.findByText(es.apiErrors.INVITATION_INVALID)).toBeInTheDocument();
    expect(screen.getByLabelText(es.access.activation.code)).toBeInTheDocument();
  });

  it('asks for the email when the clinic did not have one', async () => {
    server.use(
      http.post(apiUrl('/auth/activation/verify'), () =>
        Response.json({
          activation_token: 'mock-activation-token',
          clinic_name: 'Clínica de prueba',
          privacy_notice_version_id: 'p1000000-0000-4000-8000-000000000001',
          email_required: true,
        }),
      ),
    );
    const { router } = renderApp('/activate');
    await fillCode();
    const email = await screen.findByLabelText(es.access.activation.email);
    expect(email).toHaveAttribute('type', 'email');
    await userEvent.type(email, 'no-es-correo');
    await userEvent.type(screen.getByLabelText(es.access.activation.password), STRONG_PASSWORD);
    await userEvent.click(screen.getByRole('checkbox', { name: new RegExp(es.access.activation.privacy.slice(0, 30)) }));
    await userEvent.click(screen.getByRole('button', { name: es.access.activation.complete }));
    expect(await screen.findByText(es.validation.invalidEmail)).toBeInTheDocument();

    await userEvent.clear(email);
    await userEvent.type(email, 'paciente@example.test');
    await userEvent.click(screen.getByRole('button', { name: es.access.activation.complete }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/patient');
    });
  });

  it('sends the patient back to the code when the activation token is no longer valid', async () => {
    server.use(http.post(apiUrl('/auth/activation/complete'), () => apiError('INVITATION_INVALID')));
    renderApp('/activate');
    await fillCode();
    await userEvent.type(await screen.findByLabelText(es.access.activation.password), STRONG_PASSWORD);
    await userEvent.click(screen.getByRole('checkbox', { name: new RegExp(es.access.activation.privacy.slice(0, 30)) }));
    await userEvent.click(screen.getByRole('button', { name: es.access.activation.complete }));
    expect(await screen.findByRole('alert')).toHaveTextContent(es.apiErrors.INVITATION_INVALID);
    expect(await screen.findByLabelText(es.access.activation.code)).toHaveValue('');
  });

  it('has no axe violations on the code step', async () => {
    const { container } = renderApp('/activate');
    await screen.findByLabelText(es.access.activation.code);
    await expectNoAxeViolations(container);
  });
});
