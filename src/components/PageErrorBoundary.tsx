import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="app-shell">
        <h1>Unable to open this page</h1>
        <p role="alert">This page could not load. Return home or reload to try again.</p>
        <Link to="/">Return home</Link>
        <button className="text-btn" type="button" onClick={() => window.location.reload()}>Reload app</button>
      </main>
    )
  }
}
