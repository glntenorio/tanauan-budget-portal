import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import PortalProvider from './components/PortalProvider';
import './styles/theme.css';
import './styles/app.css';
import './styles/gt-shell.css';
import './styles/local.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* BASE_URL is "/" on its own host, or a sub-path (glentenorio.com/tools/…) when built with PORTAL_BASE. */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <PortalProvider>
        <App />
      </PortalProvider>
    </BrowserRouter>
  </StrictMode>,
);
