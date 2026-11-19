import { ArrowUp, Square } from 'lucide-react';
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react';
import './ai-chat.css';

/** Six lines of text (line height 1.5 at 18 px, plus padding) before the field stops growing. */
const MAX_TEXTAREA_PX = 168;

export interface PromptInputProps {
  id: string;
  /** Accessible label; visually hidden, the placeholder carries the look. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** Shows the stop button instead of send while a reply is pending. */
  pending: boolean;
  onStop?: (() => void) | undefined;
  disabled?: boolean | undefined;
  /** Visible text of the send button, and its accessible name. */
  sendLabel: string;
  sendAriaLabel?: string | undefined;
  stopLabel: string;
  placeholder?: string | undefined;
  /** Shown under the field, for example the length counter or a validation message. */
  footer?: ReactNode;
  invalid?: boolean | undefined;
  describedBy?: string | undefined;
  className?: string;
}

/**
 * Chat prompt: a rounded field with a textarea that grows up to six lines. Enter sends,
 * Shift+Enter adds a line, and the button turns into a stop control while a reply is pending.
 *
 * Pattern: none (anatomy of the AI Elements PromptInput, without the AI SDK).
 */
export function PromptInput({
  id,
  label,
  value,
  onChange,
  onSubmit,
  pending,
  onStop,
  disabled = false,
  sendLabel,
  sendAriaLabel,
  stopLabel,
  placeholder,
  footer,
  invalid,
  describedBy,
  className,
}: PromptInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${String(Math.min(node.scrollHeight, MAX_TEXTAREA_PX))}px`;
  }, [value]);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (pending || disabled) return;
    onSubmit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(event);
    }
  };

  return (
    <form className={`ai-prompt ${className ?? ''}`.trim()} onSubmit={submit}>
      <label htmlFor={id} className="ai-prompt__label">
        {label}
      </label>
      <div className="ai-prompt__field" data-invalid={invalid ? "true" : undefined}>
        <textarea
          ref={ref}
          id={id}
          name="message"
          rows={1}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="ai-prompt__textarea"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        {pending ? (
          <button type="button" className="ai-button" data-variant="outline" onClick={onStop}>
            <Square aria-hidden="true" size="1em" fill="currentColor" />
            {stopLabel}
          </button>
        ) : (
          <button type="submit" className="ai-button" disabled={disabled} aria-label={sendAriaLabel}>
            {sendLabel}
            <ArrowUp aria-hidden="true" size="1.25em" />
          </button>
        )}
      </div>
      {footer}
    </form>
  );
}
