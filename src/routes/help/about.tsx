import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { staticCacheHeaders } from '@/functions/utilities/cache-headers';

export const Route = createFileRoute('/help/about')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('About', '', match.pathname),
  headers: staticCacheHeaders,
});

function RouteComponent() {
  return <GeneralLayout>Coming soon</GeneralLayout>;
}
