import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkbenchWindow } from './workbench';
import './globals.css';

if (!window.arc) {
  throw new Error('Arc API not available. Ensure the app is running in Electron.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkbenchWindow />
  </StrictMode>
);