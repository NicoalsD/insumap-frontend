import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { formatAdminDate } from './formatAdminDate';

export interface CredentialSheetItem {
  readonly id: string;
  readonly fullName: string;
  readonly mrn: string;
  /** Activation code, shown on this sheet only. It is never stored or cached. */
  readonly code: string;
  readonly expiresAt: string;
}

export interface CredentialSheetProps {
  readonly clinicName: string;
  readonly timeZone: string | undefined;
  readonly items: readonly CredentialSheetItem[];
  readonly issuedAt: string;
}

/**
 * Printable sheet with the activation codes of one issue. On screen it sits inside the issue
 * dialog; `@media print` in `console.css` prints only this element. The codes exist only in the
 * dialog's local state, so closing the dialog discards them.
 */
export function CredentialSheet({ clinicName, timeZone, items, issuedAt }: CredentialSheetProps) {
  return (
    <section className="credential-sheet" aria-labelledby="credential-sheet-title">
      <h2 id="credential-sheet-title" className="credential-sheet__title">
        {format(es.admin.issue.sheetTitle, { clinic: clinicName })}
      </h2>
      <p className="credential-sheet__meta">
        {format(es.admin.issue.sheetPrintedAt, { date: formatAdminDate(issuedAt, timeZone) })} ·{' '}
        {format(es.admin.issue.sheetItemCount, { count: items.length })}
      </p>
      <p className="credential-sheet__warning" role="note">
        {es.admin.issue.sheetWarning}
      </p>
      <table className="credential-sheet__table">
        <thead>
          <tr>
            <th scope="col">{es.admin.issue.sheetPatient}</th>
            <th scope="col">{es.admin.issue.sheetMrn}</th>
            <th scope="col">{es.admin.issue.sheetCode}</th>
            <th scope="col">{es.admin.issue.sheetExpires}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.fullName}</td>
              <td className="credential-sheet__mono">{item.mrn}</td>
              <td className="credential-sheet__mono credential-sheet__code">{item.code}</td>
              <td>{formatAdminDate(item.expiresAt, timeZone)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
