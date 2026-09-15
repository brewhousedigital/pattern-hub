import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import type { TypeTagHierarchyRecord, TypeTagV2Record } from '@/functions/database/tags';
import type { OperationType } from '@/functions/database/tags-admin/satellite-sync';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

interface BuildTagColumnsOptions {
  hierarchy: TypeTagHierarchyRecord[];
  tagsV2ById: Map<string, TypeTagV2Record>;
  setMetadataRow: (row: TypeReadOnlyDatabaseItem) => void;
  setImpliedTagsRow: (row: TypeReadOnlyDatabaseItem) => void;
  setAliasRow: (row: TypeReadOnlyDatabaseItem) => void;
  setSetParentRow: (row: TypeReadOnlyDatabaseItem) => void;
  setRenamePrefill: (value: { tag: string; nonce: number }) => void;
  startOp: (type: OperationType, tag: string) => void | Promise<void>;
}

/**
 * Column defs for the main "All Tags" DataGrid - wires each row's action
 * icons to the page's own dialog-open setters and startOp('delete', ...),
 * kept as a plain builder (not a component) so TagManagementPage can memoize
 * the result itself, matching the useMemo it already wrapped this in.
 */
export function buildTagColumns({
  hierarchy,
  tagsV2ById,
  setMetadataRow,
  setImpliedTagsRow,
  setAliasRow,
  setSetParentRow,
  setRenamePrefill,
  startOp,
}: BuildTagColumnsOptions): GridColDef<TypeReadOnlyDatabaseItem>[] {
  return [
    {
      field: 'tag',
      headerName: 'Tag',
      flex: 1,
      sortable: true,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          variant={params.row.count === 1 ? 'outlined' : 'filled'}
          color={params.row.count === 1 ? 'warning' : 'default'}
          sx={{ fontFamily: 'monospace' }}
        />
      ),
    },
    {
      field: 'parent',
      headerName: 'Parent',
      width: 160,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const parentName = hierarchy.find((h) => h.tag === params.row.tag)?.parent_tag;
        return parentName ? (
          <Chip label={parentName} size="small" variant="outlined" color="primary" sx={{ fontFamily: 'monospace' }} />
        ) : (
          <Typography variant="caption" color="text.disabled">
            -
          </Typography>
        );
      },
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 130,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const typeInfo = tagsV2ById.get(params.row.id)?.expand?.type;
        // "General" is the default every tag starts with - a badge for it
        // on every row would just be noise, so only show one for a tag
        // that's been given a real, differentiating Type.
        if (!typeInfo || typeInfo.name.toLowerCase() === 'general') {
          return (
            <Typography variant="caption" color="text.disabled">
              General
            </Typography>
          );
        }
        return (
          <Chip
            label={typeInfo.name}
            size="small"
            sx={typeInfo.color ? { bgcolor: typeInfo.color, color: '#fff' } : undefined}
          />
        );
      },
    },
    {
      field: 'count',
      headerName: 'Patterns',
      width: 110,
      sortable: true,
      disableColumnMenu: true,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 276,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit type & definition">
            <IconButton size="small" onClick={() => setMetadataRow(params.row)}>
              <EditNoteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Manage implied tags">
            <IconButton size="small" onClick={() => setImpliedTagsRow(params.row)}>
              <DeviceHubIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Manage alias">
            <IconButton size="small" onClick={() => setAliasRow(params.row)}>
              <SwapHorizIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Set parent tag (legacy hierarchy)">
            <IconButton size="small" onClick={() => setSetParentRow(params.row)}>
              <AccountTreeOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rename this tag">
            <IconButton size="small" onClick={() => setRenamePrefill({ tag: params.row.tag, nonce: Date.now() })}>
              <DriveFileRenameOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete this tag globally">
            <IconButton size="small" onClick={() => startOp('delete', params.row.tag)} color="error">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];
}
