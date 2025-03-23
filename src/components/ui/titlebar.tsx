import { useRouter } from '@tanstack/react-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ChevronLeft, ChevronRight, Minus, Square, X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { Button } from './button'
import { Router } from '@/main'
import { cn } from '@/lib/utils'

const appWindow = getCurrentWindow()
const WINDOW_BUTTONS = [
  {
    name: 'Minimize',
    icon: <Minus className='size-4 group-hover:text-foreground' />,
    fn: () => appWindow.minimize(),
  },
  {
    name: 'Maximize',
    icon: <Square className='size-3 group-hover:text-foreground' />,
    fn: () => appWindow.toggleMaximize(),
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
          className='px-0 rounded-full hover:bg-transparent p-1 text-muted-foreground'
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
    <div data-tauri-drag-region className='h-8 flex justify-between w-full'>
      <div>
        <NavigationButton direction='back' />
        <NavigationButton direction='forward' />
      </div>
      <p
        data-tauri-drag-region
        className='select px-2 text-sm h-full flex items-center'
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
        'h-8 grid place-items-center group hover:bg-foreground/10 w-9',
        button.buttonCn,
      )}
    >
      {button.icon}
    </button>
  )
}
