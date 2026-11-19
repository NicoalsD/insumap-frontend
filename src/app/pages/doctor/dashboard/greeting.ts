import { es } from '@/i18n/es';
import { format } from '@/i18n/format';

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
