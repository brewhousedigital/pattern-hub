import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pattern/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/pattern/"!</div>
}
