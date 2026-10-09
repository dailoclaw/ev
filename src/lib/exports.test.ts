import { expect, it } from 'vitest'
import { buildCsv } from './exports'

// Read RFC-style quoted fields so embedded CR/LF and quotes are tested as cells.
function cells(csv: string): string[][] {
  const rows: string[][] = [], row: string[] = []
  let cell = '', quoted = false
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(cell); cell = ''
      if (char === '\n') { rows.push([...row]); row.length = 0 }
    } else cell += char
  }
  row.push(cell); rows.push(row)
  return rows
}

it.each(['=1+2', '+1', '-1', '@SUM(1)', ' \t=1+2', '\r=1+2', '\n=1+2', '\u0000=1', '\ufeff =1', '＝1+2', '＋1', '－1', '＠SUM(1)', '\tplain'])(
  'exports hazardous prefix %j as literal text in a single cell', notes => {
    const csv = buildCsv([{ id: 'a', date: '2026-01-01', type: notes, amount: 10, cost: 5, freeKwh: 7, notes }])
    const parsed = cells(csv)
    expect(parsed).toHaveLength(2)
    expect(parsed[1]).toHaveLength(6)
    expect(parsed[1][1]).toBe(`'${notes}`)
    expect(parsed[1][5]).toBe(`'${notes}`)
    expect(parsed[1].slice(2, 5)).toEqual(['10', '5.00', '7.00'])
  },
)

it('preserves harmless text and quotes CR, LF, quotes and delimiter payloads', () => {
  const notes = 'Norwood\rnew line\n"quote",;=1+2'
  const csv = buildCsv([{ id: 'a', date: '2026-01-01', type: 'Charger', amount: 0, cost: 15, notes }])
  expect(cells(csv)[1]).toEqual(['2026-01-01', 'Charger', '0', '15.00', '0.00', notes])
})
