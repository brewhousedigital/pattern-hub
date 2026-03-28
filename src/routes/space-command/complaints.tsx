import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/space-command/complaints')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/space-command/complaints"!</div>
}
