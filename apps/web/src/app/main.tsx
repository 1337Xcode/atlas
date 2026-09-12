import React from 'react'
import { createRoot } from 'react-dom/client'
import { Reader as App } from './Reader'
import '@fontsource-variable/geist/wght.css'
import './reader.css'
import { ErrorBoundary } from './ErrorNotice'
import './index.css'

// feat: ?studio=1 opens the theatre timeline for authoring the beats by hand
if (new URLSearchParams(location.search).get('studio') === '1') {
  const studio = (await import('@theatre/studio')).default
  studio.initialize()
}

const root = document.getElementById('root')
if (!root) throw new Error('no #root element to mount into')

createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
