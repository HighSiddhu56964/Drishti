import OpenAI from "openai";
import { z } from "zod";
import type { KnowledgeGraph } from "../types/graph.js";

let openaiClient: OpenAI | null = null;
function getOpenAI() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set in environment variables.");
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://api.groq.com/openai/v1", // Using Groq for free rapid inference as existing ones
    });
  }
  return openaiClient;
}

const PredictiveAnalysisSchema = z.object({
  insights: z.array(z.string()),
  trends: z.array(z.string()),
  newNodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.string(),
    properties: z.object({
      description: z.string(),
      category: z.string(),
    }).passthrough(),
    importance: z.number()
  })),
  newEdges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    relationship: z.string(),
    weight: z.number(),
    description: z.string()
  }))
});

export type PredictiveAnalysisResult = z.infer<typeof PredictiveAnalysisSchema>;

/**
 * AI Predictive Analysis Engine
 * Analyzes the entire knowledge graph and suggests predictions, hidden patterns,
 * and proposes new nodes/edges to improve the graph.
 */
export async function analyzeGraphPredictively(
  graphData: KnowledgeGraph
): Promise<PredictiveAnalysisResult> {
  // We serialize the core aspects of the graph to avoid exceeding token limits
  const summarizedNodes = graphData.nodes.map((n: any) => ({
    id: n.id,
    label: n.label,
    type: n.type,
    // Truncate desc to save tokens if needed
    desc: n.properties?.description?.substring(0, 100)
  }));
  
  const summarizedEdges = graphData.edges.map((e: any) => ({
    from: e.source,
    to: e.target,
    rel: e.relationship
  }));

  const payload = JSON.stringify({ nodes: summarizedNodes, edges: summarizedEdges });

  const SYSTEM_PROMPT = `You are an advanced Predictive AI Agent for a Geopolitical and Global Intelligence Platform.
Your task is to analyze the provided knowledge graph structure (nodes and connections), identify hidden patterns, predict future geopolitical/economic trends, and suggest NEW nodes and edges that are missing from the current graph to make it more comprehensive.

Analyze the entities and how they are connected. Then output ONLY a JSON object exactly matching this structure:
{
  "insights": ["3-4 bullet points detailing hidden patterns or non-obvious correlations in the graph"],
  "trends": ["3-4 bullet points predicting future developments based on the current graph topology"],
  "newNodes": [
    {
      "id": "snake_case_id",
      "label": "Human Readable Name",
      "type": "COUNTRY | PERSON | ORGANIZATION | LOCATION | EVENT | CONCEPT | RESOURCE",
      "properties": { "description": "Short explanation", "category": "geopolitics | economy | etc" },
      "importance": 0.8
    }
  ],
  "newEdges": [
    {
      "source": "must exist in graph or newNodes",
      "target": "must exist in graph or newNodes",
      "relationship": "VERB_PHRASE",
      "weight": 0.5,
      "description": "Short explanation"
    }
  ]
}

Ensure that "newNodes" contains 3-5 highly relevant new entities, and "newEdges" connects them securely to existing nodes or other new nodes. EVERY newEdge must have valid source/target IDs.`;

  const response = await getOpenAI().chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    temperature: 0.3,
    max_tokens: 3000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Graph Payload (JSON): \n\n${payload}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty response from AI for predictive analysis.");
  }

  try {
    let cleanRaw = raw.trim();
    if (cleanRaw.startsWith("```json")) {
      cleanRaw = cleanRaw.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```/, "").replace(/```$/, "").trim();
    }
    const parsed = JSON.parse(cleanRaw);
    return PredictiveAnalysisSchema.parse(parsed);
  } catch (err) {
    throw new Error("Failed to parse predictive analysis JSON from AI." + (err instanceof Error ? err.message : ""));
  }
}
