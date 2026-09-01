import type { EnrichedSession } from './savings'

export type CostConcentrationMode = 'all' | 'paid' | 'provider'

export interface CostConcentrationPoint {
  energyPct: number
  costPct: number
}

export interface CostConcentrationBlock {
  session: EnrichedSession
  kwh: number
  cost: number
  rate: number
}

export interface CostConcentrationModel {
  blocks: CostConcentrationBlock[]
  points: CostConcentrationPoint[]
  totalKwh: number
  totalCost: number
  energySessions: number
  tailEnergyPct: number
  tailCostPct: number
  tailSessions: EnrichedSession[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function blocksForSession(session: EnrichedSession, mode: CostConcentrationMode): CostConcentrationBlock[] {
  if (session.isFee || session.amount <= 0) return []

  const freeKwh = clamp(session.freeKwh, 0, session.amount)
  const billedKwh = Math.max(0, session.amount - freeKwh)

  if (mode === 'paid') {
    if (session.cost <= 0 || billedKwh <= 0) return []
    return [{ session, kwh: billedKwh, cost: session.cost, rate: session.cost / billedKwh }]
  }

  const blocks: CostConcentrationBlock[] = []
  if (freeKwh > 0) blocks.push({ session, kwh: freeKwh, cost: 0, rate: 0 })
  if (billedKwh > 0) {
    blocks.push({ session, kwh: billedKwh, cost: session.cost, rate: session.cost / billedKwh })
  }
  return blocks
}

export function costConcentration(
  sessions: EnrichedSession[],
  mode: CostConcentrationMode,
  provider: string | null,
  thresholdPct: number,
): CostConcentrationModel {
  const scoped = sessions.filter(session => mode !== 'provider' || session.type === provider)
  const blocks = scoped
    .flatMap(session => blocksForSession(session, mode))
    .filter(block => block.kwh > 0)
    .sort((a, b) => a.rate - b.rate || a.session.date.localeCompare(b.session.date))

  const totalKwh = blocks.reduce((sum, block) => sum + block.kwh, 0)
  const totalCost = blocks.reduce((sum, block) => sum + block.cost, 0)
  const points: CostConcentrationPoint[] = [{ energyPct: 0, costPct: 0 }]

  let cumulativeKwh = 0
  let cumulativeCost = 0
  for (const block of blocks) {
    cumulativeKwh += block.kwh
    cumulativeCost += block.cost
    points.push({
      energyPct: totalKwh > 0 ? (cumulativeKwh / totalKwh) * 100 : 0,
      costPct: totalCost > 0 ? (cumulativeCost / totalCost) * 100 : 0,
    })
  }

  const threshold = clamp(thresholdPct, 0, 100)
  const thresholdKwh = totalKwh * (threshold / 100)
  let energyBefore = 0
  let costBefore = 0
  const tailIds = new Set<string>()

  for (const block of blocks) {
    const energyAfter = energyBefore + block.kwh
    if (energyAfter > thresholdKwh) {
      const kwhBeforeThreshold = Math.max(0, thresholdKwh - energyBefore)
      costBefore += kwhBeforeThreshold * block.rate
      tailIds.add(block.session.id)
      energyBefore = thresholdKwh
      break
    }
    energyBefore = energyAfter
    costBefore += block.cost
  }

  if (energyBefore >= thresholdKwh) {
    let passedThreshold = false
    let traversed = 0
    for (const block of blocks) {
      const next = traversed + block.kwh
      if (passedThreshold || next > thresholdKwh) {
        passedThreshold = true
        tailIds.add(block.session.id)
      }
      traversed = next
    }
  }

  const tailSessions = scoped
    .filter(session => tailIds.has(session.id))
    .sort((a, b) => {
      const aRate = a.paidKwh > 0 ? a.cost / a.paidKwh : a.rate
      const bRate = b.paidKwh > 0 ? b.cost / b.paidKwh : b.rate
      return bRate - aRate || b.date.localeCompare(a.date)
    })

  return {
    blocks,
    points,
    totalKwh,
    totalCost,
    energySessions: new Set(blocks.map(block => block.session.id)).size,
    tailEnergyPct: 100 - threshold,
    tailCostPct: totalCost > 0 ? clamp(((totalCost - costBefore) / totalCost) * 100, 0, 100) : 0,
    tailSessions,
  }
}
