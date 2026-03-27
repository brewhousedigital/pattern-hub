import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/space-command/tags')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Coming Soon</div>;
}
