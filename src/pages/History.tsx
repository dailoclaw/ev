import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { chargingData } from '../data/evData'
import '../App.css'

export default function History() {
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState('All')
  const [selectedYear, setSelectedYear] = useState('All')

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button
          onClick={() => navigate('/')}
          className="glass-input"
          style={{ 
            padding: '8px 16px',
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text)',
            borderRadius: '8px'
          }}
        >
          ← Back
        </button>
        <h1 className="app-title" style={{ margin: 0 }}>⚡ Charging History</h1>
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

      {/* History Table */}
      <div className="glass-card p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th className="text-left py-3 px-4" style={{ color: 'var(--muted)' }}>Date</th>
                <th className="text-left py-3 px-4" style={{ color: 'var(--muted)' }}>Type</th>
                <th className="text-right py-3 px-4" style={{ color: 'var(--muted)' }}>kWh</th>
                <th className="text-right py-3 px-4" style={{ color: 'var(--muted)' }}>Cost</th>
                <th className="text-left py-3 px-4" style={{ color: 'var(--muted)' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((session, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <td className="py-3 px-4" style={{ color: 'var(--text)' }}>
                    {new Date(session.Date).toLocaleDateString('en-AU')}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        background: 'rgba(59,130,246,0.2)',
                        color: '#60a5fa',
                      }}
                    >
                      {session.Type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right" style={{ color: 'var(--text)' }}>
                    {session.Amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium" style={{ color: '#10b981' }}>
                    ${session.Cost.toFixed(2)}
                  </td>
                  <td className="py-3 px-4" style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    {session.Notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-center mt-4" style={{ color: 'var(--muted)', fontSize: '14px' }}>
          Showing {filteredData.length} session{filteredData.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center app-version">
        EV Charging Dashboard v1.9.0
      </div>
    </div>
  )
}
