(() => {
  try {
    const retro = window.location.port === '5181' || new URLSearchParams(window.location.search).get('theme') === 'retro'
    document.documentElement.classList.toggle('retro', retro)
    const saved = localStorage.getItem('theme')
    const dark = !retro && (saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = retro ? 'light' : dark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', retro ? '#f0e0bd' : dark ? '#15130f' : '#f4efe4')
  } catch {
    /* keep the light default when storage is unavailable */
  }
})()
