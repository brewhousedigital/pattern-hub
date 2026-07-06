import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

export const Route = createFileRoute('/guides/')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Guides', 'Tips and how-tos for stained glass pattern making.', match.pathname),
});

function RouteComponent() {
  return <GeneralLayout>Coming soon</GeneralLayout>;
}
