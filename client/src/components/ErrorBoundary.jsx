import { Component } from 'react';

// Catches render errors in the page area so one bad response doesn't blank the app.
// Resets when resetKey changes (the route), so navigating away also recovers.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="realm-panel text-center space-y-3" style={{ padding: '2rem 1rem' }}>
        <div style={{ fontSize: '1.5rem' }}>⚔</div>
        <p className="text-realm-text">Something went wrong loading this page.</p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button className="realm-btn-gold" onClick={() => this.setState({ error: null })}>Try again</button>
          {/* A failed lazy chunk stays cached, so a full reload is the reliable fallback */}
          <button
            className="font-mono"
            onClick={() => window.location.reload()}
            style={{ fontSize: '0.75rem', color: '#8090a8', border: '1px solid #243650', padding: '6px 18px', background: 'transparent', cursor: 'pointer' }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
