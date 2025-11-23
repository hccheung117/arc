import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkbenchWindow } from './workbench';
import './globals.css';

if (!window.arc) {
  throw new Error('Arc API not available. Ensure the app is running in Electron.')
}

const CurrentWindow = WorkbenchWindow;

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <CurrentWindow />
  </StrictMode>
);
