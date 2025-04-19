export function disableBrowserDefaultBehaviours() {
  // DISABLE RIGHT CLICK CONTEXT MENU
  document.addEventListener('contextmenu', (e) => {
    if (import.meta.env.DEV) return
    e.preventDefault()
  })

  // DISABLE RELOADS
  document.addEventListener('keydown', (event) => {
    if (import.meta.env.DEV) return
    // Prevent F5 or Ctrl+R (Windows/Linux) and Command+R (Mac) from refreshing the page
    const shouldBlock =
      event.key === 'F5' ||
      (event.ctrlKey && event.key === 'r') ||
      (event.metaKey && event.key === 'r')

    if (shouldBlock) event.preventDefault()
  })
}
