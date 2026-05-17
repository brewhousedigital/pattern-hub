import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/profile/collections/$collectionId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/profile/collections/$collectionId"!</div>
}
