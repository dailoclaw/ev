import type { Provider } from './providers'

export function providerAccountPath(name: string, providers: Provider[]): string {
  const provider = providers.find(item => item.name === name)
  return provider ? `/accounts/id/${encodeURIComponent(provider.id)}` : `/accounts/${encodeURIComponent(name)}`
}

// Router params conflate a literal %2F with an encoded slash; decode the raw segment once for that legacy case.
export function legacyAccountName(name: string, pathname: string): string {
  if (!/%252f/i.test(pathname)) return name
  try { return decodeURIComponent(pathname.slice('/accounts/'.length)) } catch { return name }
}
