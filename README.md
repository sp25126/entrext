# Entrext OS
### The Developer Perception Platform — Click Any Element. Capture Everything. Ship Better.

> A visual UI feedback platform that lets teams annotate live websites, capture component-level bugs, export structured developer-ready reports, and collaborate in real-time — all without leaving the browser.

---

## What Is Entrext?

Entrext bridges the gap between testers and developers. Instead of vague WhatsApp messages like *"the button is broken"*, testers Ctrl+Click any element on a live site, leave a contextual comment pinned to the exact CSS selector, and developers receive a structured Markdown report they can act on immediately.

**The core loop:**
```
Share a URL → Testers Ctrl+Click elements → Comments pinned to selectors → Export structured Markdown
```

---

## Current Status

> **Version:** 2.6 (Local MVP)
> **Environment:** Local Development
> **Stack:** Next.js 16 (Turbopack) + FastAPI + Supabase + PostgreSQL

---

## ✅ What Is Built & Working

### Platform (Web App)

#### 1. Project Creation
- Create a named project with a target URL and optional description
- Each project gets a unique `share_token` (16-char alphanumeric)
- Stored in Supabase PostgreSQL with UUID primary keys

#### 2. Smart Proxy Engine
- Proxies any public HTTP/HTTPS website through `GET /proxy?url=`
- Full SSRF protection — blocks `localhost`, `127.0.0.1`, `192.168.x.x`, `10.x.x.x`, `169.254.169.254` (AWS metadata)
- Strips security headers: `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`
- Rewrites all relative `href`, `src`, `action`, `srcset` attributes to absolute URLs
- Injects `overlay.js` + `html2canvas` into every proxied page automatically
- Returns `X-Proxy-Cache` and `X-Entrext-Status` response headers
- **Advanced Site Detection:** WebGL / Three.js / Spline sites return a clean fallback card instead of a broken render

#### 3. Overlay Engine (`public/overlay.js`)
- Injected into every proxied page as an isolated IIFE — zero global pollution
- `Ctrl` key activates feedback mode — floating badge + purple dashed hover outline appears
- Crash-proof `SelectorEngine` with 5-level waterfall:
  - `data-testid` / `data-cy` → `aria-label` → unique `#id` → semantic class → structural path
- `Ctrl+Click` captures: CSS selector, element label, tag name, X/Y position (%), page URL, html2canvas screenshot
- Sends `FEEDBACK_CLICK` postMessage to parent — never blocks if screenshot fails

#### 4. Marker System
- Numbered orbs (1, 2, 3...) rendered over the iframe at captured X/Y positions
- Framer Motion spring animation on marker appearance
- Three states: `pending` (white), `saved` (purple), `failed` (red)
- All markers persist in Zustand `overlayStore` for the session

#### 5. Comment System
- Command Center panel shows comment form when a marker is placed
- Captures: tester name (saved to `localStorage`), comment text, component selector, screenshot
- **Optimistic updates** — comment appears instantly in feed before API confirms
- On failure: comment marked red with retry state — never silently lost
- Stored in Supabase `comments` table with full metadata

#### 6. Command Center
- Draggable panel with Framer Motion spring physics
- Shows all comments for the active project
- Each card: selector chip, tester name, relative timestamp, screenshot thumbnail
- "Mark Resolved" — animated strikethrough, persists to DB

#### 7. Share Link System
- One-click share link generation: `localhost:3000/test/[share_token]`
- Anyone with the link can open the testing view — **no login required**
- Tester identity stored anonymously in `localStorage` (`tester_id`, `tester_name`)

#### 8. Markdown Export
- `GET /export?project_id=` returns structured Markdown
- Each issue includes: component selector, tester name, status, timestamp, comment text
- Copy to clipboard button with "Copied!" toast

#### 9. WebSocket Multiplayer (Backend Ready)
- `ws://localhost:8765/ws/project/{id}` endpoint live
- `ConnectionManager` handles rooms, connect/disconnect, broadcast
- Event types: `TESTER_JOINED`, `TESTER_LEFT`, `CURSOR_MOVE`, `MARKER_PLACED`, `TESTER_LEFT`, `SYNC`
- Frontend reconnection in progress

---

## 🗂 Project Structure

```
entrext/
├── backend/
│   ├── main.py              # Complete FastAPI app — all routes in one file
│   ├── .env                 # SUPABASE_URL + SUPABASE_KEY
│   ├── requirements.txt
│   └── venv/
│
├── src/
│   ├── app/
│   │   ├── projects/
│   │   │   ├── new/page.tsx     # Project creation form
│   │   │   └── page.tsx         # Projects dashboard
│   │   ├── project/[id]/
│   │   │   └── page.tsx         # Main testing view + postMessage listener
│   │   └── test/[token]/
│   │       └── page.tsx         # Public tester share view
│   ├── store/
│   │   ├── projectStore.ts      # Projects CRUD
│   │   ├── commentStore.ts      # Comments + optimistic updates
│   │   └── overlayStore.ts      # Markers, pending state, mode
│   ├── lib/
│   │   └── api.ts               # Single API client — all fetch calls here
│   └── components/
│       └── AdvancedSiteCard.tsx # WebGL/blocked site fallback UI
│
└── public/
    └── overlay.js           # Injected into every proxied page
```

---

## 🗄 Database Schema (Supabase)

```sql
-- Projects
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  target_url   TEXT NOT NULL,
  share_token  TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE comments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID REFERENCES projects(id) ON DELETE CASCADE,
  text                TEXT NOT NULL,
  component_selector  TEXT DEFAULT '',
  page_url            TEXT DEFAULT '',
  tester_name         TEXT DEFAULT 'Anonymous',
  screenshot_url      TEXT DEFAULT '',
  x                   FLOAT DEFAULT 0,
  y                   FLOAT DEFAULT 0,
  status              TEXT DEFAULT 'open',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ⚙️ API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/projects` | Create a project |
| `GET` | `/projects` | List all projects |
| `GET` | `/projects/by-id/{id}` | Get project by UUID |
| `GET` | `/projects/by-token/{token}` | Resolve share token (public) |
| `DELETE` | `/projects/{id}` | Delete a project |
| `POST` | `/comments` | Submit a comment |
| `GET` | `/comments/{project_id}` | Get all comments for project |
| `PATCH` | `/comments/{id}/resolve` | Resolve a comment |
| `GET` | `/export?project_id=` | Export Markdown report |
| `GET` | `/proxy?url=` | Proxy any public URL |
| `WS` | `/ws/project/{id}` | WebSocket room per project |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase project (free tier works)

### 1. Clone & Install

```bash
# Frontend
npm install

# Backend
cd backend
python -m venv venv
venv/Scripts/pip install fastapi uvicorn supabase httpx beautifulsoup4 lxml python-dotenv
```

### 2. Environment Variables

**`backend/.env`**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

**`.env.local`**
```env
NEXT_PUBLIC_API_BASE=http://localhost:8765
```

### 3. Database Setup

Run in Supabase SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  target_url TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  component_selector TEXT DEFAULT '',
  page_url TEXT DEFAULT '',
  tester_name TEXT DEFAULT 'Anonymous',
  screenshot_url TEXT DEFAULT '',
  x FLOAT DEFAULT 0,
  y FLOAT DEFAULT 0,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
```

### 4. Run

```bash
# Terminal 1 — Backend
cd backend
venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8765 --reload

# Terminal 2 — Frontend
npm run dev
```

Open `http://localhost:3000`

---

## 🔭 Future Plans

> Everything below is designed and architected — implementation is next.

### 🤖 AI Layer
- **AI Triage Engine** — Every comment auto-classified as `P0/P1/P2/P3` with severity, category, one-line summary, and suggested fix via Groq API (`llama-3.3-70b-versatile`, free tier)
- **Ghost Session Recorder** — Passive recording of tester interactions: clicks, scrolls, hesitations (3s+ hover), rage clicks (3x same element in 1.5s) — replayed as annotated timeline
- **Design System Enforcer** — Define your token system once; auto-flag any element violating your colors, fonts, or border radii

### 🔴 Real-Time Layer
- **Live Cursor Sync** — See other testers' cursors moving in real-time over the proxied page
- **Live Marker Broadcast** — New markers appear on all connected screens simultaneously with animation
- **Presence Bar** — Colored dots in the header showing who is actively reviewing

### 📤 Integrations
- **GitHub Issue Export** — Push all feedback directly to a GitHub repo as labeled Issues (P0 → `critical`, P1 → `bug`, P2 → `enhancement`)
- **Slack / Discord Webhook** — Notify team channels on new P0/P1 comments instantly

### 🔌 Entrext Lens (Browser Extension)
A standalone Chrome extension (Manifest V3) for sites that cannot be proxied (WebGL, 3D, strict CSP).

- **Ctrl+Click on any live site** — captures element styles, selector, screenshot
- **3-Pass LLM Pipeline** — Raw analysis → Refined prompt → Production React/Tailwind code skeleton
- **Full Page DNA Extractor** — Analyze entire page: color palette, typography scale, spacing unit, design language classification
- **Local LLM Support** — Connect your own Ollama instance via ngrok tunnel — 100% private, zero API costs
- **Component Memory Library** — Every captured component stored locally; similarity detection across sites
- **Accessibility X-Ray Mode** — WCAG contrast ratios, missing alt text, keyboard navigation path, touch target sizes
- **Prompt-to-Variation Pipeline** — Generate Dark Mode, Mobile-First, More Accessible, More Premium variations of any captured component

### 💰 Monetization (Planned)
| Plan | Price | Limits |
|------|-------|--------|
| Free | $0 | 3 projects, 50 comments/project, watermarked export |
| Pro | $12/mo | Unlimited projects, AI triage, GitHub export |
| Team | $29/mo | Multiplayer, session recorder, priority support |
| Enterprise | Custom | SSO, self-hosted, SLA |

---

## 🏗 Architecture Vision (Full Entrext OS)

```
Entrext Platform (web)           Entrext Lens (extension)
        ↕                                  ↕
   Shared Project DB ←→ Real-time WebSocket Bridge ←→ Local Ollama LLM
        ↕                                  ↕
   Team Feedback OS              Personal Component Library
```

---

## Known Limitations (Current MVP)

- WebGL / Three.js / Spline sites cannot be proxied — use extension (coming soon)
- Sites with strict `X-Frame-Options` may show broken renders
- No authentication — all projects are public by project ID (fine for MVP)
- WebSocket multiplayer backend is live but frontend sync is in progress
- AI triage columns exist in schema but pipeline not yet connected

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, Turbopack) |
| Styling | Tailwind CSS + Framer Motion |
| State | Zustand |
| Backend | FastAPI (Python 3.11) |
| Database | Supabase (PostgreSQL) |
| Proxy | httpx + BeautifulSoup4 (lxml) |
| Real-time | FastAPI WebSockets |
| Overlay | Vanilla JS IIFE (zero dependencies) |
| Screenshot | html2canvas (CDN) |

---

## License

MIT — build freely, ship fast.

---

*Built in Ahmedabad, India 🇮🇳 — Entrext OS v2.6*
