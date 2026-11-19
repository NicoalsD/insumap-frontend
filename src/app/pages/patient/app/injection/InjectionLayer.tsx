import { useMemo, useState } from 'react';
import { es } from '@/i18n/es';
import { InjectionBodyMap, type BodyView, type SiteCode } from '@/ui/body';
import type { InjectionSitesDto, InsulinKind } from '@/services/dto/injection';
import { ErrorState, LoadingState } from '@/ui';
import { useInjectionSites } from './injectionQueries';
import { needleText, reasonTexts, sitesToEntries, todayText } from './injectionModel';
import { useNow } from '../useNow';
import './Injection.css';
import { useOwnBody } from './useOwnBody';

/** The kinds the home layer offers: the two the patient uses every day. */
const HOME_KINDS = ['BOLUS', 'BASAL'] as const satisfies readonly InsulinKind[];

/**
 * Home layer "Dónde inyectarte": where to inject today for the chosen kind, shown on the body map
 * with the reasons in plain language. Read-only except for choosing a site; no units, ever.
 *
 * Pattern: none (a layer over `InjectionBodyMap`, the strategy-free view of the API suggestion).
 */
export function InjectionLayer() {
  const [kind, setKind] = useState<(typeof HOME_KINDS)[number]>('BOLUS');
  return (
    <section className="patient-layer injection-layer" aria-labelledby="layer-injection">
      <h2 id="layer-injection" className="patient-layer__title">{es.patient.injection.title}</h2>
      <p className="patient-layer__body">{es.patient.injection.description}</p>
      <fieldset className="injection-layer__kinds">
        <legend className="visually-hidden">{es.patient.injection.kindLegend}</legend>
        {HOME_KINDS.map((option) => (
          <label key={option} className="injection-layer__kind" data-selected={option === kind || undefined}>
            <input
              type="radio"
              name="injection-kind"
              value={option}
              checked={option === kind}
              onChange={() => {
                setKind(option);
              }}
            />
            {es.patient.injection.kinds[option]}
          </label>
        ))}
      </fieldset>
      <InjectionForKind key={kind} kind={kind} />
    </section>
  );
}

/** Keyed by kind, so a change of kind starts from that kind's suggestion. */
function InjectionForKind({ kind }: { readonly kind: InsulinKind }) {
  const query = useInjectionSites(kind);
  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => { void query.refetch(); }} />;
  }
  return <InjectionSuggestion data={query.data} />;
}

function InjectionSuggestion({ data }: { readonly data: InjectionSitesDto }) {
  const now = useNow();
  const body = useOwnBody();
  const entries = useMemo(() => sitesToEntries(data, now), [data, now]);
  const suggestion = data.suggestion;
  const [choice, setChoice] = useState<{ site: SiteCode; spot: number } | null>(null);
  const [view, setView] = useState<BodyView>('front');
  const shown = choice ?? (suggestion ? { site: suggestion.site, spot: suggestion.spot } : null);
  const chosenOther = choice !== null && suggestion !== null && (choice.site !== suggestion.site || choice.spot !== suggestion.spot);

  if (suggestion === null) {
    return (
      <>
        <p role="status" className="injection-layer__none">{es.patient.injection.noSuggestion}</p>
        <InjectionBodyMap
          sex={body.sex}
          bmi={body.bmi}
          sites={entries}
          selectedSite={null}
          selectedSpot={null}
          onSelect={() => undefined}
          view={view}
          onViewChange={setView}
          label={es.patient.injection.mapLabel}
        />
      </>
    );
  }

  return (
    <div className="injection-layer__body">
      <p className="injection-layer__today" role="status" aria-live="polite">
        {shown ? todayText(shown.site, shown.spot) : null}
      </p>
      <ul className="injection-layer__reasons">
        {reasonTexts(suggestion.reason_codes).map((text) => (
          <li key={text}>{text}</li>
        ))}
        <li>{needleText(suggestion.needle_note)}</li>
      </ul>
      {chosenOther ? <p className="patient-layer__body">{es.patient.injection.chooseOther}</p> : null}
      <InjectionBodyMap
          sex={body.sex}
          bmi={body.bmi}
        sites={entries}
        selectedSite={shown?.site ?? null}
        selectedSpot={shown?.spot ?? null}
        onSelect={(site, spot) => {
          setChoice({ site, spot });
        }}
        view={view}
        onViewChange={setView}
        label={es.patient.injection.mapLabel}
      />
    </div>
  );
}
