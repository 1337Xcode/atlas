import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
if (new URLSearchParams(location.search).get('studio') === '1') {
  const studio = (await import('@theatre/studio')).default; const { extension } = await import('@theatre/r3f'); studio.extend(extension); studio.initialize();
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
