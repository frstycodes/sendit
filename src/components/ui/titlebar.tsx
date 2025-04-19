import { cn } from '@/lib/utils'
import { Router } from '@/main'
import { useRouter } from '@tanstack/react-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ChevronLeft, ChevronRight, Minus, X } from 'lucide-react'
import { Button } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { CycleThemeButton } from '../toggle-theme'

const appWindow = getCurrentWindow()
const WINDOW_BUTTONS = [
  {
    name: 'Minimize',
    icon: <Minus className='group-hover:text-foreground size-4' />,
    fn: () => appWindow.minimize(),
  },
  {
    name: 'Close',
    icon: <X className='group-hover:text-foreground size-4' />,
    buttonCn: 'hover:bg-rose-500',
    fn: () => appWindow.close(),
  },
]

export function TitleBar() {
  return (
    <div data-tauri-drag-region className='flex h-8 w-full justify-between'>
      <div className='flex items-center'>
        <NavigationButton direction='back' />
        <NavigationButton direction='forward' />
        <div className='ml-2 flex items-center'>
          <CycleThemeButton />
        </div>
      </div>
      <div className='flex'>
        {WINDOW_BUTTONS.map((item) => (
          <WindowButton button={item} key={item.name} />
        ))}
      </div>
    </div>
  )
}

type NavigationButtonProps = {
  direction: 'forward' | 'back'
}
function NavigationButton(props: NavigationButtonProps) {
  const router = useRouter<Router>()
  const Icon = props.direction == 'back' ? ChevronLeft : ChevronRight
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={() => router.history[props.direction]()}
          variant='ghost'
          className='text-muted-foreground rounded-full p-1 px-0 hover:bg-transparent'
        >
          <Icon className='size-6!' />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {props.direction === 'forward' ? 'Go forward' : 'Go back'}
      </TooltipContent>
    </Tooltip>
  )
}

function WindowButton({ button }: { button: (typeof WINDOW_BUTTONS)[number] }) {
  return (
    <button
      onClick={(e) => {
        button.fn()
        e.currentTarget.blur()
      }}
      className={cn(
        'group hover:bg-foreground/10 grid h-8 w-9 place-items-center',
        button.buttonCn,
      )}
    >
      {button.icon}
    </button>
  )
}
