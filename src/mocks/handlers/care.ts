import { http, HttpResponse } from 'msw';
import {
  MESSAGE_SENDER_ROLES,
  reminderUpdateSchema,
  type ClinicalNoteDto,
  type MessageDto,
} from '@/services/dto/care';
import { apiUrl } from '@/services/http/apiUrl';
import { HTTP_STATUS } from '@/services/http/httpStatus';
import { EMERGENCY_NOTICE, type ReminderRecord } from '../fixtures/care';
import { apiError, paginate, readBody, validationError } from '../http';
import type { MockState } from '../MockState';
import { guard } from './guard';

/**
 * Permissions of the patient and messaging endpoints (API.md 8.7, 8.11, 8.12). They are not in
 * `core/auth/permissions.ts` yet; the fixture accounts carry the same codes.
 */
export const CARE_PERMISSIONS = {
  treatmentPlanReadOwn: 'treatment_plans.read_own',
  remindersManageOwn: 'reminders.manage_own',
  clinicalNotesManage: 'clinical_notes.manage',
  messagesUseOwn: 'messages.use_own',
  messagesUseAssigned: 'messages.use_assigned',
} as const;

const FALLBACK_PAGE_DEFAULT = 20;
const FALLBACK_PAGE_MAX = 100;
const FALLBACK_NOTE_MAX = 500;
const FALLBACK_MESSAGE_MAX = 500;

/** Reminder as the API returns it: the plan lock stays inside the mock. */
const publicReminder = ({ id, label, time_of_day, enabled }: ReminderRecord) => ({
  id,
  label,
  time_of_day,
  enabled,
});

/**
 * Patient plan, reminders, clinical notes and the patient-doctor thread (API.md 8.7, 8.11, 8.12).
 * Every route checks the permission first, then looks at the record, so a missing permission is a
 * 403 and an unknown or unassigned patient is a 404.
 */
export function careHandlers(state: MockState) {
  const page = <T>(items: readonly T[], url: URL) =>
    paginate(
      items,
      url,
      state.limits['page_size_default'] ?? FALLBACK_PAGE_DEFAULT,
      state.limits['page_size_max'] ?? FALLBACK_PAGE_MAX,
    );
  const can = (permissions: readonly string[], code: string) => permissions.includes(code);

  return [
    http.get(apiUrl('/patients/own/treatment-plan'), ({ request }) => {
      const result = guard(state, request, CARE_PERMISSIONS.treatmentPlanReadOwn);
      if ('response' in result) return result.response;
      const plan = state.world.plans.get(result.account.id);
      return plan ? HttpResponse.json(plan) : apiError('NOT_FOUND');
    }),

    http.get(apiUrl('/reminders'), ({ request }) => {
      const result = guard(state, request, CARE_PERMISSIONS.remindersManageOwn);
      if ('response' in result) return result.response;
      const reminders = (state.world.reminders.get(result.account.id) ?? []).map(publicReminder);
      return HttpResponse.json(page(reminders, new URL(request.url)));
    }),

    http.patch(apiUrl('/reminders/:reminder_id'), async ({ request, params }) => {
      const result = guard(state, request, CARE_PERMISSIONS.remindersManageOwn);
      if ('response' in result) return result.response;
      // Only the patient's own reminders are searched: another patient's reminder is simply not found.
      const reminder = (state.world.reminders.get(result.account.id) ?? []).find(
        (item) => item.id === params['reminder_id'],
      );
      if (!reminder) return apiError('NOT_FOUND');
      const parsed = reminderUpdateSchema.safeParse((await readBody(request)) ?? {});
      if (!parsed.success) {
        return validationError(
          parsed.error.issues.map((issue) => ({
            field: `body.${issue.path.join('.')}`,
            type: issue.code,
          })),
        );
      }
      // The plan locks a reminder: it cannot be switched off or moved by the patient (API.md 8.7).
      const changesLocked =
        reminder.locked && (parsed.data.enabled === false || parsed.data.time_of_day !== undefined);
      if (changesLocked) return apiError('FORBIDDEN');
      if (parsed.data.enabled !== undefined) reminder.enabled = parsed.data.enabled;
      if (parsed.data.time_of_day !== undefined) reminder.time_of_day = parsed.data.time_of_day;
      return HttpResponse.json(publicReminder(reminder));
    }),

    http.get(apiUrl('/patients/:patient_id/clinical-notes'), ({ request, params }) => {
      const result = guard(state, request, CARE_PERMISSIONS.clinicalNotesManage);
      if ('response' in result) return result.response;
      const patient = String(params['patient_id']);
      if (!state.world.isAssigned(patient)) return apiError('NOT_FOUND');
      const notes = [...(state.world.notes.get(patient) ?? [])].reverse();
      return HttpResponse.json(page(notes, new URL(request.url)));
    }),

    http.post(apiUrl('/patients/:patient_id/clinical-notes'), async ({ request, params }) => {
      const result = guard(state, request, CARE_PERMISSIONS.clinicalNotesManage);
      if ('response' in result) return result.response;
      const patient = String(params['patient_id']);
      if (!state.world.isAssigned(patient)) return apiError('NOT_FOUND');
      const body = await readBody(request);
      const text = typeof body?.['body'] === 'string' ? body['body'].trim() : '';
      const maxLength = state.limits['note_max_length'] ?? FALLBACK_NOTE_MAX;
      if (text === '' || text.length > maxLength)
        return validationError([{ field: 'body.body', type: 'string' }]);
      const note: ClinicalNoteDto = {
        id: state.world.nextId('n1'),
        body: text,
        author_name: result.account.fullName,
        created_at: new Date().toISOString(),
      };
      state.world.notes.set(patient, [...(state.world.notes.get(patient) ?? []), note]);
      return HttpResponse.json(note, { status: HTTP_STATUS.CREATED });
    }),

    http.get(apiUrl('/messages'), ({ request }) => {
      const result = guard(state, request);
      if ('response' in result) return result.response;
      const url = new URL(request.url);
      const { account } = result;
      let thread: string;
      if (account.role === 'PATIENT') {
        if (!can(account.permissions, CARE_PERMISSIONS.messagesUseOwn))
          return apiError('FORBIDDEN');
        thread = account.id;
      } else if (account.role === 'DOCTOR') {
        if (!can(account.permissions, CARE_PERMISSIONS.messagesUseAssigned))
          return apiError('FORBIDDEN');
        const patient = url.searchParams.get('patient_id');
        if (patient === null)
          return validationError([{ field: 'query.patient_id', type: 'missing' }]);
        if (!state.world.isAssigned(patient)) return apiError('NOT_FOUND');
        thread = patient;
      } else {
        return apiError('FORBIDDEN');
      }
      const messages = state.world.messages.get(thread) ?? [];
      // Reading the thread marks the other side's messages as read by this viewer.
      const readerRole = account.role === 'PATIENT' ? 'PATIENT' : 'DOCTOR';
      const readAt = new Date().toISOString();
      for (const message of messages) {
        if (message.sender_role !== readerRole && message.read_at === null)
          message.read_at = readAt;
      }
      return HttpResponse.json({
        ...page([...messages].reverse(), url),
        emergency_notice: EMERGENCY_NOTICE,
      });
    }),

    http.post(apiUrl('/messages'), async ({ request }) => {
      const result = guard(state, request);
      if ('response' in result) return result.response;
      const { account } = result;
      const body = await readBody(request);
      const text = typeof body?.['body'] === 'string' ? body['body'].trim() : '';
      const maxLength = state.limits['message_max_length'] ?? FALLBACK_MESSAGE_MAX;
      let thread: string;
      let senderRole: (typeof MESSAGE_SENDER_ROLES)[number];
      if (account.role === 'PATIENT') {
        if (!can(account.permissions, CARE_PERMISSIONS.messagesUseOwn))
          return apiError('FORBIDDEN');
        thread = account.id;
        senderRole = 'PATIENT';
      } else if (account.role === 'DOCTOR') {
        if (!can(account.permissions, CARE_PERMISSIONS.messagesUseAssigned))
          return apiError('FORBIDDEN');
        const patient = typeof body?.['patient_id'] === 'string' ? body['patient_id'] : null;
        if (patient === null)
          return validationError([{ field: 'body.patient_id', type: 'missing' }]);
        if (!state.world.isAssigned(patient)) return apiError('NOT_FOUND');
        thread = patient;
        senderRole = 'DOCTOR';
      } else {
        return apiError('FORBIDDEN');
      }
      if (text === '' || text.length > maxLength)
        return validationError([{ field: 'body.body', type: 'string' }]);
      const message: MessageDto = {
        id: state.world.nextId('m1'),
        sender_role: senderRole,
        body: text,
        sent_at: new Date().toISOString(),
        read_at: null,
      };
      state.world.messages.set(thread, [...(state.world.messages.get(thread) ?? []), message]);
      return HttpResponse.json(message, { status: HTTP_STATUS.CREATED });
    }),
  ];
}
