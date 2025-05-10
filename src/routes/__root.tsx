import * as React from 'react'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { SendPageListeners } from './_pages/send'
import { ReceivePageListeners } from './_pages/receive'
import { AppState } from '@/state/appstate'
import { api, listen } from '@/lib/tauri'
import { Loader2 } from 'lucide-react'
import { TitleBar } from '@/components/titlebar'

export const Route = createRootRoute({
  component: RootComponent,
})

async function loadUser() {
  const user = await api.getUser()
  if (user.isOk()) AppState.set({ user: user.value })
}

function RootComponent() {
  const [loaded, setLoaded] = React.useState(false)

  async function onStateLoaded() {
    await loadUser()
    setLoaded(true)
  }

  async function isLoaded() {
    const loadedRes = await api.appLoaded()
    const res = loadedRes.match(
      (v) => v,
      () => false,
    )
    await loadUser()
    setLoaded(res)
  }

  React.useEffect(() => {
    if (loaded) return
    isLoaded()

    const con = new AbortController()
    listen('APP_LOADED', onStateLoaded, { signal: con.signal })

    return () => void con.abort()
  }, [loaded])

  let content = (
    <>
      <SendPageListeners />
      <ReceivePageListeners />
      <div className='flex flex-1 flex-col overflow-y-hidden p-2'>
        <Outlet />
      </div>
    </>
  )

  if (!loaded) {
    content = (
      <div className='text-background flex h-screen w-screen items-center justify-center gap-2'>
        <Loader2 className='size-8 animate-spin' />
        Loading
      </div>
    )
  }

  return (
    <>
      <TitleBar />
      {content}
    </>
  )
}
