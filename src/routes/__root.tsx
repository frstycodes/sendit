import * as React from 'react'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TitleBar } from '@/components/titlebar'
import { SendPageListeners } from './_pages/send'
import { ReceivePageListeners } from './_pages/receive'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <React.Fragment>
      <SendPageListeners />
      <ReceivePageListeners />
      <TitleBar />
      <div className='flex flex-1 flex-col overflow-y-hidden p-2'>
        <Outlet />
      </div>
    </React.Fragment>
  )
}
