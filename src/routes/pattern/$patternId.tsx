import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ViewDrawer } from '@/components/ViewDrawer';
import { useGlobalViewData } from '@/data/view';
import { useQueryGetPatternById, getPatternByIdOptions } from '@/functions/database/patterns';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader.tsx';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { queryClient } from '@/functions/database/authentication-setup';

export const Route = createFileRoute('/pattern/$patternId')({
  component: RouteComponent,
  loader: ({ params }) => queryClient.ensureQueryData(getPatternByIdOptions(params.patternId)),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ? loaderData?.name : 'Pattern'} - Pattern Archive` },
      {
        name: 'description',
        content: loaderData?.description ? loaderData?.description : 'Find a pattern for your stained glass project.',
      },
    ],
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
