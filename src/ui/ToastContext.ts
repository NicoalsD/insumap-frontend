import { createContext } from 'react';

export type ToastTone = 'info' | 'success' | 'critical';

export interface ToastApi {
  /** Announces a short message in the live region. Errors stay until closed. */
  show(message: string, tone?: ToastTone): void;
}

export const ToastContext = createContext<ToastApi | null>(null);
