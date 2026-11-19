import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { apiError } from '@/mocks/http';
import { DEMO_TOTP_CODE, ENROLLMENT_ACCOUNT } from '@/mocks/fixtures/people';
import { server } from '@/mocks/server';
import { es } from '@/i18n/es';
import { apiUrl } from '@/services/http/apiUrl';
import { expectNoAxeViolations } from '@/test/axe';
import { renderApp } from '@/test/renderApp';

const RECOVERY_CODES_COUNT = 10;
const SECRET_PATTERN = /^[A-Z2-7]{32}$/;

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Signs in an account that has no MFA yet and waits for the enrollment screen. */
async function enrollingSession() {
  const view = renderApp('/login');
  await userEvent.type(await screen.findByLabelText(es.access.login.email), ENROLLMENT_ACCOUNT.email);
  await userEvent.type(screen.getByLabelText(es.access.login.password), ENROLLMENT_ACCOUNT.password);
  await userEvent.click(screen.getByRole('button', { name: es.access.login.submit }));
  await waitFor(() => {
    expect(view.router.state.location.pathname).toBe('/mfa/enrollment');
  });
  return view;
}

describe('MFA enrollment page', () => {
  it('draws the QR as an accessible image and offers the secret as text', async () => {
    await enrollingSession();
    const qr = await screen.findByRole('img', { name: es.access.enroll.qrLabel });
    expect(qr.tagName.toLowerCase()).toBe('svg');
    const secret = screen.getByText(SECRET_PATTERN);
    expect(secret.tagName.toLowerCase()).toBe('code');
    expect(screen.getByRole('button', { name: es.access.enroll.copySecret })).toBeInTheDocument();
  });

  it('confirms with a code, then shows the recovery codes once and leaves after the checkbox', async () => {
    const { container, router } = await enrollingSession();
    await screen.findByRole('img', { name: es.access.enroll.qrLabel });
    await userEvent.type(screen.getByLabelText(es.access.enroll.code), '000000');
    await userEvent.click(screen.getByRole('button', { name: es.access.enroll.confirm }));
    expect(await screen.findByText(es.apiErrors.INVALID_CREDENTIALS)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(es.access.enroll.code));
    await userEvent.type(screen.getByLabelText(es.access.enroll.code), DEMO_TOTP_CODE);
    await userEvent.click(screen.getByRole('button', { name: es.access.enroll.confirm }));

    const list = await screen.findByRole('list', { name: es.access.enroll.codesTitle });
    expect(within(list).getAllByRole('listitem')).toHaveLength(RECOVERY_CODES_COUNT);
    expect(screen.queryByRole('img', { name: es.access.enroll.qrLabel })).toBeNull();
    await expectNoAxeViolations(container);

    const continueButton = screen.getByRole('button', { name: es.access.enroll.continue });
    expect(continueButton).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: es.access.enroll.savedCheck }));
    expect(continueButton).toBeEnabled();
    await userEvent.click(continueButton);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/doctor/triage');
    });
  });

  it('copies and downloads the recovery codes as a text file', async () => {
    const user = userEvent.setup();
    await enrollingSession();
    await screen.findByRole('img', { name: es.access.enroll.qrLabel });
    await user.type(screen.getByLabelText(es.access.enroll.code), DEMO_TOTP_CODE);
    await user.click(screen.getByRole('button', { name: es.access.enroll.confirm }));
    await screen.findByRole('list', { name: es.access.enroll.codesTitle });

    await user.click(screen.getByRole('button', { name: es.access.enroll.copyCodes }));
    expect(await screen.findByText(es.access.enroll.codesCopied)).toBeInTheDocument();

    const createObjectURL = vi.fn(() => 'blob:insumap-test');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await user.click(screen.getByRole('button', { name: es.access.enroll.downloadCodes }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:insumap-test');
    const blob = (createObjectURL as unknown as Mock<(value: Blob) => string>).mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
  });

  it('shows the error and a way back when no enrollment session exists', async () => {
    renderApp('/mfa/enrollment');
    expect(await screen.findByRole('alert')).toHaveTextContent(es.apiErrors.UNAUTHENTICATED);
    expect(screen.getByRole('link', { name: es.access.enroll.backToLogin })).toHaveAttribute('href', '/login');
  });

  it('shows the API error and does not start enrollment twice', async () => {
    const start = vi.fn(() => apiError('INTERNAL_ERROR'));
    server.use(http.post(apiUrl('/auth/mfa/enrollment'), start));
    await enrollingSession();
    expect(await screen.findByRole('alert')).toHaveTextContent(es.apiErrors.INTERNAL_ERROR);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('has no axe violations while the QR is shown', async () => {
    const { container } = await enrollingSession();
    await screen.findByRole('img', { name: es.access.enroll.qrLabel });
    await expectNoAxeViolations(container);
  });
});
