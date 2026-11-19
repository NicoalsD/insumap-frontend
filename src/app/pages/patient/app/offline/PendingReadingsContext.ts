import { createContext, useContext } from 'react';
import type { QueueSnapshot } from './PendingReadingsQueue';
import type { ReadingCreateDto } from '@/services/dto/clinical';

export type SaveOutcome = 'saved' | 'pending';

export interface PendingReadingsContextValue {
  readonly snapshot: QueueSnapshot;
  /** Stores the reading, or queues it when the network is missing. Other API errors are thrown. */
  readonly saveReading: (body: ReadingCreateDto) => Promise<SaveOutcome>;
  readonly retry: () => Promise<void>;
  readonly dismiss: (clientReadingId: string) => void;
}

export const PendingReadingsContext = createContext<PendingReadingsContextValue | null>(null);

export function usePendingReadings(): PendingReadingsContextValue {
  const value = useContext(PendingReadingsContext);
  if (!value) throw new Error('usePendingReadings must be used inside <PendingReadingsProvider>');
  return value;
}
