export type CommunityBanner = {
  id: string;
  label: string;
  /** Filename only - expected to live under public/images/community/. */
  filename: string;
  width: number;
  height: number;
  /** Default alt text used in the generated embed snippets. */
  alt: string;
};

// Add an entry per banner once the image file is placed in
// public/images/community/, e.g.:
// {
//   id: 'wide-728x90',
//   label: 'Wide Banner (728×90)',
//   filename: 'banner-wide.png',
//   width: 728,
//   height: 90,
//   alt: 'Pattern Archive - Stained glass patterns',
// },
export const COMMUNITY_BANNERS: CommunityBanner[] = [
  {
    id: 'animated-banner-1',
    label: 'Share Graphic 88x31',
    filename: 'pattern-archive-share-button-88x31.gif',
    width: 88,
    height: 31,
    alt: 'Pattern Archive - Stained glass patterns',
  },
  {
    id: 'share-banner-1',
    label: 'Share Graphic 183x39',
    filename: 'pattern-archive-share-button-183x39.png',
    width: 183,
    height: 39,
    alt: 'Pattern Archive - Stained glass patterns',
  },
];
