// In-memory owner/API fixture for service-worker requests that browser routing
// cannot intercept. Data is reset per test and never contacts a real project.
const owner = '11111111-1111-4111-8111-111111111111'
const provider = '22222222-2222-4222-8222-222222222222'
let state
function reset() {
  state = {
    fail: false,
    providers: [{ id: provider, name: 'FreeCo', color: '#059669', free_kwh_per_day: 7, archived: false, sort_order: 0 }],
    sessions: [{ id: '33333333-3333-4333-8333-333333333333', provider_id: provider, date: new Date().toLocaleDateString('en-CA'), amount: 3.5, cost: 0, notes: null }],
    settings: { id: 1, owner_id: owner, budget_cap: 50, theme: 'light', style: 'classic', density: 'comfortable', vehicle_efficiency: 14.2, petrol_price: 1.85, petrol_use: 7, vehicle_photo_path: null },
  }
}
reset()
export async function validationBackend(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (!url.pathname.startsWith('/supabase/') && !url.pathname.startsWith('/__validation__/backend/')) return false
  const reply = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    response.end(status === 204 ? undefined : JSON.stringify(body))
  }
  if (url.pathname === '/__validation__/backend/reset' && request.method === 'POST') { reset(); reply(200, {}); return true }
  if (url.pathname === '/__validation__/backend/fail' && request.method === 'POST') { state.fail = url.searchParams.get('enabled') === 'true'; reply(200, {}); return true }
  if (state.fail) { reply(503, { message: 'Test backend unavailable' }); return true }
  const table = url.pathname.split('/').pop()
  if (request.method === 'GET') {
    const rows = table === 'providers' ? state.providers : table === 'charging_sessions' ? state.sessions : undefined
    if (rows) {
      const from = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 500)
      reply(200, rows.slice(from, from + limit))
    } else if (table === 'app_settings') reply(200, state.settings)
    else if (table === 'user') reply(200, { id: owner, email: 'owner@example.com' })
    else reply(404, { message: 'Unknown fixture endpoint' })
    return true
  }
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString()
  const input = text ? JSON.parse(text) : {}
  if (table === 'app_settings' && request.method === 'PATCH') {
    Object.assign(state.settings, input)
    reply(200, { id: 1, owner_id: owner })
  } else if (table === 'charging_sessions' || table === 'providers') {
    const key = table === 'providers' ? 'providers' : 'sessions'
    const id = request.method === 'DELETE' ? url.searchParams.get('id')?.replace(/^eq\./, '') : input.id
    state[key] = state[key].filter(row => row.id !== id)
    if (request.method !== 'DELETE') state[key].push(input)
    reply(204)
  } else reply(404, { message: 'Unknown fixture endpoint' })
  return true
}
