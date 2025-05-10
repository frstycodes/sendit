import { AppState } from '@/state/appstate'
import {
  createFileRoute,
  LinkProps,
  Outlet,
  redirect,
  useLocation,
} from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'

export const Route = createFileRoute('/_pages')({
  component: RouteComponent,
  beforeLoad: async (ctx) => {
    const user = AppState.get().user
    const isOnboardPath = ctx.location.pathname
      .toLowerCase()
      .includes('onboard')

    if (isOnboardPath) {
      if (user) throw redirect({ to: '/' })
      return
    }

    if (!user) throw redirect({ to: '/onboard' })
  },
})

type Title = {
  title: string
  description: string
}
type ValidRoutes = LinkProps['to'] & {}

const routeTitleMap: Partial<Record<ValidRoutes, Title>> = {
  '/': {
    title: 'SendIt',
    description: 'Send and receive files securely and easily.',
  },
  '/send': {
    title: 'Send Files',
    description: 'Add files and generate a ticket to share them with others.',
  },
  '/receive': {
    title: 'Receive Files',
    description: 'Receive files using the ticket.',
  },
  '/onboard': {
    title: 'Welcome to SendIt!',
    description: "Let's get you started with SendIt.",
  },
  '/edit-profile': {
    title: 'Edit Profile',
    description: 'Edit your profile information.',
  },
}

function RouteComponent() {
  const location = useLocation()

  const { title, description } =
    routeTitleMap[location.pathname as ValidRoutes]!

  const animate = { opacity: 1, y: 0, filter: 'blur(0px)' }
  const initial = { opacity: 0, y: -20, filter: 'blur(4px)' }

  return (
    <main className='flex flex-1 flex-col overflow-y-hidden'>
      <AnimatePresence mode='popLayout'>
        <motion.h1
          key={`title-${location.pathname}`}
          initial={initial}
          animate={animate}
          className='w-full text-2xl font-bold dark:text-shadow-lg'
        >
          {title}
        </motion.h1>
        <motion.p
          key={`description-${location.pathname}`}
          initial={initial}
          animate={animate}
          transition={{ delay: 0.1 }}
          className='text-muted-foreground pt-2 pb-6 text-sm dark:text-shadow-sm'
        >
          {description}
        </motion.p>
        <motion.div
          key={`content-${location.pathname}`}
          initial={initial}
          animate={animate}
          transition={{ delay: 0.2 }}
          className='flex size-full flex-col overflow-y-hidden'
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
