import { Upload } from 'lucide-react';
import { useId, useState, type DragEvent } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { acceptFor, type ImportSource } from './importFile';

const t = es.adminImports;

export interface FileDropZoneProps {
  readonly source: ImportSource;
  /** The file already chosen, shown by name and size; `null` when none. */
  readonly selectedName: string | null;
  readonly selectedSize: string | null;
  readonly describedBy: string | undefined;
  /** Receives the dropped or picked file; `undefined` when the picker was cancelled. */
  readonly onPick: (file: File | undefined) => void;
  readonly invalid: boolean;
}

/**
 * Drag-and-drop area with a real file input behind a visible button. The input keeps the keyboard
 * and screen-reader path; dropping is an extra way to pick the same file.
 */
export function FileDropZone({ source, selectedName, selectedSize, describedBy, onPick, invalid }: FileDropZoneProps) {
  const inputId = useId();
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const accepted = source === 'CSV' ? t.file.formatCsv : t.file.formatFhir;

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    onPick(event.dataTransfer.files[0]);
  };

  return (
    <div
      className="import-drop"
      data-dragging={dragging || undefined}
      data-invalid={invalid || undefined}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDragLeave={() => {
        setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <Upload className="import-drop__icon" size="1.5rem" aria-hidden="true" />
      <p className="import-drop__title">{t.origin.dropTitle}</p>
      <p id={hintId} className="import-drop__hint">
        {format(t.origin.dropHint, { accepted })}
      </p>
      <input
        id={inputId}
        className="import-drop__input visually-hidden"
        type="file"
        accept={acceptFor(source)}
        aria-describedby={[hintId, describedBy].filter(Boolean).join(' ')}
        onChange={(event) => {
          onPick(event.target.files?.[0]);
          // Reset so picking the same file again still fires a change.
          event.target.value = '';
        }}
      />
      <label htmlFor={inputId} className="ui-button import-drop__pick" data-variant="secondary" data-size="md">
        {t.origin.chooseFile}
      </label>
      {selectedName !== null && selectedSize !== null ? (
        <p className="import-drop__selected">
          <span className="import-drop__selected-label">{t.origin.fileSelected}</span>
          <span>{format(t.origin.fileMeta, { name: selectedName, size: selectedSize })}</span>
        </p>
      ) : null}
    </div>
  );
}
