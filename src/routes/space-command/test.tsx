import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/space-command/test')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/space-command/test"!</div>
}
