import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/space-command/map')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Coming Soon</div>;
}
