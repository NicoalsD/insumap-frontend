import { LOCALE } from '@/i18n/format';

/** Date of a credential or a record in the clinic's timezone, with `Intl` (never a hand-built string). */
export function formatAdminDate(instant: string, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone }).format(new Date(instant));
}
