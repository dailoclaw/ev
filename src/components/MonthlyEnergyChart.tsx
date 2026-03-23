import { memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface MonthlyData {
  month: string
  monthLabel: string
  cost: number
  kwh: number
  sessions: number
}

interface Props {
  data: MonthlyData[]
}

const MonthlyEnergyChart = memo(({ data }: Props) => {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="monthLabel" stroke="rgba(255,255,255,0.6)" style={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
        <YAxis stroke="rgba(255,255,255,0.6)" style={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="kwh" fill="#10b981" name="kWh" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})

MonthlyEnergyChart.displayName = 'MonthlyEnergyChart'

export default MonthlyEnergyChart
