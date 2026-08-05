import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import { TopSearchQueriesCard } from '@/components/charts/TopSearchQueriesCard';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';
import { useQueryGetTopZeroResultSearches } from '@/functions/database/search-analytics';

// Self-fetching, like MonthlyTopExportsCard - the search_logs_by_query view is
// always live, so there's no snapshot/cron step to feed this from `latest`/
// `buckets` the way most of the registry's cards are.
export const TopZeroResultSearchesCard = () => {
  const { data, isPending, isError, error } = useQueryGetTopZeroResultSearches();

  return (
    <AdminCardWrapper isPending={isPending} isError={isError} error={error}>
      <TopSearchQueriesCard
        title="Top Zero-Result Searches"
        icon={<SearchOffRoundedIcon sx={{ fontSize: 18 }} />}
        queries={data ?? []}
        emptyMessage="No zero-result searches logged yet"
      />
    </AdminCardWrapper>
  );
};
