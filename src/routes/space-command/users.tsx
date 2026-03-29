import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/space-command/users')({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: 'Users - Admin - Pattern Archive' }],
  }),
});

function RouteComponent() {
  return <div>Coming Soon</div>;
}
