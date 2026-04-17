# 🌐Drishti :- Universal Knowledge Graph Intelligence System

A real-time, AI-powered knowledge graph engine that transforms natural language queries into **interactive, multi-domain knowledge graphs**.

This system is inspired by platforms like Palantir and aims to provide deep insights into **global events, geopolitics, trade, organizations, and more**—all through a dynamic and interactive graph interface.

---

## 🚀 Features

* 🧠 **AI-Powered Graph Generation**

  * Converts user queries into structured knowledge graphs using LLMs

* 🌍 **Multi-Domain Intelligence**

  * Covers geopolitics, economy, trade, organizations, people, and events

* 🔗 **Interactive Graph Visualization**

  * Drag, zoom, hover, and click all nodes
  * Dynamic relationships between entities

* 📈 **Node Expansion**

  * Click any node to expand and fetch deeper connections

* 🔍 **Graph Search**

  * Instantly locate and highlight entities in the graph

* 📊 **Deep Intelligence Panel**

  * Rich, scrollable insights for each entity:

    * Description
    * Relationships
    * Global impact
    * Timeline
    * Key insights
    * Media (images)

* ⚡ **Real-Time Data Integration**

  * Uses global data sources to reflect current world scenarios

---

## 🏗️ Architecture

### 🔹 Frontend

* React + TypeScript (TSX)
* Graph rendering using `react-force-graph`
* Modular components:

  * GraphCanvas
  * QueryBar
  * GraphSearch
  * IntelligencePanel
  * Legend

### 🔹 Backend

* Node.js (Express)
* AI-powered graph extraction pipeline
* REST API endpoints

### 🔹 Data & Intelligence Layer

* LLM (AI reasoning and extraction)
* GDELT (global news & events)
* Wikipedia (entity enrichment)
* Neo4j (graph database)

---

## 📁 Project Structure

```
Palantir/
│
├── client/                 # Frontend
│   └── src/
│       ├── components/
│       │   ├── GraphCanvas.tsx
│       │   ├── GraphSearch.tsx
│       │   ├── IntelPanel.tsx
│       │   ├── Legend.tsx
│       │   ├── QueryBar.tsx
│       │   └── App.tsx
│       ├── main.tsx
│       ├── index.css
│       └── types.ts
│
├── src/                    # Backend
│   ├── routes/
│   │   └── graphRoutes.ts
│   ├── services/
│   │   ├── gdeltService.ts
│   │   ├── graphExtractor.ts
│   │   ├── neo4jService.ts
│   │   └── wikiService.ts
│   ├── utils/
│   ├── types/
│   └── server.ts
│
├── .env
├── package.json
└── tsconfig.json
```

---

## ⚙️ Installation & Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-username/knowledge-graph-system.git
cd knowledge-graph-system
```

---

### 2. Install Dependencies

```bash
npm install
cd client
npm install
```

---

### 3. Environment Variables

Create `.env` file in root:

```env
OPENAI_API_KEY=your_api_key_here
NEO4J_URI=your_neo4j_uri
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
```

---

### 4. Run Backend

```bash
npm run dev
```

---

### 5. Run Frontend

```bash
cd client
npm run dev
```

---

### 6. Open App

```
http://localhost:5173
```

---

## 🧪 Example Query

```
Impact of US-Iran conflict on global oil trade and economy
```

### Output:

* Interactive graph of entities
* Relationships between countries, organizations, events
* Expandable nodes
* Detailed intelligence panel

---

## 🧠 How It Works

1. User enters a query
2. Backend fetches contextual data (GDELT, Wikipedia)
3. AI extracts:

   * Entities (nodes)
   * Relationships (edges)
4. Data is normalized and validated
5. Graph is sent to frontend
6. UI renders interactive visualization

---

## 🔥 Future Enhancements

* 📡 Real-time streaming graph updates
* 🤖 Autonomous AI insights (Jarvis layer)
* 📊 Predictive analytics (future events)
* 🧠 Memory system (context-aware intelligence)
* 🌐 Multi-source validation engine

---

## ⚠️ Known Challenges

* AI-generated relationships may require validation
* Data consistency must be enforced (node IDs, edges)
* Large graphs may impact performance

---

## 🛠️ Tech Stack

* Frontend: React, TypeScript, Tailwind CSS
* Backend: Node.js, Express
* AI: OpenAI API
* Graph DB: Neo4j
* Data Sources: GDELT, Wikipedia

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

## 📄 License

MIT License

---

## 💡 Vision

This project is not just a visualization tool.

It is a step toward building a **global intelligence operating system** where users can:

* Understand complex world systems
* Explore relationships between entities
* Gain deep, AI-driven insights

---

**Built to explore the world as a connected system.**
