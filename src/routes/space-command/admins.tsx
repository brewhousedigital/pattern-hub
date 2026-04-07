import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo.ts';

export const Route = createFileRoute('/space-command/admins')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Admins List - Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  return <div>Admins Tool coming soon</div>;
}
