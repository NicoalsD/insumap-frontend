import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { InjectionBodyMap, SITE_CODES, type InjectionSiteEntry, type SiteCode } from '@/ui/body';
import type { InsulinKind } from '@/services/dto/injection';

/**
 * Sites the doctor allowed for one plan item, in text, plus a read-only body map with those sites
 * highlighted. `null` means any rotation zone (BRIEF-injection: the plan restricts nothing).
 */
export function PlanSites({
  kind,
  sites,
}: {
  readonly kind: InsulinKind;
  readonly sites: readonly SiteCode[] | null;
}) {
  if (sites === null) {
    return <p className="plan-meta">{es.patient.injection.plan.any}</p>;
  }
  const names = sites.map((site) => es.patient.injection.siteNames[site]).join(', ');
  const entries: InjectionSiteEntry[] = SITE_CODES.filter((site) => sites.includes(site)).map((site) => ({
    site,
    state: 'ALLOWED',
  }));
  return (
    <div className="plan-sites">
      <p>{format(es.patient.injection.plan.allowed, { sites: names })}</p>
      <p className="plan-meta">{es.patient.injection.plan.readOnly}</p>
      <InjectionBodyMap
        sites={entries}
        selectedSite={null}
        selectedSpot={null}
        onSelect={() => undefined}
        label={`${es.patient.injection.plan.mapTitle}: ${es.patient.injection.kinds[kind]}`}
      />
    </div>
  );
}
