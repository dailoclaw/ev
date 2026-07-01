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
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 10, bottom: 6, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
        <XAxis dataKey="monthLabel" stroke="rgba(203,213,225,0.62)" style={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis stroke="rgba(203,213,225,0.62)" style={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="cost" 
          stroke="#6366f1" 
          strokeWidth={3} 
          name="Cost ($)" 
          dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#ffffff', stroke: '#6366f1', strokeWidth: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
})

MonthlyCostChart.displayName = 'MonthlyCostChart'

export default MonthlyCostChart
