/**
 * Neo4j Persistent Graph Storage Service
 *
 * Manages the Neo4j driver lifecycle and provides functions to:
 *  - Save knowledge graphs (nodes + edges) using MERGE to avoid duplicates
 *  - Retrieve a snapshot of the stored graph
 *  - Gracefully close the driver on shutdown
 */

import neo4j, { type Driver, type Session } from "neo4j-driver";
import type { KnowledgeGraph, GraphNode, GraphEdge } from "../types/graph.js";

let driver: Driver | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sanitize a relationship type string into a valid Neo4j relationship type.
 * Must be uppercase, alphanumeric + underscores only.
 */
function sanitizeRelType(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "RELATED_TO";
}

// ─── Initialization ──────────────────────────────────────────────────────────

/**
 * Initialize the Neo4j driver and create constraints.
 * Logs a warning if the connection cannot be established — never throws.
 */
export async function initNeo4j(): Promise<void> {
  const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
  const user = process.env.NEO4J_USER || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "password";

  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

    // Verify connectivity
    await driver.verifyConnectivity();
    console.log(`[Neo4j] ✅ Connected to ${uri}`);

    // Ensure a uniqueness constraint on Entity.id
    const session = driver.session();
    try {
      await session.run(
        `CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
         FOR (n:Entity) REQUIRE n.id IS UNIQUE`
      );
      console.log("[Neo4j] ✅ Constraint entity_id_unique ensured");
    } finally {
      await session.close();
    }
  } catch (err) {
    console.warn(
      "[Neo4j] ⚠️  Could not connect — graph persistence disabled:",
      err instanceof Error ? err.message : err
    );
    driver = null;
  }
}

// ─── Save Graph ──────────────────────────────────────────────────────────────

/**
 * Persist a KnowledgeGraph to Neo4j.
 * Uses MERGE so duplicate entities are updated, not duplicated.
 * Errors are logged — this function never throws.
 */
export async function saveGraphToNeo4j(
  graph: KnowledgeGraph
): Promise<void> {
  if (!driver) {
    console.warn("[Neo4j] Driver not available — skipping save");
    return;
  }

  const session: Session = driver.session();

  try {
    // ── Nodes ─────────────────────────────────────────────────────────────
    for (const node of graph.nodes) {
      await session.run(
        `MERGE (n:Entity {id: $id})
         SET n.label       = $label,
             n.type        = $type,
             n.description = $description,
             n.category    = $category,
             n.updatedAt   = datetime()`,
        {
          id: node.id,
          label: node.label,
          type: node.type,
          description: node.properties.description,
          category: node.properties.category,
        }
      );
    }
    console.log(`[Neo4j] 📦 Merged ${graph.nodes.length} nodes`);

    // ── Edges ─────────────────────────────────────────────────────────────
    let edgeCount = 0;
    for (const edge of graph.edges) {
      const relType = sanitizeRelType(edge.relationship);

      // Dynamic relationship types require string interpolation in Cypher.
      // We sanitize the type above to prevent injection.
      await session.run(
        `MATCH (a:Entity {id: $source})
         MATCH (b:Entity {id: $target})
         MERGE (a)-[r:${relType}]->(b)
         SET r.weight      = $weight,
             r.description = $description,
             r.updatedAt   = datetime()`,
        {
          source: edge.source,
          target: edge.target,
          weight: edge.weight,
          description: edge.description,
        }
      );
      edgeCount++;
    }
    console.log(`[Neo4j] 🔗 Merged ${edgeCount} relationships`);
  } catch (err) {
    console.error(
      "[Neo4j] ❌ Error saving graph:",
      err instanceof Error ? err.message : err
    );
  } finally {
    await session.close();
  }
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

/**
 * Return a snapshot of the current Neo4j graph (top N nodes + relationships).
 * Useful for debugging and future UI rendering.
 */
export async function getGraphSnapshot(
  limit: number = 50
): Promise<KnowledgeGraph> {
  const empty: KnowledgeGraph = { nodes: [], edges: [] };

  if (!driver) {
    console.warn("[Neo4j] Driver not available — returning empty snapshot");
    return empty;
  }

  const session: Session = driver.session();

  try {
    // Fetch nodes
    const nodeResult = await session.run(
      `MATCH (n:Entity) RETURN n LIMIT $limit`,
      { limit: neo4j.int(limit) }
    );

    const nodeMap = new Map<string, GraphNode>();
    for (const record of nodeResult.records) {
      const n = record.get("n").properties;
      const node: GraphNode = {
        id: n.id,
        label: n.label || n.id,
        type: n.type || "unknown",
        properties: {
          description: n.description || "",
          category: n.category || "",
        },
      };
      nodeMap.set(node.id, node);
    }

    // Fetch relationships between those nodes
    const edgeResult = await session.run(
      `MATCH (a:Entity)-[r]->(b:Entity)
       WHERE a.id IN $ids AND b.id IN $ids
       RETURN a.id AS source, b.id AS target,
              type(r) AS relationship,
              r.weight AS weight,
              r.description AS description
       LIMIT $limit`,
      {
        ids: Array.from(nodeMap.keys()),
        limit: neo4j.int(limit),
      }
    );

    const edges: GraphEdge[] = edgeResult.records.map((record) => ({
      source: record.get("source"),
      target: record.get("target"),
      relationship: record.get("relationship").toLowerCase(),
      weight: typeof record.get("weight") === "number"
        ? record.get("weight")
        : 0.5,
      description: record.get("description") || "",
    }));

    console.log(
      `[Neo4j] 📸 Snapshot: ${nodeMap.size} nodes, ${edges.length} edges`
    );

    return { nodes: Array.from(nodeMap.values()), edges };
  } catch (err) {
    console.error(
      "[Neo4j] ❌ Error fetching snapshot:",
      err instanceof Error ? err.message : err
    );
    return empty;
  } finally {
    await session.close();
  }
}

// ─── Shutdown ────────────────────────────────────────────────────────────────

/**
 * Gracefully close the Neo4j driver.
 */
export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    console.log("[Neo4j] 🔌 Driver closed");
    driver = null;
  }
}
