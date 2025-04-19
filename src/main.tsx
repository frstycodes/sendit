import { RouterProvider } from '@tanstack/react-router'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'
import { ThemeProvider } from './context/theme.context'
import { isWindows11 } from 'tauri-plugin-windows-version-api'
import { PostHogProvider } from 'posthog-js/react'
import { disableBrowserDefaultBehaviours } from './lib/utils'
import { posthogKeys } from './lib/post-hog'
import { router } from './lib/tanstack-router'

// MICA SETUP: We use Mica effect for windows 11 so we need to set the background color to transparent
isWindows11().then((res) => res && document.body.classList.add('mica'))

// This disables right click context menu and reloading the app
disableBrowserDefaultBehaviours()

const container = document.getElementById('root')
createRoot(container!).render(
  <React.StrictMode>
    <PostHogProvider
      apiKey={posthogKeys.apiKey}
      options={{ api_host: posthogKeys.host }}
    >
      <ThemeProvider defaultTheme='system'>
        <TooltipProvider delayDuration={100}>
          <Toaster />
          <RouterProvider router={router} defaultPreloadDelay={0} />
        </TooltipProvider>
      </ThemeProvider>
    </PostHogProvider>
  </React.StrictMode>,
)
