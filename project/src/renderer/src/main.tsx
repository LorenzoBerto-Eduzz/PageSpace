import './assets/main.css'
import './assets/dashboard.css'
import './assets/package-editor.css'
import './assets/settings.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { WindowChrome } from './components/WindowChrome'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WindowChrome />
    <App />
  </StrictMode>
)
