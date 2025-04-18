import { createRouter, RouterProvider } from '@tanstack/react-router'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'
import { ThemeProvider } from './context/theme.context'
import { routeTree } from './routeTree.gen'

const container = document.getElementById('root')

const root = createRoot(container!)

const router = createRouter({ routeTree })
export type Router = typeof router

declare module '@tanstack/react-router' {
  interface Register {
    router: Router
  }
}

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

root.render(
  <React.StrictMode>
    <ThemeProvider defaultTheme='system'>
      <TooltipProvider delayDuration={100}>
        <Toaster />
        <RouterProvider router={router} defaultPreloadDelay={0} />
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
