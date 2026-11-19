import { useState, type ComponentPropsWithRef } from 'react';
import { TextField } from '@/ui';
import { es } from '@/i18n/es';

export type PasswordFieldProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'size' | 'id'> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

/**
 * Password input with a show/hide toggle under the field. The name and autocomplete stay on the
 * input and only `type` changes, so password managers keep recognising the field.
 */
export function PasswordField({ label, error, hint, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="access__password">
      <TextField
        {...rest}
        type={visible ? 'text' : 'password'}
        label={label}
        error={error}
        {...(hint === undefined ? {} : { hint })}
      />
      <button
        type="button"
        className="access__toggle"
        aria-pressed={visible}
        onClick={() => {
          setVisible((current) => !current);
        }}
      >
        {visible ? es.access.login.hidePassword : es.access.login.showPassword}
      </button>
    </div>
  );
}
