import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { ChoiceSlider, Slider } from './Slider';

describe('Slider', () => {
  it('is a labelled slider that reads its value with the unit', async () => {
    const { container } = render(
      <Slider
        label="Acercar"
        value={120}
        min={100}
        max={220}
        step={10}
        valueText={(v) => `${String(v)} %`}
        onChange={vi.fn()}
      />,
    );
    const slider = screen.getByRole('slider', { name: 'Acercar' });
    expect(slider).toHaveAttribute('aria-valuenow', '120');
    expect(slider).toHaveAttribute('aria-valuetext', '120 %');
    await expectNoAxeViolations(container);
  });

  it('moves by a step with the arrows and to the ends with Home and End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Slider
        label="Acercar"
        value={120}
        min={100}
        max={220}
        step={10}
        valueText={String}
        onChange={onChange}
      />,
    );
    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(130);
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith(100);
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith(220);
  });

  it('does nothing while disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Slider
        label="Punto"
        value={1}
        min={1}
        max={4}
        disabled
        valueText={String}
        onChange={onChange}
      />,
    );
    screen.getByRole('slider').focus();
    await user.keyboard('{End}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('slider')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('ChoiceSlider', () => {
  it('walks an ordered list and speaks each stop', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChoiceSlider
        label="Ventana"
        value="14d"
        options={[
          { value: '7d', label: '7 días', text: 'Últimos 7 días' },
          { value: '14d', label: '14 días', text: 'Últimos 14 días' },
          { value: '30d', label: '30 días', text: 'Últimos 30 días' },
        ]}
        onChange={onChange}
      />,
    );
    const slider = screen.getByRole('slider', { name: 'Ventana' });
    expect(slider).toHaveAttribute('aria-valuetext', 'Últimos 14 días');
    slider.focus();
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('7d');
  });
});
