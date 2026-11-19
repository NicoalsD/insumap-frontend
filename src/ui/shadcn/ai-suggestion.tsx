import type { ReactNode } from 'react';
import './ai-chat.css';

/** Row of suggested questions as chips: no bullets, wraps on narrow screens. */
export function Suggestions({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <ul aria-label={label} className={`ai-suggestions ${className ?? ''}`.trim()}>
      {children}
    </ul>
  );
}

export interface SuggestionProps {
  suggestion: string;
  onSelect: (suggestion: string) => void;
  disabled?: boolean | undefined;
}

/** One suggested question: a thin cobalt pill with 15 px text. */
export function Suggestion({ suggestion, onSelect, disabled }: SuggestionProps) {
  return (
    <li>
      <button
        type="button"
        className="ai-suggestion"
        disabled={disabled}
        onClick={() => {
          onSelect(suggestion);
        }}
      >
        {suggestion}
      </button>
    </li>
  );
}
