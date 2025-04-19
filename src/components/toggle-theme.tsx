import { useTheme } from '@/context/theme.context'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useRef } from 'react'
import { Button } from './ui/button'

const STATES = [
  { theme: 'system', icon: Monitor },
  { theme: 'light', icon: Sun },
  { theme: 'dark', icon: Moon },
]

export function CycleThemeButton() {
  const { theme, setTheme } = useTheme()
  const currThemeIdx = useRef(
    STATES.findIndex((state) => state.theme === theme),
  )
  const currentTheme = STATES[currThemeIdx.current]

  function cycleTheme() {
    const newIdx = (currThemeIdx.current + 1) % STATES.length
    currThemeIdx.current = newIdx
    setTheme(STATES[newIdx].theme as any)
  }

  return (
    <Button
      onClick={cycleTheme}
      variant='ghost'
      className='text-muted-foreground hover:text-foreground h-fit rounded-full p-0 hover:bg-transparent'
    >
      <currentTheme.icon className='size-4!' />
      <span key={currentTheme.theme} className='text-xs capitalize'>
        {currentTheme.theme}
      </span>
    </Button>
  )
}
