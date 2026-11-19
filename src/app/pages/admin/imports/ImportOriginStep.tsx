import { Download, X } from 'lucide-react';
import { useId, useState } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { ImportBatchViewModel } from '@/services/adapters/ImportViewModelAdapters';
import { useFieldLimits } from '@/state/useFieldLimits';
import { Button } from '@/ui';
import { FileDropZone } from './FileDropZone';
import {
  buildCsvTemplate,
  CSV_TEMPLATE_FILE_NAME,
  downloadTextFile,
  IMPORT_LIMIT_KEYS,
  validateImportFile,
  type FileIssue,
  type ImportSource,
} from './importFile';
import { analysisErrorMessage, fileIssueMessage, sizeText } from './importMessages';
import { useCreateImportPreview } from './useImportQueries';

const t = es.adminImports;

const NO_LIMITS: Readonly<Record<string, number>> = {};
const SOURCES: readonly ImportSource[] = ['CSV', 'FHIR'];

interface Rejection {
  readonly issue: FileIssue;
  readonly size: number;
}

export interface ImportOriginStepProps {
  /** Called with the preview batch once the API has validated the file. */
  readonly onAnalyzed: (batch: ImportBatchViewModel) => void;
}

/**
 * Step 1: choose the format and the file. The file is checked for type and size against the API's
 * limits before it is sent; the API validates it again and its errors are shown in Spanish.
 */
export function ImportOriginStep({ onAnalyzed }: ImportOriginStepProps) {
  const groupName = useId();
  const noteId = useId();
  const alertId = useId();
  const limitsQuery = useFieldLimits();
  const limits = limitsQuery.data ?? NO_LIMITS;
  const analyze = useCreateImportPreview();

  const [source, setSource] = useState<ImportSource>('CSV');
  const [file, setFile] = useState<File | null>(null);
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [readFailed, setReadFailed] = useState(false);

  const maxBytes = limits[IMPORT_LIMIT_KEYS[source]];
  const limitNote = [
    source === 'CSV' ? t.origin.csvHint : t.origin.fhirHint,
    maxBytes === undefined ? null : format(t.origin.sizeLimit, { size: sizeText(maxBytes) }),
  ]
    .filter(Boolean)
    .join(' ');

  const resetSelection = () => {
    setFile(null);
    setRejection(null);
    setReadFailed(false);
    analyze.reset();
  };

  const chooseSource = (next: ImportSource) => {
    setSource(next);
    resetSelection();
  };

  const pick = (candidate: File | undefined) => {
    if (candidate === undefined) return;
    resetSelection();
    const issue = validateImportFile(candidate, source, limits);
    if (issue === null) {
      setFile(candidate);
    } else {
      setRejection({ issue, size: candidate.size });
    }
  };

  const submit = async () => {
    if (file === null) return;
    let content: string;
    try {
      content = await file.text();
    } catch {
      setReadFailed(true);
      return;
    }
    analyze.mutate({ source, content }, { onSuccess: onAnalyzed });
  };

  const rejectionMessage =
    rejection === null ? null : fileIssueMessage(rejection.issue, source, { size: rejection.size }, maxBytes);
  const analysisMessage = analyze.isError ? analysisErrorMessage(analyze.error, source) : null;
  const alertMessage = rejectionMessage ?? (readFailed ? t.file.readFailed : analysisMessage);

  return (
    <div className="import-origin">
      <fieldset className="import-origin__formats">
        <legend>{t.origin.formatLegend}</legend>
        <div className="import-origin__choices">
          {SOURCES.map((option) => (
            <label key={option} className="import-choice">
              <input
                type="radio"
                name={groupName}
                value={option}
                checked={source === option}
                aria-describedby={noteId}
                onChange={() => {
                  chooseSource(option);
                }}
              />
              <span className="import-choice__label">{option === 'CSV' ? t.origin.csvLabel : t.origin.fhirLabel}</span>
            </label>
          ))}
        </div>
        <p id={noteId} className="import-origin__note">
          {limitNote}
        </p>
      </fieldset>

      <FileDropZone
        source={source}
        selectedName={file?.name ?? null}
        selectedSize={file === null ? null : sizeText(file.size)}
        describedBy={alertMessage === null ? undefined : alertId}
        onPick={pick}
        invalid={rejection !== null}
      />

      {alertMessage === null ? null : (
        <p id={alertId} role="alert" className="import-alert">
          {alertMessage}
        </p>
      )}

      <div className="import-origin__actions">
        <Button
          loading={analyze.isPending}
          disabled={file === null}
          onClick={() => {
            void submit();
          }}
        >
          {t.origin.analyze}
        </Button>
        {file === null ? null : (
          <Button variant="ghost" icon={<X size="1em" aria-hidden="true" />} onClick={resetSelection}>
            {t.origin.removeFile}
          </Button>
        )}
        {source === 'CSV' ? (
          <Button
            variant="ghost"
            icon={<Download size="1em" aria-hidden="true" />}
            onClick={() => {
              downloadTextFile(CSV_TEMPLATE_FILE_NAME, buildCsvTemplate());
            }}
          >
            {t.origin.templateButton}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
