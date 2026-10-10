export const perKwh = (cost: number, k: number) => (k > 0 ? '$' + (cost / k).toFixed(2) : '—')
export const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)
// short chip label so all provider filters fit one row
export const shortProv = (name: string) => {
  if (name.length <= 11) return name
  const initials = name.split(/\s+/).map(part => part[0]).join('').toUpperCase()
  return initials.length >= 2 ? initials.slice(0, 4) : name.slice(0, 4)
}
