import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { ApiContext, type ApiContextValue } from '@/state/apiContext';
import { ToastProvider } from '@/ui';
import { createApiClient, createQueryClient } from './clients';
import { SessionProvider } from './SessionProvider';

export interface AppProvidersProps {
  children: ReactNode;
  /** Injectable for tests. */
  client?: ApiContextValue;
  queryClient?: QueryClient;
}

/** Providers every screen relies on: server cache, API facade, session and toasts. */
export function AppProviders({ children, client, queryClient }: AppProvidersProps) {
  const api = useMemo(() => client ?? createApiClient(), [client]);
  const queries = useMemo(() => queryClient ?? createQueryClient(), [queryClient]);
  return (
    <QueryClientProvider client={queries}>
      <ApiContext value={api}>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </ApiContext>
    </QueryClientProvider>
  );
}
