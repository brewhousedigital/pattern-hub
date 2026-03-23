import { createFileRoute } from '@tanstack/react-router';
import { AdminLayoutTest } from '@/components/layout/AdminLayoutTest';

export const Route = createFileRoute('/space-command/test')({
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminLayoutTest>Hello "/space-command/test"!</AdminLayoutTest>;
}
