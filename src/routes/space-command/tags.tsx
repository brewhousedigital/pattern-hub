import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/space-command/tags')({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: 'Tags - Admin - Pattern Archive' }],
  }),
});

function RouteComponent() {
  return <div>Coming Soon</div>;
}
