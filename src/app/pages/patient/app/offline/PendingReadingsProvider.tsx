import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useApi } from '@/state/useApi';
import { ApiError } from '@/services/api/ApiError';
import type { ReadingCreateDto } from '@/services/dto/clinical';
import { PendingReadingsContext, type PendingReadingsContextValue, type SaveOutcome } from './PendingReadingsContext';
import { PendingReadingsQueue } from './PendingReadingsQueue';

/**
 * Owns the offline queue of the patient shell. It flushes when the browser reports the connection
 * back (`online`) and once on mount. The queue lives as long as the shell, so signing out drops it.
 *
 * Pattern: none (React context around the queue class).
 */
export function PendingReadingsProvider({ children }: { children: ReactNode }) {
  const { api } = useApi();
  const queryClient = useQueryClient();
  const [queue] = useState(() => new PendingReadingsQueue());
  const snapshot = useSyncExternalStore(queue.subscribe, () => queue.snapshot());

  const refreshReadings = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['patient'] });
  }, [queryClient]);

  const flush = useCallback(async () => {
    await queue.flush(async (body) => {
      await api.createOwnReading(body);
    });
    refreshReadings();
  }, [api, queue, refreshReadings]);

  useEffect(() => {
    const onOnline = () => {
      void flush();
    };
    window.addEventListener('online', onOnline);
    void flush();
    return () => {
      window.removeEventListener('online', onOnline);
    };
  }, [flush]);

  const saveReading = useCallback(
    async (body: ReadingCreateDto): Promise<SaveOutcome> => {
      const queueIt = (): SaveOutcome => {
        queue.enqueue({ clientReadingId: body.client_reading_id, valueMgDl: body.value_mg_dl, body });
        return 'pending';
      };
      if (!navigator.onLine) return queueIt();
      try {
        await api.createOwnReading(body);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'NETWORK') return queueIt();
        throw error;
      }
      refreshReadings();
      return 'saved';
    },
    [api, queue, refreshReadings],
  );

  const value = useMemo<PendingReadingsContextValue>(
    () => ({
      snapshot,
      saveReading,
      retry: flush,
      dismiss: (clientReadingId) => {
        queue.dismissRejected(clientReadingId);
      },
    }),
    [snapshot, saveReading, flush, queue],
  );

  return <PendingReadingsContext value={value}>{children}</PendingReadingsContext>;
}
