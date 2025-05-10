import { avatars } from '@/assets/avatars'
import { AppState } from '@/state/appstate'
import { cn } from '@/utils'
import { Link, useRouter } from '@tanstack/react-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  Minus,
  Pen,
  X,
} from 'lucide-react'
import { CycleThemeButton } from './toggle-theme'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

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
    buttonClassName: 'hover:bg-rose-500',
    fn: () => appWindow.close(),
  },
]

export function TitleBar() {
  return (
    <div data-tauri-drag-region className='flex h-8 w-full justify-between'>
      <div className='flex items-center'>
        <NavigationButton direction='back' />
        <NavigationButton direction='forward' />
        <NavigationButton direction='home' />
      </div>
      <div className='ml-auto flex items-center'>
        <UserButton />
      </div>
      <div className='flex'>
        {WINDOW_BUTTONS.map((item) => (
          <WindowButton button={item} key={item.name} />
        ))}
      </div>
    </div>
  )
}

function UserButton() {
  const { user } = AppState.use('user')
  if (!user) return null

  const avatar = avatars[user.avatar]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='default'
          className='h-fit gap-1 border-none !bg-transparent p-0.5 px-1.5 text-xs shadow-none! select-none hover:bg-transparent'
        >
          <img src={avatar} className='size-4 rounded-full' />
          <ChevronDown className='!size-3' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className='flex items-center gap-2 px-2 py-2'>
          <img src={avatar} className='h-6 w-6 rounded-full' />
          <h1 className='text-sm font-medium'>{user.name}</h1>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className='cursor-pointer py-2' asChild>
          <Link to='/edit-profile'>
            <Pen className='size-4' /> Edit Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          onClick={(e) => e.preventDefault()}
          className='cursor-pointer'
        >
          <CycleThemeButton className='aspect-auto h-full justify-start' />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type NavigationButtonProps = {
  direction: 'forward' | 'back' | 'home'
}

function NavigationButton(props: NavigationButtonProps) {
  const router = useRouter()

  const iconMap = {
    forward: ChevronRight,
    back: ChevronLeft,
    home: Home,
  }
  const labelMap = {
    forward: 'Go forward',
    back: 'Go back',
    home: 'Go home',
  }

  const navigateFn = {
    forward: () => router.history.forward(),
    back: () => router.history.back(),
    home: () => router.navigate({ to: '/' }),
  }

  const Icon = iconMap[props.direction]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={navigateFn[props.direction]}
          variant='ghost'
          className='text-muted-foreground rounded-full p-1 px-0 hover:bg-transparent'
        >
          <Icon
            className={props.direction == 'home' ? 'size-4.5!' : 'size-6!'}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{labelMap[props.direction]}</TooltipContent>
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
        button.buttonClassName,
      )}
    >
      {button.icon}
    </button>
  )
}
