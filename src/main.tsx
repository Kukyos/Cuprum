import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/archivo/wdth-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { loadModel } from './ai/classifier.ts';

const qs = new URLSearchParams(location.search);
if (!qs.has('noai')) loadModel(); // start the model download now, so it is ready by the time someone reaches the scanner
createRoot(document.getElementById('root')!).render(<App />);
