import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/inter/wght.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/app-shell.css';
import './styles/workspace-polish.css';
import './styles/operations.css';
import './styles/salesperson.css';
import './styles/commercial.css';
import './styles/manager.css';

import App from './App.jsx';
import { AuthProvider } from './context/AuthProvider.jsx';
import { SystemHealthProvider } from './context/SystemHealthProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SystemHealthProvider>
          <App />
        </SystemHealthProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
