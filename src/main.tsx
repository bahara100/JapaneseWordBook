import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SpeechProvider } from './speech/SpeechProvider';
import { StorageProvider } from './storage/StorageProvider';
import './styles/base.css';
import './styles/polish.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(<StrictMode><StorageProvider><SpeechProvider><App /></SpeechProvider></StorageProvider></StrictMode>);
