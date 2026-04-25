import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypePatternResponse, TypePatternKeyTableResponse } from '@/functions/database/patterns.ts';

export const generatePbImage = (pattern?: TypePatternResponse) => {
  const thisPatternFile = pattern?.pattern_file ? pattern?.pattern_file : pattern?.pattern_file_external;
  return `${pocketbaseDomain}/api/files/${pattern?.collectionId}/${pattern?.id}/${thisPatternFile}`;
};

// This function is used on the admin panel to force-render the SVG file if it exists
export const generatePbImageSVG = (pattern?: TypePatternResponse) => {
  return `${pocketbaseDomain}/api/files/${pattern?.collectionId}/${pattern?.id}/${pattern?.pattern_file}`;
};

// This function is used on the admin panel to force-render the external file if it exists
export const generatePbImageExternalFile = (pattern?: TypePatternResponse) => {
  return `${pocketbaseDomain}/api/files/${pattern?.collectionId}/${pattern?.id}/${pattern?.pattern_file_external}`;
};

// This function is used on the admin panel to force-render the open graph file if it exists
export const generatePbImageOpenGraph = (pattern?: TypePatternResponse) => {
  return `${pocketbaseDomain}/api/files/${pattern?.collectionId}/${pattern?.id}/${pattern?.opengraph_image}`;
};

// This function is used to generate the pattern key reference image stored on each pattern
export const generatePbImagePatternKeyRef = (keyItem: TypePatternKeyTableResponse) => {
  return `${pocketbaseDomain}/api/files/pbc_669275364/${keyItem.id}/${keyItem.name}`;
};
