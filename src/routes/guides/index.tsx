import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { staticCacheHeaders } from '@/functions/utilities/cache-headers';

export const Route = createFileRoute('/guides/')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Guides', 'Tips and how-tos for stained glass pattern making.', match.pathname),
  headers: staticCacheHeaders,
});

function RouteComponent() {
  return <GeneralLayout>Coming soon</GeneralLayout>;
}
