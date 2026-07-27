import './assets/main.css'
import './assets/dashboard.css'
import './assets/editor.css'
import './assets/settings.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
