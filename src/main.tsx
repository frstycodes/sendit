import { createRouter, RouterProvider } from '@tanstack/react-router'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'
import { ThemeProvider } from './context/theme.context'
import './index.css'
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

const preventDefault = (e: Event) => e.preventDefault()
// DISABLE RIGHT CLICK CONTEXT MENU
document.addEventListener('contextmenu', preventDefault)
// DISABLE KEYPRESS TO DISABLE RELOADS
document.addEventListener('keydown', preventDefault)

root.render(
  <React.StrictMode>
    <ThemeProvider defaultTheme='system'>
      <TooltipProvider delayDuration={100}>
        <Toaster richColors />
        <RouterProvider router={router} defaultPreloadDelay={0} />
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
