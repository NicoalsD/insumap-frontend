import { ApiError, apiErrorMessage } from '@/services/api/ApiError';
import type { ReadingCreateDto } from '@/services/dto/clinical';

/** A reading waiting for the network. Held in memory only: no tokens, nothing in web storage. */
export interface PendingReading {
  readonly clientReadingId: string;
  readonly valueMgDl: number;
  readonly body: ReadingCreateDto;
}

export interface RejectedReading {
  readonly clientReadingId: string;
  readonly valueMgDl: number;
  readonly reason: string;
}

export interface QueueSnapshot {
  readonly pending: readonly PendingReading[];
  readonly rejected: readonly RejectedReading[];
}

/** Sends one reading; resolves when the server stored it (or answered it as a duplicate). */
export type SendReading = (body: ReadingCreateDto) => Promise<unknown>;

type Listener = () => void;

/**
 * In-memory queue of glucose readings not yet accepted by the API. A network failure keeps the
 * reading for the next flush; any other answer from the server (out of range, too old) moves it to
 * `rejected` with the Spanish reason, so the patient sees it instead of losing it silently.
 * It never persists: closing the session drops the queue with its provider.
 *
 * Pattern: none (plain class with a listener set, read through `useSyncExternalStore`).
 */
export class PendingReadingsQueue {
  private pending: PendingReading[] = [];
  private rejected: RejectedReading[] = [];
  private listeners = new Set<Listener>();
  private flushing: Promise<void> | null = null;
  /** Cached view: `useSyncExternalStore` needs the same object until something changes. */
  private current: QueueSnapshot = { pending: [], rejected: [] };

  enqueue(reading: PendingReading): void {
    this.pending = [...this.pending, reading];
    this.emit();
  }

  snapshot(): QueueSnapshot {
    return this.current;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dismissRejected(clientReadingId: string): void {
    this.rejected = this.rejected.filter((item) => item.clientReadingId !== clientReadingId);
    this.emit();
  }

  /** Sends pending readings in order. Stops at the first network failure; concurrent calls share one run. */
  flush(send: SendReading): Promise<void> {
    this.flushing ??= this.run(send).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async run(send: SendReading): Promise<void> {
    while (this.pending.length > 0) {
      const [next] = this.pending;
      if (next === undefined) return;
      try {
        await send(next.body);
        this.pending = this.pending.filter((item) => item.clientReadingId !== next.clientReadingId);
        this.emit();
      } catch (error) {
        if (error instanceof ApiError && error.code === 'NETWORK') return;
        this.pending = this.pending.filter((item) => item.clientReadingId !== next.clientReadingId);
        this.rejected = [
          ...this.rejected,
          { clientReadingId: next.clientReadingId, valueMgDl: next.valueMgDl, reason: apiErrorMessage(error) },
        ];
        this.emit();
      }
    }
  }

  private emit(): void {
    this.current = { pending: this.pending, rejected: this.rejected };
    for (const listener of this.listeners) listener();
  }
}
