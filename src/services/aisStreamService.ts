import WebSocket from "ws";
import { Server as SocketIOServer } from "socket.io";
// @ts-ignore
import { v4 as uuidv4 } from "uuid";

/**
 * AIS Stream Real-Time Pipeline
 * Connects to aisstream.io, transforms raw AIS pos reports into 
 * dynamic Graph nodes and edges, and streams them via socket.io.
 */

let aisSocket: WebSocket | null = null;
let io: SocketIOServer | null = null;
const API_KEY = process.env.AIS_API_KEY || "YOUR_AIS_API_KEY_HERE"; // Wait, user just said "process.env.AIS_API_KEY", I'll put a default empty or we can add it to env

// Config
const MAX_SHIPS = 200;
const THROTTLE_MS = 2000;

// State to keep track of active ships to avoid spamming the same edges
const activeShips = new Map<string, any>();
const activeRegions = new Set<string>();
let lastPush = Date.now();

export function initAisStream(socketIo: SocketIOServer) {
  io = socketIo;

  // Wait a few seconds before trying to connect to let server start up
  setTimeout(connectToAis, 2000);
}

function connectToAis() {
  if (!process.env.AIS_API_KEY) {
    console.warn("[AIS] ⚠️ No process.env.AIS_API_KEY found, AIS Stream will wait for key.");
    // We'll still connect if the user adds it later and restarts. Actually I'll use a hardcoded key from their example if they provided one, but they didn't. They provided aviationstack key, not AIS key. Wait, they wrote: { "APIKey": process.env.AIS_API_KEY,...}. I will use what's in env.
  }

  console.log("[AIS] Connecting to wss://stream.aisstream.io/v0/stream...");
  aisSocket = new WebSocket("wss://stream.aisstream.io/v0/stream");

  aisSocket.on("open", () => {
    console.log("[AIS] Connected. Sending subscription...");
    
    // Subscribe to global bounding box
    const subscriptionMessage = {
      APIKey: process.env.AIS_API_KEY || "placeholder", 
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ["PositionReport"]
    };

    aisSocket?.send(JSON.stringify(subscriptionMessage));
  });

  aisSocket.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.MessageType === "PositionReport") {
        const report = message.Message.PositionReport;
        
        // Extract data
        const mmsi = message.MetaData.MMSI;
        const shipName = message.MetaData.ShipName ? message.MetaData.ShipName.trim() : `Vessel ${mmsi}`;
        const latitude = report.Latitude;
        const longitude = report.Longitude;
        const speed = report.Sog; // Speed over ground
        const heading = report.TrueHeading;
        const timestamp = message.MetaData.time_utc;

        // Skip if coordinates are bogus
        if (latitude > 90 || latitude < -90 || longitude > 180 || longitude < -180) return;

        // Generate Graph Nodes
        const shipNodeId = `ship_${mmsi}`;
        
        // Round region lat/lon to nearest integer to group ships
        const regionLat = Math.round(latitude);
        const regionLon = Math.round(longitude);
        const regionNodeId = `region_${regionLat}_${regionLon}`;

        // Build Ship Node
        const shipNode = {
          id: shipNodeId,
          label: shipName,
          type: "VESSEL",
          properties: {
            mmsi: mmsi,
            latitude,
            longitude,
            speed,
            heading,
            timestamp,
            description: `Live Maritime Asset: ${shipName} heading ${heading}° at ${Math.round(speed)} knots.`
          }
        };

        // Build Region Node
        const regionNode = {
          id: regionNodeId,
          label: `Zone ${regionLat}°N, ${regionLon}°E`,
          type: "LOCATION",
          properties: {
            latitude: regionLat,
            longitude: regionLon,
            category: "Maritime Region"
          }
        };

        // Track in memory
        activeShips.set(shipNodeId, shipNode);
        
        // Keep to MAX_SHIPS
        if (activeShips.size > MAX_SHIPS) {
          const firstKey = activeShips.keys().next().value;
          if (firstKey) activeShips.delete(firstKey);
        }

        activeRegions.add(regionNodeId);

        // Build Relationship (Ship -> LOCATED_AT -> Region)
        const edge = {
          source: shipNodeId,
          target: regionNodeId,
          relationship: "LOCATED_AT",
          weight: 1.0,
          description: `Vessel detected via AIS Stream.`
        };

        // Stream updates periodically to avoid UI lag
        if (Date.now() - lastPush > THROTTLE_MS) {
          pushGraphUpdate();
        }
      }
    } catch (e) {
      // Ignore parse errors from raw streams
    }
  });

  aisSocket.on("error", (err) => {
    console.error("[AIS] WebSocket Error:", err.message);
  });

  aisSocket.on("close", () => {
    console.log("[AIS] Disconnected. Reconnecting in 5s...");
    setTimeout(connectToAis, 5000);
  });
}

function pushGraphUpdate() {
  if (!io) return;
  lastPush = Date.now();
  
  // We send a batched update of the latest active nodes and their edges
  const payload = {
    nodes: Array.from(activeShips.values()),
    edges: Array.from(activeShips.values()).map(ship => {
      const lat = Math.round(ship.properties.latitude);
      const lon = Math.round(ship.properties.longitude);
      return {
        source: ship.id,
        target: `region_${lat}_${lon}`,
        relationship: "LOCATED_AT",
        weight: 1.0,
        description: `Live tracking ${ship.id}`
      };
    })
  };

  // We should also push region nodes that are currently active
  const activeRegionNodes = Array.from(activeRegions).map(rid => {
    const coords = rid.split('_');
    return {
      id: rid,
      label: `Maritime Zone [${coords[1]}°, ${coords[2]}°]`,
      type: "LOCATION",
      properties: {
        latitude: parseFloat(coords[1]),
        longitude: parseFloat(coords[2])
      }
    };
  });
  
  // Only push regions that are actually connected to active ships right now
  const connectedRegions = new Set(payload.edges.map(e => e.target));
  payload.nodes.push(...activeRegionNodes.filter(r => connectedRegions.has(r.id)));

  io.emit("ais-graph-update", payload);
}
