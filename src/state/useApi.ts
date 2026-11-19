import { useContext } from 'react';
import { ApiContext, type ApiContextValue } from './apiContext';

/** The `InsumapApi` facade and its in-memory token store. Screens call `api.*` inside TanStack Query hooks. */
export function useApi(): ApiContextValue {
  const value = useContext(ApiContext);
  if (!value) throw new Error('useApi must be used inside <AppProviders>');
  return value;
}
