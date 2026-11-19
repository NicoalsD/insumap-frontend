import { useMemo } from 'react';
import type { InsulinDoseDto } from '@/services/dto/injection';
import { bodyStrings } from '@/i18n/es.body';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { InjectionBodyMap, type InjectionSiteEntry } from '@/ui/body';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/States';
import { formatDateTime } from './format';
import { analyzeInjectionHistory, HISTORY_DAYS, type SiteUsage } from './model/injectionHistory';
import './InjectionPanel.css';
import type { PatientSex } from '@/services/dto/injection';

export interface InjectionPanelProps {
  /** Every dose the patient recorded; the panel keeps the last `HISTORY_DAYS` days. */
  readonly doses: readonly InsulinDoseDto[];
  /** End of the window: the API's period end, so the view does not depend on the browser clock. */
  readonly periodEnd: Date;
  readonly timeZone: string;
  /** The patient's recorded sex and BMI: the 3D body takes their build. */
  readonly sex?: PatientSex | undefined;
  readonly bmi?: number | null | undefined;
}

const NO_OP = () => undefined;
const PERCENT = 100;

/** "Abdomen izq. · 9 dosis en 14 días", with the singular for one dose. */
function siteCountText(usage: SiteUsage): string {
  const site = bodyStrings.siteShort[usage.site];
  return usage.count === 1
    ? format(es.detail.injection.siteCountOne, { site, days: HISTORY_DAYS })
    : format(es.detail.injection.siteCount, { site, count: usage.count, days: HISTORY_DAYS });
}

/**
 * Where the patient has been injecting: the body map in read-only mode (the doctor reads it, the
 * patient chooses nothing here), the count of doses per site as text, the most recent doses and a
 * review aid when one site concentrates too many doses. It shows recorded doses only; no dose is
 * suggested or computed. The review aid is a prompt to look at rotation, not a clinical finding.
 *
 * Pattern: none (presentation over `analyzeInjectionHistory`).
 */
export function InjectionPanel({ doses, periodEnd, timeZone, sex, bmi }: InjectionPanelProps) {
  const history = useMemo(() => analyzeInjectionHistory(doses, periodEnd), [doses, periodEnd]);
  const entries = useMemo<InjectionSiteEntry[]>(
    () =>
      history.sites.map((usage) => ({
        site: usage.site,
        state: usage.recent ? 'RECENT' : 'ALLOWED',
        lastUsedLabel: usage.lastUsedAt ? formatDateTime(usage.lastUsedAt, timeZone) : undefined,
        lastSpot: usage.lastSpot,
      })),
    [history.sites, timeZone],
  );
  const used = history.sites.filter((usage) => usage.count > 0);
  const concentrated = history.concentrated;
  const kindLabel = (kind: InsulinDoseDto['kind']) => es.detail.injection.kind[kind];

  return (
    <section className="panel injection-panel" aria-labelledby="injection-title">
      <header className="panel__header">
        <h2 id="injection-title">{es.detail.injection.title}</h2>
      </header>
      <div className="panel__body injection-panel__body">
        <InjectionBodyMap
          sites={entries}
          selectedSite={null}
          selectedSpot={null}
          onSelect={NO_OP}
          readOnly
          sex={sex}
          bmi={bmi}
          label={es.detail.injection.mapLabel}
        />
        <p className="injection-panel__note">{format(es.detail.injection.windowNote, { days: HISTORY_DAYS })}</p>

        {used.length === 0 ? (
          <p className="injection-panel__empty">{format(es.detail.injection.siteNone, { days: HISTORY_DAYS })}</p>
        ) : (
          <div>
            <h3 className="injection-panel__subtitle">{es.detail.injection.siteTitle}</h3>
            <ul className="injection-panel__sites">
              {used.map((usage) => (
                <li key={usage.site}>{siteCountText(usage)}</li>
              ))}
            </ul>
          </div>
        )}

        {concentrated ? (
          <div className="injection-panel__review" role="note">
            <Badge tone="warning">{es.detail.injection.concentrationTitle}</Badge>
            <p>
              {format(es.detail.injection.concentrationHelp, {
                site: bodyStrings.sites[concentrated.site],
                share: Math.round((concentrated.count / history.withSite) * PERCENT),
                days: HISTORY_DAYS,
              })}
            </p>
          </div>
        ) : null}

        <div>
          <h3 className="injection-panel__subtitle">{es.detail.injection.recentTitle}</h3>
          {history.recentDoses.length === 0 ? (
            <EmptyState title={format(es.detail.injection.recentEmpty, { days: HISTORY_DAYS })} />
          ) : (
            <ol className="injection-panel__recent">
              {history.recentDoses.map((dose) => (
                <li key={dose.id}>
                  {format(es.detail.injection.recentItem, {
                    date: formatDateTime(new Date(dose.administered_at), timeZone),
                    kind: kindLabel(dose.kind),
                    units: dose.units,
                    site: dose.injection_site
                      ? bodyStrings.siteShort[dose.injection_site]
                      : es.detail.injection.recentNoSite,
                  })}
                  {dose.injection_spot !== null
                    ? format(es.detail.injection.recentSpot, { spot: dose.injection_spot })
                    : ''}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
