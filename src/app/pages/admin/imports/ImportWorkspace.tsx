import { useState } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { ErrorState, LoadingState } from '@/ui';
import { ImportConfirmStep } from './ImportConfirmStep';
import { ImportHistory } from './ImportHistory';
import { ImportOriginStep } from './ImportOriginStep';
import { ImportPreviewStep } from './ImportPreviewStep';
import { ImportStepBand } from './ImportStepBand';
import { isImportedBatch } from './importModel';
import { useImportBatch } from './useImportQueries';

const t = es.adminImports;

type StepId = 'origin' | 'preview' | 'confirm';

/**
 * The import screen: three layers (origin, preview, confirm) with one open at a time, then the
 * batch history. The batch id is the only state that links the layers; the data itself lives in
 * TanStack Query, so each layer reads what the API last returned.
 *
 * Pattern: none (screen composition; the adapters are P06 and the facade is P10)
 */
export function ImportWorkspace() {
  const [activeStep, setActiveStep] = useState<StepId>('origin');
  const [batchId, setBatchId] = useState<string | null>(null);
  const batchQuery = useImportBatch(batchId);
  const batch = batchQuery.data;

  const openBatch = (id: string) => {
    setBatchId(id);
    setActiveStep('preview');
  };

  const startOver = () => {
    setBatchId(null);
    setActiveStep('origin');
  };

  const originSummary =
    batch === undefined
      ? t.steps.originEmpty
      : format(t.steps.originDone, { format: t.sourceLabel[batch.source], rows: batch.totals.all });

  const previewSummary =
    batch === undefined
      ? t.steps.pending
      : format(t.steps.previewDone, {
          valid: batch.totals.valid,
          error: batch.totals.error,
          duplicate: batch.totals.skippedDuplicate,
        });

  const confirmSummary =
    batch === undefined
      ? t.steps.pending
      : isImportedBatch(batch)
        ? t.steps.confirmImported
        : t.steps.confirmReady;

  const renderPreviewBody = () => {
    if (batch !== undefined) {
      return (
        <ImportPreviewStep
          key={batch.id}
          batch={batch}
          onContinue={() => {
            setActiveStep('confirm');
          }}
        />
      );
    }
    if (batchQuery.isError) return <ErrorState error={batchQuery.error} onRetry={() => void batchQuery.refetch()} />;
    return <LoadingState />;
  };

  const renderConfirmBody = () => {
    if (batch === undefined) return <LoadingState />;
    return (
      <ImportConfirmStep
        key={batch.id}
        batch={batch}
        onReviewPreview={() => {
          setActiveStep('preview');
        }}
        onNewImport={startOver}
      />
    );
  };

  return (
    <>
      <div className="grid-12 import-flow">
        <ImportStepBand
          stepNumber={1}
          title={t.steps.origin}
          summary={originSummary}
          active={activeStep === 'origin'}
          reachable
          actionLabel={t.steps.change}
          onOpen={() => {
            setActiveStep('origin');
          }}
        >
          <ImportOriginStep
            onAnalyzed={(preview) => {
              setBatchId(preview.id);
              setActiveStep('preview');
            }}
          />
        </ImportStepBand>

        <ImportStepBand
          stepNumber={2}
          title={t.steps.preview}
          summary={previewSummary}
          active={activeStep === 'preview'}
          reachable={batch !== undefined}
          actionLabel={t.steps.review}
          onOpen={() => {
            setActiveStep('preview');
          }}
        >
          {renderPreviewBody()}
        </ImportStepBand>

        <ImportStepBand
          stepNumber={3}
          title={t.steps.confirm}
          summary={confirmSummary}
          active={activeStep === 'confirm'}
          reachable={batch !== undefined}
          actionLabel={t.steps.review}
          onOpen={() => {
            setActiveStep('confirm');
          }}
        >
          {renderConfirmBody()}
        </ImportStepBand>
      </div>

      <div className="grid-12 import-flow">
        <ImportHistory onOpen={openBatch} />
      </div>
    </>
  );
}
