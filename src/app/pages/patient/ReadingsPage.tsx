import { useMemo } from 'react';
import { es } from '@/i18n/es';
import { TargetProfileViewModelAdapter } from '@/services/adapters/TargetProfileViewModelAdapter';
import { useFieldLimits } from '@/state/useFieldLimits';
import { ErrorState, LoadingState, PageHeader } from '@/ui';
import { GlucoseRecorder } from './app/recording/GlucoseRecorder';
import { PendingNotice } from './app/offline/PendingNotice';
import { ReadingsList } from './app/readings/ReadingsList';
import { useNow } from './app/useNow';
import { useOwnOverview } from './app/patientQueries';
import './PatientPages.css';

const profiles = new TargetProfileViewModelAdapter();

/** History of the patient's own readings, by day, with the same register button as home. */
export function ReadingsPage() {
  const now = useNow();
  const limits = useFieldLimits();
  const overview = useOwnOverview('14d');
  const profile = useMemo(
    () => (overview.data ? profiles.adapt(overview.data.target_profile) : null),
    [overview.data],
  );

  if (overview.isError) {
    return (
      <div className="patient-page">
        <ErrorState error={overview.error} onRetry={() => { void overview.refetch(); }} />
      </div>
    );
  }
  if (profile === null || overview.data === undefined) {
    return (
      <div className="patient-page">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="patient-page">
      <PageHeader title={es.patient.readings.title} description={es.patient.readings.description} />
      <div className="patient-page__record">
        <PendingNotice />
        <GlucoseRecorder thresholds={profile.thresholds} limits={limits.data ?? {}} />
      </div>
      <ReadingsList thresholds={profile.thresholds} timeZone={overview.data.metrics.timezone} now={now} />
    </div>
  );
}
