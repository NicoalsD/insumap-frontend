import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import './Tabs.css';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}

export interface TabsProps {
  /** Accessible name of the tab list. */
  readonly label: string;
  readonly items: readonly TabItem[];
  readonly defaultTabId?: string;
}

/**
 * ARIA tabs with automatic activation: arrow keys move focus and selection, Home and End jump
 * to the ends, and only the selected tab is in the Tab order (roving tabindex).
 */
export function Tabs({ label, items, defaultTabId }: TabsProps) {
  const baseId = useId();
  const [selectedId, setSelectedId] = useState(defaultTabId ?? items[0]?.id);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const select = (index: number) => {
    const item = items[(index + items.length) % items.length];
    if (!item) return;
    setSelectedId(item.id);
    tabRefs.current.get(item.id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const moves: Record<string, number | undefined> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: items.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  };

  return (
    <div className="ui-tabs">
      <div className="ui-tabs__list" role="tablist" aria-label={label}>
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => {
              if (node) tabRefs.current.set(item.id, node);
              else tabRefs.current.delete(item.id);
            }}
            type="button"
            role="tab"
            className="ui-tabs__tab"
            id={`${baseId}-tab-${item.id}`}
            aria-selected={item.id === selectedId}
            aria-controls={`${baseId}-panel-${item.id}`}
            tabIndex={item.id === selectedId ? 0 : -1}
            onClick={() => { setSelectedId(item.id); }}
            onKeyDown={(event) => { onKeyDown(event, index); }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          className="ui-tabs__panel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== selectedId}
          tabIndex={item.id === selectedId ? 0 : undefined}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
