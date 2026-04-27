import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/space-command/wiki')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/space-command/wiki"!</div>
}
