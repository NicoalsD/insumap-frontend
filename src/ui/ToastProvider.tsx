import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import { ToastContext, type ToastApi, type ToastTone } from './ToastContext';
import './Toast.css';

const TOAST_DURATION_MS = 6000;
const ICONS = { info: Info, success: CircleCheck, critical: CircleAlert } as const;

interface ToastItem {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

/**
 * Live-region toasts. The region always exists in the DOM (`role="region"` named, with a
 * polite `role="status"` list inside), so screen readers announce messages added later.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const api = useMemo<ToastApi>(() => {
    return {
      show(message, tone = 'info') {
        counter.current += 1;
        const id = counter.current;
        setToasts((current) => [...current, { id, message, tone }]);
        if (tone !== 'critical') setTimeout(() => { dismiss(id); }, TOAST_DURATION_MS);
      },
    };
  }, [dismiss]);

  return (
    <ToastContext value={api}>
      {children}
      <section className="ui-toast-region" aria-label={es.toast.region}>
        <div role="status" aria-live="polite" aria-atomic="false" className="ui-toast-list">
          {toasts.map((toast) => {
            const Icon = ICONS[toast.tone];
            return (
              <div key={toast.id} className="ui-toast" data-tone={toast.tone}>
                <Icon size="1.25rem" aria-hidden="true" />
                <p className="ui-toast__message">{toast.message}</p>
                <button
                  type="button"
                  className="ui-toast__close"
                  aria-label={es.toast.close}
                  onClick={() => { dismiss(toast.id); }}
                >
                  <X size="1em" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </ToastContext>
  );
}
