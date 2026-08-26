import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import TabBar from './components/TabBar'
import AddSheet from './components/AddSheet'
import AchievementCelebration from './components/AchievementCelebration'
import { applyDensity, getStoredDensity } from './lib/density'
import { applyStyle, getStoredStyle } from './lib/style'
import { applyTheme, getStoredTheme } from './lib/theme'
import { useEvState } from './lib/data'

export default function App() {
  const [adding, setAdding] = useState(false)
  const { pathname } = useLocation()
  const { settings } = useEvState()

  useEffect(() => {
    applyDensity(getStoredDensity())
    applyStyle(getStoredStyle())
    applyTheme(getStoredTheme())
  }, [])

  useEffect(() => {
    applyDensity(settings.density)
    applyStyle(settings.style)
    applyTheme(settings.theme)
  }, [settings.density, settings.style, settings.theme])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <Outlet />
      <TabBar onAdd={() => setAdding(true)} />
      {adding && <AddSheet onClose={() => setAdding(false)} />}
      <AchievementCelebration />
    </>
  )
}
