import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { BusinessProvider } from '@trace/shared/context';
import './styles/globals.css';

export function App() {
  return (
    <BrowserRouter>
      <BusinessProvider businessType="nursery">
        <AppRouter />
      </BusinessProvider>
    </BrowserRouter>
  );
}
