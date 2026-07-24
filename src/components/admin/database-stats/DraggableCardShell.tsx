import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { Box, IconButton, Tooltip } from '@mui/material';

type Props = {
  id: string;
  onHide: (id: string) => void;
  children: ReactNode;
};

// Wraps any presentational card from src/components/charts/* with a drag
// handle + hide button. The wrapped card never imports @dnd-kit or
// localStorage itself - that machinery lives entirely in this admin-only
// folder, so the community page can reuse the same chart components without
// dragging any of this in.
export const DraggableCardShell = ({ id, onHide, children }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: 'relative',
        height: '100%',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : 'auto',
        '&:hover .db-stats-card-controls': { opacity: 1 },
      }}
    >
      <Box
        className="db-stats-card-controls"
        sx={{
          position: 'absolute',
          top: 6,
          right: 6,
          zIndex: 2,
          display: 'flex',
          gap: 0.25,
          opacity: 0,
          transition: 'opacity 0.15s',
          backgroundColor: 'background.paper',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Tooltip title="Hide card">
          <IconButton size="small" onClick={() => onHide(id)}>
            <VisibilityOffRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Drag to reorder">
          <IconButton size="small" {...attributes} {...listeners} sx={{ cursor: 'grab' }}>
            <DragIndicatorRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
      {children}
    </Box>
  );
};
