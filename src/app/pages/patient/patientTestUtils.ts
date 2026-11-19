import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { es } from '@/i18n/es';
import { PATIENT_ACCOUNT } from '@/mocks/fixtures/people';
import { renderApp } from '@/test/renderApp';

/** Signs in through the real login page and waits for the patient home. Test-only helper. */
export async function signInAsPatient() {
  const view = renderApp('/login');
  await userEvent.type(await screen.findByLabelText(es.access.login.email), PATIENT_ACCOUNT.email);
  await userEvent.type(screen.getByLabelText(es.access.login.password), PATIENT_ACCOUNT.password);
  await userEvent.click(screen.getByRole('button', { name: es.access.login.submit }));
  await waitFor(() => {
    expect(view.router.state.location.pathname).toBe('/patient');
  });
  return view;
}
