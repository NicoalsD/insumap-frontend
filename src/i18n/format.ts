/** Locale for every visible text, number and date in the app (Spanish, Colombia). */
export const LOCALE = 'es-CO';

export type MessageParams = Readonly<Record<string, string | number>>;

const numberFormat = new Intl.NumberFormat(LOCALE);

/**
 * Replaces `{name}` placeholders in a message from `es.ts`.
 * Numbers are formatted for the locale; a missing parameter is left visible so it is caught in review.
 */
export function format(template: string, params: MessageParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = params[key];
    if (value === undefined) return placeholder;
    return typeof value === 'number' ? numberFormat.format(value) : value;
  });
}
