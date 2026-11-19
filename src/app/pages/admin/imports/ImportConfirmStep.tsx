import { useId } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { ImportBatchViewModel } from '@/services/adapters/ImportViewModelAdapters';
import { apiErrorMessage } from '@/services/api/ApiError';
import { Button, ButtonLink, ErrorState, LoadingState, useToast } from '@/ui';
import { confirmGate, patientsToCreate, warningPatientCount, type ConfirmGate } from './importModel';
import { useConfirmImport, useWarningRows } from './useImportQueries';

const t = es.adminImports;

export interface ImportConfirmStepProps {
  readonly batch: ImportBatchViewModel;
  /** Opens the preview so the admin can see and fix the rows with errors. */
  readonly onReviewPreview: () => void;
  /** Starts a new import from the origin step. */
  readonly onNewImport: () => void;
}

/**
 * Step 3: what the confirmation creates. The main action is disabled, and says why, while the
 * batch has errors or nothing to import. The result links to credentials, the next step.
 */
export function ImportConfirmStep({ batch, onReviewPreview, onNewImport }: ImportConfirmStepProps) {
  const reasonId = useId();
  const toast = useToast();
  const confirm = useConfirmImport(batch.id);
  const warningRows = useWarningRows(batch.id, batch.totals.warning > 0);

  const warningPatients = warningPatientCount(warningRows.data ?? []);
  const count = patientsToCreate(batch, warningPatients);
  const ignored = batch.totals.warning - warningPatients;
  const current = confirm.data ?? batch;
  const gate: ConfirmGate = confirmGate(current, count);

  if (confirm.isSuccess) {
    return (
      <div className="import-result" role="status">
        <p className="import-result__title">{count === 1 ? t.confirm.doneOne : format(t.confirm.doneMany, { count })}</p>
        <p className="import-result__hint">{t.confirm.nextCredentialsHint}</p>
        <div className="import-result__actions">
          <ButtonLink to="/admin/credentials">{t.confirm.nextCredentials}</ButtonLink>
          <Button variant="secondary" onClick={onNewImport}>
            {t.confirm.newImport}
          </Button>
        </div>
      </div>
    );
  }

  if (gate === 'ALREADY_IMPORTED') {
    return (
      <div className="import-result">
        <p className="import-result__title">{t.confirm.alreadyImported}</p>
        <div className="import-result__actions">
          <ButtonLink to="/admin/credentials">{t.confirm.nextCredentials}</ButtonLink>
          <Button variant="secondary" onClick={onNewImport}>
            {t.confirm.newImport}
          </Button>
        </div>
      </div>
    );
  }

  const countReady = batch.totals.warning === 0 || warningRows.isSuccess;
  if (!countReady) {
    return warningRows.isError ? (
      <ErrorState error={warningRows.error} title={t.confirm.countError} onRetry={() => void warningRows.refetch()} />
    ) : (
      <LoadingState label={t.confirm.counting} />
    );
  }

  const blockedReason =
    gate === 'BLOCKED_BY_ERRORS'
      ? format(t.confirm.blockedByErrors, { count: batch.totals.error })
      : gate === 'NOTHING_TO_IMPORT'
        ? t.confirm.nothingToImport
        : null;

  const submitLabel = count === 1 ? t.confirm.submitOne : format(t.confirm.submit, { count });

  return (
    <div className="import-confirm">
      <ul className="import-confirm__facts">
        <li>{count === 1 ? t.confirm.createOne : format(t.confirm.createMany, { count })}</li>
        {warningPatients > 0 ? <li>{format(t.confirm.withWarnings, { count: warningPatients })}</li> : null}
        {ignored > 0 ? <li>{format(t.confirm.ignored, { count: ignored })}</li> : null}
        {batch.totals.skippedDuplicate > 0 ? (
          <li>{format(t.confirm.skipped, { count: batch.totals.skippedDuplicate })}</li>
        ) : null}
      </ul>

      <div className="import-confirm__gate" role="region" aria-label={t.confirm.gateRegion}>
        {blockedReason === null ? null : (
          <p id={reasonId} className="import-alert">
            {blockedReason}
          </p>
        )}
        <div className="import-confirm__actions">
          <Button
            loading={confirm.isPending}
            disabled={gate !== 'READY'}
            aria-describedby={blockedReason === null ? undefined : reasonId}
            onClick={() => {
              confirm.mutate(undefined, {
                onSuccess: () => {
                  toast.show(t.confirm.toastDone, 'success');
                },
              });
            }}
          >
            {submitLabel}
          </Button>
          {gate === 'BLOCKED_BY_ERRORS' ? (
            <Button variant="secondary" onClick={onReviewPreview}>
              {t.confirm.reviewErrors}
            </Button>
          ) : null}
        </div>
      </div>

      {confirm.isError ? (
        <p role="alert" className="import-alert">
          {t.confirm.submitError} {apiErrorMessage(confirm.error)}
        </p>
      ) : null}
    </div>
  );
}
