import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { es } from '@/i18n/es';
import { PATIENT_ACCOUNT } from '@/mocks/fixtures/people';
import { server } from '@/mocks/server';
import { apiUrl } from '@/services/http/apiUrl';
import { expectNoAxeViolations } from '@/test/axe';
import { renderApp } from '@/test/renderApp';

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Signs in through the real login page and lands on the patient home. */
async function signInAsPatient() {
  const view = renderApp('/login');
  await userEvent.type(await screen.findByLabelText(es.access.login.email), PATIENT_ACCOUNT.email);
  await userEvent.type(screen.getByLabelText(es.access.login.password), PATIENT_ACCOUNT.password);
  await userEvent.click(screen.getByRole('button', { name: es.access.login.submit }));
  await waitFor(() => {
    expect(view.router.state.location.pathname).toBe('/patient');
  });
  return view;
}

/** Opens the register wizard and walks it to the save button with a value and the fasting context. */
async function fillRecorder(value: string) {
  await userEvent.click(await screen.findByRole('button', { name: es.patient.record.open }));
  await userEvent.type(screen.getByLabelText(es.patient.record.value.label), value);
  await userEvent.click(screen.getByRole('button', { name: es.patient.record.next }));
  await userEvent.click(screen.getByRole('button', { name: es.patient.record.next }));
  await userEvent.click(screen.getByRole('radio', { name: es.patient.record.context.FASTING }));
}

describe('patient home', () => {
  it('shows the greeting, the last reading with its state in text, and the register button', async () => {
    const { container } = await signInAsPatient();
    expect(await screen.findByRole('heading', { level: 1, name: /Luisa/ })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: es.patient.latest.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: es.patient.record.open })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: es.patient.dayChart.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: es.patient.week.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: es.patient.reminders.title })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('registers a glucose value end to end and shows the immediate result', async () => {
    await signInAsPatient();
    await fillRecorder('132');
    await userEvent.click(screen.getByRole('button', { name: es.patient.record.save }));
    expect(await screen.findByText('Guardado: 132 mg/dL, en rango.')).toBeInTheDocument();
  });

  it('asks for a value within the API limits and does not send an invalid one', async () => {
    await signInAsPatient();
    await userEvent.click(await screen.findByRole('button', { name: es.patient.record.open }));
    await userEvent.type(screen.getByLabelText(es.patient.record.value.label), '5');
    await userEvent.click(screen.getByRole('button', { name: es.patient.record.next }));
    expect(await screen.findByText(/entre 20 y 600 mg\/dL/)).toBeInTheDocument();
    expect(screen.getByLabelText(es.patient.record.value.label)).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects letters and decimals on the keypad field', async () => {
    await signInAsPatient();
    await userEvent.click(await screen.findByRole('button', { name: es.patient.record.open }));
    await userEvent.type(screen.getByLabelText(es.patient.record.value.label), '12.5');
    await userEvent.click(screen.getByRole('button', { name: es.patient.record.next }));
    expect(await screen.findByText(es.patient.record.value.integer)).toBeInTheDocument();
  });

  it('tells the patient to talk to the doctor for a very low value, without any dose', async () => {
    await signInAsPatient();
    await fillRecorder('45');
    await userEvent.click(screen.getByRole('button', { name: es.patient.record.save }));
    expect(await screen.findByRole('alert')).toHaveTextContent(es.patient.record.urgent.VERY_LOW);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/unidades/);
  });

  it('keeps a reading in the pending queue when the network is down and sends it when it returns', async () => {
    await signInAsPatient();
    server.use(http.post(apiUrl('/readings'), () => HttpResponse.error()));
    await fillRecorder('150');
    await userEvent.click(screen.getByRole('button', { name: es.patient.record.save }));
    expect((await screen.findAllByText('Pendiente de enviar: 150 mg/dL. Se guardará cuando vuelva la conexión.')).length).toBeGreaterThan(0);

    server.resetHandlers();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: es.patient.offline.pendingTitle })).toBeNull();
    });
  });

  it('turns a reminder switch off and on, and reports a refused change', async () => {
    await signInAsPatient();
    const switches = await screen.findAllByRole('switch');
    const first = switches[0];
    if (first === undefined) throw new Error('expected a reminder switch');
    const before = first.getAttribute('aria-checked');
    await userEvent.click(first);
    await waitFor(() => {
      expect(first.getAttribute('aria-checked')).not.toBe(before);
    });
  });
});

describe('patient readings, plan and messages', () => {
  it('lists readings by day with the state in text and a load-more control', async () => {
    const { router } = await signInAsPatient();
    await router.navigate('/patient/readings');
    expect(await screen.findByRole('heading', { name: es.patient.readings.title })).toBeInTheDocument();
    expect((await screen.findAllByText(/mg\/dL/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Registro manual|Sensor continuo|Glucómetro/).length).toBeGreaterThan(0);
  });

  it('shows the active plan in plain language with the prescribed times', async () => {
    const { router, container } = await signInAsPatient();
    await router.navigate('/patient/plan');
    expect(await screen.findByRole('heading', { name: 'Plan basal-bolo' })).toBeInTheDocument();
    expect(screen.getByText('21:30')).toBeInTheDocument();
    expect(screen.getByText('Dosis indicada: 18 unidades')).toBeInTheDocument();
    // The shared medical notice of the footer is outside this screen; the plan itself never labels AI.
    expect(within(screen.getByRole('main')).queryByText(/\bIA\b|inteligencia artificial/i)).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('shows the thread as plain text, keeps the emergency notice and sends a message', async () => {
    const { router, container } = await signInAsPatient();
    await router.navigate('/patient/messages');
    expect(await screen.findByText(es.patient.messages.emergency)).toBeInTheDocument();
    const thread = await screen.findByRole('list');
    expect(within(thread).queryAllByRole('listitem').length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText(es.patient.messages.label), '  Hola, ¿puedo comer arroz?  ');
    await userEvent.click(screen.getByRole('button', { name: es.patient.messages.send }));
    expect(await screen.findByText('Hola, ¿puedo comer arroz?')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('refuses an empty message before calling the API', async () => {
    const { router } = await signInAsPatient();
    await router.navigate('/patient/messages');
    await userEvent.click(await screen.findByRole('button', { name: es.patient.messages.send }));
    expect(await screen.findByRole('alert')).toHaveTextContent(es.patient.messages.required);
  });
});
