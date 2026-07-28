import React from 'react';
import { MenuItem, TextField } from '@mui/material';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { TopExportedPatternsCard } from '@/components/charts/TopExportedPatternsCard';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';
import { formatMonthLabel, useQueryGetMonthlyTopExports } from '@/functions/database/database-stats';

// Unlike every other card in the registry, this one owns its own fetch and
// selection state instead of being fed pre-resolved data - it needs a month
// picker, which is a genuinely different interaction from the page-wide
// daily/monthly/quarterly/yearly period toggle that drives everything else
// (that toggle controls chart *resolution*; this picks one specific concluded
// month to inspect). Kept in admin/database-stats/ rather than charts/ for
// exactly that reason - it's stateful, admin-specific orchestration, not a
// reusable presentational primitive. TopExportedPatternsCard itself is still
// the plain, reusable list underneath.
export const MonthlyTopExportsCard = () => {
  const { data, isPending, isError, error } = useQueryGetMonthlyTopExports();
  const months = data ?? [];

  const [selectedMonth, setSelectedMonth] = React.useState<string | null>(null);
  const effectiveMonth = selectedMonth && months.some((m) => m.month === selectedMonth) ? selectedMonth : months[0]?.month;
  const selected = months.find((m) => m.month === effectiveMonth);

  const dropdown =
    months.length > 0 ? (
      <TextField
        select
        size="small"
        value={effectiveMonth ?? ''}
        onChange={(e) => setSelectedMonth(e.target.value)}
        sx={{ minWidth: 150 }}
        slotProps={{ select: { sx: { fontSize: '0.8125rem', py: 0.75 } } }}
      >
        {months.map((m) => (
          <MenuItem key={m.month} value={m.month} sx={{ fontSize: '0.8125rem' }}>
            {formatMonthLabel(m.month)}
          </MenuItem>
        ))}
      </TextField>
    ) : undefined;

  return (
    <AdminCardWrapper isPending={isPending} isError={isError} error={error}>
      <TopExportedPatternsCard
        title="Top Exported Patterns (By Month)"
        icon={<EmojiEventsRoundedIcon sx={{ fontSize: 18 }} />}
        patterns={selected?.top_patterns ?? []}
        action={dropdown}
        subtitle={
          selected
            ? `${formatMonthLabel(selected.month)} · ${selected.total_exports_in_month.toLocaleString()} total exports`
            : undefined
        }
        emptyMessage={
          months.length === 0
            ? "No completed months yet - this fills in once the current month ends"
            : 'No exports recorded that month'
        }
      />
    </AdminCardWrapper>
  );
};
