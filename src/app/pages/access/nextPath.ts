/** Characters below the space and DEL: never valid in a path. */
const FIRST_PRINTABLE = 0x20;
const DELETE = 0x7f;

/**
 * Returns the `?next=` target only when it is a path inside this app. Anything that could leave the
 * origin (`https://…`, `//host`, `/\host`) or is not a path is ignored.
 */
export function safeInternalPath(next: string | null): string | null {
  if (next === null || !next.startsWith('/')) return null;
  if (next.startsWith('//') || next.startsWith('/\\')) return null;
  for (const char of next) {
    const code = char.charCodeAt(0);
    if (code < FIRST_PRINTABLE || code === DELETE) return null;
  }
  return next;
}
