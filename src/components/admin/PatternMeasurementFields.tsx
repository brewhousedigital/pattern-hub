import { Grid, MenuItem, TextField } from '@mui/material';

const unitOfMeasurementOptions = ['in', 'cm', 'mm'];

type MeasurementFieldValue = {
  value: string;
  unit: string;
  onValueChange: (newValue: string) => void;
  onUnitChange: (newUnit: string) => void;
};

type PatternMeasurementFieldsProps = {
  pieces: string;
  onPiecesChange: (newValue: string) => void;
  width: MeasurementFieldValue;
  height: MeasurementFieldValue;
  lineWidth: MeasurementFieldValue;
  /** Matches whichever TextField style the surrounding form already uses. Defaults to 'outlined'. */
  variant?: 'outlined' | 'filled';
};

type MeasurementRowProps = {
  label: string;
  field: MeasurementFieldValue;
  variant: 'outlined' | 'filled';
};

const MeasurementRow = (props: MeasurementRowProps) => (
  <Grid container spacing={2}>
    <Grid size={{ xs: 12, md: 6 }}>
      <TextField
        fullWidth
        variant={props.variant}
        label={props.label}
        type="number"
        value={props.field.value}
        onChange={(e) => props.field.onValueChange(e.target.value)}
      />
    </Grid>
    <Grid size={{ xs: 12, md: 6 }}>
      <TextField
        fullWidth
        select
        variant={props.variant}
        label="Unit"
        value={props.field.unit}
        onChange={(e) => props.field.onUnitChange(e.target.value)}
      >
        {unitOfMeasurementOptions.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
  </Grid>
);

// Shared by AdminEditPatternModal and the user-submission review page so the
// width/height/line-width + unit layout can't drift between the two editing
// surfaces. Rows are stacked (value + unit side by side) so each unit sits
// directly next to the value it applies to.
export const PatternMeasurementFields = (props: PatternMeasurementFieldsProps) => {
  const variant = props.variant ?? 'outlined';

  return (
    <>
      <TextField
        fullWidth
        variant={variant}
        label="Pieces"
        type="number"
        value={props.pieces}
        onChange={(e) => props.onPiecesChange(e.target.value)}
      />
      <MeasurementRow label="Width" field={props.width} variant={variant} />
      <MeasurementRow label="Height" field={props.height} variant={variant} />
      <MeasurementRow label="Line Width" field={props.lineWidth} variant={variant} />
    </>
  );
};
