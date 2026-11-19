import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { es } from '@/i18n/es';
import { expectNoAxeViolations } from '@/test/axe';
import { renderApp } from '@/test/renderApp';

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function enterAs(role: 'médico' | 'paciente' | 'admin de clínica') {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`Entrar como ${role}`, 'i') }));
}

describe('app shell, guards and demo entry', () => {
  it('shows the sales landing without role entry or simulated and academic notices', async () => {
    const { container } = renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: es.landing.title })).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /Entrar como/ })).toHaveLength(0);
    expect(screen.getAllByRole('link', { name: es.landing.login })[0]).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link', { name: new RegExp(es.landing.requestDemo) }).length).toBeGreaterThan(0);
    expect(screen.queryByText(es.notices.simulated)).toBeNull();
    expect(screen.queryByText(es.notices.medicalDisclaimer)).toBeNull();
    // The regulatory notice the user chose: in the footer and next to the AI suggestion.
    expect(screen.getAllByText(es.landing.notice)).toHaveLength(2);
    await expectNoAxeViolations(container);
  });

  it('offers the role entry of the example clinic on the login page', async () => {
    renderApp('/login');
    expect(await screen.findAllByRole('button', { name: /Entrar como/ })).toHaveLength(3);
  });

  it('redirects an anonymous visitor from a guarded route to the landing', async () => {
    const { router } = renderApp('/doctor/triage');
    await screen.findByRole('heading', { level: 1, name: es.landing.title });
    expect(router.state.location.pathname).toBe('/');
  });

  it('signs in as a doctor through the real flow and shows the staff shell', async () => {
    const { container, router } = renderApp('/login');
    await enterAs('médico');
    await screen.findByRole('heading', { name: es.nav.triage });
    expect(router.state.location.pathname).toBe('/doctor/triage');
    const nav = screen.getByRole('navigation', { name: es.nav.main });
    expect(within(nav).getByRole('link', { name: es.nav.triage })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: es.nav.alerts })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: es.nav.imports })).toBeNull();
    expect(screen.getByText(es.notices.simulated)).toBeVisible();
    expect(screen.getByText(es.notices.medicalDisclaimer)).toBeVisible();
    expect(screen.getByText('Mauricio Henao Vélez')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('shows the admin rail with only the screens the permissions allow', async () => {
    renderApp('/login');
    await enterAs('admin de clínica');
    const nav = await screen.findByRole('navigation', { name: es.nav.main });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      es.nav.patients,
      es.nav.imports,
      es.nav.credentials,
      es.nav.careTeams,
    ]);
  });

  it('gives the patient the top bar and blocks the doctor zone', async () => {
    const { router } = renderApp('/login');
    await enterAs('paciente');
    await screen.findByRole('heading', { name: es.nav.home });
    expect(router.state.location.pathname).toBe('/patient');
    await router.navigate('/doctor/triage');
    expect(await screen.findByRole('heading', { name: es.states.forbiddenTitle })).toBeInTheDocument();
  });

  it('restores the session from the refresh cookie after a reload', async () => {
    const first = renderApp('/login');
    await enterAs('médico');
    await screen.findByRole('heading', { name: es.nav.triage });
    first.unmount();
    renderApp('/doctor/alerts');
    expect(await screen.findByRole('heading', { name: es.nav.alerts })).toBeInTheDocument();
  });

  it('signs out and returns to the landing', async () => {
    const { router } = renderApp('/login');
    await enterAs('médico');
    await userEvent.click(await screen.findByRole('button', { name: es.nav.logout }));
    await waitFor(() => { expect(router.state.location.pathname).toBe('/'); });
    await screen.findByRole('heading', { level: 1, name: es.landing.title });
  });

  it('answers unknown addresses with the not-found screen', async () => {
    renderApp('/no-existe');
    expect(await screen.findByRole('heading', { name: es.states.notFoundTitle })).toBeInTheDocument();
  });
});
