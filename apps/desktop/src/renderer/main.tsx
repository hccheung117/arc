import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkbenchWindow } from './workbench';
import './globals.css';

const CurrentWindow = WorkbenchWindow;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CurrentWindow />
  </StrictMode>
);
