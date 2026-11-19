import { createContext, useContext } from 'react';
import type { QueueSnapshot } from './PendingReadingsQueue';
import type { ReadingCreateDto } from '@/services/dto/clinical';
import type { InsulinDoseCreateDto } from '@/services/dto/injection';
import type { PendingSnapshot } from './PendingQueue';

export type SaveOutcome = 'saved' | 'pending';

export interface PendingReadingsContextValue {
  readonly snapshot: QueueSnapshot;
  /** Stores the reading, or queues it when the network is missing. Other API errors are thrown. */
  readonly saveReading: (body: ReadingCreateDto) => Promise<SaveOutcome>;
  readonly retry: () => Promise<void>;
  readonly dismiss: (clientReadingId: string) => void;
  /** Insulin doses waiting for the network, same rules as readings. */
  readonly doses: PendingSnapshot<InsulinDoseCreateDto>;
  readonly saveDose: (body: InsulinDoseCreateDto, label: string) => Promise<SaveOutcome>;
  readonly dismissDose: (clientId: string) => void;
}

export const PendingReadingsContext = createContext<PendingReadingsContextValue | null>(null);

export function usePendingReadings(): PendingReadingsContextValue {
  const value = useContext(PendingReadingsContext);
  if (!value) throw new Error('usePendingReadings must be used inside <PendingReadingsProvider>');
  return value;
}
