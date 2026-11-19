/** Ids that tie a field to its hint and error through `aria-describedby`. */
export function fieldIds(id: string, hasHint: boolean, hasError: boolean) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hasHint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(' ');
  return { hintId, errorId, describedBy: describedBy === '' ? undefined : describedBy };
}
