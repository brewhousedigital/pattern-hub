import { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Box, Button, Chip, Grid, ListItemText, Menu, MenuItem } from '@mui/material';
import { DraggableCardShell } from '@/components/admin/database-stats/DraggableCardShell';
import { useDatabaseStatsCardPrefs } from '@/components/admin/database-stats/useDatabaseStatsCardPrefs';
import type { TypeDatabaseStatsCardDefinition } from '@/components/admin/database-stats/DatabaseStatsCardRegistry';

type Props = {
  cards: TypeDatabaseStatsCardDefinition[];
};

// Admin-only composition root: registry + localStorage prefs + drag-and-drop,
// all isolated in this folder so the community page can use the same
// src/components/charts/* cards directly without any of this machinery.
export const DatabaseStatsGrid = ({ cards }: Props) => {
  const allIds = cards.map((c) => c.id);
  const { orderedIds, hiddenIds, setOrder, toggleHidden } = useDatabaseStatsCardPrefs(allIds);

  const cardsById = new Map(cards.map((c) => [c.id, c]));
  const isDefined = (c: TypeDatabaseStatsCardDefinition | undefined): c is TypeDatabaseStatsCardDefinition => !!c;

  const visibleOrderedCards = orderedIds
    .filter((id) => !hiddenIds.has(id))
    .map((id) => cardsById.get(id))
    .filter(isDefined);

  const hiddenCards = orderedIds
    .filter((id) => hiddenIds.has(id))
    .map((id) => cardsById.get(id))
    .filter(isDefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [restoreMenuAnchor, setRestoreMenuAnchor] = useState<HTMLElement | null>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    setOrder(arrayMove(orderedIds, oldIndex, newIndex));
  };

  return (
    <Box>
      {hiddenCards.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<VisibilityRoundedIcon fontSize="small" />}
            endIcon={<ExpandMoreRoundedIcon fontSize="small" />}
            onClick={(e) => setRestoreMenuAnchor(e.currentTarget)}
          >
            {hiddenCards.length} hidden card{hiddenCards.length === 1 ? '' : 's'}
          </Button>
          <Menu anchorEl={restoreMenuAnchor} open={!!restoreMenuAnchor} onClose={() => setRestoreMenuAnchor(null)}>
            {hiddenCards.map((card) => (
              <MenuItem
                key={card.id}
                onClick={() => {
                  toggleHidden(card.id);
                  setRestoreMenuAnchor(null);
                }}
              >
                <ListItemText>{card.title}</ListItemText>
                <Chip label="Show" size="small" sx={{ ml: 2 }} />
              </MenuItem>
            ))}
          </Menu>
        </Box>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleOrderedCards.map((c) => c.id)} strategy={rectSortingStrategy}>
          <Grid container spacing={2}>
            {visibleOrderedCards.map((card) => (
              <Grid key={card.id} size={card.gridSize}>
                <DraggableCardShell id={card.id} onHide={toggleHidden}>
                  {card.render()}
                </DraggableCardShell>
              </Grid>
            ))}
          </Grid>
        </SortableContext>
      </DndContext>
    </Box>
  );
};
