const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);

// In-memory state store for maritime intelligence
const ships = new Map();
const MAX_VESSELS = 1000;
const HISTORY_LIMIT = 50;
const STALE_TIMEOUT_MS = 1000 * 60 * 15; // 15 minutes

// The API key to use for AISStream
const API_KEY = process.env.AIS_API_KEY;

const wssFlags = {
  active: false,
};

function connectAISStream() {
  console.log("Attempting to connect to AISStream...");
  const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

  ws.on('open', () => {
    console.log("Connected to AISStream WebSocket.");
    wssFlags.active = true;

    // Send subscription message within 3 seconds
    const subMessage = {
      APIKey: API_KEY,
      BoundingBoxes: [[[ -90, -180 ], [ 90, 180 ]]], // Global Bounding Box for demo (or use highly trafficked areas)
      FilterMessageTypes: ["PositionReport", "ShipStaticData"]
    };

    ws.send(JSON.stringify(subMessage));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      const type = msg.MessageType;
      if (!type) return;

      const mmsi = msg.MetaData.MMSI;
      const shipName = msg.MetaData.ShipName ? msg.MetaData.ShipName.trim() : "UNKNOWN";

      if (!ships.has(mmsi)) {
        if (ships.size >= MAX_VESSELS) {
          // Naive drop: remove the oldest (first in Map iteration)
          const oldestKey = ships.keys().next().value;
          ships.delete(oldestKey);
        }
        ships.set(mmsi, {
          mmsi,
          name: shipName,
          lat: 0,
          lon: 0,
          sog: 0,  // Speed Over Ground
          cog: 0,  // Course Over Ground
          heading: 0,
          type: "UNKNOWN", // To be classified
          lastUpdated: Date.now(),
          path: []
        });
      }

      const ship = ships.get(mmsi);
      ship.lastUpdated = Date.now();
      
      // Update name if we get static data and it was unknown
      if (shipName !== "UNKNOWN" && shipName !== ship.name) {
         ship.name = shipName;
      }

      if (type === "PositionReport") {
        const report = msg.Message.PositionReport;
        ship.lat = report.Latitude;
        ship.lon = report.Longitude;
        ship.sog = report.Sog;
        ship.cog = report.Cog;
        ship.heading = report.TrueHeading;

        // Add to history trajectory
        ship.path.push([report.Latitude, report.Longitude]);
        if (ship.path.length > HISTORY_LIMIT) {
          ship.path.shift();
        }

        // Basic classification heuristic based on name/metadata if Type isn't directly exposed
        // Ideally ShipStaticData provides 'Type', but we can try to guess from name and behavior
        const nameUpper = ship.name.toUpperCase();
        if (nameUpper.includes("WARSHIP") || nameUpper.includes("CG ") || nameUpper.includes("NAVY") || nameUpper.includes("USS ") || nameUpper.includes("HMS ")) {
            ship.type = "MILITARY";
        } else if (nameUpper.includes("EXPRESS") || nameUpper.includes("LOGISTICS") || nameUpper.includes("CARGO")) {
            ship.type = "CARGO";
        } else if (nameUpper.includes("PRINCESS") || nameUpper.includes("OTS") || nameUpper.includes("FERRY")) {
            ship.type = "PASSENGER";
        }
      } else if (type === "ShipStaticData") {
        const staticData = msg.Message.ShipStaticData;
        const shipType = staticData.Type; // usually an integer code
        
        // Military / Law enforcement codes are generally 35. Cargo 70-79. Passenger 60-69.
        if (shipType === 35) ship.type = "MILITARY";
        else if (shipType >= 70 && shipType <= 79) ship.type = "CARGO";
        else if (shipType >= 60 && shipType <= 69) ship.type = "PASSENGER";
        else ship.type = "CIVILIAN";
      }
    } catch (err) {
      console.error("Error parsing AIS message:", err.message);
    }
  });

  ws.on('close', () => {
    console.log("AISStream connection closed. Reconnecting in 5s...");
    wssFlags.active = false;
    setTimeout(connectAISStream, 5000);
  });

  ws.on('error', (err) => {
    console.error("AISStream WebSocket error:", err.message);
  });
}

// Cleanup interval to drop stale vessels
setInterval(() => {
  const now = Date.now();
  for (const [mmsi, ship] of ships.entries()) {
    if (now - ship.lastUpdated > STALE_TIMEOUT_MS) {
      ships.delete(mmsi);
    }
  }
}, 60000);

// Expose REST API endpoint for frontend data consumption
app.get('/api/maritime', (req, res) => {
  res.json({
    status: wssFlags.active ? "LIVE" : "RECONNECTING",
    count: ships.size,
    data: Array.from(ships.values())
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
  connectAISStream();
});
