import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import TabBar from './components/TabBar'
import AddSheet from './components/AddSheet'
import { applyDensity, getStoredDensity } from './lib/density'
import './App.css'

export default function App() {
  const [adding, setAdding] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    applyDensity(getStoredDensity())
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <Outlet />
      <TabBar onAdd={() => setAdding(true)} />
      {adding && <AddSheet onClose={() => setAdding(false)} />}
    </>
  )
}
