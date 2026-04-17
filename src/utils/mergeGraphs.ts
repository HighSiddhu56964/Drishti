/**
 * Graph Merger
 * 
 * Merges two knowledge graphs with strict deduplication:
 * - Nodes are deduplicated by ID (last-write-wins)
 * - Edges are deduplicated by source→target→relationship
 * - Only edges referencing valid nodes are kept
 * - All IDs are lowercased and trimmed
 */

import type { KnowledgeGraph, GraphNode, GraphEdge } from "../types/graph.js";

export function mergeGraphs(
  oldGraph: KnowledgeGraph,
  newGraph: KnowledgeGraph
): KnowledgeGraph {
  const nodeMap = new Map<string, GraphNode>();

  // Add old nodes first, then new nodes (new overwrites if same ID)
  [...oldGraph.nodes, ...newGraph.nodes].forEach((node) => {
    const id = node.id?.toLowerCase().trim();
    if (!id) return;
    nodeMap.set(id, { ...node, id });
  });

  const validNodeIds = new Set(nodeMap.keys());

  // Merge edges with deduplication
  const seenEdges = new Set<string>();
  const edges: GraphEdge[] = [];

  [...oldGraph.edges, ...newGraph.edges].forEach((edge) => {
    const source = edge.source?.toLowerCase().trim();
    const target = edge.target?.toLowerCase().trim();

    if (!source || !target) return;
    if (!validNodeIds.has(source) || !validNodeIds.has(target)) return;
    if (source === target) return;

    const edgeKey = `${source}→${target}→${(edge.relationship || "").toLowerCase()}`;
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
    `[Merger] Combined: ${nodeMap.size} nodes, ${edges.length} edges`
  );

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}
