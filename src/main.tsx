import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './App.css'
import AuthGate from './components/AuthGate.tsx'
import AchievementCelebration from './components/AchievementCelebration.tsx'
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

const achievementPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('previewAchievement')
if (achievementPreview) document.documentElement.dataset.previewMotion = 'true'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {achievementPreview ? (
      <BrowserRouter>
        <main className="achievement-preview-stage" aria-label="Achievement animation preview" />
        <AchievementCelebration preview />
      </BrowserRouter>
    ) : (
      <AuthGate>
        <AppRoutes />
      </AuthGate>
    )}
  </StrictMode>,
)
