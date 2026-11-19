import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { ApiError } from '@/services/api/ApiError';
import type { AssistantCitationDto, AssistantEscalation, AssistantReplyDto } from '@/services/dto/assistant';
import { ASSISTANT_LIMIT_KEYS } from '@/services/dto/assistant';
import type { FieldLimitsDto } from '@/services/dto/meta';

/** HTTP status the API answers when a patient asks too often (API.md rate limits). */
const TOO_MANY_REQUESTS = 429;

export interface ChatTurn {
  readonly id: string;
  readonly from: 'user' | 'assistant';
  readonly text: string;
  readonly citations?: readonly AssistantCitationDto[];
  readonly escalation?: AssistantEscalation;
  readonly fallback?: boolean;
}

/** Limit of the question, from the API's field limits; the message limit is the fallback. */
export function questionMax(limits: FieldLimitsDto): number | undefined {
  return limits[ASSISTANT_LIMIT_KEYS.assistantMax] ?? limits[ASSISTANT_LIMIT_KEYS.messageMax];
}

/** Checks the question before it is sent. Returns the Spanish message, or null when it can go. */
export function checkQuestion(text: string, limits: FieldLimitsDto): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return es.patient.assistant.required;
  const max = questionMax(limits);
  if (max !== undefined && trimmed.length > max) return format(es.patient.assistant.tooLong, { max });
  return null;
}

/** Whether a reply ends the educational talk: an emergency stops it, a doctor call does not. */
export function endsTalk(escalation: AssistantEscalation): boolean {
  return escalation === 'EMERGENCY';
}

/** Spanish text for a failed request. A 429 gets its own, clear message. */
export function failureText(error: unknown): string {
  if (error instanceof ApiError && error.status === TOO_MANY_REQUESTS) return es.patient.assistant.rateLimited;
  return es.patient.assistant.failed;
}

export function replyTurn(id: string, reply: AssistantReplyDto): ChatTurn {
  return {
    id,
    from: 'assistant',
    text: reply.reply_text,
    citations: reply.citations,
    escalation: reply.escalation,
    fallback: reply.is_fallback,
  };
}
