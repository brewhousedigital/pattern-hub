import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo.ts';

export const Route = createFileRoute('/space-command/map')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Map - Admin', '', match.pathname),
});

function RouteComponent() {
  return <div>Map Tool coming soon</div>;
}
