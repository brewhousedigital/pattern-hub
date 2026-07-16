import { Chip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { getDifficultyInfo } from '@/functions/utilities/difficulty';

type DifficultyChipProps = {
  // Difficulty on the 1-10 scale (e.g. pattern.avg_difficulty, a difficulty rating's raw value).
  value: number | null | undefined;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
};

export function DifficultyChip({ value, size = 'small', sx }: DifficultyChipProps) {
  if (!value) return null;

  const info = getDifficultyInfo(value);

  return <Chip size={size} label={info.label} color={info.color} sx={sx} />;
}
