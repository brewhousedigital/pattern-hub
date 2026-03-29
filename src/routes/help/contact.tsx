import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

export const Route = createFileRoute('/help/contact')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Contact', '', match.pathname),
  }),
});

function RouteComponent() {
  return <GeneralLayout>Coming soon</GeneralLayout>;
}
