# Strategic Airspace & Maritime Intelligence Engine

A real-time, high-fidelity surveillance platform designed for strategic airspace and maritime tracking. This dashboard integrates live data from global feeds (OpenSky, AISStream) into a tactical, analyst-grade interface.

## 🌟 Key Features
- **Global Asset Tracking**: Live monitoring of aircraft, satellites, and maritime vessels.
- **Intelligence Heuristics**: Automated classification of civilian, military, and suspicious behavior.
- **Tactical Visuals**: High-performance globe rendering with trajectory prediction and historical pathing.
- **Secure Architecture**: Environment-based secret management for API keys.
- **ANVAY Integration**: Direct hooks for geopolitical and strategic intelligence analysis.

---

## 🚀 Getting Started

Follow these steps to set up and run the project on your local machine.

### 📋 Prerequisites
- **Node.js**: [Download and install](https://nodejs.org/) (v16+ recommended).
- **Git**: [Download and install](https://git-scm.com/).
- **AISStream API Key**: Sign up at [aisstream.io](https://aisstream.io/) to get a free API key for maritime data.

### 🛠️ Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/HRSHL14/drishti-map.git
   cd drishti-map
   ```

2. **Install Frontend Dependencies**
   In the root directory:
   ```bash
   npm install
   ```

3. **Install Backend Dependencies**
   Navigate to the server directory:
   ```bash
   cd server
   npm install
   ```

4. **Configure Environment Variables**
   Inside the `server/` directory, create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and insert your AISStream API key:
   ```env
   AIS_API_KEY=your_actual_key_here
   PORT=4000
   ```

### 📡 Running the Platform

To run the full system, you need to start the **Backend Server** and the **Vite Frontend** concurrently.

#### 1. Start the Backend (Maritime/Satellite Proxy)
In the `server/` directory:
```bash
npm start
```

#### 2. Start the Frontend (Vite Dashboard)
In the **root** directory (open a new terminal):
```bash
npm run dev
```

The application should now be accessible at `http://localhost:5173`.

---

## 🛡️ Security Note
This project uses `.gitignore` to prevent sensitive credentials in `.env` from being committed to version control. Always use `.env.example` as a template for new deployments.

## 🔗 Project Context
Built as part of the **Strategic Intelligence Platform** ecosystem for real-time geopolitical monitoring.
