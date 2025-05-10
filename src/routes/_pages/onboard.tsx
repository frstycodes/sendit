import { EditProfile } from '@/context/edit-profile'
import { AppState } from '@/state/appstate'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/_pages/onboard')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()
  const { user } = AppState.use('user')

  useEffect(() => {
    if (user) navigate({ to: '/' })
  }, [user])
  return <EditProfile />
}
