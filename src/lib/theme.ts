// Light / dark (Carbon OLED) theme — persisted, applied to <html data-theme>.
// The actual token values live in index.css; this just flips the attribute.
import { updateAppSettings, useEvState } from './data'

export type Theme = 'light' | 'dark'
const KEY = 'ev.theme'

export const getStoredTheme = (): Theme => (localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light')

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') root.dataset.theme = 'dark'
  else delete root.dataset.theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#000000' : '#f3f5f7')
}

export function setTheme(theme: Theme) {
  updateAppSettings({ theme })
  applyTheme(theme)
}

/** Settings toggle state — reads the stored value, writes through on change. */
export function useTheme() {
  const theme = useEvState().settings.theme
  const update = (t: Theme) => {
    setTheme(t)
  }
  return [theme, update] as const
}
