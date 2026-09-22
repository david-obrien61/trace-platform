// DEPLOY TRIGGER 2026-09-22 18:59Z (CONTACTS-349) — two EMPTY commits again failed to start a
// build, the same as at 13:42. Production is on 03bb38d and main carries the /inventory SKU
// search fix (#384, f695beca) that Lauren needs. Touching a real source file changes the
// bundle, which is what worked last time. Safe to delete once deploys are healthy.
// DEPLOY TRIGGER 2026-09-22 13:42 CDT — production served 9b2b30b for 92 minutes while main was
// 20 commits ahead, including the /orders/:id hotfix (#383). Two EMPTY commits did not start a
// build, so this touches a real source file to change the bundle. If you are reading this later and
// deploys are healthy, it is safe to delete.
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
