export type DifficultyLabel = 'Beginner' | 'Intermediate' | 'Expert';
export type DifficultyColor = 'success' | 'warning' | 'error';

export type DifficultyInfo = {
  label: DifficultyLabel;
  color: DifficultyColor;
  hex: string;
};

// Difficulty is stored in PocketBase on a 1-10 scale (see avg_difficulty /
// community_difficulty_ratings.average_rating / user_difficulty_ratings.rating).
// The interactive MUI Rating widget only supports 0.5-5 with precision 0.5, so
// UI code converts between the two scales with these helpers.
export const toScale10 = (ratingValue: number): number => Math.round(ratingValue * 2);
export const toRatingValue = (scale10: number): number => scale10 / 2;

export function getDifficultyInfo(scale10: number): DifficultyInfo {
  if (scale10 <= 3) return { label: 'Beginner', color: 'success', hex: '#4caf50' };
  if (scale10 <= 6) return { label: 'Intermediate', color: 'warning', hex: '#ff9800' };
  return { label: 'Expert', color: 'error', hex: '#f44336' };
}
