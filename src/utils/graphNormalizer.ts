/**
 * Graph Normalizer
 * 
 * Ensures all graph data has consistent, valid structure:
 * - All node IDs are lowercase and trimmed
 * - Nodes without IDs are removed
 * - Duplicate nodes are merged (last-write-wins)
 * - Missing fields get safe defaults
 * - Edges pointing to non-existent nodes are removed
 * - Edge fields are normalized
 */

import type { KnowledgeGraph, GraphNode, GraphEdge } from "../types/graph.js";

export function normalizeGraph(graph: KnowledgeGraph): KnowledgeGraph {
  const nodeMap = new Map<string, GraphNode>();

  // ─── Pass 1: Normalize and deduplicate nodes ─────────────────────────
  graph.nodes.forEach((node) => {
    const id = node.id?.toLowerCase().trim();
    if (!id) return; // Skip nodes without valid IDs

    nodeMap.set(id, {
      id,
      label: node.label || id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      type: (node.type || "unknown").toLowerCase().trim(),
      properties: {
        ...node.properties,
        description: node.properties?.description || `Information about ${node.label || id}`,
        category: node.properties?.category || "general",
      },
    });
  });

  const validNodeIds = new Set(nodeMap.keys());

  // ─── Pass 2: Normalize edges and remove broken references ───────────
  const seenEdges = new Set<string>();
  const edges: GraphEdge[] = [];

  graph.edges.forEach((edge) => {
    const source = edge.source?.toLowerCase().trim();
    const target = edge.target?.toLowerCase().trim();

    // Skip edges with missing/empty endpoints
    if (!source || !target) return;

    // Skip edges referencing non-existent nodes
    if (!validNodeIds.has(source) || !validNodeIds.has(target)) return;

    // Skip self-loops
    if (source === target) return;

    // Skip duplicate edges
    const edgeKey = `${source}→${target}→${(edge.relationship || "related_to").toLowerCase()}`;
    if (seenEdges.has(edgeKey)) return;
    seenEdges.add(edgeKey);

    edges.push({
      source,
      target,
      relationship: edge.relationship || "RELATED_TO",
      weight: Math.max(0, Math.min(1, edge.weight ?? 0.5)),
      description: edge.description || "",
    });
  });

  console.log(
    `[Normalizer] ${graph.nodes.length} → ${nodeMap.size} nodes, ` +
    `${graph.edges.length} → ${edges.length} edges ` +
    `(removed ${graph.nodes.length - nodeMap.size} bad nodes, ` +
    `${graph.edges.length - edges.length} bad edges)`
  );

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}
