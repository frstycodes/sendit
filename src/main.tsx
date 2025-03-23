import React, { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ChevronLeft, ChevronRight, Minus, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeProvider } from './context/theme.context'
import './index.css'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Toaster } from './components/ui/sonner'
import {
  createRouter,
  defer,
  RouterProvider,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { Button } from './components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './components/ui/tooltip'

const container = document.getElementById('root')

const root = createRoot(container!)

const router = createRouter({ routeTree })
export type Router = typeof router

declare module '@tanstack/react-router' {
  interface Register {
    router: Router
  }
}

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
