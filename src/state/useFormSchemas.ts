import { useMemo } from 'react';
import { buildFormSchemas } from '@/services/forms/formSchemas';
import { useFieldLimits } from './useFieldLimits';

/**
 * Zod schemas of the forms, built from the API's field limits. While limits load (or if they
 * fail) the schemas carry no length rules; the server stays the authority.
 */
export function useFormSchemas() {
  const { data, isPending, isError } = useFieldLimits();
  const schemas = useMemo(() => buildFormSchemas(data ?? {}), [data]);
  return { schemas, ready: !isPending && !isError };
}
