import { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorScreen } from './ErrorScreen';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in app tree:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <ErrorScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}
