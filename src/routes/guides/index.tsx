import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';

export const Route = createFileRoute('/guides/')({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: 'Guides - Pattern Archive' }],
  }),
});

function RouteComponent() {
  return <GeneralLayout>Coming soon</GeneralLayout>;
}
