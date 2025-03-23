import {
  createFileRoute,
  LinkProps,
  Outlet,
  useLocation,
} from '@tanstack/react-router'

export const Route = createFileRoute('/_pages')({
  component: RouteComponent,
})

type Title = {
  title: string
  description: string
}
type ValidRoutes = LinkProps['to'] & {}

const routeTitleMap: Partial<Record<ValidRoutes, Title>> = {
  '/send': {
    title: 'Send Files',
    description: 'Add files and generate a ticket to share them with others.',
  },
  '/receive': {
    title: 'Receive Files',
    description: 'Receive files using the ticket.',
  },
}

function RouteComponent() {
  const location = useLocation()

  const { title, description } =
    routeTitleMap[location.pathname as ValidRoutes]!
  return (
    <main className='flex overflow-y-hidden flex-1 flex-col'>
      <div className='flex items-center'>
        <p className='text-2xl w-full mb-1 font-bold'>{title}</p>
      </div>
      <div className='pb-6 pt-2'>
        <p className='text-sm text-muted-foreground'>{description}</p>
      </div>
      <Outlet />
    </main>
  )
}
