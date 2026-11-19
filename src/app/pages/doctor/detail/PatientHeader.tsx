import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { rangeTone } from '@/ui/rangeTone';
import type { ReadingViewModel } from '@/services/adapters/ReadingViewModelAdapter';
import type { RiskTier } from './types';
import { formatClockTime, formatDateTime } from './format';
import { NOTE_FIELD_ID } from './constants';

export interface PatientHeaderProps {
  readonly fullName: string;
  readonly profileLabel: string;
  readonly source: ReadingViewModel['source'] | null;
  readonly lastReading: Pick<ReadingViewModel, 'valueMgDl' | 'measuredAt' | 'state'> | null;
  readonly risk: RiskTier | null;
  readonly timeZone: string;
  readonly pendingSuggestions: number;
  readonly openAlerts: number;
}

const SOURCE_LABEL: Record<ReadingViewModel['source'], string> = {
  CGM: es.detail.header.sourceCgm,
  SMBG: es.detail.header.sourceSmbg,
  MANUAL: es.detail.header.sourceManual,
};

/**
 * Sticky header of the record: who the patient is, which goals apply, where the data comes from,
 * the latest reading with its hour, the risk tier and the one action that writes here (a note).
 * The note action moves focus to the note field of the right rail.
 */
export function PatientHeader(props: PatientHeaderProps) {
  const { fullName, profileLabel, source, lastReading, risk, timeZone, pendingSuggestions, openAlerts } = props;
  const writeNote = () => {
    const field = document.getElementById(NOTE_FIELD_ID);
    field?.focus();
    field?.scrollIntoView({ block: 'center' });
  };

  return (
    <header className="detail-header">
      <div className="detail-header__identity">
        <h1>{fullName}</h1>
        <p className="detail-header__profile">{format(es.detail.header.profile, { profile: profileLabel })}</p>
      </div>
      <dl className="detail-header__facts">
        <div>
          <dt>{es.detail.header.source}</dt>
          <dd>{source ? SOURCE_LABEL[source] : es.detail.header.sourceNone}</dd>
        </div>
        <div>
          <dt>{es.detail.header.lastReading}</dt>
          <dd>
            {lastReading ? (
              <>
                <Badge tone={rangeTone(lastReading.state)}>
                  {format(es.detail.header.lastReadingValue, {
                    value: lastReading.valueMgDl,
                    time: formatDateTime(lastReading.measuredAt, timeZone),
                  })}
                </Badge>
                <span className="detail-header__clock">{formatClockTime(lastReading.measuredAt, timeZone)}</span>
              </>
            ) : (
              es.detail.header.noReading
            )}
          </dd>
        </div>
        <div>
          <dt>{es.detail.header.risk}</dt>
          <dd>{risk ? es.risk[risk] : es.detail.header.riskUnknown}</dd>
        </div>
      </dl>
      <div className="detail-header__actions">
        {pendingSuggestions > 0 ? (
          <Badge tone="info">{format(es.detail.header.aiPending, { count: pendingSuggestions })}</Badge>
        ) : null}
        {openAlerts > 0 ? (
          <Badge tone="critical">{format(es.detail.header.openAlerts, { count: openAlerts })}</Badge>
        ) : null}
        <Button variant="secondary" onClick={writeNote}>
          {es.detail.header.writeNote}
        </Button>
      </div>
    </header>
  );
}
