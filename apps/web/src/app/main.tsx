import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/wght.css'
import './base.css'
import './reader.css'
import '../world/world.css'
import { ErrorBoundary } from './ErrorNotice'
import { Reader } from './Reader'

const root = document.getElementById('root')
if (!root) throw new Error('no #root element to mount into')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <Reader />
    </ErrorBoundary>
  </StrictMode>,
)
