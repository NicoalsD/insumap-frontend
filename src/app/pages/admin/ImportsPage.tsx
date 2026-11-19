import { es } from '@/i18n/es';
import { PageHeader } from '@/ui';
import { ImportWorkspace } from './imports/ImportWorkspace';
import './imports/imports.css';

/** Admin screen to import patients from FHIR R4 or CSV: origin, preview and confirmation, then history. */
export function ImportsPage() {
  return (
    <div className="page">
      <PageHeader title={es.adminImports.title} description={es.adminImports.description} />
      <ImportWorkspace />
    </div>
  );
}
