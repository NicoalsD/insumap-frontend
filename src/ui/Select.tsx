import { useId, type ComponentPropsWithRef } from 'react';
import { fieldIds } from './fieldIds';
import { FieldShell } from './FieldShell';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps extends Omit<ComponentPropsWithRef<'select'>, 'id' | 'children' | 'size'> {
  label: string;
  /** Options come from the API catalogs or from `es.ts`, never inline literals. */
  options: readonly SelectOption[];
  hint?: string;
  error?: string | undefined;
  size?: 'md' | 'lg';
}

/** Native select (keyboard and screen readers for free) with the same label and error contract as TextField. */
export function Select({ label, options, hint, error, size = 'md', className, ...rest }: SelectProps) {
  const id = useId();
  const { hintId, errorId, describedBy } = fieldIds(id, Boolean(hint), Boolean(error));
  return (
    <FieldShell {...{ id, label, hint, error, size, hintId, errorId }}>
      <select
        {...rest}
        id={id}
        className={['ui-field__control', className].filter(Boolean).join(' ')}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
