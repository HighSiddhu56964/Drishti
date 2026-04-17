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
- "properties": Include extensive quantitative data (e.g. population, GDP, founding_year, casualty_count) and other specific attributes based on Node type.
- "properties.importance": A STRICT FLOAT BETWEEN 0.0 AND 1.0 representing global significance/impact. YOU MUST CALCULATE THIS FOR EVERY NODE.

For every edge extract:
- "source": source node id
- "target": target node id
- "relationship": verb phrase expressing a specific real-world relationship.
- "weight": float 0-1 indicating strength
- "description": a brief explanation referencing the real-world context

## CRITICAL RULES
Before you extract a single node, read the entire source text and identify the 5 to 7 most important real-world relationships it describes. These relationships are your skeleton. Every node you create must serve at least one of these relationships. If a concept you are considering does not serve any of the core relationships, it does not get its own node.

Rule 1 — The entity test. Apply this before creating any node.
Ask: does this concept make decisions, sign agreements, command forces, control territory, produce resources, or enter into relationships with other actors? If yes, it is an entity and deserves a node. If no — if it is a measurement, a capability, a policy, a program, or a characteristic of another entity — it is a property. Store it as a property on the parent node, not as a separate node. (e.g. "Military budget" is a property of a country. "Tehran's economy" is a property of Tehran). The only exception is when the concept has independent relationships with three or more different entities that the parent node does not share.

Rule 2 — The connectivity requirement. Apply this before finalizing any node.
Every node must connect to at least two other nodes through edges that go to different parts of the graph. A node with only one edge is almost certainly an attribute of its single neighbor. A node that only connects to other nodes within a group of three or fewer is an island and must be eliminated or merged. If you cannot find two meaningful connections for a node to different parts of the graph, delete that node and add its information as a property to the most relevant existing node.

Rule 3 — Deduplication. Apply this continuously.
Before adding any node, scan your existing node list for any node that refers to the same real-world entity under a different name, abbreviation, title, or description. Merge them into one node. Use the most specific and internationally recognized name as the label. Never create two nodes for the same real-world entity.

Rule 4 — Island prevention. Apply this as a final pass.
Identify every connected component in your graph. For each island cluster, find the strongest conceptual bridge between that cluster and the main graph and add an edge expressing that relationship. If no meaningful edge exists, the entire cluster is off-topic and must be deleted.

Rule 5 — Relationship types must be specific and directional.
Never use vague relationship types like RELATED_TO or CONNECTED_TO. Every edge must express a specific real-world relationship: SANCTIONS, ALLY_OF, EXPORTS_TO, COMMANDS, FUNDS, SIGNED, BORDERS, MEMBER_OF, OPPOSES, CAUSED_BY, CONTROLS, TRADES_WITH, LEADS, PART_OF, LOCATED_IN, THREATENS.

Rule 6 — Node properties must be data-rich.
Every node must carry real quantitative data in its properties wherever it exists. 
- COUNTRY: Must include population, GDP, GDP change, primary exports with dollar values, etc.
- PERSON: Must include role, age, years in power, net worth (if known), legal/sanctions status.
- ORGANIZATION: Must include founding year, member count, annual budget, primary mandate.
- EVENT: Must include exact date, location, casualty count, financial cost, direct consequences.
Empty properties mean an empty intel panel.

FINAL VERIFICATION:
1. Does every node pass the entity test (actor, not attribute)?
2. Does every node have at least two edges to different parts of the graph?
3. Are there duplicate nodes representing the same entity? (If yes, merge)
4. Are there any island clusters? (If yes, bridge or delete)
5. Does every edge have a specific relationship type?
6. Does every node have quantitative data in its properties?
If ANY answer is no, fix it before outputting.

Return ONLY a valid JSON object with keys "nodes" and "edges". No markdown, no explanation.

{
  "nodes": [ { "id": "", "label": "", "type": "", "properties": { "description": "", "category": "", "population": 0 }, "importance": 0.8 } ],
  "edges": [ { "source": "", "target": "", "relationship": "SANCTIONS", "weight": 0.9, "description": "" } ]
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
