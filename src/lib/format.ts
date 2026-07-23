export const aud = (n: number, dp = 2) =>
  '$' + n.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const kwh = (n: number, dp = 0) =>
  n.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const rate = (n: number) => '$' + n.toFixed(3)

export const shortDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

export const longDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

export const dayHeader = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

export const monthTitle = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

/** A full timestamp (date + time), for things like "last backed up at". */
export const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const thisMonth = () => todayIso().slice(0, 7)
