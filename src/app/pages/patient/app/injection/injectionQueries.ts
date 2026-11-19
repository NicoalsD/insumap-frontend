import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/state/useApi';
import type { InjectionSitesDto, InsulinDoseCreateDto, InsulinKind } from '@/services/dto/injection';

export const injectionKeys = {
  all: ['patient', 'injection'] as const,
  sites: (kind: InsulinKind) => ['patient', 'injection', 'sites', kind] as const,
};

/** Where to inject for a kind of insulin. Read-only: the API never proposes units. */
export function useInjectionSites(kind: InsulinKind) {
  const { api } = useApi();
  return useQuery({
    queryKey: injectionKeys.sites(kind),
    queryFn: (): Promise<InjectionSitesDto> => api.getOwnInjectionSites(kind),
  });
}

/** Records a dose; the rotation changes, so every site query is refreshed. */
export function useRecordDose() {
  const { api } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: InsulinDoseCreateDto) => api.recordInsulinDose(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: injectionKeys.all }),
  });
}
