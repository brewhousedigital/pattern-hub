import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { useGlobalAuthData } from '@/data/auth-data';
import { useQueryGetUserById, getUserByIdOptions } from '@/functions/database/users';
import { generateSEO } from '@/functions/utilities/seo.ts';
import { ProfileContent, ProfileSkeleton, ProfileError } from '@/routes/profile/index';

type UserSearch = {
  tab: number;
};

// Path segment is a raw PocketBase user id today; see isPocketBaseId /
// getUserByIdOptions for where a future custom vanity slug would branch in.
export const Route = createFileRoute('/profile/$userId')({
  component: RouteComponent,
  // Run the loader on the server so shared profile links get real SEO meta,
  // but render the (heavily localStorage-dependent) component client-side only.
  ssr: 'data-only',
  validateSearch: (search: Record<string, unknown>): UserSearch => {
    const tab = Number(search.tab);
    return { tab: Number.isFinite(tab) && tab >= 0 && tab <= 5 ? tab : 0 };
  },
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(getUserByIdOptions(params.userId)).catch(() => undefined),
  head: ({ loaderData, match }) => {
    const rawName = loaderData?.name || '';
    const displayName = rawName.startsWith('NewUser_') ? '' : rawName;
    return generateSEO(
      displayName ? `${displayName}'s Profile` : 'Profile',
      displayName
        ? `See ${displayName}'s stained glass pattern collection, favorites, and activity on Pattern Archive.`
        : '',
      match.pathname,
    );
  },
});

function RouteComponent() {
  const { userId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: '/profile/$userId' });
  const setTab = (v: number) => void navigate({ search: (p) => ({ ...p, tab: v }), resetScroll: false });

  const { authData } = useGlobalAuthData();
  const { isPending, isError, data } = useQueryGetUserById(userId);

  // A logged-in user opening their own /profile/<id> link (e.g. via an old
  // share) sees the same editable self-view as /profile, not the read-only one.
  if (userId === authData?.id) {
    return (
      <GeneralLayout>
        <ProfileContent tab={tab} setTab={setTab} />
      </GeneralLayout>
    );
  }

  if (isPending) {
    return (
      <GeneralLayout>
        <ProfileSkeleton />
      </GeneralLayout>
    );
  }

  if (isError) return <ProfileError />;

  return (
    <GeneralLayout>
      <ProfileContent userData={data} tab={tab} setTab={setTab} />
    </GeneralLayout>
  );
}
