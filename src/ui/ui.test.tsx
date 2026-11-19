import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { es } from '@/i18n/es';
import { ApiError } from '@/services/api/ApiError';
import { expectNoAxeViolations } from '@/test/axe';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorBoundary,
  ErrorState,
  LoadingState,
  MedicalDisclaimer,
  Select,
  SimulatedNotice,
  Tabs,
  TextField,
  ToastProvider,
  rangeTone,
  useToast,
} from '.';

describe('Button', () => {
  it('ignores clicks while loading but keeps focus and announces it', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Guardar</Button>);
    const button = screen.getByRole('button', { name: /Guardar/ });
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).not.toBeDisabled();
  });
});

describe('TextField', () => {
  it('links label, hint and error, and marks the field invalid only with an error', async () => {
    const { container, rerender } = render(<TextField label="Correo" hint="Ayuda" />);
    const field = screen.getByLabelText('Correo');
    expect(field).toHaveAttribute('aria-invalid', 'false');
    rerender(<TextField label="Correo" hint="Ayuda" error="Escribe un correo válido" />);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Ayuda Escribe un correo válido');
    await expectNoAxeViolations(container);
  });
});

describe('Select', () => {
  it('renders options and reports the change', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <Select label="Ventana" onChange={onChange} options={[{ value: '7d', label: '7 días' }, { value: '14d', label: '14 días' }]} />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Ventana'), '14d');
    expect(onChange).toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });
});

describe('Badge', () => {
  it('maps a range state to its tone and always carries text', () => {
    expect(rangeTone('VERY_LOW')).toBe('range-very-low');
    expect(rangeTone('IN_RANGE')).toBe('range-in-range');
    render(<Badge tone={rangeTone('HIGH')}>Alto</Badge>);
    expect(screen.getByText('Alto')).toHaveAttribute('data-tone', 'range-high');
  });
});

interface Row {
  id: string;
  name: string;
  score: number;
}
const rows: Row[] = [
  { id: 'a', name: 'Beatriz', score: 20 },
  { id: 'b', name: 'Álvaro', score: 90 },
  { id: 'c', name: 'Carlos', score: 5 },
];

describe('DataTable', () => {
  const table = (
    <DataTable
      caption="Pacientes"
      rows={rows}
      rowKey={(row) => row.id}
      columns={[
        { id: 'name', header: 'Paciente', cell: (r) => r.name, sortValue: (r) => r.name },
        { id: 'score', header: 'Riesgo', cell: (r) => r.score, sortValue: (r) => r.score, measure: true },
        { id: 'note', header: 'Nota', cell: () => '-' },
      ]}
    />
  );
  const names = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]?.textContent);

  it('sorts by header button, sets aria-sort on one header, toggles and announces', async () => {
    const { container } = render(table);
    await userEvent.click(screen.getByRole('button', { name: /Riesgo/ }));
    expect(names()).toEqual(['Carlos', 'Beatriz', 'Álvaro']);
    const riesgo = screen.getByRole('columnheader', { name: /Riesgo/ });
    expect(riesgo).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(screen.getByRole('button', { name: /Riesgo/ }));
    expect(names()).toEqual(['Álvaro', 'Beatriz', 'Carlos']);
    expect(riesgo).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByRole('status')).toHaveTextContent('Ordenado por Riesgo, descendente.');
    await userEvent.click(screen.getByRole('button', { name: /Paciente/ }));
    expect(riesgo).not.toHaveAttribute('aria-sort');
    expect(names()).toEqual(['Álvaro', 'Beatriz', 'Carlos']);
    expect(screen.getByRole('button', { name: /Paciente/ })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Nota' })).toBeNull();
    await expectNoAxeViolations(container);
  });
});

describe('Tabs', () => {
  it('moves selection with arrows, Home and End and keeps one tab stop', async () => {
    const { container } = render(
      <Tabs
        label="Secciones"
        items={[
          { id: 'one', label: 'Uno', content: 'Contenido uno' },
          { id: 'two', label: 'Dos', content: 'Contenido dos' },
          { id: 'three', label: 'Tres', content: 'Contenido tres' },
        ]}
      />,
    );
    const first = screen.getByRole('tab', { name: 'Uno' });
    first.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Dos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Dos' })).toHaveFocus();
    expect(first).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Contenido dos');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Tres' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Uno' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Tres' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Uno' })).toHaveAttribute('aria-selected', 'true');
    await expectNoAxeViolations(container);
  });
});

describe('Toast', () => {
  function Trigger() {
    const toast = useToast();
    return (
      <button type="button" onClick={() => { toast.show('Lectura guardada.', 'success'); }}>
        Mostrar
      </button>
    );
  }

  it('announces messages in a named polite live region that exists before the message', async () => {
    const { container } = render(<ToastProvider><Trigger /></ToastProvider>);
    const region = screen.getByRole('region', { name: es.toast.region });
    expect(within(region).getByRole('status')).toBeEmptyDOMElement();
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(within(region).getByRole('status')).toHaveTextContent('Lectura guardada.');
    await userEvent.click(screen.getByRole('button', { name: es.toast.close }));
    await waitFor(() => { expect(within(region).getByRole('status')).toBeEmptyDOMElement(); });
    await expectNoAxeViolations(container);
  });
});

describe('states, notices and error boundary', () => {
  it('shows loading, empty and error states with Spanish copy and a retry', async () => {
    const retry = vi.fn();
    const { container } = render(
      <>
        <LoadingState />
        <EmptyState body="Cuando haya datos aparecerán aquí." />
        <ErrorState error={new ApiError(0, 'NETWORK')} onRetry={retry} />
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(es.states.loading);
    expect(screen.getByRole('heading', { name: es.states.emptyTitle })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(es.apiErrors.NETWORK);
    await userEvent.click(screen.getByRole('button', { name: es.states.retry }));
    expect(retry).toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  it('shows the simulated-data notice and the medical disclaimer', async () => {
    const { container } = render(<><SimulatedNotice /><MedicalDisclaimer /></>);
    expect(screen.getByText(es.notices.simulated)).toBeVisible();
    expect(screen.getByText(es.notices.medicalDisclaimer)).toBeVisible();
    await expectNoAxeViolations(container);
  });

  it('catches a render error without leaking its message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Broken(): never {
      throw new Error('paciente Fulano 123');
    }
    render(<ErrorBoundary><Broken /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent(es.states.unexpectedTitle);
    // React logs its own copy of the error; the boundary itself logs only the error name.
    expect(spy).toHaveBeenCalledWith('UI error: Error');
  });
});
