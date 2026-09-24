// The admin team must not see the email of a signed-in reporter for now.
// Set this to false to show these emails again in all admin report screens.
export const HIDE_SIGNED_IN_REPORTER_EMAILS = true;

export const HIDDEN_REPORTER_EMAIL_LABEL = 'Email hidden';

type TypeReporterEmailSource = {
  email: string;
  owner_id?: string;
  expand?: { owner_id?: { id?: string } };
};

/** Returns the reporter email, or null when it must stay hidden from the admin team. */
export function getVisibleReporterEmail(report?: TypeReporterEmailSource | null): string | null {
  if (!report) return null;

  const isSignedIn = !!(report.owner_id || report.expand?.owner_id?.id);
  if (HIDE_SIGNED_IN_REPORTER_EMAILS && isSignedIn) return null;

  return report.email;
}

/** Returns the PocketBase filter clause that matches a search term against reporter emails. */
export function buildReporterEmailSearchClause(searchTerm: string): string {
  // A search on a hidden email would reveal it, so only anonymous reports match on email.
  if (HIDE_SIGNED_IN_REPORTER_EMAILS) return `(email ~ '${searchTerm}' && owner_id = '')`;

  return `email ~ '${searchTerm}'`;
}
