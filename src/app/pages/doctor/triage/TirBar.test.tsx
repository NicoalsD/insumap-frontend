import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TimeInRanges } from '@/core/glucose/timeInRanges';
import { TirBar } from './TirBar';

function window(percentByState: TimeInRanges['percentByState'], isSufficient = true): TimeInRanges {
  return { percentByState, dataSufficiencyPct: 95, isSufficient, confidence: 'NORMAL', windowDays: 14 };
}

describe('TirBar', () => {
  it('names every state with a share in text, including a 1 % share that is too thin to draw a label', () => {
    const { container } = render(
      <TirBar timeInRanges={window({ VERY_LOW: 1, LOW: 3, IN_RANGE: 58, HIGH: 26, VERY_HIGH: 12 })} />,
    );
    expect(screen.getByText('Muy bajo 1 % · Bajo 3 % · En rango 58 % · Alto 26 % · Muy alto 12 %')).toBeInTheDocument();
    // Five visible segments, each drawn with a minimum width (CSS), none is dropped for being small.
    expect(container.querySelectorAll('.tir-bar__segment')).toHaveLength(5);
  });

  it('skips states with no time and keeps the bar hidden from assistive technology', () => {
    const { container } = render(<TirBar timeInRanges={window({ VERY_LOW: 0, LOW: 0, IN_RANGE: 100, HIGH: 0, VERY_HIGH: 0 })} />);
    expect(screen.getByText('En rango 100 %')).toBeInTheDocument();
    expect(container.querySelector('.tir-bar__track')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.tir-bar__segment')).toHaveLength(1);
  });

  it('shows the insufficient-data badge instead of percentages', () => {
    render(<TirBar timeInRanges={window({ VERY_LOW: 0, LOW: 0, IN_RANGE: 0, HIGH: 0, VERY_HIGH: 0 }, false)} />);
    expect(screen.getByText('Datos insuficientes')).toBeInTheDocument();
    expect(screen.queryByText(/En rango/)).toBeNull();
  });
});
