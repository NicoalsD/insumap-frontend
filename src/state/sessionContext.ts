import { createContext } from 'react';
import type { SessionViewModel } from '@/services/adapters/SessionViewModelAdapter';

export type SessionState =
  | { readonly status: 'loading'; readonly session: null }
  | { readonly status: 'anonymous'; readonly session: null }
  | { readonly status: 'authenticated'; readonly session: SessionViewModel };

export interface SessionContextValue {
  readonly state: SessionState;
  /** Reloads `GET /auth/me` after a login or MFA step. */
  reload: () => Promise<void>;
  /** Ends the session on the server and forgets the token. */
  signOut: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
