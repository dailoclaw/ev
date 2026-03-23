import { memo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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

const MonthlyCostChart = memo(({ data }: Props) => {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="monthLabel" stroke="rgba(255,255,255,0.6)" style={{ fontSize: 11 }} />
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
  )
})

MonthlyCostChart.displayName = 'MonthlyCostChart'

export default MonthlyCostChart
