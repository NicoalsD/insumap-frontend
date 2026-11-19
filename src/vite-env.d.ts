/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API including `/api/v1`; relative keeps it same-site. */
  readonly VITE_API_BASE_URL?: string;
  /** `"true"` starts Mock Service Worker with the demo fixtures. */
  readonly VITE_USE_MOCKS?: string;
  /** Sales inbox that receives the landing's demo requests (public address, never a secret). */
  readonly VITE_SALES_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
