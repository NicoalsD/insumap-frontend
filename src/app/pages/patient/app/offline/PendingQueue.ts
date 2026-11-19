import { ApiError, apiErrorMessage } from '@/services/api/ApiError';

/** One item waiting for the network. In memory only: no tokens, nothing in web storage. */
export interface PendingItem<TBody> {
  readonly clientId: string;
  /** Short text for the screen, already in Spanish (for example "2 unidades en abdomen izquierdo"). */
  readonly label: string;
  readonly body: TBody;
}

export interface PendingRejected {
  readonly clientId: string;
  readonly label: string;
  readonly reason: string;
}

export interface PendingSnapshot<TBody> {
  readonly pending: readonly PendingItem<TBody>[];
  readonly rejected: readonly PendingRejected[];
}

/**
 * Generic offline queue: a network failure keeps the item for the next flush; any other answer from
 * the server moves it to `rejected` with the Spanish reason. Sent in order, one run at a time.
 *
 * Pattern: none (plain class read through `useSyncExternalStore`, like `PendingReadingsQueue`).
 */
export class PendingQueue<TBody> {
  private pending: PendingItem<TBody>[] = [];
  private rejected: PendingRejected[] = [];
  private current: PendingSnapshot<TBody> = { pending: [], rejected: [] };
  private listeners = new Set<() => void>();
  private flushing: Promise<void> | null = null;

  enqueue(item: PendingItem<TBody>): void {
    this.pending = [...this.pending, item];
    this.emit();
  }

  snapshot(): PendingSnapshot<TBody> {
    return this.current;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dismissRejected(clientId: string): void {
    this.rejected = this.rejected.filter((item) => item.clientId !== clientId);
    this.emit();
  }

  flush(send: (body: TBody) => Promise<unknown>): Promise<void> {
    this.flushing ??= this.run(send).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async run(send: (body: TBody) => Promise<unknown>): Promise<void> {
    while (this.pending.length > 0) {
      const next = this.pending[0];
      if (next === undefined) return;
      try {
        await send(next.body);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'NETWORK') return;
        this.rejected = [...this.rejected, { clientId: next.clientId, label: next.label, reason: apiErrorMessage(error) }];
      }
      this.pending = this.pending.filter((item) => item.clientId !== next.clientId);
      this.emit();
    }
  }

  private emit(): void {
    this.current = { pending: this.pending, rejected: this.rejected };
    for (const listener of this.listeners) listener();
  }
}
