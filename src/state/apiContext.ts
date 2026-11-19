import { createContext } from 'react';
import type { AccessTokenStore } from '@/services/api/AccessTokenStore';
import type { InsumapApi } from '@/services/api/InsumapApi';

export interface ApiContextValue {
  readonly api: InsumapApi;
  readonly tokens: AccessTokenStore;
}

export const ApiContext = createContext<ApiContextValue | null>(null);
