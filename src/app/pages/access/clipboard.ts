/** Copies text to the clipboard. Resolves `false` when the browser refuses (no permission or no API). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
