import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/space-command/users')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Coming Soon</div>;
}
