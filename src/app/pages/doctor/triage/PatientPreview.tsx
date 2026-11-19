import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { MetricsViewModelAdapter, type MetricsViewModel } from '@/services/adapters/MetricsViewModelAdapter';
import type { MetricsWindow } from '@/services/dto/common';
import { Badge } from '@/ui/Badge';
import { ButtonLink } from '@/ui/ButtonLink';
import { RangeBand } from '@/ui/glucose/RangeBand';
import { RangeRuler } from '@/ui/glucose/RangeRuler';
import { ErrorState, LoadingState } from '@/ui/States';
import { useApi } from '@/state/useApi';
import { AgpBand } from './AgpBand';
import { formatElapsed } from './formatting';
import { riskBadgeTone, type TriageItem } from './triageModel';
import './PatientPreview.css';

const metricsAdapter = new MetricsViewModelAdapter();

export interface PatientPreviewProps {
  /** The selected row, or `null` when the list is empty. */
  readonly item: TriageItem | null;
  readonly window: MetricsWindow;
  readonly now: Date;
}

/**
 * Bottom panel for the selected patient: header with risk and the link to the record, then three
 * columns (last reading and the figures, the window's time in ranges, the 24-hour profile). Only the
 * API's metrics and profile are shown; the AI proposal appears as a count with its label.
 */
export function PatientPreview({ item, window, now }: PatientPreviewProps) {
  const { api } = useApi();
  const patientId = item?.patientId ?? null;

  const metricsQuery = useQuery({
    queryKey: ['patients', patientId, 'metrics', window],
    enabled: patientId !== null,
    queryFn: async () => metricsAdapter.adapt(await api.getPatientMetrics(patientId ?? '', window)),
  });
  const agpQuery = useQuery({
    queryKey: ['patients', patientId, 'agp'],
    enabled: patientId !== null,
    queryFn: () => api.getPatientAgp(patientId ?? ''),
  });

  const agpInput = useMemo(() => {
    if (!agpQuery.data) return null;
    return {
      bins: agpQuery.data.bins,
      targetLowMgDl: agpQuery.data.target_range.low,
      targetHighMgDl: agpQuery.data.target_range.high,
      isSufficient: agpQuery.data.is_sufficient,
    };
  }, [agpQuery.data]);

  if (!item) {
    return <p className="triage-preview__empty">{es.doctor.triage.previewEmpty}</p>;
  }

  return (
    <article className="triage-preview" aria-labelledby="triage-preview-title">
      <header className="triage-preview__header">
        <div className="triage-preview__identity">
          <h2 id="triage-preview-title" className="triage-preview__name" title={item.fullName}>
            {item.fullName}
          </h2>
          <Badge tone={riskBadgeTone(item.riskTier)}>{es.risk[item.riskTier]}</Badge>
          {item.pendingRecommendationsCount > 0 ? (
            <Badge tone="info">
              {es.notices.aiSuggestion}: {String(item.pendingRecommendationsCount)}
            </Badge>
          ) : null}
        </div>
        <ButtonLink to={`/doctor/patients/${item.patientId}`} variant="secondary" icon={<ArrowRight size="1em" aria-hidden="true" />}>
          {es.doctor.triage.previewOpenRecord}
        </ButtonLink>
      </header>

      <div className="triage-preview__grid">
        <section className="triage-preview__col" aria-label={es.doctor.triage.previewLastReading}>
          {item.lastReading ? (
            <>
              <RangeRuler valueMgDl={item.lastReading.valueMgDl} thresholds={item.metrics.profile.thresholds} size="compact" showTarget={false} />
              <p className="triage-preview__time">
                {es.doctor.triage.previewLastReading}: {formatElapsed(item.lastReading.measuredAt, now)}
              </p>
            </>
          ) : (
            <p className="triage-preview__time">{es.doctor.triage.noReading}</p>
          )}
          {metricsQuery.isPending ? (
            <LoadingState label={es.doctor.triage.previewLoading} />
          ) : metricsQuery.isError ? (
            <ErrorState error={metricsQuery.error} title={es.doctor.triage.previewFailed} onRetry={() => void metricsQuery.refetch()} />
          ) : (
            <PreviewFigures metrics={metricsQuery.data} />
          )}
        </section>

        <section className="triage-preview__col" aria-label={es.glucose.timeInRanges}>
          {metricsQuery.data ? (
            <RangeBand timeInRanges={metricsQuery.data.timeInRanges} thresholds={metricsQuery.data.profile.thresholds} />
          ) : null}
        </section>

        <section className="triage-preview__col" aria-label={es.doctor.agp.title}>
          {agpQuery.isError ? (
            <ErrorState error={agpQuery.error} title={es.doctor.triage.previewFailed} onRetry={() => void agpQuery.refetch()} />
          ) : agpInput ? (
            <AgpBand {...agpInput} />
          ) : agpQuery.isPending ? (
            <LoadingState label={es.doctor.triage.previewLoading} />
          ) : null}
        </section>
      </div>
    </article>
  );
}

function PreviewFigures({ metrics }: { readonly metrics: MetricsViewModel }) {
  const percent = (value: number | null) => (value === null ? es.doctor.triage.noValue : format(es.glucose.percent, { value }));
  const sufficient = metrics.timeInRanges.isSufficient;
  const figures: readonly { readonly label: string; readonly value: string }[] = [
    ...(sufficient
      ? [
          { label: es.doctor.triage.previewTir, value: percent(metrics.tirPct) },
          { label: es.doctor.triage.previewTbr, value: percent(metrics.tbrPct) },
          { label: es.doctor.triage.previewTar, value: percent(metrics.tarPct) },
        ]
      : []),
    { label: es.doctor.triage.previewGmi, value: percent(metrics.gmiPct) },
    { label: es.doctor.triage.previewCv, value: percent(metrics.cvPct) },
    { label: es.doctor.triage.previewMean, value: format(es.glucose.value, { value: Math.round(metrics.meanGlucoseMgDl) }) },
  ];
  return (
    <dl className="triage-preview__stats">
      {figures.map((figure) => (
        <div key={figure.label}>
          <dt>{figure.label}</dt>
          <dd className="measure">{figure.value}</dd>
        </div>
      ))}
    </dl>
  );
}
