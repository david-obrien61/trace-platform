import React from 'react';
import DataBridge from './DataBridge';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { caught: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { caught: true, message: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, info) {
    DataBridge.logError('RENDER', error?.message, error?.stack, {
      component: info?.componentStack?.split('\n')?.[1]?.trim() || 'unknown',
    });
  }

  render() {
    if (!this.state.caught) return this.props.children;
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
          <span className="text-3xl">⚠</span>
        </div>
        <p className="text-white font-black text-xl uppercase tracking-tight mb-2">Something went wrong</p>
        <p className="text-slate-500 text-sm mb-8 max-w-xs">{this.state.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs py-3 px-6 rounded-2xl uppercase tracking-widest transition-colors"
        >
          Reload App
        </button>
        <p className="text-slate-700 text-[9px] mt-4 uppercase tracking-widest">Error reported automatically</p>
      </div>
    );
  }
}
