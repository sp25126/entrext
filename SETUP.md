# Entrext Setup Guide

Follow these steps to initialize your local development environment.

## 1. Prerequisites

- **Python**: 3.11+
- **Node.js**: 20+
- **Database**: A Supabase account and project.

## 2. Database Schema

Run the following SQL in your Supabase SQL Editor to initialize the necessary tables:

```sql
-- 1. Projects Table
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    target_url TEXT NOT NULL,
    share_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Comments Table
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    component_selector TEXT,
    page_url TEXT,
    tester_name TEXT DEFAULT 'Anonymous',
    screenshot_url TEXT,
    x FLOAT DEFAULT 0,
    y FLOAT DEFAULT 0,
    status TEXT DEFAULT 'open', -- 'open' | 'resolved'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Realtime for peer-sync (Optional if using Supabase Realtime)
-- alter publication supabase_realtime add table projects, comments;
```

## 3. Configuration

1. **Backend**:
   - Navigate to `/backend`.
   - Copy `.env.example` to `.env`.
   - Fill in your `SUPABASE_URL` and `SUPABASE_KEY`.
   - Run `python -m venv venv` and `venv/Scripts/pip install -r requirements.txt`.

2. **Frontend**:
   - Navigate to `/web`.
   - Copy `.env.example` to `.env.local`.
   - Fill in your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Run `npm install`.

## 4. Launch

From the root directory, run:
```bash
python run_app.py
```

---

## ⚡ The Director's Prompt (For AI Developers)

If you are handing this project over to an AI agent (like Antigravity or similar), paste the following prompt to context-load it immediately:

> **PROMPT:**
> "I am working on Entrext, an 'indestructible' feedback engine for web auditing. The tech stack is Next.js (Turbo), FastAPI, and Supabase. The core innovation is a **Header-Driven Proxy Detection system** (see `backend/main.py`) that handles WebGL/3D site fallback via a status-signaling engine.
> 
> Key Architectural Points:
> - **State Management**: Zustand stores are located in `web/src/store/`. Realtime peer cursors are orchestrated via WebSockets in `page.tsx`.
> - **Proxy Engine**: The `/proxy` endpoint in `main.py` rewrites assets and injects `overlay.js` while scanning for Three.js/Spline to set the `X-Entrext-Status` header.
> - **Selector Logic**: `web/public/overlay.js` uses a defensive, attribute-first algorithm (avoiding `dataset`) to ensure SVGs and Shadow DOM elements don't crash the engine.
> 
> My goal is to maintain the 'Indestructible MVP' philosophy: focus on technical resilience, premium design aesthetics, and a crash-proof audit tunnel. Please audit the repository structure and proceed based on my next request."

---
