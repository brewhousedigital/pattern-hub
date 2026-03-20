import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypePatternResponse } from '@/functions/database/patterns.ts';

export const generatePbImage = (pattern?: TypePatternResponse) => {
  return `${pocketbaseDomain}/api/files/${pattern?.collectionId}/${pattern?.id}/${pattern?.pattern_file}`;
};
