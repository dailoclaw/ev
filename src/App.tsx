import { useState, useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { chargingData } from './data/evData'
import './App.css'

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

function App() {
  const [selectedType, setSelectedType] = useState('All')
  const [selectedYear, setSelectedYear] = useState('All')
  const [tableExpanded, setTableExpanded] = useState(false)

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
        acc[monthKey] = { month: monthKey, cost: 0, kwh: 0, sessions: 0 }
      }
      acc[monthKey].cost += session.Cost
      acc[monthKey].kwh += session.Amount
      acc[monthKey].sessions += 1
      return acc
    }, {} as Record<string, { month: string, cost: number, kwh: number, sessions: number }>)
    
    return Object.values(grouped)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(item => ({
        ...item,
        cost: Number(item.cost.toFixed(2)),
        kwh: Number(item.kwh.toFixed(2)),
      }))
  }, [filteredData])

  return (
    <div className="app-container">
      {/* Header */}
      <h1 className="app-title">⚡ EV Charging Dashboard</h1>

      {/* Car Image */}
      <div className="car-image-container mb-6">
        <img 
          src="/car.jpg" 
          alt="EV Car" 
          className="car-image"
        />
      </div>

      {/* Hero Card */}
      <div className="hero-card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Sessions', value: stats.totalSessions, icon: '🔌' },
          { label: 'Total Cost', value: `$${stats.totalCost}`, icon: '💰' },
          { label: 'Total Energy', value: `${stats.totalKwh} kWh`, icon: '⚡' },
          { label: 'Avg $/kWh', value: `$${stats.avgCostPerKwh}`, icon: '📊' },
          { label: 'Avg/Session', value: `$${stats.avgCostPerSession}`, icon: '💳' },
        ].map((stat, idx) => (
          <div key={idx} className="stat-card-modern">
            <div className="stat-icon-modern">{stat.icon}</div>
            <div className="stat-value-modern">{stat.value}</div>
            <div className="stat-label-modern">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Monthly Cost Trend - 2 columns */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>💰 Monthly Cost Trend</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" style={{ fontSize: 12 }} />
                <YAxis stroke="rgba(255,255,255,0.6)" style={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="cost" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  name="Cost ($)" 
                  dot={{ r: 5, fill: '#3b82f6' }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost by Type - 1 column */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>🔌 Cost by Type</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={costByType}
                  dataKey="cost"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  label
                >
                  {costByType.map((_item, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Energy Chart - Full Width */}
      <div className="glass-card p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>⚡ Monthly Energy (kWh)</h3>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" style={{ fontSize: 12 }} />
              <YAxis stroke="rgba(255,255,255,0.6)" style={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="kwh" fill="#10b981" name="Energy (kWh)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Collapsible Data Table */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => setTableExpanded(!tableExpanded)}
          className="w-full p-6 text-left border-b border-white/10 hover:bg-white/5 transition-colors flex items-center justify-between"
        >
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            📋 Charging History ({filteredData.length} sessions)
          </h3>
          <span className="text-2xl" style={{ color: 'var(--text)', transition: 'transform 0.2s', transform: tableExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
          </span>
        </button>
        {tableExpanded && (
          <div className="table-container">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Charger Type</th>
                  <th>Energy (kWh)</th>
                  <th>Cost ($)</th>
                  <th>$/kWh</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredData
                  .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
                  .map((session, idx) => (
                    <tr key={idx}>
                      <td>{new Date(session.Date).toLocaleDateString()}</td>
                      <td>
                        <span className="charger-badge-modern">{session.Type}</span>
                      </td>
                      <td>{session.Amount.toFixed(2)}</td>
                      <td>${session.Cost.toFixed(2)}</td>
                      <td>${(session.Cost / session.Amount).toFixed(3)}</td>
                      <td style={{ color: 'var(--muted)' }}>{session.Notes || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center app-version">
        EV Charging Dashboard v1.4.0
      </div>
    </div>
  )
}

export default App
