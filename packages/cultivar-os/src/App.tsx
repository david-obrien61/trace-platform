import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { NurseryProvider } from './context/NurseryProvider';
import './styles/globals.css';

export function App() {
  return (
    <BrowserRouter>
      <NurseryProvider>
        <AppRouter />
      </NurseryProvider>
    </BrowserRouter>
  );
}
