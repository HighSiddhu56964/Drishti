/**
 * Normalization utilities for entity names and graph deduplication.
 */

import type { KnowledgeGraph, GraphNode, GraphEdge } from "../types/graph.js";

/**
 * Normalize a human-readable name into a stable, lowercase ID.
 *  "Strait of Hormuz" → "strait_of_hormuz"
 */
export function normalizeId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")   // strip special chars
    .replace(/[\s-]+/g, "_")          // spaces / hyphens → underscores
    .replace(/_+/g, "_")              // collapse consecutive underscores
    .replace(/^_|_$/g, "");           // trim leading/trailing underscores
}

/**
 * Remove duplicate nodes (same normalised id) and remap edges.
 */
export function deduplicateGraph(graph: KnowledgeGraph): KnowledgeGraph {
  const nodeMap = new Map<string, GraphNode>();
  const idRemap = new Map<string, string>(); // old id → canonical id

  for (const node of graph.nodes) {
    const canonical = normalizeId(node.label);

    if (nodeMap.has(canonical)) {
      // Keep existing node, just remap this id
      idRemap.set(node.id, canonical);
    } else {
      // Ensure the node itself uses the canonical id
      const normalized: GraphNode = {
        ...node,
        id: canonical,
      };
      nodeMap.set(canonical, normalized);
      idRemap.set(node.id, canonical);
    }
  }

  // Remap edges and remove self-loops / duplicates
  const seenEdges = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const edge of graph.edges) {
    const source = idRemap.get(edge.source) ?? normalizeId(edge.source);
    const target = idRemap.get(edge.target) ?? normalizeId(edge.target);

    if (source === target) continue; // skip self-loops

    const edgeKey = `${source}→${target}→${edge.relationship}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);

    // Only keep edges whose endpoints exist
    if (!nodeMap.has(source) || !nodeMap.has(target)) continue;

    edges.push({
      ...edge,
      source,
      target,
      weight: Math.max(0, Math.min(1, edge.weight)), // clamp weight
    });
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}
