import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/space-command/faq')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Coming Soon</div>;
}
