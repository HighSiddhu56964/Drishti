// ─── Entity Types (extensible) ───────────────────────────────────────────────
export type EntityType =
  | "country"
  | "organization"
  | "company"
  | "person"
  | "event"
  | "resource"
  | "economic_factor"
  | "location"
  | "infrastructure"
  | (string & {}); // allows any string while keeping autocomplete

// ─── Relationship Types (extensible) ─────────────────────────────────────────
export type RelationshipType =
  | "conflict"
  | "alliance"
  | "trade"
  | "sanctions"
  | "impacts"
  | "controls"
  | "depends_on"
  | "exports_to"
  | "imports_from"
  | "influences"
  | "located_in"
  | "supports"
  | "opposes"
  | (string & {});

// ─── Categories ──────────────────────────────────────────────────────────────
export type Category =
  | "geopolitics"
  | "trade"
  | "economy"
  | "organization"
  | "event"
  | "resource"
  | "infrastructure"
  | "military"
  | "technology"
  | (string & {});

// ─── Graph Node ──────────────────────────────────────────────────────────────
export interface GraphNode {
  id: string;
  label: string;
  type: EntityType;
  properties: {
    description: string;
    category: Category;
    [key: string]: unknown; // future-proof extensibility
  };
}

// ─── Graph Edge ──────────────────────────────────────────────────────────────
export interface GraphEdge {
  source: string;
  target: string;
  relationship: RelationshipType;
  weight: number; // 0.0 – 1.0
  description: string;
}

// ─── Knowledge Graph ─────────────────────────────────────────────────────────
export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
