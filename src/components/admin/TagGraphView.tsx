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
// off it. A third `tagViewMode` option on
// the admin tags page, alongside the existing 'list'/'tree' - not a
// replacement for either. All data (tags_v2/implied_tags/tag_aliases) is
// already fetched by that page for its existing dialogs, so this component
// takes it as props and runs no query of its own.

// A component's implication roots (computeLayers depth 0) sit on this
// radius; each further depth adds another RING_SPACING beyond it. A ring
// grows past that when it holds enough nodes that MIN_ARC_PER_NODE would
// otherwise pack them tighter than this - see layoutComponentRadially.
const BASE_RADIUS = 64;
const RING_SPACING = 110;
const MIN_ARC_PER_NODE = 92;
// How far an alias ghost sits beyond its own tag, and the angle between
// neighbouring aliases of the same tag so they fan out instead of stacking
// on top of each other.
const SATELLITE_OFFSET = 50;
const SATELLITE_FAN = 0.4;
// Clear space kept between two separate components once they're packed
// onto the shared canvas - see packComponents.
const COMPONENT_GAP = 48;

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

// The radial layout (see layoutComponentRadially below) can place a
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

// ─── Connected components ───────────────────────────────────────────────────

/**
 * Union-find over every edge (implies and alias alike) so that tags with no
 * path between them end up in separate groups. This is the core of the
 * bubble layout: instead of every tag sharing one set of global columns -
 * where hundreds of unrelated edges all cross through the same layers -
 * each group of actually-related tags becomes its own small cluster,
 * positioned and packed independently (see layoutComponentRadially and
 * packComponents below), so a glance at the graph shows what's connected
 * and what's off in its own island.
 */
function findComponents(nodeIds: string[], edges: { source: string; target: string }[]): Map<string, string[]> {
  const parent = new Map<string, string>(nodeIds.map((id) => [id, id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = id;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };

  for (const { source, target } of edges) {
    if (!parent.has(source) || !parent.has(target)) continue;
    const ra = find(source);
    const rb = find(target);
    if (ra !== rb) parent.set(ra, rb);
  }

  const groups = new Map<string, string[]>();
  for (const id of nodeIds) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(id);
  }
  return groups;
}

// ─── Radial layout ──────────────────────────────────────────────────────────

/** Mean of a set of angles (radians) - the ordinary mean breaks down near
 * the -pi/pi wraparound, so this averages each angle's unit vector instead. */
function circularMean(angles: number[]): number {
  const sin = angles.reduce((s, a) => s + Math.sin(a), 0);
  const cos = angles.reduce((s, a) => s + Math.cos(a), 0);
  return Math.atan2(sin, cos);
}

type LocalLayout = {
  /** Positions relative to this component's own centre, i.e. before packComponents offsets it onto the shared canvas. */
  positions: Map<string, { x: number; y: number }>;
  /** Bounding radius around that centre, used to pack this component against its neighbours without overlap. */
  radius: number;
};

/**
 * Arranges one connected component as a small radial tree: implication
 * roots (computeLayers depth 0 - see that function's own doc comment) sit
 * at the centre, and each further depth gets its own ring further out.
 *
 * A node's angle is the circular mean of its own parents' angles, then
 * every ring is re-spread to evenly fill the full circle in that
 * mean-angle order. That second pass is what keeps a ring from either
 * bunching into a narrow wedge (if nodes just inherited their parent's
 * exact angle) or losing the grouping entirely (if angle were assigned
 * without regard to parents) - it's the standard "barycenter" heuristic
 * layered-graph drawing uses to cut down on crossings, adapted from a
 * straight axis to a ring. Siblings that share a parent land next to each
 * other, which is what the old layout's plain alphabetical order within a
 * column didn't give it.
 */
function layoutComponentRadially(
  tagIds: string[],
  impliesEdges: { source: string; target: string }[],
  aliasesByTarget: Map<string, string[]>,
): LocalLayout {
  const positions = new Map<string, { x: number; y: number }>();

  if (tagIds.length === 1) {
    positions.set(tagIds[0], { x: 0, y: 0 });
  } else {
    const layer = computeLayers(tagIds, impliesEdges);
    const parentsOf = new Map<string, string[]>(tagIds.map((id) => [id, []]));
    for (const e of impliesEdges) parentsOf.get(e.target)?.push(e.source);

    const byLayer = new Map<number, string[]>();
    for (const id of tagIds) {
      const l = layer.get(id) ?? 0;
      if (!byLayer.has(l)) byLayer.set(l, []);
      byLayer.get(l)!.push(id);
    }

    const angle = new Map<string, number>();
    const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
    for (const l of sortedLayers) {
      const ranked = byLayer
        .get(l)!
        .map((id) => {
          const parentAngles = (parentsOf.get(id) ?? [])
            .map((p) => angle.get(p))
            .filter((a): a is number => a !== undefined);
          return { id, mean: parentAngles.length > 0 ? circularMean(parentAngles) : undefined };
        })
        .sort((a, b) => {
          if (a.mean !== undefined && b.mean !== undefined) return a.mean - b.mean;
          if (a.mean !== undefined) return -1;
          if (b.mean !== undefined) return 1;
          return a.id.localeCompare(b.id);
        });
      ranked.forEach(({ id }, i) => angle.set(id, ((i + 0.5) / ranked.length) * Math.PI * 2));
    }

    for (const l of sortedLayers) {
      const ids = byLayer.get(l)!;
      const ringRadius = Math.max(BASE_RADIUS + l * RING_SPACING, (ids.length * MIN_ARC_PER_NODE) / (Math.PI * 2));
      for (const id of ids) {
        const a = angle.get(id)!;
        positions.set(id, { x: Math.cos(a) * ringRadius, y: Math.sin(a) * ringRadius });
      }
    }
  }

  // Alias ghosts aren't part of the implies rings above - they're small
  // satellites just beyond their own tag, fanned out by angle so two
  // aliases of the same tag don't land on top of each other.
  let boundingRadius = BASE_RADIUS;
  for (const { x, y } of positions.values()) boundingRadius = Math.max(boundingRadius, Math.hypot(x, y));
  for (const [targetId, ghostIds] of aliasesByTarget) {
    const base = positions.get(targetId);
    if (!base) continue;
    const baseAngle = Math.atan2(base.y, base.x);
    const baseDist = Math.hypot(base.x, base.y);
    ghostIds.forEach((ghostId, i) => {
      const a = baseAngle + (i - (ghostIds.length - 1) / 2) * SATELLITE_FAN;
      const r = baseDist + SATELLITE_OFFSET;
      positions.set(ghostId, { x: Math.cos(a) * r, y: Math.sin(a) * r });
      boundingRadius = Math.max(boundingRadius, r);
    });
  }

  return { positions, radius: boundingRadius };
}

// ─── Packing ─────────────────────────────────────────────────────────────────

/**
 * Places each component's local layout onto shared canvas coordinates
 * without overlapping any other component's bounding circle. Walks an
 * expanding Archimedean spiral out from the origin and takes the first
 * point that clears every circle placed so far - a standard, simple way to
 * pack circles when the goal is "no overlaps," not a minimal bounding area.
 * Callers get denser results by placing larger components first.
 */
function packComponents(components: { radius: number }[]): { x: number; y: number }[] {
  const placed: { x: number; y: number; radius: number }[] = [];

  return components.map((comp) => {
    if (placed.length === 0) {
      placed.push({ x: 0, y: 0, radius: comp.radius });
      return { x: 0, y: 0 };
    }
    const spiralGrowth = 8;
    let theta = 0;
    let x = 0;
    let y = 0;
    for (let i = 0; i < 20000; i++) {
      const r = spiralGrowth * theta;
      x = r * Math.cos(theta);
      y = r * Math.sin(theta);
      const clear = placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.radius + comp.radius + COMPONENT_GAP);
      if (clear) break;
      theta += 0.35;
    }
    placed.push({ x, y, radius: comp.radius });
    return { x, y };
  });
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
    const aliasesByTargetId = new Map<string, string[]>();
    for (const a of aliases) {
      const targetId = resolveId(a.target_tag_ref, a.target_tag);
      if (!targetId || !relevantIds.has(targetId)) continue;
      const ghostId = `alias:${a.id}`;
      aliasLabelById.set(ghostId, a.alias);
      aliasEdges.push({ ghostId, targetId });
      if (!aliasesByTargetId.has(targetId)) aliasesByTargetId.set(targetId, []);
      aliasesByTargetId.get(targetId)!.push(ghostId);
    }

    // 3. Split into connected components (see findComponents) - tags with
    // no implies/alias path between them lay out, and later get packed onto
    // the canvas, independently of each other instead of sharing one set of
    // columns.
    const allNodeIds = [...relevantIdList, ...aliasLabelById.keys()];
    const dsuEdges = [
      ...impliesEdgeIds,
      ...aliasEdges.map(({ ghostId, targetId }) => ({ source: ghostId, target: targetId })),
    ];
    const components = findComponents(allNodeIds, dsuEdges);

    // 4. Lay out each component on its own (see layoutComponentRadially),
    // then pack the components onto a shared canvas without overlapping
    // (see packComponents). Largest-first is the usual circle-packing
    // convention - it settles the few big clusters near the centre first
    // and lets the many small ones fill in the gaps around them.
    const laidOutComponents = [...components.values()].map((memberIds) => {
      const tagMemberIds = memberIds.filter((id) => !aliasLabelById.has(id));
      const memberSet = new Set(memberIds);
      const componentImpliesEdges = impliesEdgeIds.filter((e) => memberSet.has(e.source) && memberSet.has(e.target));
      const componentAliasesByTarget = new Map(
        tagMemberIds
          .map((id): [string, string[]] => [id, aliasesByTargetId.get(id) ?? []])
          .filter(([, ghosts]) => ghosts.length > 0),
      );
      return layoutComponentRadially(tagMemberIds, componentImpliesEdges, componentAliasesByTarget);
    });
    laidOutComponents.sort((a, b) => b.radius - a.radius);
    const offsets = packComponents(laidOutComponents);

    const finalPos = new Map<string, { x: number; y: number }>();
    laidOutComponents.forEach((comp, i) => {
      const offset = offsets[i];
      for (const [id, local] of comp.positions) {
        finalPos.set(id, { x: local.x + offset.x, y: local.y + offset.y });
      }
    });

    // 5. Build the React Flow nodes from those positions.
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

    // 6. Edges. Each one picks whichever compass handle (see COMPASS and
    // compassSide) actually faces the other end, since the radial layout
    // can put a connected node in any direction rather than always to the
    // right the way the old column layout could assume.
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
