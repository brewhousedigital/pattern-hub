import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';

export const Route = createFileRoute('/help/contact')({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: 'Contact - Pattern Archive' }],
  }),
});

function RouteComponent() {
  return <GeneralLayout>Coming soon</GeneralLayout>;
}
