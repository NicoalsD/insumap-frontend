import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Button } from '@/ui';
import { usePendingReadings } from './PendingReadingsContext';
import './PendingNotice.css';

/** Shows readings waiting for the network and the ones the server refused, with retry and dismiss. */
export function PendingNotice() {
  const { snapshot, retry, dismiss } = usePendingReadings();
  const { pending, rejected } = snapshot;
  if (pending.length === 0 && rejected.length === 0) return null;
  return (
    <section className="pending-notice" aria-labelledby="pending-notice-title">
      {pending.length > 0 ? (
        <div className="pending-notice__block">
          <h2 id="pending-notice-title" className="pending-notice__title">{es.patient.offline.pendingTitle}</h2>
          <p>
            {format(pending.length === 1 ? es.patient.offline.pendingBody : es.patient.offline.pendingBodyMany, {
              count: pending.length,
            })}
          </p>
          <ul className="pending-notice__list">
            {pending.map((item) => (
              <li key={item.clientReadingId}>{format(es.patient.record.result.pending, { value: item.valueMgDl })}</li>
            ))}
          </ul>
          <Button size="lg" variant="secondary" onClick={() => { void retry(); }}>
            {es.patient.offline.retry}
          </Button>
        </div>
      ) : null}
      {rejected.map((item) => (
        <div key={item.clientReadingId} className="pending-notice__block" role="alert">
          <p>{format(es.patient.offline.rejected, { reason: item.reason })}</p>
          <Button size="lg" variant="ghost" onClick={() => { dismiss(item.clientReadingId); }}>
            {es.patient.offline.dismiss}
          </Button>
        </div>
      ))}
    </section>
  );
}
