try {
  const root = document.documentElement
  if (localStorage.getItem('ev.theme') === 'dark') root.dataset.theme = 'dark'
  if (localStorage.getItem('ev.style') === 'minimal') root.dataset.style = 'minimal'
  const themeColor = document.querySelector('meta[name="theme-color"]')
  if (themeColor && root.dataset.theme === 'dark') themeColor.setAttribute('content', '#000000')
} catch {
  // Storage can be disabled in private browsing; light Classic remains usable.
}
