import { describe, expect, it } from 'vitest';
import { ApiError } from '@/services/api/ApiError';
import type { ReadingCreateDto } from '@/services/dto/clinical';
import { PendingReadingsQueue } from './PendingReadingsQueue';

const body = (id: string, value: number): ReadingCreateDto => ({
  client_reading_id: id,
  value_mg_dl: value,
  measured_at: '2026-11-19T12:00:00.000Z',
  source: 'MANUAL',
  context: 'FASTING',
});

describe('PendingReadingsQueue', () => {
  it('sends queued readings in order and empties the queue when the network answers', async () => {
    const queue = new PendingReadingsQueue();
    queue.enqueue({ clientReadingId: 'a', valueMgDl: 120, body: body('a', 120) });
    queue.enqueue({ clientReadingId: 'b', valueMgDl: 140, body: body('b', 140) });
    const sent: string[] = [];
    await queue.flush((item) => {
      sent.push(item.client_reading_id);
      return Promise.resolve();
    });
    expect(sent).toEqual(['a', 'b']);
    expect(queue.snapshot().pending).toEqual([]);
  });

  it('keeps readings while the network is down and sends them on the next flush', async () => {
    const queue = new PendingReadingsQueue();
    queue.enqueue({ clientReadingId: 'a', valueMgDl: 120, body: body('a', 120) });
    await queue.flush(() => Promise.reject(new ApiError(0, 'NETWORK')));
    expect(queue.snapshot().pending).toHaveLength(1);
    await queue.flush(() => Promise.resolve());
    expect(queue.snapshot().pending).toHaveLength(0);
  });

  it('moves a reading the server refuses to rejected, with the Spanish reason, and can dismiss it', async () => {
    const queue = new PendingReadingsQueue();
    queue.enqueue({ clientReadingId: 'a', valueMgDl: 999, body: body('a', 999) });
    await queue.flush(() => Promise.reject(new ApiError(422, 'GLUCOSE_OUT_OF_RANGE')));
    const { pending, rejected } = queue.snapshot();
    expect(pending).toHaveLength(0);
    expect(rejected).toEqual([
      expect.objectContaining({ clientReadingId: 'a', reason: 'La glucosa está fuera del rango medible.' }),
    ]);
    queue.dismissRejected('a');
    expect(queue.snapshot().rejected).toHaveLength(0);
  });

  it('returns the same snapshot object until something changes', () => {
    const queue = new PendingReadingsQueue();
    const first = queue.snapshot();
    expect(queue.snapshot()).toBe(first);
    queue.enqueue({ clientReadingId: 'a', valueMgDl: 120, body: body('a', 120) });
    expect(queue.snapshot()).not.toBe(first);
  });

  it('shares one run between concurrent flushes', async () => {
    const queue = new PendingReadingsQueue();
    queue.enqueue({ clientReadingId: 'a', valueMgDl: 120, body: body('a', 120) });
    let calls = 0;
    const send = () => {
      calls += 1;
      return Promise.resolve();
    };
    await Promise.all([queue.flush(send), queue.flush(send)]);
    expect(calls).toBe(1);
  });
});
