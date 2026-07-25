import { useEffect, useMemo, useState } from 'react'

/** How long the $ ⇄ kWh transition owns the chart, in ms. Must outlast the
 *  longest staggered pill animation (delay cap 238ms + 300ms roll). */
export const ROLL_MS = 620

/** True for one animation window after `metric` flips — drives the `rolling`
 *  class that re-scales the bars and rolls their value pills. Stays false on
 *  first render (nothing to roll from) and when reduced motion is asked for. */
export function useUnitRoll(metric: string) {
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  // `roll` is 0 when idle, else a token bumped on every flip — so toggling
  // again mid-animation restarts the window instead of inheriting its timer.
  const [seen, setSeen] = useState(metric)
  const [roll, setRoll] = useState(0)

  if (metric !== seen) {
    setSeen(metric)
    if (!reduceMotion) setRoll(n => n + 1)
  }

  useEffect(() => {
    if (roll === 0) return
    const id = setTimeout(() => setRoll(0), ROLL_MS)
    return () => clearTimeout(id)
  }, [roll])

  return roll > 0
}
