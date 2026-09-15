import { useMemo, useState } from 'react';
import { Alert, Box, Chip, Collapse, IconButton, Tooltip, Typography } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import type { TypeTagStat, TypeTagHierarchyRecord } from '@/functions/database/tags';

interface TreeNodeProps {
  tagName: string;
  count: number;
  hierarchy: TypeTagHierarchyRecord[];
  allTagStats: Map<string, number>;
  depth?: number;
  onSetParent: (tagName: string) => void;
}

function TreeNode({ tagName, count, hierarchy, allTagStats, depth = 0, onSetParent }: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const children = hierarchy.filter((h) => h.parent_tag === tagName);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.5,
          px: 1,
          ml: depth * 3,
          borderRadius: 1,
          '&:hover': { backgroundColor: 'action.hover' },
        }}
      >
        {children.length > 0 ? (
          <IconButton size="small" onClick={() => setOpen((v) => !v)} sx={{ p: 0.25 }}>
            <AccountTreeIcon fontSize="small" color={open ? 'primary' : 'action'} />
          </IconButton>
        ) : (
          <Box sx={{ width: 28 }} />
        )}

        <Chip label={tagName} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />

        <Typography variant="caption" color="text.secondary">
          {count} pattern{count !== 1 ? 's' : ''}
        </Typography>

        {children.length > 0 && (
          <Typography variant="caption" color="text.disabled">
            · {children.length} child{children.length !== 1 ? 'ren' : ''}
          </Typography>
        )}

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Set parent tag">
          <IconButton size="small" onClick={() => onSetParent(tagName)}>
            <AccountTreeOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {children.length > 0 && (
        <Collapse in={open}>
          {children.map((child) => (
            <TreeNode
              key={child.tag}
              tagName={child.tag}
              count={allTagStats.get(child.tag) ?? 0}
              hierarchy={hierarchy}
              allTagStats={allTagStats}
              depth={depth + 1}
              onSetParent={onSetParent}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
}

export function TagTreeView({
  hierarchy,
  tagStats,
  onSetParent,
}: {
  hierarchy: TypeTagHierarchyRecord[];
  tagStats: TypeTagStat[];
  onSetParent: (tagName: string) => void;
}) {
  const childTagNames = new Set(hierarchy.map((h) => h.tag));
  const allTagStatsMap = useMemo(() => new Map(tagStats.map((t) => [t.tag, t.count])), [tagStats]);

  // Tags that appear in hierarchy as children but whose parent_tag exists in tag stats
  const roots = tagStats.filter((t) => !childTagNames.has(t.tag));

  // Orphaned: in hierarchy as a child but their parent_tag doesn't exist in tag stats
  const allTagNames = new Set(tagStats.map((t) => t.tag));
  const orphans = hierarchy.filter((h) => !allTagNames.has(h.parent_tag));

  if (hierarchy.length === 0) {
    return (
      <Alert severity="info">
        No parent/child relationships defined yet. Use "Set Parent" on any tag to start building the hierarchy.
      </Alert>
    );
  }

  return (
    <Box>
      {roots.map((root) => (
        <TreeNode
          key={root.tag}
          tagName={root.tag}
          count={root.count}
          hierarchy={hierarchy}
          allTagStats={allTagStatsMap}
          depth={0}
          onSetParent={onSetParent}
        />
      ))}

      {orphans.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600, px: 1, display: 'block', mb: 0.5 }}>
            Orphaned - parent tag no longer exists
          </Typography>
          {orphans.map((h) => (
            <TreeNode
              key={h.tag}
              tagName={h.tag}
              count={allTagStatsMap.get(h.tag) ?? 0}
              hierarchy={hierarchy}
              allTagStats={allTagStatsMap}
              depth={0}
              onSetParent={onSetParent}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
