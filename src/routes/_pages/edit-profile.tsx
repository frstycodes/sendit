import { EditProfile } from '@/context/edit-profile'
import { AppState } from '@/state/appstate'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_pages/edit-profile')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = AppState.use('user')
  return <EditProfile buttonLabel='Save' user={user ?? undefined} />
}
