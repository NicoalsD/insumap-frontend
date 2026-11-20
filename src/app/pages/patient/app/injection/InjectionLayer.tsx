import { Clock, X } from 'lucide-react';
import { es } from '@/i18n/es';
import { InjectionBodyMap, type InjectionState } from '@/ui/body';
import { ErrorState, LoadingState } from '@/ui';
import { needleText, reasonTexts, todayText } from './injectionModel';
import './Injection.css';
import { useOwnBody } from './useOwnBody';
import { HOME_KINDS, type InjectionHome } from './useInjectionHome';

/** The marks on the body, in the order the legend explains them. */
const LEGEND_STATES = ['SUGGESTED', 'ALLOWED', 'RECENT', 'AVOID'] as const satisfies readonly InjectionState[];

/**
 * The body in the middle of the home: the only control of the site. Read-only when the API found no
 * safe site, so nothing can be picked; the inspector says why.
 *
 * Pattern: none (a stage over `InjectionBodyMap`, the strategy-free view of the API suggestion).
 */
export function InjectionStage({ home }: { readonly home: InjectionHome }) {
  const body = useOwnBody();
  const { query } = home;
  if (query.isPending) {
    return (
      <div className="injection-stage injection-stage--waiting">
        <LoadingState />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="injection-stage injection-stage--waiting">
        <ErrorState
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      </div>
    );
  }
  const noSuggestion = query.data.suggestion === null;
  return (
    <div className="injection-stage">
      <InjectionBodyMap
        fill
        sex={body.sex}
        bmi={body.bmi}
        sites={home.entries}
        selectedSite={home.shown?.site ?? null}
        selectedSpot={home.shown?.spot ?? null}
        onSelect={home.choose}
        readOnly={noSuggestion}
        view={home.view}
        onViewChange={home.setView}
        label={es.patient.injection.mapLabel}
      />
    </div>
  );
}

/**
 * Inspector "Dónde inyectarte": the kind, today's site in plain words, the reasons and what each
 * mark on the body means. Never units.
 */
export function InjectionInspector({ home }: { readonly home: InjectionHome }) {
  const { kind, setKind, query, shown, chosenOther } = home;
  const suggestion = query.data?.suggestion ?? null;
  return (
    <section className="patient-layer injection-layer" aria-labelledby="layer-injection">
      <h2 id="layer-injection" className="patient-layer__title">
        {es.patient.injection.title}
      </h2>
      <p className="patient-layer__body">{es.patient.injection.description}</p>
      <fieldset className="injection-layer__kinds">
        <legend className="visually-hidden">{es.patient.injection.kindLegend}</legend>
        {HOME_KINDS.map((option) => (
          <label
            key={option}
            className="injection-layer__kind"
            data-selected={option === kind || undefined}
          >
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

      {query.data === undefined ? null : suggestion === null ? (
        <p role="status" className="injection-layer__none">
          {es.patient.injection.noSuggestion}
        </p>
      ) : (
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
          {chosenOther ? (
            <p className="injection-layer__other">
              <span>{es.patient.injection.chooseOther}</span>
              <button type="button" className="injection-layer__back" onClick={home.backToSuggestion}>
                {es.patient.injection.backToSuggestion}
              </button>
            </p>
          ) : null}
        </div>
      )}

      <div className="injection-legend">
        <h3 className="injection-legend__title">{es.patient.injection.legendTitle}</h3>
        <ul className="injection-legend__list">
          {LEGEND_STATES.map((state) => (
            <li key={state} className="injection-legend__item">
              <span className="injection-legend__mark" data-state={state} aria-hidden="true">
                {state === 'RECENT' ? <Clock /> : state === 'AVOID' ? <X /> : null}
              </span>
              {es.patient.injection.legend[state]}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
