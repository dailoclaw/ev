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
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 10, bottom: 20, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
        <XAxis dataKey="monthLabel" stroke="rgba(203,213,225,0.62)" style={{ fontSize: 10 }} angle={-35} textAnchor="end" height={54} tickLine={false} axisLine={false} />
        <YAxis stroke="rgba(203,213,225,0.62)" style={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="kwh" fill="#14b8a6" name="kWh" radius={[8, 8, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
})

MonthlyEnergyChart.displayName = 'MonthlyEnergyChart'

export default MonthlyEnergyChart
