# 🌿 Jardín — Solar Garden OS

A self-hosted parametric garden layout, solar shadow projection, and seasonal bloom simulation engine. Designed to run on a Raspberry Pi or lightweight VM, manageable conversationally by a **Nous-Research Hermes agent** (or Claude/ChatGPT), and accessible through a modern web UI.

---

## ✨ Features

- **2.5D Top-Down Parametric Canvas**:
  - Unified coordinate space in meters with adjustable True North orientation.
  - Front garden and back garden planting beds with soil metadata.
  - Interactive pan and zoom controls.
- **Physical Structures & Solar Shadow Projection**:
  - **Own House**: Positioned between front and back garden, casting primary morning and afternoon shadows.
  - **Neighboring Houses**: Looms over boundary lines, casting long shadows across fences.
  - **Sheds & Garages**: Micro-climate shade corners in back yards.
  - **Fences & Walls**: Low-angle ground shadow casting.
  - **Trees**: Dappled, semi-transparent shade canopy.
  - Accurate solar azimuth and elevation calculated dynamically (`astral` + `shapely` vector math).
- **Cumulative Daily Sunlight Heatmap**:
  - Automatically integrates direct sun exposure hours across each bed.
  - Classifies planting zones: **Full Sun** ($\ge 6\text{h}$), **Partial Shade** ($3-6\text{h}$), and **Full Shade** ($< 3\text{h}$).
- **Seasonal Bloom Projection Timeline**:
  - Dual simulation: scrub time-of-day (06:00 to 21:00) for real-time shadows, and scrub months (Jan to Dec) to watch plants blossom with their active flower hex colors.
  - Interactive Gantt chart showing seasonal flowering overlaps and gaps.
- **Nous Hermes Agent & API-First**:
  - Built-in chat copilot with function calling to query sunlight, catalog species, place plants, or add sheds/fences.
  - OpenAPI 3.1 schema auto-generated at `/docs`.
  - Built-in **Model Context Protocol (MCP)** STDIO server for Claude Desktop, Hermes CLI, or Home Assistant Assist pipelines.
- **Ultra-Lightweight Self-Hosting**:
  - Single-container Docker build (<120MB RAM) with persistent SQLite storage.

---

## 🚀 Quickstart

### Option 1: Docker Compose (Recommended for Raspberry Pi & VM)

```bash
# Clone or navigate to the repository
cd jardin

# (Optional) Add your OpenRouter or Ollama API keys for Hermes in .env:
# LLM_API_KEY=your_key_here
# LLM_MODEL=nousresearch/hermes-3-llama-3.1-8b

docker compose up -d
```
Open **`http://<pi-ip-address>:8000`** in your browser!

---

### Option 2: Local Development (Mac / Linux)

#### 1. Backend (Python + FastAPI)
```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```
- API Docs & Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/v1/health`

#### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
- Web UI: `http://localhost:5173` (proxies `/api` directly to backend)

---

## 🤖 Connecting External Agents (Claude Desktop / Hermes via MCP)

To give **Claude Desktop** direct tool access to inspect and manage your garden:

Add this to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "jardin": {
      "command": "uv",
      "args": ["run", "python", "-m", "app.mcp_server"],
      "cwd": "/path/to/jardin/backend"
    }
  }
}
```

Now Claude or Hermes can directly execute:
- `get_garden_overview`: inspect boundary, beds, and buildings
- `get_bed_sunlight_analysis`: calculate sun hours for any date
- `get_bloom_calendar`: inspect flowering species per month
- `catalog_and_place_plant`: enrich botanical profiles and place plants
- `create_obstacle`: add houses, neighbor buildings, sheds, or trees

---

## 📐 Mathematical Ephemeris

- **Sun Position**:
  $$\theta = \text{Azimuth}(lat, lon, date, time), \quad \alpha = \text{Elevation}(lat, lon, date, time)$$
- **Shadow Cast Vector**:
  $$\text{Shadow Length } L = \frac{h}{\tan(\alpha)}$$
  $$\Delta x = L \cdot \sin(\theta_{\text{shadow}}), \quad \Delta y = -L \cdot \cos(\theta_{\text{shadow}})$$
- Ground shadow polygons are computed as the swept convex union of base vertices and projected top vertices using `shapely.ops.unary_union`.

---

## 📄 License
MIT
