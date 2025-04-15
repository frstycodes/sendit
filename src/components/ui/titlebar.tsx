import { cn } from '@/lib/utils'
import { Router } from '@/main'
import { useRouter } from '@tanstack/react-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ChevronLeft, ChevronRight, Minus, X } from 'lucide-react'
import { Button } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

const appWindow = getCurrentWindow()
const WINDOW_BUTTONS = [
  {
    name: 'Minimize',
    icon: <Minus className='size-4 group-hover:text-foreground' />,
    fn: () => appWindow.minimize(),
  },
  {
    name: 'Close',
    icon: <X className='size-4 group-hover:text-foreground' />,
    buttonCn: 'hover:bg-rose-500',
    fn: () => appWindow.close(),
  },
]

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
          className='rounded-full p-1 px-0 text-muted-foreground hover:bg-transparent'
        >
          <Icon className='!size-6' />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {props.direction === 'forward' ? 'Go forward' : 'Go back'}
      </TooltipContent>
    </Tooltip>
  )
}

export function TitleBar() {
  return (
    <div data-tauri-drag-region className='flex h-8 w-full justify-between'>
      <div>
        <NavigationButton direction='back' />
        <NavigationButton direction='forward' />
      </div>
      <p
        data-tauri-drag-region
        className='select flex h-full items-center px-2 text-sm'
      ></p>
      <div className='flex'>
        {WINDOW_BUTTONS.map((item) => (
          <WindowButton button={item} key={item.name} />
        ))}
      </div>
    </div>
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
        'group grid h-8 w-9 place-items-center hover:bg-foreground/10',
        button.buttonCn,
      )}
    >
      {button.icon}
    </button>
  )
}
