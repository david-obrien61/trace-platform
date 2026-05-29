import React from 'react'
import ReactDOM from 'react-dom/client'
import CoreApp from './CoreApp.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import DataBridge from './DataBridge.js'
import { BusinessProvider } from '@trace/shared/context'

window.addEventListener('error', (e) => {
  DataBridge.logError('UNHANDLED', e.message, e.error?.stack, {
    filename: e.filename, lineno: e.lineno,
  });
});

window.addEventListener('unhandledrejection', (e) => {
  DataBridge.logError('PROMISE', e.reason?.message || String(e.reason), e.reason?.stack);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BusinessProvider businessType="shop">
        <CoreApp />
      </BusinessProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
