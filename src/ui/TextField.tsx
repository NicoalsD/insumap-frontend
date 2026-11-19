import { useId, type ComponentPropsWithRef } from 'react';
import { fieldIds } from './fieldIds';
import { FieldShell } from './FieldShell';

export interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'id' | 'size'> {
  label: string;
  hint?: string;
  /** Validation message (Zod or API). The parent decides when to show it, e.g. after blur or submit. */
  error?: string | undefined;
  size?: 'md' | 'lg';
}

/** Text input with a visible label, optional hint and an accessible error (`aria-invalid` + `aria-describedby`). */
export function TextField({ label, hint, error, size = 'md', className, ...rest }: TextFieldProps) {
  const id = useId();
  const { hintId, errorId, describedBy } = fieldIds(id, Boolean(hint), Boolean(error));
  return (
    <FieldShell {...{ id, label, hint, error, size, hintId, errorId }}>
      <input
        {...rest}
        id={id}
        className={['ui-field__control', className].filter(Boolean).join(' ')}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
    </FieldShell>
  );
}
