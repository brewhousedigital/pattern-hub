import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/help/about')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Coming soon</div>;
}
