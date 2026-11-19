import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { CredentialInvitationDto } from '@/services/dto/admin';
import { useApi } from '@/state/useApi';
import { Button } from '@/ui/Button';
import { useToast } from '@/ui/useToast';
import { CredentialSheet, type CredentialSheetItem } from './CredentialSheet';
import { useClinic, invalidateAdminData } from './adminQueries';
import './console.css';

export type IssueChannel = CredentialInvitationDto['channel'];

/** A patient the console issues a credential to. Identity fields only, never clinical data. */
export interface IssueTarget {
  readonly id: string;
  readonly fullName: string;
  readonly mrn: string;
}

export interface IssueCredentialsDialogProps {
  readonly open: boolean;
  readonly targets: readonly IssueTarget[];
  /** Called when the dialog closes. The parent clears its target list. */
  readonly onClose: () => void;
  /** Dialog title override, e.g. "Reenviar credencial" for a single resend. */
  readonly resend?: boolean;
}

interface Outcome {
  readonly channel: IssueChannel;
  readonly issued: readonly CredentialSheetItem[];
  readonly failed: readonly IssueTarget[];
  readonly issuedAt: string;
}

type Phase = 'choose' | 'working' | 'done';

/**
 * Asks the channel, issues one credential per target through `POST .../credential-invitations`
 * and, for print, shows the activation codes on a printable sheet. The codes live only in this
 * component's state: closing the dialog discards them and they are never cached or logged.
 *
 * Built on the native `<dialog>` with `showModal()`: focus, Esc and the inert page come from the
 * browser.
 */
export function IssueCredentialsDialog({ open, targets, onClose, resend = false }: IssueCredentialsDialogProps) {
  const { api } = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const clinic = useClinic();
  const titleId = useId();
  const channelName = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [channel, setChannel] = useState<IssueChannel>('PRINT');
  const [phase, setPhase] = useState<Phase>('choose');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const reset = () => {
    setPhase('choose');
    setOutcome(null);
    setChannel('PRINT');
  };

  const issue = async () => {
    setPhase('working');
    const settled = await Promise.all(
      targets.map(async (target) => {
        try {
          const invitation = await api.issueCredentials(target.id, channel);
          return { target, invitation };
        } catch {
          return { target, invitation: null };
        }
      }),
    );
    const issuedAt = new Date().toISOString();
    const issued = settled.flatMap(({ target, invitation }) =>
      invitation === null
        ? []
        : [
            {
              id: target.id,
              fullName: target.fullName,
              mrn: target.mrn,
              code: invitation.activation_code ?? '',
              expiresAt: invitation.expires_at,
            },
          ],
    );
    const failed = settled.filter((entry) => entry.invitation === null).map((entry) => entry.target);
    setOutcome({ channel, issued, failed, issuedAt });
    setPhase('done');
    await invalidateAdminData(queryClient);

    if (failed.length === 0) {
      toast.show(es.admin.issue.successToast, 'success');
    } else if (issued.length === 0) {
      toast.show(es.admin.issue.failedToast, 'critical');
    } else {
      toast.show(format(es.admin.issue.partialToast, { issued: issued.length, total: targets.length }), 'critical');
    }
  };

  const leadText =
    targets.length === 1 && targets[0]
      ? format(es.admin.issue.dialogLeadOne, { name: targets[0].fullName })
      : format(es.admin.issue.dialogLeadMany, { count: targets.length });

  const printable = outcome?.channel === 'PRINT' ? outcome.issued.filter((item) => item.code !== '') : [];

  return (
    <dialog
      ref={dialogRef}
      className="credential-dialog"
      aria-labelledby={titleId}
      onClose={() => {
        reset();
        onClose();
      }}
      onCancel={(event) => {
        // Esc does not discard codes while the issue is still running.
        if (phase === 'working') event.preventDefault();
      }}
    >
      <h2 id={titleId} className="credential-dialog__title no-print">
        {resend ? es.admin.patients.resend : es.admin.issue.dialogTitle}
      </h2>

      {phase === 'choose' ? (
        <form
          className="no-print"
          onSubmit={(event) => {
            event.preventDefault();
            void issue();
          }}
        >
          <p>{leadText}</p>
          <fieldset className="credential-dialog__choices">
            <legend>{es.admin.issue.channelLegend}</legend>
            {(['PRINT', 'EMAIL'] as const).map((value) => (
              <label key={value} className="credential-choice">
                <input
                  type="radio"
                  name={channelName}
                  value={value}
                  checked={channel === value}
                  onChange={() => { setChannel(value); }}
                />
                <span>{es.admin.channel[value]}</span>
                <span className="credential-choice__hint">
                  {value === 'PRINT' ? es.admin.issue.printHint : es.admin.issue.emailHint}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="credential-dialog__actions">
            <Button type="button" variant="secondary" onClick={() => { dialogRef.current?.close(); }}>
              {es.admin.issue.cancel}
            </Button>
            <Button type="submit" disabled={targets.length === 0}>
              {es.admin.issue.confirm}
            </Button>
          </div>
        </form>
      ) : null}

      {phase === 'working' ? (
        <p className="no-print" role="status" aria-live="polite">
          {es.admin.issue.issuing}
        </p>
      ) : null}

      {phase === 'done' && outcome ? (
        <div className="credential-dialog__result">
          {outcome.channel === 'PRINT' && printable.length > 0 ? (
            <>
              <CredentialSheet
                clinicName={clinic.data?.name ?? ''}
                timeZone={clinic.data?.timezone}
                items={printable}
                issuedAt={outcome.issuedAt}
              />
              <div className="credential-dialog__actions no-print">
                <Button variant="secondary" onClick={() => { window.print(); }}>
                  {es.admin.issue.printSheet}
                </Button>
              </div>
            </>
          ) : null}
          {outcome.channel === 'EMAIL' && outcome.issued.length > 0 ? (
            <p>{format(es.admin.issue.emailDone, { count: outcome.issued.length })}</p>
          ) : null}
          {outcome.issued.length === 0 ? <p role="alert">{es.admin.issue.allFailed}</p> : null}
          {outcome.failed.length > 0 ? (
            <section className="no-print" aria-labelledby={`${titleId}-failed`}>
              <h3 id={`${titleId}-failed`}>{es.admin.issue.failedList}</h3>
              <p>
                {format(es.admin.issue.partialFailure, { failed: outcome.failed.length, total: targets.length })}
              </p>
              <ul>
                {outcome.failed.map((target) => (
                  <li key={target.id}>{target.fullName}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <div className="credential-dialog__actions no-print">
            <Button onClick={() => { dialogRef.current?.close(); }}>{es.admin.issue.done}</Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
