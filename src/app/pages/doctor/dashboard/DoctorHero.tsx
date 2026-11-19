import { Bell, Bot, ClipboardCheck, Siren } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BodyCanvas } from '@/app/pages/landing/BodyCanvas';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { canRender3D } from '@/ui/body/webglSupport';
import { TooltipProvider } from '@/ui/shadcn/tooltip';
import type { SegmentId } from '../triage/triageModel';

const MORNING_UNTIL_HOUR = 12;
const AFTERNOON_UNTIL_HOUR = 19;

/** "Buenos días, Marta Quintero" by the hour of the device. */
export function doctorGreeting(name: string, now: Date): string {
  const hour = now.getHours();
  const { greeting } = es.doctor.dashboard;
  if (hour < MORNING_UNTIL_HOUR) return format(greeting.morning, { name });
  if (hour < AFTERNOON_UNTIL_HOUR) return format(greeting.afternoon, { name });
  return format(greeting.evening, { name });
}

type StatId = Exclude<SegmentId, 'insufficient'>;

const STATS: readonly { id: StatId; icon: LucideIcon }[] = [
  { id: 'critical', icon: Siren },
  { id: 'openAlerts', icon: Bell },
  { id: 'aiPending', icon: Bot },
  { id: 'unreviewed', icon: ClipboardCheck },
];

export interface DoctorHeroProps {
  readonly name: string;
  readonly now: Date;
  readonly windowDays: number;
  readonly counts: Readonly<Record<SegmentId, number>>;
  readonly active: readonly SegmentId[];
  readonly onToggle: (segment: SegmentId) => void;
}

/**
 * Opening banner of the doctor's panel, the landing's hero in app form: greeting, the four counts
 * that matter today (each one is a toggle that filters the queue below) and the landing's 3D body.
 */
export function DoctorHero({ name, now, windowDays, counts, active, onToggle }: DoctorHeroProps) {
  const show3D = canRender3D();
  return (
    <section className="doctor-hero" aria-labelledby="doctor-hero-title">
      <div className="doctor-hero__copy">
        <h1 id="doctor-hero-title" className="doctor-hero__title">
          {doctorGreeting(name, now)}
        </h1>
        <p className="doctor-hero__lead">{format(es.doctor.dashboard.lead, { days: windowDays })}</p>
        <div className="doctor-hero__stats" role="group" aria-label={es.doctor.dashboard.statsLabel}>
          {STATS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="doctor-stat"
              data-segment={id}
              aria-pressed={active.includes(id)}
              onClick={() => {
                onToggle(id);
              }}
            >
              <span className="doctor-stat__icon" aria-hidden="true">
                <Icon size="1.25rem" />
              </span>
              <span className="doctor-stat__value">{format('{value}', { value: counts[id] })}</span>
              <span className="doctor-stat__label">{es.doctor.dashboard.stats[id]}</span>
            </button>
          ))}
        </div>
      </div>
      {show3D ? (
        <TooltipProvider>
          <div className="doctor-hero__stage">
            <BodyCanvas mode="hero" label={es.doctor.dashboard.bodyLabel} className="doctor-hero__canvas" />
          </div>
        </TooltipProvider>
      ) : null}
    </section>
  );
}
