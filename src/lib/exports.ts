import type { Session } from './savings'

export function buildCsv(sessions: Array<Session & { freeKwh?: number }>): string {
  const escape = (value: string | number | null) => {
    const raw = value == null ? '' : String(value)
    const text = typeof value === 'string' && /^[=+\-@]/.test(raw) ? `'${raw}` : raw
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const header = 'Date,Provider,AmountKwh,CostAud,FreeKwh,Notes'
  const rows = sessions.map(session =>
    [session.date, session.type, session.amount, session.cost.toFixed(2), (session.freeKwh ?? 0).toFixed(2), session.notes ?? '']
      .map(escape)
      .join(','),
  )
  return [header, ...rows].join('\n')
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const downloadCsv = (csv: string, filename: string) => downloadBlob(csv, filename, 'text/csv;charset=utf-8')
export const downloadJson = (data: unknown, filename: string) =>
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json')
