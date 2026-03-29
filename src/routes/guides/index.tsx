import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

export const Route = createFileRoute('/guides/')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Guides', '', match.pathname),
  }),
});

function RouteComponent() {
  return <GeneralLayout>Coming soon</GeneralLayout>;
}
