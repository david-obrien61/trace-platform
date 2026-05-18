import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import './styles/globals.css';

export function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
