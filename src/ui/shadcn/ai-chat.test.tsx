import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { Conversation, Message, PromptInput, Suggestion, Suggestions } from './ai-chat';

/** Controlled prompt so the keyboard rules can be tested without the screen. */
function Harness({ onSubmit }: { onSubmit: () => void }) {
  const [value, setValue] = useState('');
  return (
    <PromptInput
      id="q"
      label="Pregunta"
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      pending={false}
      sendLabel="Enviar"
      stopLabel="Detener"
    />
  );
}

describe('PromptInput', () => {
  it('sends on Enter and keeps a line break on Shift+Enter', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const field = screen.getByLabelText('Pregunta');
    await userEvent.type(field, 'hola');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(field, 'mundo{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows a stop button instead of send while a reply is pending', async () => {
    const onStop = vi.fn();
    render(
      <PromptInput
        id="q"
        label="Pregunta"
        value="x"
        onChange={() => undefined}
        onSubmit={() => undefined}
        pending
        onStop={onStop}
        sendLabel="Enviar"
        stopLabel="Detener"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Detener' }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull();
  });
});

describe('Conversation and Message', () => {
  it('renders the log with its name, plain text messages and the suggestions as chips', async () => {
    const onSelect = vi.fn();
    const { container } = render(
      <>
        <Conversation label="Chat" scrollLabel="Ir al final">
          <Message from="user" author="Tú">{'<b>no es html</b>'}</Message>
          <Message from="assistant" author="Asistente educativo">Respuesta</Message>
        </Conversation>
        <Suggestions label="Preguntas sugeridas">
          <Suggestion suggestion="¿Qué es el tiempo en rango?" onSelect={onSelect} />
        </Suggestions>
      </>,
    );
    expect(screen.getByRole('log', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByText('<b>no es html</b>').tagName).toBe('SPAN');
    await userEvent.click(screen.getByRole('button', { name: '¿Qué es el tiempo en rango?' }));
    expect(onSelect).toHaveBeenCalledWith('¿Qué es el tiempo en rango?');
    await expectNoAxeViolations(container);
  });
});
