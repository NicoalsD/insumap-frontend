import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SessionViewModelAdapter, type SessionViewModel } from '@/services/adapters/SessionViewModelAdapter';
import { SessionContext, type SessionContextValue, type SessionState } from '@/state/sessionContext';
import { useApi } from '@/state/useApi';

const adapter = new SessionViewModelAdapter();
const ANONYMOUS: SessionState = { status: 'anonymous', session: null };

/**
 * Holds who is signed in. On mount it tries the refresh cookie (a reload loses the in-memory
 * access token), then reads `/auth/current-user`. Whenever the token disappears (logout, revoked session,
 * failed refresh) it goes back to anonymous and drops cached server data.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { api, tokens } = useApi();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  const reload = useCallback(async (): Promise<SessionViewModel | null> => {
    try {
      const session = adapter.adapt(await api.getCurrentUser());
      setState({ status: 'authenticated', session });
      return session;
    } catch {
      setState(ANONYMOUS);
      return null;
    }
  }, [api]);

  useEffect(() => {
    const lifecycle = { active: true };
    void (async () => {
      const restored = tokens.get() !== null || (await api.restoreSession());
      if (!lifecycle.active) return;
      if (restored) await reload();
      else setState(ANONYMOUS);
    })();
    return () => {
      lifecycle.active = false;
    };
  }, [api, tokens, reload]);

  useEffect(
    () =>
      tokens.subscribe((token) => {
        if (token !== null) return;
        setState(ANONYMOUS);
        queryClient.clear();
      }),
    [tokens, queryClient],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      reload,
      signOut: async () => {
        await api.logout().catch(() => undefined);
        setState(ANONYMOUS);
        queryClient.clear();
      },
    }),
    [state, reload, api, queryClient],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
