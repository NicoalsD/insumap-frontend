import { es } from '@/i18n/es';
import { useFieldLimits } from '@/state/useFieldLimits';
import { ErrorState, LoadingState, PageHeader } from '@/ui';
import { AssistantChat } from './app/assistant/AssistantChat';
import './PatientPages.css';

/** Educational assistant: general questions with approved clinic material; never doses or diagnoses. */
export function AssistantPage() {
  const limits = useFieldLimits();
  return (
    <div className="patient-page assistant-page">
      <PageHeader title={es.patient.assistant.title} description={es.patient.assistant.description} />
      {limits.isError ? <ErrorState error={limits.error} onRetry={() => { void limits.refetch(); }} /> : null}
      {limits.isPending ? <LoadingState /> : <AssistantChat limits={limits.data ?? {}} />}
    </div>
  );
}
