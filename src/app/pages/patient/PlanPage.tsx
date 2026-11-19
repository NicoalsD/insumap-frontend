import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { ApiError } from '@/services/api/ApiError';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/ui';
import { longDate } from './app/patientFormat';
import { PlanSites } from './app/injection/PlanSites';
import { useOwnOverview, useOwnPlan } from './app/patientQueries';
import './PatientPages.css';

/** The active plan in plain language: name, version and the schedule the doctor indicated. */
export function PlanPage() {
  const plan = useOwnPlan();
  const overview = useOwnOverview('14d');
  const timeZone = overview.data?.metrics.timezone ?? 'UTC';

  if (plan.isError && plan.error instanceof ApiError && plan.error.code === 'NOT_FOUND') {
    return (
      <div className="patient-page">
        <PageHeader title={es.patient.plan.title} description={es.patient.plan.description} />
        <EmptyState title={es.patient.plan.empty} />
      </div>
    );
  }
  if (plan.isError) {
    return (
      <div className="patient-page">
        <ErrorState error={plan.error} onRetry={() => { void plan.refetch(); }} />
      </div>
    );
  }
  if (plan.isPending) {
    return (
      <div className="patient-page">
        <LoadingState />
      </div>
    );
  }
  const data = plan.data;
  return (
    <div className="patient-page">
      <PageHeader title={es.patient.plan.title} description={es.patient.plan.description} />
      {(

        <section className="patient-page__section" aria-labelledby="plan-name">
          <h2 id="plan-name" className="patient-layer__title">{data.name}</h2>
          <p className="plan-meta">{format(es.patient.plan.version, { version: data.version })}</p>
          {data.updated_at ? (
            <p className="plan-meta">
              {format(es.patient.plan.updated, { date: longDate(new Date(data.updated_at), timeZone) })}
            </p>
          ) : null}
          <p>{data.summary}</p>
          <h2 className="patient-layer__title">{es.patient.plan.schedule}</h2>
          <ol className="plan-schedule">
            {data.schedule.map((item) => (
              <li key={`${item.time_of_day}-${item.label}`} className="plan-schedule__item">
                <span className="plan-schedule__time">{item.time_of_day}</span>
                <span>{item.label}</span>
                <span className="plan-schedule__dose">
                  {item.dose_units === null
                    ? es.patient.plan.noDose
                    : format(es.patient.plan.dose, { units: item.dose_units })}
                </span>
                {item.insulin_kind !== null ? (
                  <PlanSites kind={item.insulin_kind} sites={item.injection_sites} />
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
