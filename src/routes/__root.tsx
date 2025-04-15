import * as React from 'react'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TitleBar } from '@/components/ui/titlebar'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <React.Fragment>
      <TitleBar />
      <div className='flex flex-1 flex-col overflow-y-hidden p-2'>
        <Outlet />
      </div>
    </React.Fragment>
  )
}
