import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ViewDrawer } from '@/components/ViewDrawer';
import { useGlobalViewData } from '@/data/view';
import { useQueryGetPatternById } from '@/functions/database/patterns';
import { FullScreenLoader } from '@/components/FullScreenLoader';

export const Route = createFileRoute('/pattern/$patternId')({
  component: RouteComponent,
});

function RouteComponent() {
  const { patternId } = Route.useParams();
  const { setViewData } = useGlobalViewData();

  const { isPending, isError, data } = useQueryGetPatternById(patternId);

  React.useEffect(() => {
    if (data) {
      setViewData(data);
    }
  }, [data]);

  if (isPending) {
    return <FullScreenLoader />;
  }

  if (isError) {
    return <>Error</>;
  }

  return <ViewDrawer hideNavigation />;
}
