import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypePatternResponse, TypePatternKeyTableResponse } from '@/functions/database/patterns.ts';
import type { TypeAuthData } from '@/functions/database/authentication';
import type { TypeManualAuthor } from '@/functions/database/manual-authors';

// Used whenever the underlying file field (or the pattern/id itself) is missing,
// instead of building a URL with a literal "undefined" segment in it.
const PLACEHOLDER_IMAGE = '/images/placeholder-image.webp';

export const generatePbImage = (pattern?: TypePatternResponse) => {
  const thisPatternFile = pattern?.pattern_file ? pattern?.pattern_file : pattern?.pattern_file_external;
  if (!thisPatternFile || !pattern?.collectionId || !pattern?.id) return PLACEHOLDER_IMAGE;
  return `${pocketbaseDomain}/api/files/${pattern.collectionId}/${pattern.id}/${thisPatternFile}`;
};

// This function is used on the admin panel to force-render the SVG file if it exists
export const generatePbImageSVG = (pattern?: TypePatternResponse) => {
  if (!pattern?.pattern_file || !pattern.collectionId || !pattern.id) return PLACEHOLDER_IMAGE;
  return `${pocketbaseDomain}/api/files/${pattern.collectionId}/${pattern.id}/${pattern.pattern_file}`;
};

// This function is used on the admin panel to force-render the external file if it exists
export const generatePbImageExternalFile = (pattern?: TypePatternResponse) => {
  if (!pattern?.pattern_file_external || !pattern.collectionId || !pattern.id) return PLACEHOLDER_IMAGE;
  return `${pocketbaseDomain}/api/files/${pattern.collectionId}/${pattern.id}/${pattern.pattern_file_external}`;
};

// This function is used on the admin panel to force-render the open graph file if it exists
export const generatePbImageOpenGraph = (pattern?: TypePatternResponse) => {
  if (!pattern?.opengraph_image || !pattern.collectionId || !pattern.id) return PLACEHOLDER_IMAGE;
  return `${pocketbaseDomain}/api/files/${pattern.collectionId}/${pattern.id}/${pattern.opengraph_image}`;
};

// This function is used to generate the pattern key reference image stored on each pattern
export const generatePbImagePatternKeyRef = (keyItem: TypePatternKeyTableResponse) => {
  if (!keyItem.name || !keyItem.id) return PLACEHOLDER_IMAGE;
  return `${pocketbaseDomain}/api/files/pbc_669275364/${keyItem.id}/${keyItem.name}`;
};

export const generateUserAvatarUrl = (user?: TypeAuthData): string | null => {
  if (!user?.avatar || !user.collectionId || !user.id) return null;
  return `${pocketbaseDomain}/api/files/${user.collectionId}/${user.id}/${user.avatar}`;
};

export const generateUserHeaderUrl = (user?: TypeAuthData): string | null => {
  if (!user?.header_image || !user.collectionId || !user.id) return null;
  return `${pocketbaseDomain}/api/files/${user.collectionId}/${user.id}/${user.header_image}`;
};

export const generateUserBgImageUrl = (user?: TypeAuthData): string | null => {
  if (!user?.profile_bg_image || !user.collectionId || !user.id) return null;
  return `${pocketbaseDomain}/api/files/${user.collectionId}/${user.id}/${user.profile_bg_image}`;
};

export const generateUserMobileHeaderUrl = (user?: TypeAuthData): string | null => {
  if (!user?.mobile_header_image || !user.collectionId || !user.id) return null;
  return `${pocketbaseDomain}/api/files/${user.collectionId}/${user.id}/${user.mobile_header_image}`;
};

export const generateManualAuthorAvatarUrl = (author?: TypeManualAuthor): string | null => {
  if (!author?.avatar || !author.collectionId || !author.id) return null;
  return `${pocketbaseDomain}/api/files/${author.collectionId}/${author.id}/${author.avatar}`;
};
