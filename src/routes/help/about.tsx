import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';

export const Route = createFileRoute('/help/about')({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: 'About - Pattern Archive' }],
  }),
});

function RouteComponent() {
  return <GeneralLayout>Coming soon</GeneralLayout>;
}
