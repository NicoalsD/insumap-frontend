import { lazy, Suspense } from 'react';
import { LoadingState } from '@/ui';

const SystemDesignPage = lazy(() => import('./SystemDesignPage'));

/** The design-system reference loads on demand so it stays out of the main bundle. */
export function LazySystemDesignPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SystemDesignPage />
    </Suspense>
  );
}
