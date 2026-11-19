import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { ChoiceSlider } from '@/ui/Slider';

/**
 * The time window of the doctor's screens as one slider (7, 14 or 30 days) instead of a row of
 * options: one control, one gesture, and the change shows at once (the query keeps the previous
 * data on screen while the new window loads).
 */
export function WindowSlider<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  readonly label: string;
  /** The current window; a value outside `options` (for example 24 h) shows the first stop. */
  readonly value: string;
  readonly options: readonly T[];
  readonly onChange: (value: T) => void;
  readonly className?: string;
}) {
  return (
    <ChoiceSlider
      className={['window-slider', className].filter(Boolean).join(' ')}
      label={label}
      value={options.find((option) => option === value) ?? (options[0] as T)}
      options={options.map((option) => {
        const days = Number.parseInt(option, 10);
        return {
          value: option,
          label: format(es.doctor.dashboard.windowChip, { days }),
          text: format(es.doctor.triage.windowOption, { days }),
        };
      })}
      onChange={onChange}
    />
  );
}
