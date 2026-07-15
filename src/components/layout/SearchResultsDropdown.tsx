import type { RefObject } from 'react';
import { Box, Divider, LinearProgress, List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

type SearchResultsDropdownProps = {
  dropdownRef: RefObject<HTMLDivElement | null>;
  label: string;
  items: TypeReadOnlyDatabaseItem[];
  isFetching: boolean;
  searchTerm: string;
  highlightedIndex: number;
  onItemHover: (index: number) => void;
  onItemSelect: (item: TypeReadOnlyDatabaseItem) => void;
  sx?: object;
};

/**
 * The absolutely-positioned results panel shared by every tokenized/tag
 * search bar - handles its own header, loading state, and highlighted-item
 * styling. Callers own the open/close state, data fetching, and keyboard
 * navigation; this just renders the list and reports hover/click.
 */
export const SearchResultsDropdown = ({
  dropdownRef,
  label,
  items,
  isFetching,
  searchTerm,
  highlightedIndex,
  onItemHover,
  onItemSelect,
  sx,
}: SearchResultsDropdownProps) => {
  return (
    <Paper
      ref={dropdownRef}
      elevation={3}
      sx={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 903,
        maxHeight: 500,
        overflowY: 'auto',
        borderRadius: '0 0 8px 8px',
        border: '1px solid',
        borderColor: 'primary.main',
        borderTop: 'none',
        ...sx,
      }}
    >
      <Box sx={{ px: 2, py: 0.75, backgroundColor: 'action.hover' }}>
        <Typography variant="caption" color="text.secondary">
          {label} -{' '}
          {isFetching ? 'Loading...' : searchTerm ? `${items.length} result${items.length !== 1 ? 's' : ''}` : 'Newest'}
        </Typography>
      </Box>

      {isFetching && searchTerm ? <LinearProgress sx={{ height: 2 }} /> : <Divider />}

      <List dense disablePadding>
        {items.map((item, index) => (
          <ListItemButton
            key={item.id}
            selected={index === highlightedIndex}
            onMouseDown={(e) => {
              // Prevent input blur from firing before click
              e.preventDefault();
              onItemSelect(item);
            }}
            onMouseEnter={() => onItemHover(index)}
            sx={{
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { backgroundColor: 'primary.dark' },
              },
            }}
          >
            <ListItemText primary={item.tag} slotProps={{ primary: { sx: { fontSize: '0.875rem' } } }} />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
};
