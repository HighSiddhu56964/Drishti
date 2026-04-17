/**
 * Palantir Knowledge Graph Engine — Server Entry Point
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import graphRoutes from "./routes/graphRoutes.js";
import { initNeo4j, closeNeo4j } from "./services/neo4jService.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/graph", graphRoutes);

// ─── Serve static frontend ──────────────────────────────────────────────────
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Palantir Knowledge Graph Engine",
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[Server] Unhandled error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  }
);

// ─── Start ───────────────────────────────────────────────────────────────
async function startServer() {
  // Initialize Neo4j (non-fatal if unavailable)
  await initNeo4j();

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  🔮  Palantir Knowledge Graph Engine                    ║
║  🌐  http://localhost:${PORT}                             ║
║  📡  POST /graph/query                                  ║
║  📸  GET  /graph/snapshot                               ║
║  💚  GET  /health                                       ║
╚══════════════════════════════════════════════════════════╝
    `);
  });
}

startServer();

// ─── Graceful Shutdown ───────────────────────────────────────────────────
const shutdown = async () => {
  console.log("\n[Server] Shutting down...");
  await closeNeo4j();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
