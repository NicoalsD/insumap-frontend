/** True when the build runs against Mock Service Worker (`VITE_USE_MOCKS=true`). */
export function mocksEnabled(flag: string | undefined = import.meta.env.VITE_USE_MOCKS): boolean {
  return flag === 'true';
}
