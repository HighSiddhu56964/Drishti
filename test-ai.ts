import "dotenv/config";
import { generateKnowledgeGraph } from "./src/services/graphExtractor.js";

async function run() {
  try {
    const res = await generateKnowledgeGraph("Test query");
    console.log("SUCCESS:", JSON.stringify(res).slice(0, 50));
  } catch (e) {
    console.error("ERROR:");
    console.error(e.message);
  }
}
run();
