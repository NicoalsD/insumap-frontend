import { z } from 'zod';

/**
 * `POST /assistant/messages` (API.md, HU-42, IA6). Educational only: the assistant never gives doses
 * or diagnoses. Replies are plain text; the UI never renders them as HTML.
 */
export const ASSISTANT_ESCALATIONS = ['NONE', 'CONTACT_DOCTOR', 'EMERGENCY'] as const;
export const assistantEscalationSchema = z.enum(ASSISTANT_ESCALATIONS);
export type AssistantEscalation = z.infer<typeof assistantEscalationSchema>;

/** Approved clinic material the reply is based on. */
export const assistantCitationSchema = z.object({
  title: z.string(),
  source: z.string().optional(),
});
export type AssistantCitationDto = z.infer<typeof assistantCitationSchema>;

export const assistantReplySchema = z.object({
  reply_text: z.string(),
  citations: z.array(assistantCitationSchema).default([]),
  escalation: assistantEscalationSchema,
  is_fallback: z.boolean().default(false),
});
export type AssistantReplyDto = z.infer<typeof assistantReplySchema>;

/** Body of `POST /assistant/messages`. */
export interface AssistantMessageCreateDto {
  readonly message: string;
}

/** Key of `GET /meta/field-limits` for the assistant question; falls back to the message limit. */
export const ASSISTANT_LIMIT_KEYS = {
  assistantMax: 'assistant_message_max_length',
  messageMax: 'message_max_length',
} as const;
