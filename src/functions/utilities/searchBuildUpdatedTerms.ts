export const buildUpdatedTerm = (prev: string, tag: string, prefix = '') => {
  const fullTag = `${prefix}${tag}`;
  const opposite = prefix === '-' ? tag : `-${tag}`;
  const existing = prev ? prev.split(' ') : [];

  if (existing.includes(fullTag)) return prev; // already present, no-op

  if (existing.includes(opposite)) {
    // swap the opposite polarity to this one
    return existing.map((t) => (t === opposite ? fullTag : t)).join(' ');
  }

  return existing.length ? `${prev} ${fullTag}` : fullTag;
};
