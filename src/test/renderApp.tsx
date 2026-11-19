import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/AppProviders';
import { createApiClient, createQueryClient } from '@/app/clients';
import { appRoutes } from '@/app/routes';

/** Renders the whole app (providers, guards, shells) on a memory router with a fresh token store. */
export function renderApp(path = '/') {
  const client = createApiClient();
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const queryClient = createQueryClient();
  const view = render(
    <AppProviders client={client} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, router, client };
}
