import { es } from '@/i18n/es';
import { useFieldLimits } from '@/state/useFieldLimits';
import { PageHeader } from '@/ui';
import { MessageThread } from './app/messages/MessageThread';
import { useOwnOverview } from './app/patientQueries';
import './PatientPages.css';

/** Thread with the care team. Not an emergency channel: the notice is always on screen. */
export function MessagesPage() {
  const limits = useFieldLimits();
  const overview = useOwnOverview('14d');
  return (
    <div className="patient-page">
      <PageHeader title={es.patient.messages.title} description={es.patient.messages.description} />
      <MessageThread limits={limits.data ?? {}} timeZone={overview.data?.timezone ?? 'UTC'} />
    </div>
  );
}
