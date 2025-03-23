import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

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

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => null,
}

const ThemeContext = createContext<ThemeProviderState>(initialState)

const DARK_MODE_MEDIA = window.matchMedia('(prefers-color-scheme: dark)')
const ROOT = window.document.documentElement

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  function getThemeFromStorage(): Theme {
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme
  }

  function getInitialResolvedTheme(): ResolvedTheme {
    const storedTheme = getThemeFromStorage()
    if (storedTheme != 'system') return storedTheme
    return DARK_MODE_MEDIA.matches ? 'dark' : 'light'
  }

  const [theme, setTheme] = useState<Theme>(getThemeFromStorage)
  const [resolvedTheme, setResolvedTheme] = useState(getInitialResolvedTheme)

  useEffect(() => {
    ROOT.classList.remove('light', 'dark')
    ROOT.classList.add(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    localStorage.setItem(storageKey, theme)
    if (theme != 'system') return
    const controller = new AbortController()

    DARK_MODE_MEDIA.addEventListener(
      'change',
      (event) => {
        const systemTheme = event.matches ? 'dark' : 'light'
        setResolvedTheme(systemTheme)
      },
      { signal: controller.signal },
    )
    return () => {
      controller.abort()
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

export function useResolvedTheme() {
  const [resolvedTheme, setResolvedTheme] = useState<Theme>('light')
  const { theme } = useTheme()

  useEffect(() => {
    if (theme === 'system') {
      const systemTheme = DARK_MODE_MEDIA.matches ? 'dark' : 'light'

      setResolvedTheme(systemTheme)
    } else {
      setResolvedTheme(theme)
    }
  }, [theme])

  return resolvedTheme
}
