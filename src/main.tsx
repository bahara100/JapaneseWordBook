import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StorageProvider } from './storage/StorageProvider';
import './styles/base.css';
import './styles/polish.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(<StrictMode><StorageProvider><App /></StorageProvider></StrictMode>);
