import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthGate from './components/AuthGate.tsx'
import AppRoutes from './AppRoutes.tsx'

// Apply the locally mirrored theme before React paints. Keeping this in the
// bundled module lets production use a strict script-src CSP without inline JS.
try {
  if (localStorage.getItem('ev.theme') === 'dark') {
    document.documentElement.dataset.theme = 'dark'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#000000')
  }
  if (localStorage.getItem('ev.style') === 'minimal') document.documentElement.dataset.style = 'minimal'
} catch {
  // Storage can be disabled in private browsing; defaults remain usable.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <AppRoutes />
    </AuthGate>
  </StrictMode>,
)
