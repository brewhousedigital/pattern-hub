import React from 'react';
import { useQueryGetSpaceCommandDashboardData } from '@/functions/database/admin-dashboard-data';
import { useQueryGetAllManualAuthors, nameToSlug } from '@/functions/database/manual-authors';
import { AdminDashboardReadOnlyTable, type TypeAuthorsTableRow } from '@/components/admin/AdminDashboardReadOnlyTable';

export const AdminAuthorsTable = () => {
  const { isPending, isFetching, isError, data: dashboardData } = useQueryGetSpaceCommandDashboardData();

  // Custom author pages (the manual_authors collection). Matched by exact name
  // or slugified name - the same convention PatternViewContent uses to link
  // author names on pattern pages.
  const { data: manualAuthorPages = [] } = useQueryGetAllManualAuthors();

  const data: TypeAuthorsTableRow[] = React.useMemo(() => {
    const authors = dashboardData?.authors ?? [];
    if (manualAuthorPages.length === 0) return authors;

    return authors.map((author) => {
      // Registered accounts already link to their profile
      if (author.user_id) return author;

      const page = manualAuthorPages.find(
        (p) => p.name === author.tag || nameToSlug(p.name) === nameToSlug(author.tag),
      );

      return page ? { ...author, manual_page_slug: page.slug, manual_page_published: page.is_published } : author;
    });
  }, [dashboardData?.authors, manualAuthorPages]);

  return (
    <AdminDashboardReadOnlyTable
      isPending={isPending}
      isFetching={isFetching}
      isError={isError}
      data={data}
      title="Authors"
      customProp="authors"
    />
  );
};
