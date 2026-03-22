import { useState, useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { chargingData } from './data/evData'
import './App.css'

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

function App() {
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  // Filter data
  const filteredData = useMemo(() => {
    return chargingData.filter(session => {
      const matchSearch = !search || 
        session.Type.toLowerCase().includes(search.toLowerCase()) ||
        session.Notes?.toLowerCase().includes(search.toLowerCase())
      
      const sessionDate = new Date(session.Date)
      const matchStart = !dateRange.start || sessionDate >= new Date(dateRange.start)
      const matchEnd = !dateRange.end || sessionDate <= new Date(dateRange.end)
      
      return matchSearch && matchStart && matchEnd
    })
  }, [search, dateRange])

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
      <p className="app-subtitle">Track your electric vehicle charging costs and usage patterns</p>

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
        <div className="filter-row">
          <input
            type="text"
            placeholder="🔍 Search charger type or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full"
          />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="glass-input w-full"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="glass-input w-full"
          />
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Monthly Cost Trend - 2 columns */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>💰 Monthly Cost Trend</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" style={{ fontSize: 12 }} />
                <YAxis stroke="rgba(255,255,255,0.6)" style={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} name="Cost ($)" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost by Type - 1 column */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>🔌 Cost by Type</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={costByType}
                  dataKey="cost"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
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

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Energy */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>⚡ Monthly Energy (kWh)</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
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

        {/* Sessions per Type */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>📊 Sessions per Type</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="type" stroke="rgba(255,255,255,0.6)" style={{ fontSize: 12 }} />
                <YAxis stroke="rgba(255,255,255,0.6)" style={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" name="Sessions" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            📋 Charging History ({filteredData.length} sessions)
          </h3>
        </div>
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
      </div>

      {/* Footer */}
      <div className="text-center app-version">
        EV Charging Dashboard v1.2.0
      </div>
    </div>
  )
}

export default App
