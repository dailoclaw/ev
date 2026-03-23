import { memo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

interface CostData {
  type: string
  cost: number
  kwh: number
  count: number
}

interface Props {
  data: CostData[]
}

const CostByTypeChart = memo(({ data }: Props) => {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          dataKey="cost"
          nameKey="type"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={(entry) => `$${entry.value.toFixed(2)}`}
        >
          {data.map((_item, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
})

CostByTypeChart.displayName = 'CostByTypeChart'

export default CostByTypeChart
