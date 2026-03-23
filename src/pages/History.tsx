import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { chargingData } from '../data/evData'
import '../App.css'

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

export default function History() {
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState('All')
  const [selectedYear, setSelectedYear] = useState('All')

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Get unique charger types and years
  const chargerTypes = useMemo(() => {
    const types = Array.from(new Set(chargingData.map(s => s.Type))).sort()
    return ['All', ...types]
  }, [])

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
    }).sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
  }, [selectedType, selectedYear])

  return (
    <div className="app-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/')}
          className="glass-input"
          style={{ 
            padding: '10px 18px',
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--text)',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        >
          ← Back
        </button>
        <h1 className="app-title" style={{ margin: 0, fontSize: '24px' }}>⚡ Charging History</h1>
      </div>

      {/* Filters */}
      <div className="filter-spacing">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
              Charger Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="glass-input w-full"
            >
              {chargerTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="glass-input w-full"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', borderRadius: '12px' }}>
        <h4 style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Charger Types</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {['Jolt', 'Matty', 'Chargefox', 'Supercharger'].map(type => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              <span style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 500 }}>{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* History Table */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: '15px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.15)' }}>
                <th className="text-left py-4 px-4" style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', width: '35%' }}>Date</th>
                <th className="text-center py-4 px-4" style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', width: '15%' }}>Type</th>
                <th className="text-right py-4 px-4" style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', width: '25%' }}>Energy</th>
                <th className="text-right py-4 px-4" style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', width: '25%' }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((session, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <td className="py-4 px-4" style={{ color: 'var(--text)', fontWeight: 500, fontSize: '14px' }}>
                    {new Date(session.Date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
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
                          background: `${getChargerColor(session.Type)}20`,
                          color: getChargerColor(session.Type),
                        }}
                      >
                        {getChargerIcon(session.Type)}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right" style={{ color: 'var(--text)', fontWeight: 600, fontSize: '15px' }}>
                    {session.Amount.toFixed(2)} kWh
                  </td>
                  <td className="py-4 px-4 text-right" style={{ color: '#10b981', fontWeight: 700, fontSize: '16px' }}>
                    ${session.Cost.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-center" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', color: 'var(--muted)', fontSize: '13px', fontWeight: 500 }}>
          {filteredData.length} session{filteredData.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center app-version">
        EV Charging Dashboard v2.0.1
      </div>
    </div>
  )
}
