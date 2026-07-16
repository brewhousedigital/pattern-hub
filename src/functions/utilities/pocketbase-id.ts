// PocketBase auto-generated record ids are always exactly 15 lowercase
// alphanumeric characters. Used to tell a raw record id apart from a
// user-chosen identifier (e.g. a future custom profile vanity slug) sharing
// the same URL segment, so lookup code can branch on which one it got.
const POCKETBASE_ID_PATTERN = /^[a-z0-9]{15}$/;

export function isPocketBaseId(value: string): boolean {
  return POCKETBASE_ID_PATTERN.test(value);
}
