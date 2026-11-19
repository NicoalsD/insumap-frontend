const INITIALS = 2;

/** Two initials of a name for the avatar ("Marta Quintero" → "MQ"). */
export function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, INITIALS)
    .map((part) => part.charAt(0).toLocaleUpperCase('es-CO'))
    .join('');
}
