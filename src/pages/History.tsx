import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { chargingData, type ChargingSession } from '../data/evData'
import '../App.css'

const chargerTypes = ['Jolt', 'Matty', 'Chargefox', 'Supercharger']

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

const formatDate = (dateStr: string) => (
  new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
)

const formatMonth = (dateStr: string) => (
  new Date(dateStr).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
)

const getSessionRate = (session: ChargingSession) => (
  session.Amount > 0 ? session.Cost / session.Amount : 0
)

export default function History() {
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState('All')
  const [selectedYear, setSelectedYear] = useState('All')
  const [selectedSession, setSelectedSession] = useState<ChargingSession | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const years = useMemo(() => {
    const yearSet = new Set(chargingData.map(s => new Date(s.Date).getFullYear()))
    return ['All', ...Array.from(yearSet).sort().reverse()]
  }, [])

  const filteredData = useMemo(() => {
    return chargingData
      .filter(session => {
        const sessionYear = new Date(session.Date).getFullYear().toString()
        return (
          (selectedType === 'All' || session.Type === selectedType) &&
          (selectedYear === 'All' || sessionYear === selectedYear)
        )
      })
      .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
  }, [selectedType, selectedYear])

  const groupedSessions = useMemo(() => {
    return filteredData.reduce((groups, session) => {
      const month = formatMonth(session.Date)
      if (!groups[month]) groups[month] = []
      groups[month].push(session)
      return groups
    }, {} as Record<string, ChargingSession[]>)
  }, [filteredData])

  const totalCost = useMemo(() => (
    filteredData.reduce((sum, session) => sum + session.Cost, 0)
  ), [filteredData])

  const resetFilters = () => {
    setSelectedType('All')
    setSelectedYear('All')
  }

  return (
    <main className="app-shell">
      <header className="mobile-appbar">
        <div>
          <p className="eyebrow">EV Command</p>
          <h1>History</h1>
          <span>{filteredData.length} sessions · ${totalCost.toFixed(2)} spent</span>
        </div>
        <button className="icon-button" type="button" aria-label="Back to overview" onClick={() => navigate('/')}>
          ←
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

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Chargers</h2>
            <p>Refine the list without leaving history.</p>
          </div>
          {(selectedType !== 'All' || selectedYear !== 'All') && (
            <button className="text-button" type="button" onClick={resetFilters}>
              Reset
            </button>
          )}
        </div>
        <div className="provider-chip-row" aria-label="Filter by charger type">
          {chargerTypes.map(type => {
            const isActive = selectedType === type
            const count = chargingData.filter(session => {
              const sessionYear = new Date(session.Date).getFullYear().toString()
              return session.Type === type && (selectedYear === 'All' || sessionYear === selectedYear)
            }).length

            return (
              <button
                key={type}
                type="button"
                className={`provider-chip ${isActive ? 'active' : ''}`}
                style={{ '--provider': getChargerColor(type) } as CSSProperties}
                onClick={() => setSelectedType(isActive ? 'All' : type)}
              >
                <span className="provider-mark">{getChargerIcon(type)}</span>
                <span>
                  <strong>{type}</strong>
                  <small>{count} sessions</small>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="section-block bottom-spacer">
        <div className="section-heading">
          <div>
            <h2>Sessions</h2>
            <p>{selectedType === 'All' ? 'All charger records' : `${selectedType} records`} sorted newest first.</p>
          </div>
        </div>

        {filteredData.length > 0 ? (
          <div className="history-groups">
            {Object.entries(groupedSessions).map(([month, sessions]) => (
              <section className="history-group" key={month}>
                <h3>{month}</h3>
                <div className="session-list">
                  {sessions.map((session, index) => (
                    <button
                      className="session-row interactive"
                      key={`${session.Date}-${session.Type}-${index}`}
                      type="button"
                      onClick={() => setSelectedSession(session)}
                    >
                      <span className="provider-mark" style={{ '--provider': getChargerColor(session.Type) } as CSSProperties}>
                        {getChargerIcon(session.Type)}
                      </span>
                      <span>
                        <strong>{session.Type}</strong>
                        <small>{formatDate(session.Date)} · {session.Amount.toFixed(1)} kWh · ${getSessionRate(session).toFixed(3)}/kWh</small>
                      </span>
                      <b>${session.Cost.toFixed(2)}</b>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No matching sessions</strong>
            <p>Clear the charger or year filter to restore your charging ledger.</p>
            <button className="primary-button" type="button" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        )}
      </section>

      {selectedSession && (
        <div className="sheet-backdrop" role="presentation" onClick={() => setSelectedSession(null)}>
          <aside
            className="session-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-detail-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="section-heading">
              <div>
                <h2 id="session-detail-title">{selectedSession.Type}</h2>
                <p>{formatDate(selectedSession.Date)}</p>
              </div>
              <button className="icon-button small" type="button" aria-label="Close details" onClick={() => setSelectedSession(null)}>
                X
              </button>
            </div>
            <div className="ledger-hero compact">
              <span className="hero-caption">Session cost</span>
              <strong>${selectedSession.Cost.toFixed(2)}</strong>
              <p>{selectedSession.Amount.toFixed(2)} kWh · ${getSessionRate(selectedSession).toFixed(3)}/kWh</p>
            </div>
            <section className="metric-grid">
              <article className="metric-card">
                <span>Energy</span>
                <strong>{selectedSession.Amount.toFixed(2)}</strong>
                <small>kWh</small>
              </article>
              <article className="metric-card">
                <span>Provider</span>
                <strong>{getChargerIcon(selectedSession.Type)}</strong>
                <small>{selectedSession.Type}</small>
              </article>
            </section>
            {selectedSession.Notes && (
              <div className="note-card">
                <strong>Notes</strong>
                <p>{selectedSession.Notes}</p>
              </div>
            )}
          </aside>
        </div>
      )}

      <nav className="bottom-nav" aria-label="Primary">
        <button type="button" onClick={() => navigate('/')}>
          <span>Overview</span>
        </button>
        <button className="active" type="button" aria-current="page">
          <span>History</span>
        </button>
      </nav>
    </main>
  )
}
