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

## ✅ What Is Built & Working (Prototype Status)

### 🛠️ The Substrate
- **Smart Proxy Engine (Hardened)**: Rewrites websites on-the-fly, neutralizes CORS/CSP, and injects our audit layers securely. Now with full **SSRF Protection** and URL sanitization.
- **WebSocket Hub**: Real-time bidirectional synchronization. Cursors, markers, and comments appear on all peers instantly without page refreshes.
- **AI Triage Layer**: Background classification of every piece of feedback using **Llama 3**. Auto-assigns severity (P0-P3), categories, and suggested fixes.

### ✏️ Annotation & Feedback
- **Indestructible Overlay**: `Ctrl+Click` any element. Captures CSS Selectors, XPaths, Screen coordinates (%), and full DOM context.
- **Multimodal Capture**: Automatic high-fidelity screenshots associated with every marker.
- **Command Center**: A draggable, real-time interface for managing audits, resolving issues, and viewing AI insights.

### 🔗 Collaboration & Sharing
- **Secure Share Links**: Generate unique links for clients/QA.
- **Role-Based Access**: Assign `tester`, `reviewer`, or `viewer` roles per link.
- **Security Gates**: Optional passwords, usage limits, and expiration dates for every shareable session.
- **Tester Onboarding**: A beautiful, zero-barrier landing page—testers enter their name and start annotating in seconds.

### 📊 Data & Handoff
- **Structural Export**: One-click generation of **Markdown, JSON, or CSV** reports.
- **AI-Summarized Triage**: Every export includes an action plan prioritized by urgency and impact.

---

## 🗂 Project Structure
```text
entrext/
├── backend/
│   ├── main.py              # FastAPI Core (Real-time Hub & Proxy)
│   ├── schemas.py           # Pydantic hard-validation layer
│   ├── export_engine.py     # Multi-format report generation
│   ├── logger.py            # Redacted secure logging
│   └── .env                 # Substrate credentials
├── web/
│   ├── src/app/             # Next.js 16 (App Router)
│   ├── src/store/           # Zustand State (Real-time shared state)
│   └── public/overlay.js    # Injected Audit Shell
```

---

## 🗄️ Database Schema (Supabase)
```sql
-- Required: uuid-ossp extension
CREATE TABLE projects ( ... );
CREATE TABLE comments ( ... );
CREATE TABLE share_links ( ... ); -- New: secure access management
```

---

## 🔭 Future Plans (The Roadmap)
> **Note:** Core workflow is complete. Next phases focus on scalability and mobile.

### 🔴 Visual Fidelity
- **Session Replay** — Native recording of the DOM tree to allow "time-travel" debugging of CSS glitches.
- **Mobile Mirroring** — Sync mobile audit sessions directly to your desktop Command Center via QR code.

### 🔌 Entrext Lens (Extension)
- Standalone browser extension for sites that block iframes or use heavy Canvas/WebGL renders.

---

## ⚖️ License
MIT — build freely, ship fast.

---

*Built for the next generation of builders — Ahmedabad, India 🇮🇳 — Entrext Prototype v3.0*

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
