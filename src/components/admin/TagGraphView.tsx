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
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
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
// off it. A third `tagViewMode` option on
// the admin tags page, alongside the existing 'list'/'tree' - not a
// replacement for either. All data (tags_v2/implied_tags/tag_aliases) is
// already fetched by that page for its existing dialogs, so this component
// takes it as props and runs no query of its own.

// Negative strength on forceManyBody means mutual repulsion between every
// pair of nodes, not just connected ones - this is what pushes unrelated
// tags apart into visibly separate clusters instead of a single tangle.
// The LINK_DISTANCE values are the resting length forceLink then pulls a
// connected pair back toward; the COLLIDE radii are the minimum gap
// forceCollide keeps between any two settled nodes so labels don't
// overlap. See layoutWithForceSimulation.
const CHARGE_STRENGTH = -260;
const LINK_DISTANCE_IMPLIES = 130;
const LINK_DISTANCE_ALIAS = 55;
const TAG_COLLIDE_RADIUS = 60;
const ALIAS_COLLIDE_RADIUS = 34;
const SIMULATION_TICKS = 300;

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

// The force simulation (see layoutWithForceSimulation below) can place a
// connected node in any direction, not just to the right, so a single
// fixed target/source pair per node - enough for the old left-to-right
// column layout - would force edges to detour around the node to reach a
// fixed side. Every node instead gets one target and one source handle on
// each side, and TagGraphView picks whichever pair actually faces the
// other end of a given edge (see compassSide).
const COMPASS: { id: 'top' | 'right' | 'bottom' | 'left'; position: Position }[] = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
];

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
      {COMPASS.map(({ id, position }) => (
        <Handle key={`t-${id}`} type="target" position={position} id={`${id}-target`} style={{ opacity: 0 }} />
      ))}
      {data.label}
      {COMPASS.map(({ id, position }) => (
        <Handle key={`s-${id}`} type="source" position={position} id={`${id}-source`} style={{ opacity: 0 }} />
      ))}
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
      {COMPASS.map(({ id, position }) => (
        <Handle key={`t-${id}`} type="target" position={position} id={`${id}-target`} style={{ opacity: 0 }} />
      ))}
      {data.label}
    </Box>
  );
}

const nodeTypes: NodeTypes = { tagNode: TagNodeComponent, aliasNode: AliasNodeComponent };

// ─── Force-directed layout ──────────────────────────────────────────────────

interface SimNode extends SimulationNodeDatum {
  id: string;
  kind: 'tag' | 'alias';
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  kind: 'implies' | 'alias';
}

/**
 * Positions every node with a physics simulation instead of an explicit
 * layout algorithm: forceManyBody repels every node from every other node
 * (not just connected ones), forceLink pulls each edge's two ends back
 * together, and forceCollide keeps settled nodes from overlapping once
 * they get close. Tags and aliases with no implies/alias path between them
 * have nothing pulling them together, so they drift apart on their own -
 * that's what turns "what's connected vs. not" into visibly separate
 * clusters, without this component ever having to compute connected
 * components or a layout for each one itself.
 *
 * Runs synchronously for a fixed number of ticks instead of animating -
 * this is a one-shot layout for a read-only graph, not a live physics
 * view. 300 is d3-force's own default number of ticks before a
 * simulation's alpha decays to alphaMin, i.e. before it would consider
 * itself settled.
 */
function layoutWithForceSimulation(
  nodeDefs: { id: string; kind: 'tag' | 'alias' }[],
  linkDefs: { source: string; target: string; kind: 'implies' | 'alias' }[],
): Map<string, { x: number; y: number }> {
  const nodes: SimNode[] = nodeDefs.map(({ id, kind }) => ({ id, kind }));
  const links: SimLink[] = linkDefs.map(({ source, target, kind }) => ({ source, target, kind }));

  const simulation = forceSimulation(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance((l) => (l.kind === 'alias' ? LINK_DISTANCE_ALIAS : LINK_DISTANCE_IMPLIES)),
    )
    .force('charge', forceManyBody<SimNode>().strength(CHARGE_STRENGTH))
    .force(
      'collide',
      forceCollide<SimNode>((d) => (d.kind === 'alias' ? ALIAS_COLLIDE_RADIUS : TAG_COLLIDE_RADIUS)),
    )
    .force('center', forceCenter<SimNode>(0, 0))
    .stop();

  for (let i = 0; i < SIMULATION_TICKS; i++) simulation.tick();

  return new Map(nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
}

// ─── Edge routing ────────────────────────────────────────────────────────────

/** Which of a node's four compass handles (see COMPASS) faces a point offset by (dx, dy) from it. */
function compassSide(dx: number, dy: number): 'top' | 'right' | 'bottom' | 'left' {
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
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
    // happen (every existing row was backfilled, and every write path
    // populates it going forward), but resolving by name rather than
    // silently dropping the edge keeps this graph honest if that's ever
    // wrong. Prefers a General-type row when a name is ambiguous, matching
    // every other name-resolution path in this codebase.
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

    const relevantIdList = [...relevantIds];

    // 2. Group aliases by the tag they target - same gating as rule 1 above,
    // an alias only gets a ghost node when its target tag is itself already
    // in the graph.
    const aliasLabelById = new Map<string, string>();
    const aliasEdges: { ghostId: string; targetId: string }[] = [];
    for (const a of aliases) {
      const targetId = resolveId(a.target_tag_ref, a.target_tag);
      if (!targetId || !relevantIds.has(targetId)) continue;
      const ghostId = `alias:${a.id}`;
      aliasLabelById.set(ghostId, a.alias);
      aliasEdges.push({ ghostId, targetId });
    }

    // 3. Let a physics simulation position everything (see
    // layoutWithForceSimulation) instead of computing an explicit layout -
    // tags and aliases with no implies/alias path between them drift apart
    // once nothing pulls them together, which is what makes "what's
    // connected vs. not" visually obvious.
    const finalPos = layoutWithForceSimulation(
      [
        ...relevantIdList.map((id) => ({ id, kind: 'tag' as const })),
        ...[...aliasLabelById.keys()].map((id) => ({ id, kind: 'alias' as const })),
      ],
      [
        ...impliesEdgeIds.map(({ source, target }) => ({ source, target, kind: 'implies' as const })),
        ...aliasEdges.map(({ ghostId, targetId }) => ({ source: targetId, target: ghostId, kind: 'alias' as const })),
      ],
    );

    // 4. Build the React Flow nodes from those positions.
    const nodes: GraphNode[] = [];
    const usedTypeIds = new Set<string>();
    for (const [id, position] of finalPos) {
      const aliasLabel = aliasLabelById.get(id);
      if (aliasLabel !== undefined) {
        nodes.push({ id, type: 'aliasNode', position, data: { label: aliasLabel }, draggable: true });
        continue;
      }
      const row = tagsById.get(id);
      if (!row) continue;
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
    }

    // 5. Edges. Each one picks whichever compass handle (see COMPASS and
    // compassSide) actually faces the other end, since the simulation can
    // put a connected node in any direction from another.
    const edges: Edge[] = [
      ...impliesEdgeIds.map(({ source, target }, i) => {
        const sp = finalPos.get(source);
        const tp = finalPos.get(target);
        const dx = sp && tp ? tp.x - sp.x : 1;
        const dy = sp && tp ? tp.y - sp.y : 0;
        return {
          id: `implies-${i}-${source}-${target}`,
          source,
          target,
          sourceHandle: `${compassSide(dx, dy)}-source`,
          targetHandle: `${compassSide(-dx, -dy)}-target`,
          type: 'straight',
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: theme.palette.text.secondary },
        };
      }),
      ...aliasEdges.map(({ ghostId, targetId }) => {
        const sp = finalPos.get(targetId);
        const tp = finalPos.get(ghostId);
        const dx = sp && tp ? tp.x - sp.x : 0;
        const dy = sp && tp ? tp.y - sp.y : 1;
        return {
          id: `alias-${ghostId}`,
          source: targetId,
          sourceHandle: `${compassSide(dx, dy)}-source`,
          target: ghostId,
          targetHandle: `${compassSide(-dx, -dy)}-target`,
          type: 'straight',
          style: { stroke: theme.palette.divider, strokeDasharray: '4 3' },
        };
      }),
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
