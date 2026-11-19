import { useMemo } from 'react';
import { es } from '@/i18n/es';
import { MetricsViewModelAdapter } from '@/services/adapters/MetricsViewModelAdapter';
import { TargetProfileViewModelAdapter } from '@/services/adapters/TargetProfileViewModelAdapter';
import type { GlucoseReadingDto } from '@/services/dto/clinical';
import type { ReminderDto } from '@/services/dto/care';
import { useSession } from '@/state/useSession';
import { useFieldLimits } from '@/state/useFieldLimits';
import { ErrorState, LoadingState } from '@/ui';
import { GlucoseRecorder } from './app/recording/GlucoseRecorder';
import { PendingNotice } from './app/offline/PendingNotice';
import { LatestLayer, DayLayer, WeekLayer, RemindersLayer } from './app/home/HomeLayers';
import { greetingFor } from './app/patientFormat';
import { useNow } from './app/useNow';
import {
  useAllOwnReadings,
  useOwnMetrics,
  useOwnOverview,
  useOwnReminders,
  useUpdateReminder,
} from './app/patientQueries';
import './PatientPages.css';

const profiles = new TargetProfileViewModelAdapter();
const metricsAdapter = new MetricsViewModelAdapter();
const WEEK_WINDOW = '7d';
const HOME_WINDOW = '14d';

/** Home of the patient, in layers: last reading, register, today, the week, today's reminders. */
export function PatientHomePage() {
  const { state } = useSession();
  const now = useNow();
  const limits = useFieldLimits();
  const overview = useOwnOverview(HOME_WINDOW);
  const readings = useAllOwnReadings();
  const week = useOwnMetrics(WEEK_WINDOW);
  const reminders = useOwnReminders();
  const updateReminder = useUpdateReminder();

  const profile = useMemo(
    () => (overview.data ? profiles.adapt(overview.data.target_profile) : null),
    [overview.data],
  );

  if (state.status !== 'authenticated') return null;
  const { session } = state;

  if (overview.isPending || profile === null || overview.data === undefined) {
    if (overview.isError) {
      return (
        <div className="patient-page">
          <ErrorState error={overview.error} onRetry={() => { void overview.refetch(); }} />
        </div>
      );
    }
    return (
      <div className="patient-page">
        <LoadingState />
      </div>
    );
  }

  const data = overview.data;
  const timeZone = data.metrics.timezone;
  const latest = latestReading(data.latest_readings);
  const weekMetrics = week.data ? metricsAdapter.adapt(week.data) : null;
  const todayReadings: readonly GlucoseReadingDto[] = readings.data ?? [];
  const hasAlert = data.open_alerts.length > 0;

  const toggle = (reminder: ReminderDto) => {
    updateReminder.mutate({ reminderId: reminder.id, body: { enabled: !reminder.enabled } });
  };

  return (
    <div className="patient-page">
      <header className="patient-page__head">
        <h1 className="patient-page__title">{greetingFor(now, session.fullName)}</h1>
        <p className="patient-page__lead">{es.patient.greeting.subtitle}</p>
      </header>

      {hasAlert ? (
        <p className="patient-page__banner" role="status">
          {es.patient.alertBanner}
        </p>
      ) : null}

      <LatestLayer reading={latest} profile={profile} timeZone={timeZone} now={now} />

      <div className="patient-page__record">
        <PendingNotice />
        <GlucoseRecorder thresholds={profile.thresholds} limits={limits.data ?? {}} />
      </div>

      <DayLayer readings={todayReadings} profile={profile} timeZone={timeZone} now={now} />

      {weekMetrics ? (
        <WeekLayer
          tirPct={weekMetrics.tirPct}
          isSufficient={weekMetrics.timeInRanges.isSufficient}
          goalPct={profile.goals.tirMinPct}
        />
      ) : null}

      {reminders.isError ? (
        <ErrorState error={reminders.error} onRetry={() => { void reminders.refetch(); }} />
      ) : (
        <RemindersLayer
          reminders={reminders.data ?? []}
          onToggle={toggle}
          pendingId={updateReminder.isPending ? updateReminder.variables.reminderId : null}
          errorMessage={updateReminder.isError ? es.patient.reminders.error : null}
        />
      )}
    </div>
  );
}

/** The newest reading by measurement time, whatever order the API used. */
function latestReading(items: readonly GlucoseReadingDto[]): GlucoseReadingDto | null {
  let newest: GlucoseReadingDto | null = null;
  for (const item of items) {
    if (newest === null || Date.parse(item.measured_at) > Date.parse(newest.measured_at)) newest = item;
  }
  return newest;
}
