import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import '@fontsource-variable/atkinson-hyperlegible-mono/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { mocksEnabled } from './services/demo/DemoLogin';

/** Starts Mock Service Worker first when `VITE_USE_MOCKS=true`; the module is not bundled otherwise. */
async function bootstrap(): Promise<void> {
  if (mocksEnabled()) {
    const { startMocks } = await import('./mocks/browser');
    await startMocks();
  }
  const container = document.getElementById('root');
  if (!container) return;
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
