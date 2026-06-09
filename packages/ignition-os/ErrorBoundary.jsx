import React from 'react';
import DataBridge from './DataBridge';

const STYLE_DEBUG = false;

// Non-1:1: hover:bg-blue-500 on Reload button → ign-btn-primary CSS class
// [TRACE:STYLE] ErrorBoundary converted, 7 classNames → inline, 1 non-1:1:
//   (1) hover:bg-blue-500 on Reload button → ign-btn-primary CSS class

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { caught: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { caught: true, message: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, info) {
    if (STYLE_DEBUG) console.log('[TRACE:STYLE] ErrorBoundary converted, 7 classNames → inline, 1 non-1:1');
    DataBridge.logError('RENDER', error?.message, error?.stack, {
      component: info?.componentStack?.split('\n')?.[1]?.trim() || 'unknown',
    });
  }

  render() {
    if (!this.state.caught) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{
          width: 64,
          height: 64,
          backgroundColor: 'rgba(239,68,68,0.1)',
          borderRadius: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <span style={{ fontSize: 30 }}>⚠</span>
        </div>
        <p style={{ color: '#ffffff', fontWeight: 900, fontSize: 20, textTransform: 'uppercase', letterSpacing: '-0.025em', marginBottom: 8 }}>
          Something went wrong
        </p>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 32, maxWidth: 288 }}>
          {this.state.message}
        </p>
        <button
          className="ign-btn-primary"
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: 12,
            paddingTop: 12,
            paddingBottom: 12,
            paddingLeft: 24,
            paddingRight: 24,
            borderRadius: 16,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            border: 'none',
          }}
        >
          Reload App
        </button>
        <p style={{ color: '#334155', fontSize: 9, marginTop: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Error reported automatically
        </p>
      </div>
    );
  }
}
