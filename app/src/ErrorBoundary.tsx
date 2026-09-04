import { Component, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** Never show a black canvas on stage. If the scene throws, fall back to something honest. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[DRISHTI] scene error, falling back:', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
