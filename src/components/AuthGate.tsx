import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { initializeData, retrySync, stopDataSync, useEvState } from '../lib/data'
import { hasSupabaseConfig, supa } from '../lib/supa'

type AuthState = { loading: boolean; user: User | null }

function GateCard({ children }: { children: ReactNode }) {
  return (
    <main className="auth-gate">
      <section className="auth-card">
        <p className="eyebrow">EV Command</p>
        {children}
      </section>
    </main>
  )
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ loading: true, user: null })
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const data = useEvState()

  useEffect(() => {
    if (!supa) return
    let active = true
    void supa.auth.getSession().then(({ data: sessionData }) => {
      if (active) setAuth({ loading: false, user: sessionData.session?.user ?? null })
    })
    const { data: subscription } = supa.auth.onAuthStateChange((_event, session) => {
      if (active) setAuth({ loading: false, user: session?.user ?? null })
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (auth.user) void initializeData(auth.user.id)
    else if (!auth.loading) stopDataSync()
  }, [auth.loading, auth.user])

  if (!hasSupabaseConfig) {
    return (
      <GateCard>
        <h1>Configuration required</h1>
        <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild. This app uses Supabase as its canonical store.</p>
      </GateCard>
    )
  }

  if (auth.loading) {
    return (
      <GateCard>
        <h1>Opening your ledger…</h1>
        <p>Checking the saved Supabase session.</p>
      </GateCard>
    )
  }

  if (!auth.user) {
    const sendLink = async (event: React.FormEvent) => {
      event.preventDefault()
      if (!supa || !email.trim()) return
      setSending(true)
      setMessage(null)
      const { error } = await supa.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
      })
      setSending(false)
      setMessage(error ? error.message : 'Check your email for the secure sign-in link.')
    }
    return (
      <GateCard>
        <h1>Sign in</h1>
        <p>Your charging ledger is available only to the configured owner account.</p>
        <form onSubmit={sendLink}>
          <label htmlFor="owner-email">Owner email</label>
          <input
            id="owner-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <button className="primary-btn" type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
        {message && <p role="status">{message}</p>}
      </GateCard>
    )
  }

  if (data.loading && data.syncStatus !== 'offline') {
    return (
      <GateCard>
        <h1>Loading your ledger…</h1>
        <p>Reading the local cache and syncing Supabase.</p>
      </GateCard>
    )
  }

  if (data.syncStatus === 'error' && data.sessions.length === 0 && data.providers.length === 0) {
    return (
      <GateCard>
        <h1>Ledger unavailable</h1>
        <p>{data.lastSyncError}</p>
        <button className="primary-btn" type="button" onClick={() => void retrySync()}>
          Try again
        </button>
        <button className="text-btn" type="button" onClick={() => void supa?.auth.signOut({ scope: 'local' })}>
          Sign out
        </button>
      </GateCard>
    )
  }

  return children
}
