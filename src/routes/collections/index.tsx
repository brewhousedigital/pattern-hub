import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';

export const Route = createFileRoute('/collections/')({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: 'Collections - Pattern Archive' }],
  }),
});

function RouteComponent() {
  return <GeneralLayout>Coming soon</GeneralLayout>;
}
