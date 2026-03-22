import { useState, useMemo } from 'react'
import { CContainer, CCard, CCardBody, CCardHeader, CRow, CCol, CTable, CFormInput } from '@coreui/react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { chargingData } from './data/evData'
import './App.css'

const COLORS = ['#4f46e5', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

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
      <CContainer className="py-4">
        {/* Header */}
        <div className="header-section">
          <h1 className="app-title">⚡ EV Charging Dashboard</h1>
          <p className="app-subtitle">Track your electric vehicle charging costs and usage patterns</p>
        </div>

        {/* Filters */}
        <CCard className="mb-4">
          <CCardBody>
            <CRow className="g-3">
              <CCol md={4}>
                <CFormInput
                  placeholder="🔍 Search charger type or notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </CCol>
              <CCol md={4}>
                <CFormInput
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </CCol>
              <CCol md={4}>
                <CFormInput
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        {/* Summary Stats */}
        <CRow className="mb-4 g-3">
          {[
            { label: 'Total Sessions', value: stats.totalSessions, icon: '🔌' },
            { label: 'Total Cost', value: `$${stats.totalCost}`, icon: '💰' },
            { label: 'Total Energy', value: `${stats.totalKwh} kWh`, icon: '⚡' },
            { label: 'Avg $/kWh', value: `$${stats.avgCostPerKwh}`, icon: '📊' },
            { label: 'Avg $/Session', value: `$${stats.avgCostPerSession}`, icon: '💳' },
          ].map((stat, idx) => (
            <CCol key={idx} xs={6} lg className="stat-col">
              <CCard className="stat-card h-100">
                <CCardBody>
                  <div className="stat-icon">{stat.icon}</div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </CCardBody>
              </CCard>
            </CCol>
          ))}
        </CRow>

        {/* Charts Row 1: Cost Trends */}
        <CRow className="mb-4 g-4">
          <CCol lg={8}>
            <CCard className="chart-card h-100">
              <CCardHeader className="chart-header">
                <h5 className="mb-0">💰 Monthly Cost Trend</h5>
              </CCardHeader>
              <CCardBody>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a38" />
                    <XAxis dataKey="month" stroke="#888899" />
                    <YAxis stroke="#888899" />
                    <Tooltip contentStyle={{ background: '#13131e', border: '1px solid #2a2a40', borderRadius: 8 }} />
                    <Legend />
                    <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} name="Cost ($)" />
                  </LineChart>
                </ResponsiveContainer>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={4}>
            <CCard className="chart-card h-100">
              <CCardHeader className="chart-header">
                <h5 className="mb-0">🔌 Cost by Charger Type</h5>
              </CCardHeader>
              <CCardBody>
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
                    <Tooltip contentStyle={{ background: '#13131e', border: '1px solid #2a2a40', borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        {/* Charts Row 2: Energy & Sessions */}
        <CRow className="mb-4 g-4">
          <CCol lg={6}>
            <CCard className="chart-card h-100">
              <CCardHeader className="chart-header">
                <h5 className="mb-0">⚡ Monthly Energy (kWh)</h5>
              </CCardHeader>
              <CCardBody>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a38" />
                    <XAxis dataKey="month" stroke="#888899" />
                    <YAxis stroke="#888899" />
                    <Tooltip contentStyle={{ background: '#13131e', border: '1px solid #2a2a40', borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="kwh" fill="#10b981" name="Energy (kWh)" />
                  </BarChart>
                </ResponsiveContainer>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={6}>
            <CCard className="chart-card h-100">
              <CCardHeader className="chart-header">
                <h5 className="mb-0">📊 Sessions per Charger Type</h5>
              </CCardHeader>
              <CCardBody>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a38" />
                    <XAxis dataKey="type" stroke="#888899" />
                    <YAxis stroke="#888899" />
                    <Tooltip contentStyle={{ background: '#13131e', border: '1px solid #2a2a40', borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="count" fill="#4f46e5" name="Sessions" />
                  </BarChart>
                </ResponsiveContainer>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        {/* Data Table */}
        <CCard className="table-card">
          <CCardHeader className="chart-header">
            <h5 className="mb-0">📋 Charging History ({filteredData.length} sessions)</h5>
          </CCardHeader>
          <CCardBody className="p-0">
            <div className="table-container">
              <CTable hover responsive className="charging-table mb-0">
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
                          <span className="charger-badge">{session.Type}</span>
                        </td>
                        <td>{session.Amount.toFixed(2)}</td>
                        <td>${session.Cost.toFixed(2)}</td>
                        <td>${(session.Cost / session.Amount).toFixed(3)}</td>
                        <td className="text-muted">{session.Notes || '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </CTable>
            </div>
          </CCardBody>
        </CCard>

        {/* Footer */}
        <div className="text-center mt-4">
          <small className="app-version">EV Charging Dashboard v1.1.0</small>
        </div>
      </CContainer>
    </div>
  )
}

export default App
