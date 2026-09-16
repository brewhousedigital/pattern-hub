import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import type { TypeTagHierarchyRecord, TypeTagV2Record, TypeImpliedTagRecord, TypeTagAliasRecord } from '@/functions/database/tags';
import type { OperationType } from '@/functions/database/tags-admin/satellite-sync';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

interface BuildTagColumnsOptions {
  hierarchy: TypeTagHierarchyRecord[];
  tagsV2ById: Map<string, TypeTagV2Record>;
  /** This row's own alias record, if its name is itself registered as an alias of another, root tag. */
  aliasByOwnName: Map<string, TypeTagAliasRecord>;
  /** Aliases whose target is this row's name - other strings that resolve here. */
  aliasesByTarget: Map<string, TypeTagAliasRecord[]>;
  /** implied_tags edges this row's name triggers (the "tag" side). */
  impliesByTag: Map<string, TypeImpliedTagRecord[]>;
  /** implied_tags edges this row's name is the target of (the "implies_tag" side). */
  impliedByTag: Map<string, TypeImpliedTagRecord[]>;
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
  aliasByOwnName,
  aliasesByTarget,
  impliesByTag,
  impliedByTag,
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
      renderCell: (params) => {
        const chip = (
          <Chip
            label={params.value}
            size="small"
            variant={params.row.count <= 1 ? 'outlined' : 'filled'}
            color={params.row.count === 0 ? 'info' : params.row.count === 1 ? 'warning' : 'default'}
            sx={{ fontFamily: 'monospace' }}
          />
        );
        // A 0-count tag (created standalone via Add Tag, never yet put on a
        // pattern) needs its own look distinct from a singleton - it's not
        // a cleanup candidate the way a used-once tag might be, it just
        // hasn't been assigned yet. The tooltip is the only place that
        // distinction is spelled out, since the chip's color alone doesn't
        // explain itself.
        return params.row.count === 0 ? (
          <Tooltip title="Not used on any pattern yet">{chip}</Tooltip>
        ) : (
          chip
        );
      },
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
      field: 'linked_author',
      headerName: 'Author',
      width: 70,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const tagV2 = tagsV2ById.get(params.row.id);
        const typeInfo = tagV2?.expand?.type;
        const linkedUser = tagV2?.expand?.linked_user;
        // Only an Author-typed tag can carry a linked_user at all - see
        // TypeTagV2Record.linked_user's own doc comment - and an
        // Author-typed tag with no account yet (a manual-only credit) has
        // nothing to link to, so there's nothing to render either way.
        if (typeInfo?.name.toLowerCase() !== 'author' || !linkedUser) return null;
        return (
          <Tooltip title={linkedUser.name}>
            <IconButton
              size="small"
              component="a"
              href={`/profile/${linkedUser.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <AccountCircleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      },
    },
    {
      field: 'relations',
      headerName: 'Relations',
      width: 90,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const aliasOf = aliasByOwnName.get(params.row.tag);
        const aliasTargets = aliasesByTarget.get(params.row.tag) ?? [];
        const implies = impliesByTag.get(params.row.tag) ?? [];
        const impliedBy = impliedByTag.get(params.row.tag) ?? [];
        const hasAliasEdge = !!aliasOf || aliasTargets.length > 0;
        const hasImpliedEdge = implies.length > 0 || impliedBy.length > 0;

        // No badge is the common case - a "true" tag with no alias or
        // implied-tag relationships at all - the same "blank means nothing
        // special" convention the Type column above uses for a plain
        // General tag, rather than a redundant badge on every other row.
        if (!hasAliasEdge && !hasImpliedEdge) return null;

        const aliasTooltip = [
          aliasOf && `Alias of "${aliasOf.target_tag}" - resolves there instead of here`,
          aliasTargets.length > 0 &&
            `Target of ${aliasTargets.length} alias${aliasTargets.length === 1 ? '' : 'es'}: ${aliasTargets.map((a) => a.alias).join(', ')}`,
        ]
          .filter(Boolean)
          .join(' · ');

        const impliedTooltip = [
          implies.length > 0 && `Implies: ${implies.map((e) => e.implies_tag).join(', ')}`,
          impliedBy.length > 0 && `Implied by: ${impliedBy.map((e) => e.tag).join(', ')}`,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
            {hasAliasEdge && (
              <Tooltip title={aliasTooltip}>
                {/* secondary (this row itself redirects elsewhere) vs. action
                    grey (this row is only a target other aliases point at) -
                    the first is the one that actually changes how this row
                    behaves, so it gets the louder color. */}
                <SwapHorizIcon fontSize="small" color={aliasOf ? 'secondary' : 'action'} />
              </Tooltip>
            )}
            {hasImpliedEdge && (
              <Tooltip title={impliedTooltip}>
                {/* primary (this row implies others - tagging a pattern with
                    it silently pulls in more tags) vs. action grey (this row
                    is only implied by others, which doesn't change what
                    tagging it here does). */}
                <DeviceHubIcon fontSize="small" color={implies.length > 0 ? 'primary' : 'action'} />
              </Tooltip>
            )}
          </Box>
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
