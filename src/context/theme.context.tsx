import { api } from '@/lib/tauri'
import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const THEME_KEY = 'vite-ui-theme'
const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => null,
}

const ThemeContext = createContext<ThemeProviderState>(initialState)

const DARK_MODE_MEDIA = window.matchMedia('(prefers-color-scheme: dark)')
const ROOT = window.document.documentElement

function changeRootTheme(theme: ResolvedTheme) {
  api.setTheme(theme)
  ROOT.classList.remove('light', 'dark')
  ROOT.classList.add(theme)
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  function getThemeFromStorage(): Theme {
    return (localStorage.getItem(THEME_KEY) as Theme) || defaultTheme
  }

  function getResolvedTheme(): ResolvedTheme {
    const storedTheme = getThemeFromStorage()
    if (storedTheme != 'system') return storedTheme || defaultTheme
    return DARK_MODE_MEDIA.matches ? 'dark' : 'light'
  }

  const [theme, setTheme] = useState<Theme>(getThemeFromStorage)
  const resolvedTheme = getResolvedTheme()

  useEffect(() => {
    if (theme != 'system') {
      changeRootTheme(theme)
      return
    }
    console.log('test')
    const onThemeChanged = (event: MediaQueryListEvent) => {
      const systemTheme = event.matches ? 'dark' : 'light'
      changeRootTheme(systemTheme)
    }

    DARK_MODE_MEDIA.addEventListener('change', onThemeChanged)
    return () => DARK_MODE_MEDIA.removeEventListener('change', onThemeChanged)
  }, [theme])

  useEffect(() => {
    if (theme != 'system') {
      return
    }
  }, [theme])

  const value = {
    theme,
    resolvedTheme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeContext.Provider {...props} value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
