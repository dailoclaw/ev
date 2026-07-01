import { memo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#6366f1', '#14b8a6', '#8b5cf6', '#f43f5e']

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
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="cost"
          nameKey="type"
          cx="50%"
          cy="50%"
          innerRadius={48}
          outerRadius={78}
          paddingAngle={3}
          label={(entry) => `$${entry.value.toFixed(0)}`}
          isAnimationActive={false}
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
