import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ViewDrawer } from '@/components/ViewDrawer';
import { useGlobalViewData } from '@/data/view';
import { useQueryGetPatternById, getPatternByIdOptions } from '@/functions/database/patterns';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader.tsx';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { queryClient } from '@/functions/database/authentication-setup';
import { generateSEO } from '@/functions/utilities/seo.ts';

export const Route = createFileRoute('/pattern/$patternId')({
  component: RouteComponent,
  loader: ({ params }) => queryClient.ensureQueryData(getPatternByIdOptions(params.patternId)),
  head: ({ loaderData, match }) => ({
    meta: generateSEO(loaderData?.name, loaderData?.description, match.pathname),
  }),
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

  return (
    <GeneralLayout>
      <ViewDrawer hideNavigation />
    </GeneralLayout>
  );
}
