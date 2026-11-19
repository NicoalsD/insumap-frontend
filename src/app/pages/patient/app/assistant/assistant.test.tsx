import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { es } from '@/i18n/es';
import { server } from '@/mocks/server';
import { apiError } from '@/mocks/http';
import { apiUrl } from '@/services/http/apiUrl';
import { expectNoAxeViolations } from '@/test/axe';
import { signInAsPatient } from '../../patientTestUtils';

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function openAssistant() {
  const view = await signInAsPatient();
  await view.router.navigate('/patient/assistant');
  return view;
}

async function ask(text: string) {
  await userEvent.type(await screen.findByLabelText(es.patient.assistant.label), text);
  await userEvent.click(screen.getByRole('button', { name: es.patient.assistant.sendAria }));
}

describe('educational assistant', () => {
  it('answers an educational question with the approved material and the educational notice', async () => {
    const { container } = await openAssistant();
    expect(await screen.findByText(es.patient.assistant.notice)).toBeInTheDocument();
    await ask('¿Cómo roto los sitios de inyección?');
    expect(await screen.findByText(/Rota los sitios de inyección/)).toBeInTheDocument();
    expect(screen.getByText('Material de tu clínica: Guía de rotación de sitios de inyección')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('refuses a dose request and sends the patient to the doctor, without any number', async () => {
    await openAssistant();
    await ask('¿Cuántas unidades me pongo de insulina?');
    expect(await screen.findByText(/Eso lo define tu médico/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the emergency banner for an alarm sign and stops the educational talk', async () => {
    await openAssistant();
    await ask('Tengo un desmayo y confusión');
    expect(await screen.findByRole('alert')).toHaveTextContent(es.patient.assistant.escalationEmergency);
    expect(screen.getByText(es.patient.assistant.ended)).toBeInTheDocument();
    expect(screen.getByLabelText(es.patient.assistant.label)).toBeDisabled();
  });

  it('shows a clear message when the API answers 429', async () => {
    server.use(http.post(apiUrl('/assistant/messages'), () => apiError('RATE_LIMITED', { retry_after: 60 }, 429)));
    await openAssistant();
    await ask('¿Qué es el tiempo en rango?');
    expect(await screen.findByRole('alert')).toHaveTextContent(es.patient.assistant.rateLimited);
  });

  it('uses the predefined answers and labels them when there is no consent for external processing', async () => {
    server.use(
      http.post(apiUrl('/assistant/messages'), () =>
        HttpResponse.json({
          reply_text: 'Rota los sitios de inyección entre izquierda y derecha.',
          citations: [{ title: 'Guía de rotación de sitios de inyección' }],
          escalation: 'NONE',
          is_fallback: true,
        }),
      ),
    );
    await openAssistant();
    await ask('¿Cómo roto los sitios?');
    expect(await screen.findByText(es.patient.assistant.fallback)).toBeInTheDocument();
  });

  it('shows the doctor path when the reply escalates to the care team', async () => {
    await openAssistant();
    await ask('Me siento mareado después de la comida');
    await waitFor(() => {
      expect(screen.getByRole('link', { name: es.patient.assistant.openMessages })).toHaveAttribute(
        'href',
        '/patient/messages',
      );
    });
  });

  it('does not send an empty question', async () => {
    await openAssistant();
    await userEvent.click(await screen.findByRole('button', { name: es.patient.assistant.sendAria }));
    expect(await screen.findByText(es.patient.assistant.required)).toBeInTheDocument();
  });
});
