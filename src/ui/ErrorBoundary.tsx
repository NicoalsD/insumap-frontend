import { Component, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import { Button } from './Button';
import './States.css';

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

/**
 * Last line of defense for render errors: shows a calm message and a reload action. It logs the
 * error name only (never the message or component stack) because those can carry health data.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    console.error(`UI error: ${error.name}`);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="ui-state" role="alert">
        <h1 className="ui-state__title">{es.states.unexpectedTitle}</h1>
        <p className="ui-state__body">{es.states.unexpectedBody}</p>
        <Button onClick={() => { location.reload(); }}>{es.states.reload}</Button>
      </div>
    );
  }
}
