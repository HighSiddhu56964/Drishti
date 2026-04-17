/* Shared types and helpers for the Palantir KG React app */

export interface NodeData {
  id: string;
  label: string;
  type: string;
  properties: { description: string; category: string; importance?: number; [k: string]: unknown };
  x?: number;
  y?: number;
}

export interface EdgeData {
  source: string;
  target: string;
  relationship: string;
  weight: number;
  description: string;
}

export interface GraphPayload {
  nodes: NodeData[];
  edges: EdgeData[];
  meta?: { dataSource: string; articleCount?: number };
}

export interface WikiInfo {
  summary?: string;
  extract?: string;
  description?: string;
  thumbnail?: string;
  url?: string;
  coordinates?: { lat: number; lng: number };
}

export const TYPE_COLORS: Record<string, string> = {
  country: "#00e5ff",
  organization: "#69ff47",
  event: "#ef4444",
  resource: "#ffd740",
  person: "#b388ff",
  company: "#f97316",
  concept: "#40c4ff",
  economic_factor: "#2dd4bf",
  location: "#ea80fc",
  infrastructure: "#ff80ab",
  leader: "#b388ff",
};
export const DEFAULT_COLOR = "#00e5ff";

export function getColor(type?: string): string {
  if (!type) return DEFAULT_COLOR;
  return TYPE_COLORS[type.toLowerCase()] || DEFAULT_COLOR;
}

export function sanitizeGraphData(data: GraphPayload): GraphPayload {
  const nodeMap = new Map<string, NodeData>();

  (data.nodes || []).forEach((n) => {
    const id = (n.id || "").toLowerCase().trim();
    if (!id) return; // Remove nodes without ID

    nodeMap.set(id, {
      id,
      label: n.label || id.replace(/_/g, " "),
      type: (n.type || "entity").toLowerCase().trim(),
      properties: {
        ...(n.properties || {}),
        description: n.properties?.description || "Intelligence entity — inferred from context.",
        category: n.properties?.category || "general",
      },
    });
  });

  const validNodeIds = new Set(nodeMap.keys());

  // Deduplicate edges and remove broken references
  const seenEdges = new Set<string>();
  const edges = (data.edges || []).filter((e) => {
    const src = (e.source || "").toLowerCase().trim();
    const tgt = (e.target || "").toLowerCase().trim();
    if (!src || !tgt) return false;
    if (!validNodeIds.has(src) || !validNodeIds.has(tgt)) return false;
    if (src === tgt) return false;
    const key = `${src}→${tgt}→${(e.relationship || "").toLowerCase()}`;
    if (seenEdges.has(key)) return false;
    seenEdges.add(key);
    return true;
  }).map((e) => ({
    ...e,
    source: (e.source || "").toLowerCase().trim(),
    target: (e.target || "").toLowerCase().trim(),
    relationship: e.relationship || "RELATED_TO",
    weight: e.weight ?? 0.5,
    description: e.description || "",
  }));

  const nodes = Array.from(nodeMap.values());

  console.log(
    `[Sanitize] ${data.nodes?.length ?? 0} → ${nodes.length} nodes, ` +
    `${data.edges?.length ?? 0} → ${edges.length} edges`
  );

  return { nodes, edges, meta: data.meta };
}

/* ── AI-generated node intelligence ─── */
export interface NodeDetails {
  fullDescription: string;
  globalImpact: {
    economy: string;
    geopolitics: string;
    trade: string;
  };
  timeline: { year: string; event: string }[];
  insights: string[];
}

/* ── Merge expansion graph into existing graph (strict dedup) ─── */
export function mergeGraphData(existing: GraphPayload, incoming: GraphPayload): GraphPayload {
  const nodeMap = new Map<string, NodeData>();

  // Add existing nodes first, then incoming (incoming overwrites if same ID)
  [...existing.nodes, ...incoming.nodes].forEach((n) => {
    const id = (n.id || "").toLowerCase().trim();
    if (!id) return;
    nodeMap.set(id, { ...n, id });
  });

  const validNodeIds = new Set(nodeMap.keys());

  // Merge edges with deduplication
  const seenEdges = new Set<string>();
  const edges: EdgeData[] = [];

  [...existing.edges, ...incoming.edges].forEach((e) => {
    const src = (e.source || "").toLowerCase().trim();
    const tgt = (e.target || "").toLowerCase().trim();
    if (!src || !tgt) return;
    if (!validNodeIds.has(src) || !validNodeIds.has(tgt)) return;
    if (src === tgt) return;
    const key = `${src}→${tgt}→${(e.relationship || "").toLowerCase()}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    edges.push({ ...e, source: src, target: tgt });
  });

  const nodes = Array.from(nodeMap.values());

  console.log(
    `[Merge] ${existing.nodes.length} + ${incoming.nodes.length} → ${nodes.length} nodes, ` +
    `${existing.edges.length} + ${incoming.edges.length} → ${edges.length} edges`
  );

  return { nodes, edges, meta: existing.meta };
}
