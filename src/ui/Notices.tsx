import { ShieldAlert } from 'lucide-react';
import { es } from '@/i18n/es';
import './Notices.css';

/** Regulatory notice: not a medical device, the AI only proposes and the doctor decides. */
export function MedicalDisclaimer() {
  return (
    <footer className="ui-disclaimer">
      <ShieldAlert size="1.125rem" aria-hidden="true" />
      <p>{es.notices.medicalDisclaimer}</p>
    </footer>
  );
}
