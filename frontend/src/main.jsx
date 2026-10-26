import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/inter/wght.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/pages.css';

import App from './App.jsx';
import { SystemHealthProvider } from './context/SystemHealthProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SystemHealthProvider>
        <App />
      </SystemHealthProvider>
    </BrowserRouter>
  </StrictMode>,
);
