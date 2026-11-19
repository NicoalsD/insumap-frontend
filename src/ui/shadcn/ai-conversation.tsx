import { ArrowDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import './ai-chat.css';

/** Distance from the bottom (px) under which the conversation counts as "at the end". */
const AT_END_THRESHOLD_PX = 48;

export interface ConversationProps {
  children: ReactNode;
  /** Accessible name of the log (already in Spanish). */
  label: string;
  /** Text of the "go to the end" button. */
  scrollLabel: string;
  className?: string;
}

/**
 * Scrollable message log that stays pinned to the newest message while the reader is at the end.
 * When the reader scrolls up, new messages do not move the view; a button brings them back down.
 *
 * Pattern: none (anatomy of the AI Elements Conversation, without the AI SDK).
 */
export function Conversation({ children, label, scrollLabel, className }: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    setAtEnd(node.scrollHeight - node.scrollTop - node.clientHeight <= AT_END_THRESHOLD_PX);
  }, []);

  const scrollToEnd = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    setAtEnd(true);
  }, []);

  // Pinned to the end while the reader is there: new messages keep the newest one in view.
  useEffect(() => {
    const node = scrollRef.current;
    if (atEnd && node) node.scrollTop = node.scrollHeight;
  });

  return (
    <div className={`ai-conversation ${className ?? ''}`.trim()}>
      <div ref={scrollRef} role="log" aria-label={label} aria-live="polite" tabIndex={0} onScroll={measure} className="ai-conversation__log">
        {children}
      </div>
      {atEnd ? null : (
        <button type="button" className="ai-button ai-conversation__scroll-end" data-variant="outline" onClick={scrollToEnd}>
          <ArrowDown aria-hidden="true" size="1.125em" />
          {scrollLabel}
        </button>
      )}
    </div>
  );
}
