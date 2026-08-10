import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './emulator.css';
import EmulatorApp from './EmulatorApp.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EmulatorApp />
  </StrictMode>,
);
