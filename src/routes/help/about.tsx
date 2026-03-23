import { createFileRoute } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';

export const Route = createFileRoute('/help/about')({
  component: RouteComponent,
});

function RouteComponent() {
  return <GeneralLayout>Coming soon</GeneralLayout>;
}
