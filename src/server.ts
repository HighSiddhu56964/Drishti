/**
 * Drishti Knowledge Graph Engine — Server Entry Point
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import graphRoutes from "./routes/graphRoutes.js";
import aviationRoutes from "./routes/aviationRoutes.js";
import predictRoutes from "./routes/predictRoutes.js";
import { initNeo4j, closeNeo4j } from "./services/neo4jService.js";
import { initAisStream } from "./services/aisStreamService.js";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*" }
});
const PORT = parseInt(process.env.PORT || "3000", 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/graph/predict", predictRoutes);
app.use("/graph", graphRoutes);
app.use("/api/aviation", aviationRoutes);

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
    service: "Drishti Knowledge Graph Engine",
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

  // Initialize AIS Stream WebSocket Service
  initAisStream(io);

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  🔮  Drishti Knowledge Graph Engine                    ║
║  🌐  http://localhost:${PORT}                             ║
║  📡  POST /graph/query                                  ║
║  🌊  WSS  ws://localhost:${PORT}                             ║
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
