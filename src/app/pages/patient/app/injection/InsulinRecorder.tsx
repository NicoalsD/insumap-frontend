import { useId, useState, type SyntheticEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { InjectionBodyMap, type SiteCode } from '@/ui/body';
import type { FieldLimitsDto } from '@/services/dto/meta';
import type { InjectionSitesDto } from '@/services/dto/injection';
import { Button } from '@/ui';
import { usePendingReadings } from '../offline/PendingReadingsContext';
import { buildDoseBody, parseUnits, RECORDABLE_KINDS, sitesToEntries, type RecordableKind } from './injectionModel';
import { injectionKeys, useInjectionSites } from './injectionQueries';
import { useNow } from '../useNow';
import './Injection.css';

const FIRST_STEP = 1;
const UNITS_STEP = 2;
const SITE_STEP = 3;
const STEPS = SITE_STEP;
/** Units limit the API publishes, if any; read from the field limits, never a literal. */
const DOSE_MAX_KEY = 'insulin_dose_max_units';

type Phase = 'form' | 'saved';

export interface InsulinRecorderProps {
  readonly limits: FieldLimitsDto;
}

/**
 * Three-step inline wizard to register an insulin dose: the kind, the units the patient typed (the
 * app never suggests units) and the site and spot on the body map, preselected from the suggestion.
 * Saving refreshes the rotation, so the result shows the next suggestion.
 *
 * Pattern: none (a stepped form; its rules live in `injectionModel.ts`).
 */
export function InsulinRecorder({ limits }: InsulinRecorderProps) {
  const queryClient = useQueryClient();
  const { saveDose } = usePendingReadings();
  const now = useNow();
  const idBase = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(FIRST_STEP);
  const [kind, setKind] = useState<RecordableKind | null>(null);
  const [unitsText, setUnitsText] = useState('');
  const [choice, setChoice] = useState<{ site: SiteCode; spot: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ phase: Phase; message: string; next: string | null } | null>(null);
  const sites = useInjectionSites(kind ?? 'BOLUS');

  const reset = () => {
    setStep(FIRST_STEP);
    setKind(null);
    setUnitsText('');
    setChoice(null);
    setError(null);
    setResult(null);
  };
  const close = () => {
    setOpen(false);
    reset();
  };

  if (!open) {
    return (
      <Button size="lg" variant="secondary" onClick={() => { setOpen(true); }}>
        {es.patient.injection.record.open}
      </Button>
    );
  }

  if (result !== null) {
    return (
      <section className="injection-recorder" aria-labelledby={`${idBase}-title`}>
        <h2 id={`${idBase}-title`} className="injection-recorder__title">{es.patient.injection.record.title}</h2>
        <p role="status" className="injection-recorder__result">{result.message}</p>
        {result.next !== null ? <p>{result.next}</p> : null}
        <div className="injection-recorder__actions">
          <Button size="lg" variant="secondary" onClick={reset}>{es.patient.injection.record.again}</Button>
          <Button size="lg" variant="ghost" onClick={close}>{es.patient.injection.record.close}</Button>
        </div>
      </section>
    );
  }

  const checkStep = (current: number): string | null => {
    if (current === FIRST_STEP) return kind === null ? es.patient.injection.record.kindLegend : null;
    if (current === UNITS_STEP) {
      const units = parseUnits(unitsText);
      if (unitsText.trim() === '') return es.patient.injection.record.units.required;
      if (units === null) return es.patient.injection.record.units.invalid;
      const max = limits[DOSE_MAX_KEY];
      if (max !== undefined && units > max) return format(es.patient.injection.record.units.max, { max });
      return null;
    }
    return null;
  };

  const next = () => {
    const found = checkStep(step);
    setError(found);
    if (found === null) setStep(step + 1);
  };

  const save = async (event: SyntheticEvent) => {
    event.preventDefault();
    const units = parseUnits(unitsText);
    if (kind === null || units === null || shown === null) {
      setError(es.patient.injection.record.site.required);
      return;
    }
    setBusy(true);
    const body = buildDoseBody({
      kind,
      units,
      administeredAt: new Date(now.getTime()).toISOString(),
      site: shown.site,
      spot: shown.spot,
    });
    const where = format(es.patient.injection.record.result.saved, {
      site: es.patient.injection.siteNames[shown.site],
      spot: shown.spot,
    });
    try {
      const outcome = await saveDose(body, `${String(units)} u`);
      if (outcome === 'pending') {
        setResult({
          phase: 'saved',
          message: format(es.patient.injection.record.result.pending, {
            units: String(units),
            site: es.patient.injection.siteNames[shown.site],
            spot: shown.spot,
          }),
          next: null,
        });
      } else {
        // The rotation changed: refetch the active site query, then read the fresh suggestion.
        await queryClient.invalidateQueries({ queryKey: injectionKeys.sites(kind) });
        const fresh = queryClient.getQueryData<InjectionSitesDto>(injectionKeys.sites(kind));
        setResult({ phase: 'saved', message: where, next: fresh ? nextText(fresh) : null });
      }
    } catch {
      setError(es.patient.injection.record.result.failed);
    } finally {
      setBusy(false);
    }
  };

  const data = sites.data;
  const suggestion = data?.suggestion ?? null;
  const shown = choice ?? (suggestion ? { site: suggestion.site, spot: suggestion.spot } : null);
  const entries = data ? sitesToEntries(data, now) : [];

  return (
    <section className="injection-recorder" aria-labelledby={`${idBase}-title`}>
      <div className="injection-recorder__head">
        <h2 id={`${idBase}-title`} className="injection-recorder__title">{es.patient.injection.record.title}</h2>
        <p className="injection-recorder__step">{format(es.patient.injection.record.stepOf, { step, total: STEPS })}</p>
      </div>

      <form className="injection-recorder__form" noValidate onSubmit={(event) => { void save(event); }}>
        {step === FIRST_STEP ? (
          <fieldset className="injection-recorder__field">
            <legend className="injection-recorder__label">{es.patient.injection.record.kindLegend}</legend>
            {RECORDABLE_KINDS.map((option) => (
              <label key={option} className="injection-recorder__choice">
                <input type="radio" name={`${idBase}-kind`} value={option} checked={kind === option} onChange={() => { setKind(option); setChoice(null); }} />
                {es.patient.injection.kinds[option]}
              </label>
            ))}
          </fieldset>
        ) : null}

        {step === UNITS_STEP ? (
          <div className="injection-recorder__field">
            <label htmlFor={`${idBase}-units`} className="injection-recorder__label">{es.patient.injection.record.units.label}</label>
            <p className="injection-recorder__hint">{es.patient.injection.record.units.hint}</p>
            <input
              id={`${idBase}-units`}
              className="injection-recorder__input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              name="units"
              value={unitsText}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${idBase}-units-error` : undefined}
              onChange={(event) => { setUnitsText(event.target.value); }}
            />
          </div>
        ) : null}

        {step === SITE_STEP ? (
          <div className="injection-recorder__field">
            <p className="injection-recorder__label" id={`${idBase}-site`}>{es.patient.injection.record.site.legend}</p>
            {suggestion ? <p className="injection-recorder__hint">{es.patient.injection.record.site.suggested}</p> : null}
            {sites.isPending ? <p>{es.patient.injection.record.saving}</p> : null}
            {data ? (
              <InjectionBodyMap
                sites={entries}
                selectedSite={shown?.site ?? null}
                selectedSpot={shown?.spot ?? null}
                onSelect={(site, spot) => { setChoice({ site, spot }); }}
                label={es.patient.injection.mapLabel}
              />
            ) : null}
          </div>
        ) : null}

        {error ? <p id={`${idBase}-units-error`} role="alert" className="injection-recorder__error">{error}</p> : null}

        <div className="injection-recorder__actions">
          {step > FIRST_STEP ? (
            <Button size="lg" variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>{es.patient.injection.record.back}</Button>
          ) : null}
          {step < STEPS ? (
            <Button size="lg" onClick={next}>{es.patient.injection.record.next}</Button>
          ) : (
            <Button type="submit" size="lg" loading={busy} disabled={shown === null}>
              {busy ? es.patient.injection.record.saving : es.patient.injection.record.save}
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={close}>{es.patient.injection.record.close}</Button>
        </div>
      </form>
    </section>
  );
}

function nextText(data: InjectionSitesDto): string {
  const suggestion = data.suggestion;
  if (suggestion === null) return es.patient.injection.record.result.nextNone;
  return format(es.patient.injection.record.result.next, {
    site: es.patient.injection.siteNames[suggestion.site],
    spot: suggestion.spot,
  });
}
