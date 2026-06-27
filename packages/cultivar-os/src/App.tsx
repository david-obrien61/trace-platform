import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { BusinessProvider } from '@trace/shared/context';
import { DebugPanel } from './components/DebugPanel';
import './styles/globals.css';

export function App() {
  return (
    <BrowserRouter>
      <BusinessProvider businessType="nursery" addBusinessHref="/add-business">
        <AppRouter />
      </BusinessProvider>
      {/* Field-debug panel — renders only when ?debug=1 (sticky) so demos stay clean. */}
      <DebugPanel />
    </BrowserRouter>
  );
}
