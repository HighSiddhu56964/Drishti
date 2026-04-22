# 🌐 DRISHTI: Universal Knowledge Graph Intelligence System

> **Project Intelligence & Strategic Context Document**
> *Status: Active / Phase 2 (Predictive & Jarvis Integration)*

---

## 1. 🎯 Problem Statement
In an era of information overload, understanding the **hidden relationships** and **cascading impacts** of global events is nearly impossible using traditional news feeds. Intelligence is fragmented across disparate sources (GDELT, Wikipedia, live feeds), making it difficult to visualize the "big picture" of geopolitical, economic, and security risks.

**The core challenge:** How to transform raw, unstructured global data into a coherent, navigable, and predictive knowledge system.

---

## 2. 💡 Solution: The Drishti Engine
Drishti is an **Intelligence Operating System** that uses Large Language Models (LLMs) to perform real-time entity extraction and relationship mapping. It synthesizes a dynamic Knowledge Graph from natural language queries, allowing users to:
- **Visualize** complex networks of actors (countries, organizations, individuals).
- **Discover** non-obvious connections through multi-step graph expansion.
- **Analyze** the predictive impact of events using historical context and AI reasoning.

---

## 3. 🛠️ Tech Stack

### **Frontend (Tactical Console)**
- **Core:** React 19, TypeScript, Vite.
- **Visualizations:** 
  - `react-force-graph-2d` (Knowledge Graph).
  - `Three.js` / `@react-three/fiber` (Global Intelligence Globe).
  - `D3.js` (Force simulation and data mapping).
- **Communication:** `Socket.io-client` (Real-time telemetry).
- **Styling:** Vanilla CSS (Tactical "Deep Space" Aesthetic).

### **Backend (Intelligence Pipeline)**
- **Runtime:** Node.js (Express), `tsx`.
- **AI Engine:** OpenAI API (GPT-4o for extraction and reasoning).
- **Graph Database:** Neo4j (Entity-relationship persistence).
- **Real-time:** `Socket.io` (AIS streaming and graph updates).
- **Validation:** `Zod` (Schema enforcement).

### **Data Layer**
- **GDELT Project:** Global news and event monitoring.
- **Wikipedia API:** Entity enrichment and contextual summaries.
- **AIS Data:** Real-time maritime tracking (simulated/integrated).

---

## 4. 🧬 Methodology (The Extraction Pipeline)
1. **Input:** User submits a natural language query (e.g., "Impact of Red Sea crisis on India's LPG supply").
2. **Contextualization:** The system fetches relevant event logs from GDELT and entity summaries from Wikipedia.
3. **AI Extraction:** The `graphExtractor` service processes the data into a JSON-schema compliant graph (Nodes & Edges).
4. **Normalization:** The `neo4jService` ensures entity resolution (avoiding duplicates) and stores the graph.
5. **Real-time Delivery:** The graph is emitted via WebSockets or REST to the frontend.
6. **Interaction:** Users expand nodes, triggering recursive extraction for deeper intelligence.

---

## 📁 File Structure (Architecture Map)

```text
drishti-v2/
├── client/                 # Frontend Tactical Interface
│   ├── src/
│   │   ├── components/     # Modular UI Components
│   │   │   ├── GlobeView.tsx        # 3D Global Telemetry
│   │   │   ├── GraphCanvas.tsx      # Main Knowledge Graph
│   │   │   ├── IntelPanel.tsx       # Deep Dive Data Panel
│   │   │   ├── JarvisPanel.tsx      # AI Assistant & Chat
│   │   │   ├── PredictivePanel.tsx  # Scenario Simulation
│   │   │   └── GraphSearch.tsx      # Entity Locator (Header)
│   │   ├── types.ts        # Shared TypeScript Interfaces
│   │   └── App.tsx         # Dashboard Orchestrator
│
├── src/                    # Backend Intelligence Pipeline
│   ├── routes/             # API Entry Points
│   ├── services/           # Core Logic Engines
│   │   ├── graphExtractor.ts   # LLM Graph Generation
│   │   ├── neo4jService.ts     # Graph DB Management
│   │   ├── gdeltService.ts     # Global News Integration
│   │   └── aisStreamService.ts # Real-time Telemetry
│   └── server.ts           # System Entry Point
```

---

## 🚀 Key Features
- **JARVIS Assistant:** Context-aware AI sidebar for querying and graph control.
- **Predictive Intelligence:** "Palantir-style" re-evaluation of graphs to discover hidden threats.
- **Dynamic Expansion:** One-click exploration of any entity's hidden network.
- **Global Search:** Instant entity highlighting with viewport auto-centering.
- **Globe/Graph Switcher:** Seamless transition between geospatial and relational views.
- **Intel Briefings:** Rich stat cards for every node including global impact scores and timelines.

---

## 💎 USP (Unique Selling Points)
1. **High-Density Tactical UI:** Designed for mission-critical visualization (not a standard dashboard).
2. **Contextual Enrichment:** Every node is automatically cross-referenced with Wikipedia and GDELT.
3. **Live AIS Integration:** Real-time maritime intelligence streamed directly into the graph.
4. **Autonomous Reasoning:** The system doesn't just show data; it "thinks" about relationship implications.

---

## 📈 Current Status & Progress

### **Completed ✅**
- [x] Core Knowledge Graph rendering engine.
- [x] AI Extraction pipeline (GDELT + Wiki + OpenAI).
- [x] Tactical UI System (Deep Space / Green theme).
- [x] Predictive Analysis Module (Scenario Simulation).
- [x] Graph Search integration in header.
- [x] Neo4j persistence layer.

### **In Progress ⏳**
- [ ] Multi-scenario comparison grid in Predictive Panel.
- [ ] Live AIS WebSocket streaming stability.
- [ ] Autonomous "Alert" system in JARVIS sidebar.

### **Upcoming 🔜**
- [ ] Historical Time-Travel (Graph versioning over time).
- [ ] Exportable Intelligence Reports (PDF/JSON).
- [ ] Mobile Tactical View (Responsive adaptation).

---

## 📊 Database Schema (Logical)
- **Nodes:** `Entity { name, type, importance, description, properties }`
- **Edges:** `Relationship { source, target, relationship, weight, description }`
- **Labels:** `COUNTRY, ORGANIZATION, PERSON, EVENT, RESOURCE, INFRASTRUCTURE`

---

## 🛡️ Backend Endpoints
- `POST /graph/query`: Generates a new graph from a query.
- `POST /graph/expand`: Fetches deeper connections for a specific node.
- `POST /graph/re-evaluate`: Runs predictive analysis on the current graph.
- `GET /graph/entity/:name`: Fetches Wikipedia/GDELT enrichment for an entity.
