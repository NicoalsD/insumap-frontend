import { Bell, Bot, ClipboardCheck, Siren } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BodyCanvas } from '@/app/pages/landing/BodyCanvas';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { canRender3D } from '@/ui/body/webglSupport';
import { TooltipProvider } from '@/ui/shadcn/tooltip';
import type { SegmentId } from '../triage/triageModel';
import { doctorGreeting } from './greeting';
import { AnimatedNumber } from '@/ui/motion/AnimatedNumber';
import { markPressOrigin } from '@/ui/motion/press';

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
              data-hot={(id === 'critical' && counts[id] > 0) || undefined}
              onPointerDown={markPressOrigin}
              onClick={() => {
                onToggle(id);
              }}
            >
              <span className="doctor-stat__icon" aria-hidden="true">
                <Icon size="1.25rem" />
              </span>
              <AnimatedNumber className="doctor-stat__value" value={counts[id]} />
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
