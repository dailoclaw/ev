import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { chargingData, type ChargingSession } from './data/evData'
import MonthlyCostChart from './components/MonthlyCostChart'
import MonthlyEnergyChart from './components/MonthlyEnergyChart'
import CostByTypeChart from './components/CostByTypeChart'
import './App.css'

const chargerTypes = ['Jolt', 'Matty', 'Chargefox', 'Supercharger']

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
}

const formatShortDate = (dateStr: string) => (
  new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
)

const getChargerIcon = (type: string) => {
  const icons: Record<string, string> = {
    Jolt: 'J',
    Matty: 'M',
    Chargefox: 'C',
    Supercharger: 'S',
  }
  return icons[type] || type.charAt(0).toUpperCase()
}

const getChargerColor = (type: string) => {
  const colors: Record<string, string> = {
    Jolt: '#14b8a6',
    Matty: '#6366f1',
    Chargefox: '#8b5cf6',
    Supercharger: '#f43f5e',
  }
  return colors[type] || '#94a3b8'
}

const getSessionRate = (session: ChargingSession) => (
  session.Amount > 0 ? session.Cost / session.Amount : 0
)

function App() {
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState('All')
  const [selectedYear, setSelectedYear] = useState('All')

  const years = useMemo(() => {
    const yearSet = new Set(chargingData.map(s => new Date(s.Date).getFullYear()))
    return ['All', ...Array.from(yearSet).sort().reverse()]
  }, [])

  const filteredData = useMemo(() => {
    return chargingData.filter(session => {
      const sessionYear = new Date(session.Date).getFullYear().toString()
      return (
        (selectedType === 'All' || session.Type === selectedType) &&
        (selectedYear === 'All' || sessionYear === selectedYear)
      )
    })
  }, [selectedType, selectedYear])

  const sortedFilteredData = useMemo(() => {
    return [...filteredData].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
  }, [filteredData])

  const stats = useMemo(() => {
    const totalCost = filteredData.reduce((sum, s) => sum + s.Cost, 0)
    const totalKwh = filteredData.reduce((sum, s) => sum + s.Amount, 0)
    const avgCostPerKwh = totalKwh > 0 ? totalCost / totalKwh : 0
    const avgCostPerSession = filteredData.length > 0 ? totalCost / filteredData.length : 0

    return {
      totalSessions: filteredData.length,
      totalCost: totalCost.toFixed(2),
      totalKwh: totalKwh.toLocaleString('en-AU', { maximumFractionDigits: 0 }),
      avgCostPerKwh: avgCostPerKwh.toFixed(3),
      avgCostPerSession: avgCostPerSession.toFixed(2),
    }
  }, [filteredData])

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

  const recentSessions = sortedFilteredData.slice(0, 4)

  return (
    <main className="app-shell">
      <header className="mobile-appbar">
        <div>
          <p className="eyebrow">EV Command</p>
          <h1>Overview</h1>
          <span>{selectedType === 'All' ? 'All chargers' : selectedType} · {selectedYear === 'All' ? 'All years' : selectedYear}</span>
        </div>
        <button className="icon-button" type="button" aria-label="Open charging history" onClick={() => navigate('/history')}>
          →
        </button>
      </header>

      <section className="segmented-control" aria-label="Filter by year">
        {years.map(year => {
          const yearValue = year.toString()
          return (
            <button
              key={yearValue}
              type="button"
              className={selectedYear === yearValue ? 'active' : ''}
              onClick={() => setSelectedYear(yearValue)}
            >
              {yearValue === 'All' ? 'All' : yearValue}
            </button>
          )
        })}
      </section>

      <section className="ledger-hero">
        <span className="hero-caption">Total spent</span>
        <strong>${stats.totalCost}</strong>
        <p>{stats.totalSessions} charging sessions · {stats.totalKwh} kWh added</p>
      </section>

      <section className="metric-grid" aria-label="Charging summary">
        <article className="metric-card">
          <span>Energy</span>
          <strong>{stats.totalKwh}</strong>
          <small>kWh charged</small>
        </article>
        <article className="metric-card">
          <span>Sessions</span>
          <strong>{stats.totalSessions}</strong>
          <small>recorded stops</small>
        </article>
        <article className="metric-card">
          <span>Rate</span>
          <strong>${stats.avgCostPerKwh}</strong>
          <small>avg / kWh</small>
        </article>
        <article className="metric-card">
          <span>Avg stop</span>
          <strong>${stats.avgCostPerSession}</strong>
          <small>per session</small>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Chargers</h2>
            <p>Tap a provider to focus the ledger.</p>
          </div>
          {selectedType !== 'All' && (
            <button className="text-button" type="button" onClick={() => setSelectedType('All')}>
              Clear
            </button>
          )}
        </div>
        <div className="provider-chip-row" aria-label="Filter by charger type">
          {chargerTypes.map(type => {
            const color = getChargerColor(type)
            const providerStats = costByType.find(item => item.type === type)
            const isActive = selectedType === type

            return (
              <button
                key={type}
                type="button"
                className={`provider-chip ${isActive ? 'active' : ''}`}
                style={{ '--provider': color } as CSSProperties}
                onClick={() => setSelectedType(isActive ? 'All' : type)}
              >
                <span className="provider-mark">{getChargerIcon(type)}</span>
                <span>
                  <strong>{type}</strong>
                  <small>{providerStats ? `${providerStats.count} sessions` : '0 sessions'}</small>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Insights</h2>
            <p>Cost and energy trends for the active filter.</p>
          </div>
        </div>
        <article className="chart-card">
          <h3>Monthly cost</h3>
          <MonthlyCostChart data={monthlyData} />
        </article>
        <article className="chart-card">
          <h3>Monthly energy</h3>
          <MonthlyEnergyChart data={monthlyData} />
        </article>
        <article className="chart-card compact-chart">
          <h3>Provider split</h3>
          <CostByTypeChart data={costByType} />
        </article>
      </section>

      <section className="section-block bottom-spacer">
        <div className="section-heading">
          <div>
            <h2>Recent sessions</h2>
            <p>Latest records from your filtered ledger.</p>
          </div>
          <button className="text-button" type="button" onClick={() => navigate('/history')}>
            View all
          </button>
        </div>

        {recentSessions.length > 0 ? (
          <div className="session-list">
            {recentSessions.map((session, index) => (
              <article className="session-row" key={`${session.Date}-${session.Type}-${index}`}>
                <span className="provider-mark" style={{ '--provider': getChargerColor(session.Type) } as CSSProperties}>
                  {getChargerIcon(session.Type)}
                </span>
                <div>
                  <strong>{session.Type}</strong>
                  <small>{formatShortDate(session.Date)} · {session.Amount.toFixed(1)} kWh · ${getSessionRate(session).toFixed(3)}/kWh</small>
                </div>
                <b>${session.Cost.toFixed(2)}</b>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState onReset={() => {
            setSelectedType('All')
            setSelectedYear('All')
          }} />
        )}
      </section>

      <nav className="bottom-nav" aria-label="Primary">
        <button className="active" type="button" aria-current="page">
          <span>Overview</span>
        </button>
        <button type="button" onClick={() => navigate('/history')}>
          <span>History</span>
        </button>
      </nav>
    </main>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="empty-state">
      <strong>No matching sessions</strong>
      <p>Clear the charger or year filter to restore your charging ledger.</p>
      <button className="primary-button" type="button" onClick={onReset}>
        Clear filters
      </button>
    </div>
  )
}

export default App
