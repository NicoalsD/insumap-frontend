import { Bot, User } from 'lucide-react';
import type { ReactNode } from 'react';
import './ai-chat.css';

export interface MessageProps {
  /** `user` is the patient (right, cobalt); `assistant` is the educational assistant (left, white). */
  from: 'user' | 'assistant';
  /** Role label above the text, for example "Tú" or "Asistente educativo". */
  author: string;
  /** Plain text only: the reply is never rendered as HTML. */
  children: ReactNode;
  meta?: string | undefined;
  className?: string;
}

/**
 * One chat turn: avatar, role and the text in the bubble. The bubble uses `thread__bubble`, the same
 * class as the doctor thread in Mensajes, so both chats share colors and shape.
 */
export function Message({ from, author, children, meta, className }: MessageProps) {
  const isUser = from === 'user';
  const Icon = isUser ? User : Bot;
  return (
    <article className={`ai-message ${className ?? ''}`.trim()} data-from={from}>
      <span className="ai-message__avatar" aria-hidden="true">
        <Icon size="1.125rem" />
      </span>
      <div className="thread__bubble ai-message__bubble" data-sender={isUser ? 'PATIENT' : 'DOCTOR'}>
        <span className="thread__meta">
          {author}
          {meta ? ` · ${meta}` : ''}
        </span>
        <span className="ai-message__text">{children}</span>
      </div>
    </article>
  );
}
