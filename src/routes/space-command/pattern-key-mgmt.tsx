import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/space-command/pattern-key-mgmt')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/space-command/pattern-key-mgmt"!</div>
}
