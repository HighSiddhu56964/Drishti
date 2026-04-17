/**
 * Graph Routes
 *
 * POST /graph/query — accepts a query string, generates a knowledge graph.
 * GET  /graph/snapshot — returns the current Neo4j graph snapshot.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { fetchContextData } from "../services/contextService.js";
import { generateKnowledgeGraph } from "../services/graphExtractor.js";
import { saveGraphToNeo4j, getGraphSnapshot } from "../services/neo4jService.js";
import { fetchEntityInfo } from "../services/wikiService.js";
import { normalizeGraph } from "../utils/graphNormalizer.js";
import { analyzeGraphPredictively } from "../services/predictiveService.js";

const router = Router();

const QuerySchema = z.object({
  query: z
    .string()
    .min(3, "Query must be at least 3 characters")
    .max(1000, "Query must be under 1000 characters"),
});

router.post("/query", async (req: Request, res: Response): Promise<void> => {
  try {
    // ─── Validate request body ─────────────────────────────────────────
    const parsed = QuerySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { query } = parsed.data;
    console.log(`\n${"═".repeat(60)}`);
    console.log(`[Query] "${query}"`);
    console.log(`${"═".repeat(60)}`);

    // ─── Step 1: Fetch real-world context (GDELT → AI fallback) ──────
    console.log("[Step 1] Fetching context data...");
    const { context: contextText, source, articleCount } =
      await fetchContextData(query);
    console.log(
      `[Step 1] Context ready (${source}, ${contextText.length} chars, ${articleCount} articles)`
    );

    // ─── Step 2: Extract knowledge graph ───────────────────────────────
    console.log("[Step 2] Extracting knowledge graph...");
    const graph = await generateKnowledgeGraph(contextText);
    console.log(
      `[Step 2] Graph ready — ${graph.nodes.length} nodes, ${graph.edges.length} edges`
    );

    // ─── Step 3: Normalize graph data ─────────────────────────────────
    const cleanGraph = normalizeGraph(graph);
    console.log(`[Step 3] Normalized: ${cleanGraph.nodes.length} nodes, ${cleanGraph.edges.length} edges`);

    // ─── Step 4: Persist to Neo4j ─────────────────────────────────────
    console.log("[Step 4] Saving graph to Neo4j...");
    try {
      await saveGraphToNeo4j(cleanGraph);
      console.log("[Step 4] Neo4j save complete");
    } catch (neo4jErr) {
      console.error(
        "[Step 4] Neo4j save failed (non-fatal):",
        neo4jErr instanceof Error ? neo4jErr.message : neo4jErr
      );
    }

    // ─── Respond ───────────────────────────────────────────────────────
    res.json({
      query,
      nodes: cleanGraph.nodes,
      edges: cleanGraph.edges,
      meta: {
        nodeCount: cleanGraph.nodes.length,
        edgeCount: cleanGraph.edges.length,
        dataSource: source,
        articleCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[GraphRoute] Error:", err);
    res.status(500).json({
      error: "Failed to generate knowledge graph",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ─── GET /snapshot — return current Neo4j graph ───────────────────────────
router.get("/snapshot", async (_req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(_req.query.limit as string) || 50;
    const graph = await getGraphSnapshot(limit);

    res.json({
      nodes: graph.nodes,
      edges: graph.edges,
      meta: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[GraphRoute] Snapshot error:", err);
    res.status(500).json({
      error: "Failed to fetch graph snapshot",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ─── GET /entity/:label — fetch entity details from Wikipedia ─────────────
router.get("/entity/:label", async (req: Request, res: Response): Promise<void> => {
  try {
    const label = decodeURIComponent(req.params.label as string);
    console.log(`[Wiki] Fetching details for: "${label}"`);

    const info = await fetchEntityInfo(label);

    if (!info) {
      // Return a usable fallback instead of an error so IntelPanel always renders
      res.json({
        title: label,
        summary: "Entity in knowledge graph",
        description: "",
        thumbnail: null,
        url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(label)}`,
        extract: "No Wikipedia article found for this entity. Try searching manually.",
        categories: [],
        connections: [],
        type: "UNKNOWN",
      });
      return;
    }

    res.json(info);
  } catch (err) {
    // Graceful fallback — never return a 500 so IntelPanel always opens
    const label = String(req.params.label || "Unknown");
    console.error(`[Wiki] Entity fetch error for "${label}":`, err);
    res.json({
      title: label,
      label: label,
      summary: "Entity in knowledge graph",
      description: "",
      thumbnail: null,
      url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(label)}`,
      extract: "Could not fetch details at this time.",
      categories: [],
      connections: [],
      type: "UNKNOWN",
    });
  }
});

// ─── POST /expand — dynamically expand graph from a node ──────────────────
const ExpandSchema = z.object({
  nodeId: z.string(),
  label: z.string(),
});

router.post("/expand", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = ExpandSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { nodeId, label } = parsed.data;
    console.log(`\n${"─".repeat(60)}`);
    console.log(`[Expand] Expanding node: "${label}" (${nodeId})`);

    // Fetch context about this entity
    const { context: contextText, source, articleCount } = await fetchContextData(label);
    console.log(`[Expand] Context ready (${source}, ${contextText.length} chars)`);

    // Generate subgraph
    const graph = await generateKnowledgeGraph(contextText);

    // Normalize first, then limit to 15 nodes
    const normalized = normalizeGraph(graph);
    const limitedNodes = normalized.nodes.slice(0, 15);
    const limitedNodeIds = new Set(limitedNodes.map((n) => n.id));
    const limitedEdges = normalized.edges.filter(
      (e) => limitedNodeIds.has(e.source) && limitedNodeIds.has(e.target)
    );

    console.log(`[Expand] Result: ${limitedNodes.length} nodes, ${limitedEdges.length} edges`);

    res.json({
      nodes: limitedNodes,
      edges: limitedEdges,
      sourceNodeId: nodeId,
      meta: {
        nodeCount: limitedNodes.length,
        edgeCount: limitedEdges.length,
        dataSource: source,
        articleCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[GraphRoute] Expand error:", err);
    res.status(500).json({
      error: "Failed to expand node",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ─── POST /node-details — AI-generated deep intelligence for a node ───────
import OpenAI from "openai";

const DetailSchema = z.object({
  label: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
});

router.post("/node-details", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = DetailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const { label, type, description } = parsed.data;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const response = await openai.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an intelligence analyst. Given an entity, produce a detailed JSON analysis.
Return ONLY valid JSON with these keys:
{
  "fullDescription": "A detailed 200-500 word explanation of this entity, its significance, history, and current role in global affairs.",
  "designation": "If this entity is a PERSON, output their exact official title or post (e.g. 'Prime Minister of Iran', 'CEO of Tesla', 'General of Army'). If NOT a person, output the entity's general classification (e.g. 'Multinational Technology Company', 'International Maritime Strait', 'Geopolitical Conflict'). Do not just say 'Company' or 'Location'.",
  "vitalStatistic": {
    "metric": "Exact critical percentage or hard figure (e.g. '20%', '$5 Trillion', '300,000 km²')",
    "label": "Exactly what this percentage/figure represents (e.g. 'of global oil trade volume', 'annual revenue', 'area of influence')"
  },
  "hardFact": {
    "metric": "e.g. '1st', 'Sole Provider', 'Key Chokepoint', 'Top 5'",
    "label": "Brief strategic reality or ranking (e.g. 'Largest Global Exporter', 'Only maritime route out of gulf')"
  },
  "globalImpact": {
    "economy": "How this entity affects global/regional economics (2-3 sentences)",
    "geopolitics": "Geopolitical significance (2-3 sentences)", 
    "trade": "Impact on trade and supply chains (2-3 sentences)"
  },
  "timeline": [
    { "year": "YYYY", "event": "Brief description of key event" }
  ],
  "insights": [
    "Strategic importance bullet point",
    "Risk factor bullet point",
    "Dependency or relationship bullet point"
  ]
}
Include 5-8 timeline events and 4-6 insight points. You MUST return a highly accurate 'vitalStatistic' metric representing the real-world scale or impact percentage of this entity. Be factual and specific.`,
        },
        {
          role: "user",
          content: `Entity: "${label}"\nType: ${type || "Unknown"}\nContext: ${description || "No additional context"}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Empty AI response");
    }

    let cleanRaw = raw.trim();
    if (cleanRaw.startsWith("```json")) {
      cleanRaw = cleanRaw.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const details = JSON.parse(cleanRaw);
    res.json(details);
  } catch (err) {
    console.error("[GraphRoute] Node details error:", err);
    // Graceful fallback
    res.json({
      fullDescription: `${req.body?.label || "This entity"} is a significant entity in the knowledge graph. Detailed AI analysis is temporarily unavailable.`,
      globalImpact: {
        economy: "Economic impact data is being processed.",
        geopolitics: "Geopolitical analysis is being generated.",
        trade: "Trade impact assessment is pending.",
      },
      timeline: [],
      insights: [
        "This entity plays a role in the current geopolitical landscape.",
        "Further analysis is recommended for comprehensive understanding.",
      ],
    });
  }
});

// ─── POST /predictive-analysis — AI analysis of the entire graph ──────────
const GraphPayloadSchema = z.object({
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  meta: z.any().optional(),
});

router.post("/predictive-analysis", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = GraphPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid graph payload format" });
      return;
    }

    console.log(`\n${"─".repeat(60)}`);
    console.log(`[Predictive Analysis] Analyzing graph with ${parsed.data.nodes.length} nodes...`);

    const analysis = await analyzeGraphPredictively({
      nodes: parsed.data.nodes,
      edges: parsed.data.edges
    });

    res.json(analysis);
  } catch (err) {
    console.error("[GraphRoute] Predictive analysis error:", err);
    res.status(500).json({
      error: "Failed to run predictive analysis",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ─── POST /re-evaluate — PALANTIR DEEP RE-EVALUATION SYSTEM ──────────
router.post("/re-evaluate", async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = GraphPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid graph payload" });
      return;
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log(`[RE-EVALUATE] Deep analysis initiated — ${parsed.data.nodes.length} nodes, ${parsed.data.edges.length} edges`);

    const summarizedNodes = parsed.data.nodes.map((n: any) => ({
      id: n.id, label: n.label, type: n.type,
      desc: n.properties?.description?.substring(0, 120)
    }));
    const summarizedEdges = parsed.data.edges.map((e: any) => ({
      from: e.source, to: e.target, rel: e.relationship
    }));
    const payload = JSON.stringify({ nodes: summarizedNodes, edges: summarizedEdges });

    const SUPER_SYSTEM_PROMPT = `You are PALANTIR — the most advanced intelligence graph re-evaluation engine on Earth. 
You operate across ALL intelligence disciplines: SIGINT (signals), HUMINT (human), OSINT (open source), GEOINT (geospatial), MASINT (measurement), and FININT (financial).

You have been given the OUTPUT of a previous knowledge graph extraction. Your mission is to DEEPLY RE-ANALYZE this graph and find:

1. **HIDDEN CONNECTIONS**: Entities that SHOULD be connected but are NOT. Cross-reference every node against every other node. Look for:
   - Shared geopolitical interests or conflicts
   - Financial dependencies (sanctions, trade, investments)  
   - Military alliances or adversarial relationships
   - Historical precedents and diplomatic ties
   - Supply chain and resource dependencies
   - Shared personnel, organizations, or intermediaries

2. **MISSING CRITICAL ENTITIES**: Nodes that are CONSPICUOUSLY ABSENT from the graph. Every intelligence picture has blind spots. Identify:
   - Key actors who MUST be involved but aren't mentioned
   - Organizations that mediate between existing entities
   - Geographic locations critical to the dynamics
   - Historical events that shaped current relationships
   - Financial instruments or mechanisms at play

3. **THREAT VECTORS & OPPORTUNITIES**: Based on the graph topology:
   - What are the highest-risk escalation paths?
   - Where are the leverage points for influence?
   - What would disruption at key nodes cause?
   - What intelligence gaps need to be filled?

4. **RECURSIVE DEEP LINKS**: For each NEW node you add, ALSO find its connections to ALL existing nodes AND to other new nodes. Think 2-3 hops deep. Every entity connects to the web.

OUTPUT FORMAT — Return ONLY a valid JSON object:
{
  "deepInsights": ["5-8 sentences revealing NON-OBVIOUS intelligence findings. Be specific, cite entity names."],
  "threatAssessment": ["3-5 threat vectors with severity HIGH/MEDIUM/LOW"],
  "newNodes": [
    {
      "id": "snake_case_id",
      "label": "Full Entity Name",
      "type": "COUNTRY | PERSON | ORGANIZATION | LOCATION | EVENT | CONCEPT | RESOURCE | MILITARY_ASSET | FINANCIAL_INSTRUMENT",
      "properties": { "description": "Intelligence brief (2-3 sentences)", "category": "domain", "source": "OSINT/SIGINT/HUMINT/etc" },
      "importance": 0.0-1.0
    }
  ],
  "newEdges": [
    {
      "source": "existing_or_new_node_id",
      "target": "existing_or_new_node_id", 
      "relationship": "VERB_PHRASE_UPPERCASE",
      "weight": 0.0-1.0,
      "description": "Brief explanation of this intelligence link"
    }
  ]
}

CRITICAL RULES:
- Generate 8-15 new nodes (be AGGRESSIVE in expansion)
- Generate 15-30 new edges (EVERY new node must connect to at least 2 existing nodes)
- Cross-link new nodes to EACH OTHER where applicable
- EVERY edge must have valid source/target IDs (existing in graph OR in newNodes)
- Be geopolitically accurate and intelligence-grade
- Think like a Palantir Gotham analyst: follow the money, the weapons, the people, the data`;

    const openai = new (await import("openai")).default({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const response = await openai.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.4,
      max_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SUPER_SYSTEM_PROMPT },
        { role: "user", content: `INTELLIGENCE GRAPH PAYLOAD:\n\n${payload}` },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty response from re-evaluation engine.");

    let cleanRaw = raw.trim();
    if (cleanRaw.startsWith("```json")) {
      cleanRaw = cleanRaw.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const result = JSON.parse(cleanRaw);
    console.log(`[RE-EVALUATE] Complete — found ${result.newNodes?.length || 0} new nodes, ${result.newEdges?.length || 0} new edges`);
    
    res.json(result);
  } catch (err) {
    console.error("[GraphRoute] Re-evaluation error:", err);
    res.status(500).json({
      error: "Deep re-evaluation failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
