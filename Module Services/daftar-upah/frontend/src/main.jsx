import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/theme.css'
import './styles/animations.css'
import './styles/sawit-report-theme.css'
import './styles/present.css'
import './utils/httpSetup'
// ag-grid-enterprise removed from global scope — only dead code (LegacyPayrollGrid.jsx) used it.
// Active AG Grid usage (AgGridWrapper.jsx) only needs community features.

// Force disable cache in development
if (import.meta.env.DEV) {
  localStorage.setItem('disable-cache', Date.now().toString())
  sessionStorage.setItem('cache-buster', Date.now().toString())
}

const mount = document.getElementById('root') || (() => {
  const el = document.createElement('div')
  el.id = 'root'
  document.body.appendChild(el)
  return el
})()

ReactDOM.createRoot(mount).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
