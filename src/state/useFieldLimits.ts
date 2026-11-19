import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';

const LIMITS_STALE_MS = 300_000;

/** Field limits from `GET /meta/field-limits`, cached 5 minutes like the API's `Cache-Control`. */
export function useFieldLimits() {
  const { api } = useApi();
  return useQuery({
    queryKey: ['meta', 'field-limits'],
    queryFn: () => api.getFieldLimits(),
    staleTime: LIMITS_STALE_MS,
  });
}
