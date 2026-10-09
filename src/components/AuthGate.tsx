import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { dismissSaveError, initializeData, retrySync, stopDataSync, useEvState } from '../lib/data'
import { hasSupabaseConfig, supa } from '../lib/supa'
import { applyTheme } from '../lib/theme'
import StartupSplash from './StartupSplash'

type AuthState = { loading: boolean; user: User | null }
const STARTUP_INTRO_MS = 3200

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
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'password' | 'magic' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [startupIntroComplete, setStartupIntroComplete] = useState(!hasSupabaseConfig)
  const data = useEvState()
  const startupPending = hasSupabaseConfig && (
    !startupIntroComplete || auth.loading || Boolean(auth.user && data.loading && data.syncStatus !== 'offline')
  )

  useEffect(() => {
    if (!hasSupabaseConfig) return
    const timer = window.setTimeout(() => setStartupIntroComplete(true), STARTUP_INTRO_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!supa) return
    let active = true
    let authEventReceived = false
    let authenticatedOwner: string | null = null
    const publishUser = (user: User | null) => {
      if (!active) return
      const nextOwner = user?.id ?? null
      // Invalidate work immediately, before React processes the new auth state.
      if (nextOwner !== authenticatedOwner) stopDataSync()
      authenticatedOwner = nextOwner
      setAuth({ loading: false, user })
    }
    void supa.auth.getSession().then(({ data: sessionData }) => {
      if (!authEventReceived) publishUser(sessionData.session?.user ?? null)
    })
    const { data: subscription } = supa.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true
      publishUser(session?.user ?? null)
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
      stopDataSync()
    }
  }, [])

  useEffect(() => {
    if (auth.user) void initializeData(auth.user.id)
    else if (!auth.loading) stopDataSync()
  }, [auth.loading, auth.user])

  useEffect(() => {
    if (!auth.user || data.loading) return
    applyTheme(data.settings.theme)
    try {
      localStorage.setItem('ev.theme', data.settings.theme)
    } catch {
      // The current session can still use the restored theme when storage is unavailable.
    }
  }, [auth.user, data.loading, data.settings.theme])

  if (!hasSupabaseConfig) {
    return (
      <GateCard>
        <h1>Configuration required</h1>
        <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild. This app uses Supabase as its canonical store.</p>
      </GateCard>
    )
  }

  const signInWithPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supa || !email.trim() || !password) return
    setBusy('password')
    setMessage(null)
    const { error } = await supa.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(null)
    if (error) setMessage(error.message)
  }

  const sendLink = async () => {
    if (!supa || !email.trim()) return
    setBusy('magic')
    setMessage(null)
    const { error } = await supa.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    })
    setBusy(null)
    setMessage(error ? error.message : 'Check your email for the secure sign-in link.')
  }

  let content: ReactNode
  if (auth.loading || (auth.user && data.loading && data.syncStatus !== 'offline')) {
    content = <main className="route-loading" aria-hidden="true" />
  } else if (!auth.user) {
    content = (
      <GateCard>
        <h1>Sign in</h1>
        <p>Your charging ledger is available only to the configured owner account.</p>
        <form onSubmit={signInWithPassword}>
          <label htmlFor="owner-email">Owner email</label>
          <input
            id="owner-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <label htmlFor="owner-password">Owner password</label>
          <input
            id="owner-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
          <button className="primary-btn" type="submit" disabled={busy !== null || !email.trim() || !password}>
            {busy === 'password' ? 'Signing in…' : 'Sign in'}
          </button>
          <button className="text-btn" type="button" disabled={busy !== null || !email.trim()} onClick={() => void sendLink()}>
            {busy === 'magic' ? 'Sending link…' : 'Use a magic link instead'}
          </button>
        </form>
        {message && <p role="status">{message}</p>}
      </GateCard>
    )
  } else if (data.syncStatus === 'error' && data.sessions.length === 0 && data.providers.length === 0) {
    content = (
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
  } else {
    content = children
  }

  return (
    <>
      {auth.user && data.lastSaveError && (
        <div role="alert" style={{ position: 'fixed', top: 12, left: 12, right: 12, zIndex: 10000, padding: 12, borderRadius: 12, background: 'var(--surf)', color: 'var(--neg)', border: '1px solid var(--neg)' }}>
          <p>{data.lastSaveError}</p>
          <button type="button" onClick={dismissSaveError}>Dismiss save error</button>
        </div>
      )}
      {content}
      {startupPending && <StartupSplash />}
    </>
  )
}
