import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/space-command/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/admin/"!</div>
}
