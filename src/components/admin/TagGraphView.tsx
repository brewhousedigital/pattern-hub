import { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import type {
  TypeTagV2Record,
  TypeTagTypeRecord,
  TypeImpliedTagRecord,
  TypeTagAliasRecord,
} from '@/functions/database/tags';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

// ─── Tag graph visualization ────────────────────────────────────────────────
//
// Read-only visualization of the implied-tag graph, plus the aliases hanging
// off it - scoped alongside Phase R3 of the Tag Relational Refactor, built
// once the developer asked for it (see TAG_RELATIONAL_REFACTOR_NOTES.md,
// "Related, separate work: tag graph visualization" for the original scope,
// and the phase entry recording this file). A third `tagViewMode` option on
// the admin tags page, alongside the existing 'list'/'tree' - not a
// replacement for either. All data (tags_v2/implied_tags/tag_aliases) is
// already fetched by that page for its existing dialogs, so this component
// takes it as props and runs no query of its own.

const LAYER_WIDTH = 240;
const ROW_HEIGHT = 64;
// A graph layer (implication depth - see computeLayers) with more ids than
// this splits into multiple side-by-side columns instead of one column
// stacking all of them - see the Position step below.
const MAX_TAGS_PER_COLUMN = 50;

// ─── Node types ─────────────────────────────────────────────────────────────

type TagNodeData = {
  label: string;
  color: string | null;
  onOpen: () => void;
};
type TagFlowNode = Node<TagNodeData, 'tagNode'>;

type AliasNodeData = {
  label: string;
};
type AliasFlowNode = Node<AliasNodeData, 'aliasNode'>;

type GraphNode = TagFlowNode | AliasFlowNode;

// Plain MUI-styled boxes rather than a design-system component of their own
// - this graph is the only place a "tag chip as a graph node" needs to
// exist, so a one-off styled Box here costs less than a shared component
// only one caller would ever use. Handles are invisible (opacity 0) - real
// connection points React Flow needs to route edges to/from, not meant to
// be seen or dragged from by an admin on a read-only graph.

function TagNodeComponent({ data }: NodeProps<TagFlowNode>) {
  const theme = useTheme();
  const color = data.color ?? theme.palette.text.disabled;
  return (
    <Box
      onClick={data.onOpen}
      title="Manage implied tags"
      sx={{
        px: 1.5,
        py: 0.75,
        borderRadius: 2,
        border: '2px solid',
        borderColor: color,
        backgroundColor: data.color ? alpha(data.color, 0.14) : theme.palette.action.hover,
        fontSize: '0.8rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        boxShadow: 1,
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: 4 },
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {data.label}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      {/* Dedicated handle for an outgoing alias edge, separate from the
          left/right pair above - an alias's ghost node shares this tag's own
          column (see the layout comment on TagGraphView), so routing that
          edge through the same left-to-right handles as an implies edge
          would have to loop back on itself to reach a node that isn't
          actually to the right. Top-to-bottom instead, matching the ghost
          node's own placement just below it in the same column. */}
      <Handle type="source" position={Position.Bottom} id="alias" style={{ opacity: 0 }} />
    </Box>
  );
}

function AliasNodeComponent({ data }: NodeProps<AliasFlowNode>) {
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.5,
        borderRadius: 2,
        border: '1.5px dashed',
        borderColor: 'divider',
        fontSize: '0.7rem',
        fontStyle: 'italic',
        color: 'text.secondary',
        whiteSpace: 'nowrap',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {data.label}
    </Box>
  );
}

const nodeTypes: NodeTypes = { tagNode: TagNodeComponent, aliasNode: AliasNodeComponent };

// ─── Layering ───────────────────────────────────────────────────────────────

/**
 * A node's layer is its longest path from a root - a tag nothing implies
 * (no incoming edge). The same kind of graph walk getImpliedTags/
 * getTagsImplying (src/functions/database/tags.ts) already do, measuring
 * depth instead of collecting a visited set. Memoized per id (`layer`) so a
 * node reachable via many paths is only resolved once; the `visiting` guard
 * stops an infinite loop if a cycle ever slipped into the data (the admin
 * implied-tag editor already guards against creating one on purpose, but a
 * hand-rolled layout should never hang even if that's ever wrong).
 */
function computeLayers(nodeIds: string[], impliesEdges: { source: string; target: string }[]): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const id of nodeIds) incoming.set(id, []);
  for (const edge of impliesEdges) {
    incoming.get(edge.target)?.push(edge.source);
  }

  const layer = new Map<string, number>();

  function resolve(id: string, visiting: Set<string>): number {
    const cached = layer.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = incoming.get(id) ?? [];
    const depth = parents.length === 0 ? 0 : Math.max(...parents.map((p) => resolve(p, visiting))) + 1;
    visiting.delete(id);
    layer.set(id, depth);
    return depth;
  }

  for (const id of nodeIds) resolve(id, new Set());
  return layer;
}

// ─── Component ──────────────────────────────────────────────────────────────

type TagGraphViewProps = {
  tagsV2: TypeTagV2Record[];
  impliedTags: TypeImpliedTagRecord[];
  aliases: TypeTagAliasRecord[];
  tagTypes: TypeTagTypeRecord[];
  /** Opens the existing ImpliedTagsDialog for the clicked tag - reuses the edit UI that already exists rather than building a second one inside the graph. */
  onNodeClick: (tag: TypeReadOnlyDatabaseItem) => void;
};

export const TagGraphView = ({ tagsV2, impliedTags, aliases, tagTypes, onNodeClick }: TagGraphViewProps) => {
  const theme = useTheme();

  const { initialNodes, initialEdges, usedTypes } = useMemo(() => {
    const tagsById = new Map(tagsV2.map((t) => [t.id, t]));

    // Fallback for an edge/alias somehow missing its ref field - shouldn't
    // happen (Phase R2 backfilled every existing row, and every write path
    // since Phase R1 populates it going forward), but resolving by name
    // rather than silently dropping the edge keeps this graph honest if
    // that's ever wrong. Prefers a General-type row when a name is
    // ambiguous, matching every other name-resolution path this refactor
    // settled on (see TAG_RELATIONAL_REFACTOR_NOTES.md, R3.5).
    const idByName = new Map<string, string>();
    for (const t of tagsV2) {
      const norm = t.tag.toLowerCase();
      const isGeneral = !t.expand?.type || t.expand.type.name.toLowerCase() === 'general';
      if (!idByName.has(norm) || isGeneral) idByName.set(norm, t.id);
    }
    const resolveId = (ref: string | undefined, name: string): string | undefined =>
      ref || idByName.get(name.toLowerCase());

    // 1. Only a tag that participates in at least one implied-tag edge, as
    // either side, gets a node - most tags have no implied-tag relationship
    // at all, and including every tag would make the graph unreadable
    // without showing anything a plain list doesn't already.
    const impliesEdgeIds: { source: string; target: string }[] = [];
    const relevantIds = new Set<string>();
    for (const edge of impliedTags) {
      const source = resolveId(edge.tag_ref, edge.tag);
      const target = resolveId(edge.implies_tag_ref, edge.implies_tag);
      if (!source || !target || source === target) continue;
      if (!tagsById.has(source) || !tagsById.has(target)) continue;
      impliesEdgeIds.push({ source, target });
      relevantIds.add(source);
      relevantIds.add(target);
    }

    // 2. Layer every relevant tag by its longest path from a root.
    const relevantIdList = [...relevantIds];
    const layer = computeLayers(relevantIdList, impliesEdgeIds);

    // 3. Group ids by layer, alphabetically within a layer - a stable,
    // predictable order instead of whatever order tags_v2 happened to load in.
    const byLayer = new Map<number, string[]>();
    const sortedRelevant = [...relevantIdList].sort((a, b) =>
      (tagsById.get(a)?.tag ?? '').localeCompare(tagsById.get(b)?.tag ?? ''),
    );
    for (const id of sortedRelevant) {
      const l = layer.get(id) ?? 0;
      if (!byLayer.has(l)) byLayer.set(l, []);
      byLayer.get(l)!.push(id);
    }

    // 4. An alias's ghost node joins its target's layer, appended after the
    // real tag nodes already placed there - only when the target is itself
    // already in the graph. An alias for a tag with no implied-tag edges of
    // its own would otherwise need pulling in an unrelated, edge-less tag
    // just to give the alias somewhere to point, contradicting rule 1 above.
    const aliasLabelById = new Map<string, string>();
    const aliasEdges: { ghostId: string; targetId: string }[] = [];
    for (const a of aliases) {
      const targetId = resolveId(a.target_tag_ref, a.target_tag);
      if (!targetId || !relevantIds.has(targetId)) continue;
      const ghostId = `alias:${a.id}`;
      const targetLayer = layer.get(targetId) ?? 0;
      if (!byLayer.has(targetLayer)) byLayer.set(targetLayer, []);
      byLayer.get(targetLayer)!.push(ghostId);
      aliasLabelById.set(ghostId, a.alias);
      aliasEdges.push({ ghostId, targetId });
    }

    // 5. Position. Each graph layer (implication depth) can need more than
    // one visual column - a layer with more than MAX_TAGS_PER_COLUMN ids
    // would otherwise stack every one of them into a single, impractically
    // tall column. Split into consecutive chunks of at most
    // MAX_TAGS_PER_COLUMN instead, one column per chunk, side by side within
    // the layer's own horizontal span.
    //
    // A layer's x-offset is cumulative, not a fixed multiple of LAYER_WIDTH,
    // so a layer that needed extra columns pushes every later layer further
    // right to make room, rather than a later layer's single column
    // overlapping an earlier layer's second or third one. Layers are still
    // visited in depth order (sortedLayerKeys), so this preserves the same
    // "arrows mostly point forward" property the original single-column
    // layout had.
    const sortedLayerKeys = [...byLayer.keys()].sort((a, b) => a - b);
    const layerStartX = new Map<number, number>();
    let cumulativeX = 0;
    for (const l of sortedLayerKeys) {
      layerStartX.set(l, cumulativeX);
      const columnsNeeded = Math.max(1, Math.ceil(byLayer.get(l)!.length / MAX_TAGS_PER_COLUMN));
      cumulativeX += columnsNeeded * LAYER_WIDTH;
    }

    const nodes: GraphNode[] = [];
    const usedTypeIds = new Set<string>();
    for (const l of sortedLayerKeys) {
      const ids = byLayer.get(l)!;
      const baseX = layerStartX.get(l)!;
      for (let chunkStart = 0; chunkStart < ids.length; chunkStart += MAX_TAGS_PER_COLUMN) {
        const chunk = ids.slice(chunkStart, chunkStart + MAX_TAGS_PER_COLUMN);
        // Each column of up to 100 is centered around the same y=0 midline
        // as every other column in this layer - a 30-tag leftover column
        // sits centered against a full 100-tag one next to it, rather than
        // computing its own, likely different, center.
        const x = baseX + (chunkStart / MAX_TAGS_PER_COLUMN) * LAYER_WIDTH;
        const startY = -((chunk.length - 1) * ROW_HEIGHT) / 2;
        chunk.forEach((id, index) => {
          const position = { x, y: startY + index * ROW_HEIGHT };
          const aliasLabel = aliasLabelById.get(id);
          if (aliasLabel !== undefined) {
            nodes.push({ id, type: 'aliasNode', position, data: { label: aliasLabel }, draggable: true });
            return;
          }
          const row = tagsById.get(id);
          if (!row) return;
          const type = row.expand?.type ?? null;
          const isGeneral = !type || type.name.toLowerCase() === 'general';
          if (type && !isGeneral) usedTypeIds.add(type.id);
          nodes.push({
            id,
            type: 'tagNode',
            position,
            data: {
              label: row.tag,
              color: type && !isGeneral ? type.color || null : null,
              onOpen: () => onNodeClick({ id: row.id, tag: row.tag, count: 0 }),
            },
            draggable: true,
          });
        });
      }
    }

    const edges: Edge[] = [
      ...impliesEdgeIds.map(({ source, target }, i) => ({
        id: `implies-${i}-${source}-${target}`,
        source,
        target,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: theme.palette.text.secondary },
      })),
      ...aliasEdges.map(({ ghostId, targetId }) => ({
        id: `alias-${ghostId}`,
        source: targetId,
        sourceHandle: 'alias',
        target: ghostId,
        style: { stroke: theme.palette.divider, strokeDasharray: '4 3' },
      })),
    ];

    return {
      initialNodes: nodes,
      initialEdges: edges,
      usedTypes: tagTypes.filter((t) => usedTypeIds.has(t.id)),
    };
  }, [tagsV2, impliedTags, aliases, tagTypes, onNodeClick, theme]);

  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  // initialNodes/initialEdges are freshly computed (new array identity)
  // whenever the underlying data changes - e.g. a save from ImpliedTagsDialog
  // refetching impliedTagsList. Re-seeding the draggable state here is what
  // makes the graph pick that up instead of showing a stale layout.
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (initialNodes.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No implied-tag relationships yet. Add one from a tag's "Manage implied tags" action in List view to see it
          here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 600 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
        <Panel position="top-right">
          <Box
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 1.25,
              boxShadow: 1,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
              Type
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {usedTypes.map((t) => (
                <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: t.color || 'text.disabled',
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="caption">{t.name}</Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'action.disabled', flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary">
                  General
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                <Box sx={{ width: 14, height: 0, borderTop: '1.5px dashed', borderColor: 'divider', flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary">
                  Alias
                </Typography>
              </Box>
            </Box>
          </Box>
        </Panel>
      </ReactFlow>
    </Box>
  );
};
