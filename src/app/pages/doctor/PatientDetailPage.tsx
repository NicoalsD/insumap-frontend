import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { PERMISSIONS } from '@/core/auth/permissions';
import { useSession } from '@/state/useSession';
import { es } from '@/i18n/es';
import { MetricsViewModelAdapter, windowToDays } from '@/services/adapters/MetricsViewModelAdapter';
import { ReadingViewModelAdapter, type ReadingViewModel } from '@/services/adapters/ReadingViewModelAdapter';
import { TargetProfileViewModelAdapter } from '@/services/adapters/TargetProfileViewModelAdapter';
import type { MetricsWindow } from '@/services/dto/common';
import { PageHeader } from '@/ui/PageHeader';
import { ErrorState, LoadingState } from '@/ui/States';
import { InjectionPanel } from './detail/InjectionPanel';
import { AgpChart } from './detail/charts/AgpChart';
import { AiSuggestionPanel } from './detail/AiSuggestionPanel';
import { MessagesPanel, NotesPanel, PlanPanel } from './detail/CarePanels';
import { DEFAULT_WINDOW, MAIN_SPAN, RAIL_SPAN, WINDOW_OPTIONS } from './detail/constants';
import { MetricsRow } from './detail/MetricsRow';
import { OpenAlertsPanel } from './detail/OpenAlertsPanel';
import { PatientHeader } from './detail/PatientHeader';
import { PatternsPanel } from './detail/PatternsPanel';
import { SurfaceSection } from './detail/SurfaceSection';
import { Timeline } from './detail/Timeline';
import { detectPatterns, type PatternRules } from './detail/model/patterns';
import { readingsInWindow } from './detail/model/readings';
import { buildSurfaceGrid } from './detail/model/surface';
import {
  usePatientAgp,
  usePatientAlerts,
  usePatientInsulinDoses,
  usePatientMessages,
  usePatientMetrics,
  usePatientNotes,
  usePatientOverview,
  usePatientReadings,
  usePatientRecommendations,
  usePatientRiskTier,
} from './detail/queries';
import type { RiskTier } from './detail/types';
import './detail/PatientDetail.css';

const profileAdapter = new TargetProfileViewModelAdapter();
const metricsAdapter = new MetricsViewModelAdapter(profileAdapter);

/** Window from the URL (`?window=14d`). Anything else falls back to the default: the URL is never trusted. */
function windowFrom(raw: string | null): MetricsWindow {
  return WINDOW_OPTIONS.find((option) => option === raw) ?? DEFAULT_WINDOW;
}

const span = (value: number) => ({ '--span': value, '--span-md': MAIN_SPAN }) as CSSProperties;

/**
 * Patient record for the doctor (patron F). The header with goals, source and latest reading sticks
 * to the top; the main column (8 of 12) holds the window metrics, the 24-hour profile, the 3D
 * surface, the detected patterns and the timeline; the right rail (4 of 12) holds the AI suggestions,
 * open alerts, the active plan, clinical notes and messages. Every number comes from the API.
 *
 * Pattern: P06 Adapter for every DTO that becomes a view model; P19 and P08 live in the detail modules.
 */
export function PatientDetailPage() {
  const { patientId = '' } = useParams();
  const { state } = useSession();
  const session = state.status === 'authenticated' ? state.session : null;
  const [params, setParams] = useSearchParams();
  const window = windowFrom(params.get('window'));
  const setWindow = (next: MetricsWindow) => {
    setParams(
      (previous) => {
        const copy = new URLSearchParams(previous);
        copy.set('window', next);
        return copy;
      },
      { replace: true },
    );
  };

  const overview = usePatientOverview(patientId, window);
  const metrics = usePatientMetrics(patientId, window);
  const agp = usePatientAgp(patientId);
  const readings = usePatientReadings(patientId);
  const risk = usePatientRiskTier(patientId, window);
  const recommendations = usePatientRecommendations(patientId);
  const alerts = usePatientAlerts(patientId);
  const notes = usePatientNotes(patientId);
  const messages = usePatientMessages(patientId);
  const insulinDoses = usePatientInsulinDoses(patientId);

  const dto = overview.data;
  const profile = useMemo(() => (dto ? profileAdapter.adapt(dto.target_profile) : null), [dto]);
  const readingViews = useMemo<ReadingViewModel[]>(() => {
    if (!profile || !readings.data) return [];
    const adapter = new ReadingViewModelAdapter(profile.thresholds);
    return readings.data.map((item) => adapter.adapt(item));
  }, [profile, readings.data]);
  const latest = useMemo<ReadingViewModel | null>(
    () =>
      readingViews.reduce<ReadingViewModel | null>(
        (best, item) => (best === null || item.measuredAt.getTime() > best.measuredAt.getTime() ? item : best),
        null,
      ),
    [readingViews],
  );
  const metricsView = useMemo(() => (metrics.data ? metricsAdapter.adapt(metrics.data) : null), [metrics.data]);
  const timeZone = metrics.data?.timezone ?? 'UTC';
  const windowDays = windowToDays(window) ?? 0;
  const localReadings = useMemo(
    () =>
      metricsView
        ? readingsInWindow(readingViews, { periodEnd: metricsView.periodTo, days: windowDays, timeZone })
        : [],
    [metricsView, readingViews, windowDays, timeZone],
  );
  const grid = useMemo(() => buildSurfaceGrid(localReadings), [localReadings]);
  const domain = useMemo(
    () =>
      grid && profile
        ? {
            min: Math.min(grid.min, profile.thresholds.rangeLowMgDl),
            max: Math.max(grid.max, profile.thresholds.rangeHighMgDl),
          }
        : { min: 0, max: 0 },
    [grid, profile],
  );
  const rules = useMemo<PatternRules | null>(() => {
    if (!dto || !profile) return null;
    const { night_start: start, night_end: end, postprandial_max_mg_dl: postprandial } = dto.target_profile;
    return {
      rangeLowMgDl: profile.thresholds.rangeLowMgDl,
      postprandialMaxMgDl: postprandial ?? null,
      night: start && end ? { start, end } : null,
    };
  }, [dto, profile]);
  const patterns = useMemo(() => (rules ? detectPatterns(localReadings, rules) : []), [rules, localReadings]);

  if (overview.isPending || metrics.isPending) {
    return (
      <div className="page">
        <LoadingState label={es.detail.loading} />
      </div>
    );
  }

  if (overview.isError || !dto || !profile || !rules) {
    return (
      <div className="page">
        <PageHeader title={es.nav.patients} />
        <ErrorState
          error={overview.error}
          title={es.detail.errorTitle}
          onRetry={() => {
            void overview.refetch();
          }}
        />
      </div>
    );
  }

  const canDecide = session?.can(PERMISSIONS.recommendationsDecide) ?? false;
  const canAcknowledge = session?.can(PERMISSIONS.alertsAcknowledge) ?? false;
  const canResolve = session?.can(PERMISSIONS.alertsResolve) ?? false;
  const recommendationDtos = recommendations.data ?? [];
  const openAlertDtos = (alerts.data ?? []).filter((alert) => alert.status !== 'RESOLVED');
  const pendingSuggestions = recommendationDtos.filter((item) => item.status === 'PROPOSED').length;
  const riskTier: RiskTier | null = risk.data ?? null;
  const agpInput = agp.data
    ? {
        bins: agp.data.bins,
        target: { low: profile.thresholds.rangeLowMgDl, high: profile.thresholds.rangeHighMgDl },
        isSufficient: agp.data.is_sufficient,
      }
    : null;

  return (
    <div className="page patient-detail">
      <PatientHeader
        fullName={dto.patient.full_name}
        profileLabel={profile.label}
        source={latest?.source ?? null}
        lastReading={latest}
        risk={riskTier}
        timeZone={timeZone}
        pendingSuggestions={pendingSuggestions}
        openAlerts={openAlertDtos.length}
        sex={dto.patient.sex}
        bmi={dto.patient.bmi}
      />
      <div className="grid-12 patient-detail__grid">
        <div className="patient-detail__stack" style={span(MAIN_SPAN)}>
          {metricsView && metrics.data ? (
            <MetricsRow
              window={window}
              onWindow={setWindow}
              metrics={metricsView}
              current={metrics.data.metrics}
              previous={metrics.data.previous}
            />
          ) : null}
          <AgpChart
            input={agpInput}
            loading={agp.isPending}
            error={agp.error}
            onRetry={() => {
              void agp.refetch();
            }}
          />
          <SurfaceSection grid={grid} thresholds={profile.thresholds} domain={domain} loading={readings.isPending} />
          <PatternsPanel
            patterns={patterns}
            rules={rules}
            computed={{ night: rules.night !== null, postprandial: rules.postprandialMaxMgDl !== null }}
          />
        </div>
        <aside className="patient-detail__stack" style={span(RAIL_SPAN)}>
          <AiSuggestionPanel
            recommendations={recommendationDtos}
            patientId={patientId}
            canDecide={canDecide}
            timeZone={timeZone}
          />
          <OpenAlertsPanel
            alerts={openAlertDtos}
            patientId={patientId}
            canAcknowledge={canAcknowledge}
            canResolve={canResolve}
            timeZone={timeZone}
          />
          <PlanPanel plan={dto.active_plan} />
          {insulinDoses.isError ? (
            <section className="panel" aria-labelledby="injection-error-title">
              <header className="panel__header">
                <h2 id="injection-error-title">{es.detail.injection.title}</h2>
              </header>
              <div className="panel__body">
                <ErrorState error={insulinDoses.error} title={es.detail.injection.title} onRetry={() => void insulinDoses.refetch()} />
              </div>
            </section>
          ) : insulinDoses.isPending || !metricsView ? (
            <section className="panel" aria-labelledby="injection-loading-title">
              <header className="panel__header">
                <h2 id="injection-loading-title">{es.detail.injection.title}</h2>
              </header>
              <div className="panel__body">
                <LoadingState />
              </div>
            </section>
          ) : (
            <InjectionPanel doses={insulinDoses.data} periodEnd={metricsView.periodTo} timeZone={timeZone} />
          )}
          <NotesPanel patientId={patientId} notes={notes.data ?? []} canWrite timeZone={timeZone} />
          <MessagesPanel
            patientId={patientId}
            messages={messages.data?.items ?? []}
            emergencyNotice={messages.data?.emergency_notice}
            timeZone={timeZone}
          />
        </aside>
      </div>
      <div className="patient-detail__wide">
        <Timeline
          readings={localReadings}
          alerts={alerts.data ?? []}
          recommendations={recommendationDtos}
          notes={notes.data ?? []}
          timeZone={timeZone}
        />
      </div>
    </div>
  );
}
