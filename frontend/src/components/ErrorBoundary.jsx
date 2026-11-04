import { Component } from 'react';

/**
 * Catches a crash while rendering one screen so the rest of the app (sidebar,
 * navigation, sign-out) keeps working instead of the whole window going blank.
 * Pass a different `resetKey` (for example the current path) to clear the error
 * when the person navigates elsewhere.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[trackmaster-hub] screen crashed:', error, info?.componentStack);
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="app-empty" role="alert">
        <span className="app-empty__mark" aria-hidden="true">!</span>
        <h2>This screen hit a problem</h2>
        <p>Nothing you entered was lost on the server. Try again, or open another screen from the menu.</p>
        <p>
          <button type="button" className="btn btn--primary btn--small" onClick={() => this.setState({ error: null })}>Try again</button>{' '}
          {this.props.fullPage ? <button type="button" className="btn btn--outline btn--small" onClick={() => window.location.reload()}>Reload the page</button> : null}
        </p>
      </div>
    );
  }
}
