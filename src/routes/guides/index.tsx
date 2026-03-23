import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';

export const Route = createFileRoute('/guides/')({
  component: RouteComponent,
});

function RouteComponent() {
  return <GeneralLayout>Coming soon</GeneralLayout>;
}
