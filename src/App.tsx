import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { chargingData } from './data/evData'
import SplashScreen from './components/SplashScreen'
import MonthlyCostChart from './components/MonthlyCostChart'
import MonthlyEnergyChart from './components/MonthlyEnergyChart'
import CostByTypeChart from './components/CostByTypeChart'
import './App.css'

// Month name formatting
const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Charger type icons (first letter)
const getChargerIcon = (type: string) => {
  const icons: Record<string, string> = {
    'Jolt': 'J',
    'Matty': 'M',
    'Chargefox': 'C',
    'Supercharger': 'S'
  }
  return icons[type] || type.charAt(0).toUpperCase()
}

const getChargerColor = (type: string) => {
  const colors: Record<string, string> = {
    'Jolt': '#10b981',
    'Matty': '#3b82f6',
    'Chargefox': '#8b5cf6',
    'Supercharger': '#ef4444'
  }
  return colors[type] || '#6b7280'
}

// Car image carousel - original plus 5 new photos
const CAR_IMAGES = ['/car.jpg', '/car1.jpg', '/car2.jpg', '/car3.jpg', '/car4.jpg', '/car5.jpg'];

function App() {
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState('All')
  const [selectedYear, setSelectedYear] = useState('All')
  const [currentCarImage, setCurrentCarImage] = useState(0)
  const [splashComplete, setSplashComplete] = useState(false)

  // Get unique years
  const years = useMemo(() => {
    const yearSet = new Set(chargingData.map(s => new Date(s.Date).getFullYear()))
    return ['All', ...Array.from(yearSet).sort().reverse()]
  }, [])

  // Filter data
  const filteredData = useMemo(() => {
    return chargingData.filter(session => {
      const matchType = selectedType === 'All' || session.Type === selectedType
      const sessionYear = new Date(session.Date).getFullYear().toString()
      const matchYear = selectedYear === 'All' || sessionYear === selectedYear
      
      return matchType && matchYear
    })
  }, [selectedType, selectedYear])

  // Summary stats
  const stats = useMemo(() => {
    const totalCost = filteredData.reduce((sum, s) => sum + s.Cost, 0)
    const totalKwh = filteredData.reduce((sum, s) => sum + s.Amount, 0)
    const avgCostPerKwh = totalKwh > 0 ? totalCost / totalKwh : 0
    const avgCostPerSession = filteredData.length > 0 ? totalCost / filteredData.length : 0
    
    return {
      totalSessions: filteredData.length,
      totalCost: totalCost.toFixed(2),
      totalKwh: totalKwh.toFixed(2),
      avgCostPerKwh: avgCostPerKwh.toFixed(3),
      avgCostPerSession: avgCostPerSession.toFixed(2),
    }
  }, [filteredData])

  // Cost by charger type
  const costByType = useMemo(() => {
    const grouped = filteredData.reduce((acc, session) => {
      if (!acc[session.Type]) {
        acc[session.Type] = { type: session.Type, cost: 0, kwh: 0, count: 0 }
      }
      acc[session.Type].cost += session.Cost
      acc[session.Type].kwh += session.Amount
      acc[session.Type].count += 1
      return acc
    }, {} as Record<string, { type: string, cost: number, kwh: number, count: number }>)
    
    return Object.values(grouped).map(item => ({
      ...item,
      cost: Number(item.cost.toFixed(2)),
      kwh: Number(item.kwh.toFixed(2)),
    }))
  }, [filteredData])

  // Monthly trends
  const monthlyData = useMemo(() => {
    const grouped = filteredData.reduce((acc, session) => {
      const date = new Date(session.Date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthKey, monthLabel: formatMonth(monthKey), cost: 0, kwh: 0, sessions: 0 }
      }
      acc[monthKey].cost += session.Cost
      acc[monthKey].kwh += session.Amount
      acc[monthKey].sessions += 1
      return acc
    }, {} as Record<string, { month: string, monthLabel: string, cost: number, kwh: number, sessions: number }>)
    
    return Object.values(grouped)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(item => ({
        ...item,
        cost: Number(item.cost.toFixed(2)),
        kwh: Number(item.kwh.toFixed(2)),
      }))
  }, [filteredData])

  return (
    <>
      <SplashScreen onComplete={() => setSplashComplete(true)} />
      <div className="app-container" style={{ visibility: splashComplete ? 'visible' : 'hidden' }}>
      {/* Header */}
      <h1 className="app-title">⚡ EV Charging Dashboard</h1>

      {/* Car Image - Click to cycle through photos */}
      <div className="car-image-container" style={{ marginBottom: '32px' }}>
        <img 
          src={CAR_IMAGES[currentCarImage]}
          alt="EV Car" 
          className="car-image clickable-car"
          onClick={() => setCurrentCarImage((prev) => (prev + 1) % CAR_IMAGES.length)}
          title="Click to see more photos"
        />
      </div>

      {/* Hero Card with 5 stats */}
      <div className="hero-card hero-spacing">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 md:gap-12">
          <div>
            <div className="hero-value">${stats.totalCost}</div>
            <div className="hero-label">Total Spent</div>
          </div>
          <div>
            <div className="hero-value">{stats.totalKwh}</div>
            <div className="hero-label">kWh Charged</div>
          </div>
          <div>
            <div className="hero-value">{stats.totalSessions}</div>
            <div className="hero-label">Sessions</div>
          </div>
          <div>
            <div className="hero-value">${stats.avgCostPerKwh}</div>
            <div className="hero-label">Avg $/kWh</div>
          </div>
          <div>
            <div className="hero-value">${stats.avgCostPerSession}</div>
            <div className="hero-label">Avg/Session</div>
          </div>
        </div>
      </div>

      {/* Year Filter Toggle */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'inline-flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          {years.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year.toString())}
              style={{
                padding: '8px 20px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: selectedYear === year.toString() ? 'rgba(59,130,246,0.3)' : 'transparent',
                color: selectedYear === year.toString() ? '#ffffff' : 'var(--muted)',
              }}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Clickable Legend for Charger Type Filter */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', borderRadius: '12px' }}>
        <h4 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Filter by Charger Type</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {['Jolt', 'Matty', 'Chargefox', 'Supercharger'].map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(selectedType === type ? 'All' : type)}
              className="charger-filter-button"
              data-selected={selectedType === type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                borderRadius: '10px',
                border: selectedType === type ? `2px solid ${getChargerColor(type)}` : '2px solid transparent',
                background: selectedType === type ? `${getChargerColor(type)}15` : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  background: `${getChargerColor(type)}20`,
                  color: getChargerColor(type),
                  flexShrink: 0,
                }}
              >
                {getChargerIcon(type)}
              </div>
              <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 500, flex: 1 }}>
                {type}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 chart-row-spacing">
        {/* Monthly Energy - 1 column */}
        <div className="glass-card p-6">
          <h3 className="chart-heading">
            <span>⚡</span>
            <span>Monthly Energy</span>
          </h3>
          <div className="chart-wrapper">
            <MonthlyEnergyChart data={monthlyData} />
          </div>
        </div>

        {/* Monthly Cost Trend - 2 columns */}
        <div className="lg:col-span-2 glass-card p-6 chart-mobile-spacing">
          <h3 className="chart-heading">
            <span>💰</span>
            <span>Monthly Cost Trend</span>
          </h3>
          <div className="chart-wrapper">
            <MonthlyCostChart data={monthlyData} />
          </div>
        </div>
      </div>

      {/* Cost by Type - Full Width */}
      <div className="glass-card p-6 chart-row-spacing">
        <h3 className="chart-heading">
          <span>🔌</span>
          <span>Cost by Charger Type</span>
        </h3>
        <div className="chart-wrapper">
          <CostByTypeChart data={costByType} />
        </div>
      </div>

      {/* History Button */}
      <div className="text-center mb-6">
        <button
          onClick={() => navigate('/history')}
          className="glass-input"
          style={{
            padding: '16px 48px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(59,130,246,0.15)',
            color: 'var(--text)',
            borderRadius: '12px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.25)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.15)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          📋 View Charging History
        </button>
      </div>

      {/* Footer */}
      <div className="text-center app-version">
        EV Charging Dashboard v2.9.0
      </div>
    </div>
    </>
  )
}

export default App
