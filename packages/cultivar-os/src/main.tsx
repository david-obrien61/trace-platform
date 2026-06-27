import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installCapture } from '@trace/shared/debug';
import { App } from './App';

// Field-debug capture — install BEFORE React so the earliest [TRACE:*] + any
// boot-time crash is buffered (survives white-screen/reload). [TRACE:CAPTURE] ON.
installCapture();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
