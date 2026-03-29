import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo.ts';

export const Route = createFileRoute('/space-command/tags')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Tags - Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  return <div>Coming Soon</div>;
}
