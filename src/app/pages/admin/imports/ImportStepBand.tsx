import { useId, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Button } from '@/ui';

const t = es.adminImports;

export interface ImportStepBandProps {
  readonly stepNumber: number;
  readonly title: string;
  /** One line that says what this step holds now, visible while the step is collapsed. */
  readonly summary: string;
  readonly active: boolean;
  /** A step can only be reopened once the batch it works on exists. */
  readonly reachable: boolean;
  readonly actionLabel: string;
  readonly onOpen: () => void;
  readonly children?: ReactNode;
}

/**
 * One layer of the import flow: a band with its heading and summary. Only the active step renders
 * its body, so the screen reads as three stacked layers with a single open task.
 *
 * Pattern: none (presentational band of the import flow)
 */
export function ImportStepBand({
  stepNumber,
  title,
  summary,
  active,
  reachable,
  actionLabel,
  onOpen,
  children,
}: ImportStepBandProps) {
  const headingId = useId();
  return (
    <section className="panel import-band" aria-labelledby={headingId} data-active={active || undefined}>
      <header className="import-band__header">
        <span className="import-band__number measure">{format(t.steps.stepNumber, { step: stepNumber })}</span>
        <div className="import-band__title">
          <h2 id={headingId}>{title}</h2>
          {active ? null : <p className="import-band__summary">{reachable ? summary : t.steps.pending}</p>}
        </div>
        {!active && reachable ? (
          <Button variant="secondary" size="sm" onClick={onOpen}>
            {actionLabel}
          </Button>
        ) : null}
      </header>
      {active ? <div className="import-band__body">{children}</div> : null}
    </section>
  );
}
