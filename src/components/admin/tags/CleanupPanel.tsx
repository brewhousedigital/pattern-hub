import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import type { TypeTagStat } from '@/functions/database/tags';
import { useGlobalIsFetchingPatterns } from '@/functions/database/tags-admin/useGlobalIsFetchingPatterns';

interface CleanupPanelProps {
  tagStats: TypeTagStat[];
  onDeleteMany: (tags: string[]) => void;
}

export function CleanupPanel({ tagStats, onDeleteMany }: CleanupPanelProps) {
  const { isFetchingPatterns } = useGlobalIsFetchingPatterns();
  const [threshold, setThreshold] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const candidates = tagStats.filter((t) => t.count <= threshold);

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((t) => t.tag)));
    }
  };

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <CleaningServicesIcon color="action" />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Low-Use Tag Cleanup
        </Typography>
        <Box sx={{ flex: 1 }} />
        <TextField
          label="Used ≤ N times"
          type="number"
          value={threshold}
          onChange={(e) => {
            setThreshold(Math.max(1, parseInt(e.target.value) || 1));
            setSelected(new Set());
          }}
          size="small"
          sx={{ width: 140 }}
          slotProps={{ htmlInput: { min: 1 } }}
        />
      </Box>

      {candidates.length === 0 ? (
        <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
          No tags found with ≤ {threshold} use{threshold !== 1 ? 's' : ''}. Your tag library is clean!
        </Alert>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            Found <strong>{candidates.length}</strong> tag{candidates.length !== 1 ? 's' : ''} used {threshold} time
            {threshold !== 1 ? 's or fewer' : ''}.
          </Alert>

          <TableContainer sx={{ maxHeight: 260 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.size > 0 && selected.size < candidates.length}
                      checked={candidates.length > 0 && selected.size === candidates.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>Tag</TableCell>
                  <TableCell align="right">Uses</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {candidates.map(({ tag, count }) => (
                  <TableRow
                    key={tag}
                    hover
                    onClick={() => toggle(tag)}
                    sx={{ cursor: 'pointer' }}
                    selected={selected.has(tag)}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={selected.has(tag)} />
                    </TableCell>
                    <TableCell>
                      <Chip label={tag} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">
                        {count}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              loading={isFetchingPatterns}
              variant="contained"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              disabled={selected.size === 0}
              onClick={() => onDeleteMany(Array.from(selected))}
            >
              Delete {selected.size} selected tag{selected.size !== 1 ? 's' : ''}
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}
