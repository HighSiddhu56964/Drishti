/**
 * AI Graph Extraction Engine
 *
 * Takes a context text and extracts a structured knowledge graph using OpenAI.
 * Handles entity extraction, typing, relationship generation, normalization,
 * and deduplication.
 */

import OpenAI from "openai";
import { z } from "zod";
import type { KnowledgeGraph } from "../types/graph.js";
import { deduplicateGraph } from "../utils/normalize.js";

let openaiClient: OpenAI | null = null;
function getOpenAI() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set in environment variables.");
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return openaiClient;
}

// ─── Zod Schemas for validation ─────────────────────────────────────────────

const NodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string(),
  properties: z.object({
    description: z.string(),
    category: z.string(),
  }).passthrough(),
});

const EdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  relationship: z.string(),
  weight: z.number().min(0).max(1),
  description: z.string(),
});

const GraphSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
});

// ─── Extraction Prompt ───────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a geopolitical intelligence analyst. Extract a COMPREHENSIVE knowledge graph from the provided text. You must return a MINIMUM of 25 nodes and MINIMUM of 30 edges. Do not be conservative — extract every meaningful entity.

Node types to extract exhaustively: COUNTRY, PERSON (leaders, generals, diplomats, officials), ORGANIZATION (military, UN bodies, alliances, NGOs, oil cartels, banks), LOCATION (cities, straits, bases, borders, regions), EVENT (battles, sanctions, treaties, summits, attacks), CONCEPT (sanctions, nuclear deal, oil embargo, ceasefire), RESOURCE (oil, gas, weapons systems, uranium).

For every node extract:
- "id": snake_case unique identifier
- "label": display name
- "type": from the above list
- "properties.description": 2 sentences of factual context
- "properties.category": one of: geopolitics, trade, economy, organization, event, resource, infrastructure, military, technology
- "properties.importance": A STRICT FLOAT BETWEEN 0.0 AND 1.0 representing global significance/impact. YOU MUST CALCULATE AND PROVIDE THIS FOR EVERY NODE WITHOUT EXCEPTION.

For every edge extract:
- "source": source node id
- "target": target node id
- "relationship": verb phrase e.g. SANCTIONS, ALLY_OF, COMMANDS, BORDERS, EXPORTS_TO, SIGNED_WITH, OPPOSES, FUNDS
- "weight": float 0–1 indicating strength
- "description": a brief explanation referencing the real-world context

## CRITICAL RULES
1. Extract a MINIMUM of 25 nodes and 30 edges — do NOT be conservative
2. Use REAL names — no placeholders like "Country A" or "some organization"
3. Every node id must be unique, lowercase, with underscores
4. Every edge must reference valid node ids that exist in your nodes array
5. No duplicate nodes — if the same entity appears multiple times, use ONE node
6. Relationships must be directional and logically correct
7. Cover ALL domains present in the text (politics, economics, trade, military, etc.)
8. Infer implicit relationships — if two entities are mentioned in similar contexts, consider how they relate

CRITICAL EDGE RULE: Every single node you emit MUST appear as either a source or target in at least one edge. A node with zero edges is forbidden. If a node has no obvious direct relationship to another, connect it with a RELATED_TO or INFLUENCES edge to the most thematically relevant node. The edges array must have AT LEAST (number_of_nodes × 1.5) entries — a graph with 30 nodes needs at minimum 45 edges. Prefer multiple relationship types: ALLY_OF, OPPOSES, SANCTIONS, TRADES_WITH, COMMANDS, LOCATED_IN, SIGNED, PART_OF, FUNDS, BORDERS, CAUSED_BY, LEADS.

Return ONLY a valid JSON object with keys "nodes" and "edges". No markdown, no explanation.

{
  "nodes": [ { "id": "", "label": "", "type": "", "properties": { "description": "", "category": "" }, "importance": 0 } ],
  "edges": [ { "source": "", "target": "", "relationship": "", "weight": 0.0, "description": "" } ]
}`;

// ─── Main Extraction Function ────────────────────────────────────────────────

export async function generateKnowledgeGraph(
  text: string
): Promise<KnowledgeGraph> {
  const response = await getOpenAI().chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    temperature: 0.2,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract a comprehensive knowledge graph from the following briefing:\n\n${text}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI returned an empty graph extraction response.");
  }

  // Parse and validate
  let parsed: unknown;
  try {
    // Strip markdown code blocks if the model wrapped the JSON
    let cleanRaw = raw.trim();
    if (cleanRaw.startsWith("```json")) {
      cleanRaw = cleanRaw.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```/, "").replace(/```$/, "").trim();
    }
    parsed = JSON.parse(cleanRaw);
  } catch {
    throw new Error(
      `Failed to parse OpenAI graph response as JSON: ${raw.slice(0, 200)}...`
    );
  }

  const validated = GraphSchema.parse(parsed);

  // ─── Post-processing: connect orphan nodes ──────────────────────────
  const connectedNodeIds = new Set<string>();
  validated.edges.forEach((e: any) => {
    connectedNodeIds.add(e.source);
    connectedNodeIds.add(e.target);
  });
  const orphanNodes = validated.nodes.filter((n: any) => !connectedNodeIds.has(n.id));
  if (orphanNodes.length > 0 && validated.nodes.length > 1) {
    orphanNodes.forEach((orphan: any) => {
      const target = validated.nodes.find((n: any) => n.id !== orphan.id && connectedNodeIds.has(n.id));
      if (target) {
        validated.edges.push({
          source: orphan.id,
          target: target.id,
          relationship: 'RELATED_TO',
          weight: 0.3,
          description: `${orphan.label} is related to ${target.label}`,
        });
        connectedNodeIds.add(orphan.id);
      }
    });
    console.log(`[GraphExtractor] Connected ${orphanNodes.length} orphan node(s)`);
  }

  // Deduplicate and normalize
  const graph = deduplicateGraph(validated as KnowledgeGraph);

  console.log(
    `[GraphExtractor] Extracted ${graph.nodes.length} nodes, ${graph.edges.length} edges`
  );

  return graph;
}
