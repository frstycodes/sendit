import { routeTree } from '@/routeTree.gen'
import { createRouter } from '@tanstack/react-router'

export type Router = typeof router

declare module '@tanstack/react-router' {
  interface Register {
    router: Router
  }
}
export const router = createRouter({ routeTree })
