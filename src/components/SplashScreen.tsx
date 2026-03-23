import { useEffect, useState } from 'react'
import './SplashScreen.css'

export default function SplashScreen() {
  const [show, setShow] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    // Wait 2 seconds, then start fade
    const fadeTimer = setTimeout(() => {
      setFadeOut(true)
    }, 2000)

    // Remove from DOM after fade completes (2s wait + 0.5s fade)
    const hideTimer = setTimeout(() => {
      setShow(false)
    }, 2500)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (!show) return null

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <img src="/splash.jpg" alt="EV Dashboard" className="splash-image" />
        <div className="splash-title">⚡ EV Charging Dashboard</div>
      </div>
    </div>
  )
}
