import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/space-command/map')({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: 'Map - Admin - Pattern Archive' }],
  }),
});

function RouteComponent() {
  return <div>Coming Soon</div>;
}
