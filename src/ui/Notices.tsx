import { FlaskConical, ShieldAlert } from 'lucide-react';
import { es } from '@/i18n/es';
import './Notices.css';

/** "Datos simulados": always visible on every screen of a demo clinic (AGENTS.md 3.5). */
export function SimulatedNotice() {
  return (
    <aside className="ui-simulated" aria-label={es.notices.simulated}>
      <FlaskConical size="1.125rem" aria-hidden="true" />
      <strong>{es.notices.simulated}</strong>
      <span>{es.notices.simulatedDetail}</span>
    </aside>
  );
}

/** Medical disclaimer: academic project, not a medical device, AI only supports the doctor. */
export function MedicalDisclaimer() {
  return (
    <footer className="ui-disclaimer">
      <ShieldAlert size="1.125rem" aria-hidden="true" />
      <p>{es.notices.medicalDisclaimer}</p>
    </footer>
  );
}
