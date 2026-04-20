import os
import json
import secrets
import asyncio
import uuid
import logging
import hashlib
from typing import List, Dict, Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request, Response, BackgroundTasks, Body
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import httpx
from bs4 import BeautifulSoup
from fastapi.responses import HTMLResponse, FileResponse
from urllib.parse import urlparse, urljoin, quote
import socket, ipaddress

from .config import settings
from .logger import logger
from .errors import AppError, app_error_handler, validation_error_handler, unhandled_exception_handler
from .schemas import (
    ProjectCreate, ProjectResponse, CommentCreate, 
    CommentResponse, ShareLinkCreate, ShareLinkResponse, 
    ShareTokenResolveRequest
)
from .ratelimit import check_rate_limit, rate_limit
from datetime import timezone

# ─── Infrastructure Initialization ──────────────────────────────────────────
app = FastAPI(
    title="Entrext API",
    version="2.1.0",
    docs_url="/docs" if os.environ.get("ENV") != "production" else None
)

# Database Substrate
db: Client = create_client(settings.supabase_url, settings.supabase_key)

# ─── Proxy Infrastructure (Phase 4) ─────────────────────────────────────────
BLOCKED_IPS   = {"169.254.169.254"}
FRONTEND_BASE = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
BACKEND_URL   = os.environ.get("BACKEND_URL", "http://localhost:8765")

def ssrf_check(url: str):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise AppError("INVALID_SCHEME", "Only http/https URLs are allowed", 400)
    host = parsed.hostname or ""
    try:
        ip_str = socket.gethostbyname(host)
    except socket.gaierror:
        raise AppError("DNS_FAILED", "Could not resolve host", 400)
    ip = ipaddress.ip_address(ip_str)
    if ip.is_private or ip.is_loopback or ip.is_multicast or ip.is_reserved or ip_str in BLOCKED_IPS:
        raise AppError("SSRF_BLOCKED", "Target URL is not allowed", 400)

# Real-time Synchronization Hub
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, project_id: str, websocket: WebSocket):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)
        logger.info(f"[WS] Peer joined project={project_id}. Total={len(self.active_connections[project_id])}")

    def disconnect(self, project_id: str, websocket: WebSocket):
        if project_id in self.active_connections:
            if websocket in self.active_connections[project_id]:
                self.active_connections[project_id].remove(websocket)
                logger.info(f"[WS] Peer left project={project_id}")

    async def broadcast(self, project_id: str, message: dict, exclude: Optional[WebSocket] = None):
        if project_id in self.active_connections:
            dead_links = []
            for connection in self.active_connections[project_id]:
                if connection == exclude: continue
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_links.append(connection)
            
            for dead in dead_links:
                self.disconnect(project_id, dead)

manager = ConnectionManager()

# ─── Error Handling Substrate ────────────────────────────────────────────────
from fastapi.exceptions import RequestValidationError
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health():
    """Validates connectivity without leaking internals."""
    try:
        db.table("projects").select("id").limit(1).execute()
        return {"status": "ok", "db_connected": True}
    except Exception as e:
        logger.error(f"Health check failure: {str(e)}")
        return {"status": "degraded", "db_connected": False}

# ─── Projects (Auth-less Production) ──────────────────────────────────────────
@app.post("/projects/", status_code=201, response_model=ProjectResponse, dependencies=[Depends(rate_limit(10, 60))])
def create_project(b: ProjectCreate):
    try:
        r = db.table("projects").insert({
            "name": b.name,
            "description": b.description,
            "target_url": str(b.target_url),
            "share_token": secrets.token_urlsafe(12),
        }).execute()
        if not r.data: raise AppError("DB_FAILED", "Could not save project", 500)
        return r.data[0]
    except Exception as e:
        logger.error(f"Project creation failed: {str(e)}")
        raise AppError("DB_FAILED", "Internal database error", 500)

@app.get("/projects/", response_model=List[ProjectResponse])
def list_projects():
    return db.table("projects").select("*").order("created_at", desc=True).execute().data

@app.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str):
    try:
        r = db.table("projects").select("*").eq("id", project_id).single().execute()
        if not r.data:
            raise AppError("NOT_FOUND", "Project not found", 404)
        return r.data
    except AppError: raise
    except Exception: raise AppError("DB_FAILED", "Retrieval failed", 500)

@app.get("/projects/by-id/{project_id}/", response_model=ProjectResponse)
def get_project_alias(project_id: str):
    return get_project(project_id)

@app.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str):
    try:
        db.table("projects").delete().eq("id", project_id).execute()
        return Response(status_code=204)
    except Exception as e:
        logger.error(f"Deletion failed {project_id}: {str(e)}")
        raise AppError("DB_FAILED", "Deletion error", 500)

# ─── Real-time Engine ─────────────────────────────────────────────────────────
@app.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    try:
        uuid.UUID(project_id)
    except ValueError:
        await websocket.close(code=4000)
        return

    await manager.connect(project_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                await manager.broadcast(project_id, msg, exclude=websocket)
            except json.JSONDecodeError:
                pass 
    except WebSocketDisconnect:
        manager.disconnect(project_id, websocket)
    except Exception:
        manager.disconnect(project_id, websocket)

# ─── Comments ────────────────────────────────────────────────────────────────
@app.post("/comments", status_code=201, response_model=CommentResponse)
async def create_comment(b: CommentCreate, request: Request, background_tasks: BackgroundTasks):
    check_rate_limit(request, "create_comment")

    # Validate project_id is a proper UUID format
    try:
        uuid.UUID(b.project_id)
    except ValueError:
        raise AppError("INVALID_UUID", f"Project ID '{b.project_id}' is not a valid UUID format", 400)

    # Verify project exists — returns clean 404 instead of DB constraint error
    proj = db.table("projects").select("id").eq("id", b.project_id).execute()
    if not proj.data:
        raise AppError("NOT_FOUND", f"Project {b.project_id} not found", 404)

    # Cause C — screenshot_url safety (don't choke DB with huge base64)
    screenshot = b.screenshot_url
    if screenshot and screenshot.startswith('data:image') and len(screenshot) > 500_000:
        logger.warning(f"[comments] screenshot_url truncated — was {len(screenshot)} chars")
        screenshot = screenshot[:100] + "...[truncated]"

    insert = {
        "project_id":         b.project_id,
        "text":               b.text.strip(),
        "component_selector": b.component_selector or "",
        "xpath":              b.xpath or "",
        "tag_name":           b.tag_name or "",
        "inner_text":         b.inner_text or "",
        "page_url":           b.page_url or "/",
        "tester_name":        b.tester_name or "Anonymous",
        "x":                  b.x or 0,
        "y":                  b.y or 0,
        "marker_number":      b.marker_number or 0,
        "screenshot_url":     screenshot, # Use sanitized version
        "severity":           None,
        "status":             "open",
    }

    try:
        r = db.table("comments").insert(insert).execute()
        if not r.data:
            raise Exception("Insert returned empty data — possible RLS block or missing column")
    except Exception as e:
        err_str = str(e)
        logger.error(f"[DB ERROR] Full Report: {err_str}")
        # Return full error to frontend temporarily for hardening diagnostic
        raise AppError("DB_ERROR", f"Substrate write failed: {err_str}", 500)

    comment = r.data[0]

    # Broadcast + AI triage in background
    background_tasks.add_task(
        manager.broadcast,
        b.project_id,
        {"type": "NEW_COMMENT", "comment": comment}
    )
    background_tasks.add_task(run_ai_triage, comment["id"], b.text, b.project_id)

    return comment


async def run_ai_triage(comment_id: str, text: str, project_id: str):
    """Classify severity, update DB, then broadcast the update."""
    try:
        import os, httpx
        groq_key = os.environ.get("GROQ_API_KEY", "")
        if not groq_key:
            severity = "P2"  # default if no AI key
        else:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                    json={
                        "model": "llama3-8b-8192",
                        "messages": [{
                            "role": "user",
                            "content": (
                                f"Classify this UI bug report as P0 (critical/crash), "
                                f"P1 (major), P2 (minor), or P3 (cosmetic). "
                                f"Reply with ONLY the label, nothing else.\n\nFeedback: {text}"
                            )
                        }],
                        "max_tokens": 5,
                        "temperature": 0,
                    }
                )
            severity = resp.json()["choices"][0]["message"]["content"].strip()
            if severity not in ("P0","P1","P2","P3"):
                severity = "P2"

        # Update DB
        db.table("comments").update({"severity": severity}).eq("id", comment_id).execute()

        # Broadcast severity update to all clients
        await manager.broadcast(
            project_id,
            {"type": "COMMENT_TRIAGED", "comment_id": comment_id, "severity": severity}
        )
    except Exception as e:
        logger.warning(f"AI triage failed: {type(e).__name__}")

@app.get("/comments/{project_id}/", response_model=List[CommentResponse])
def get_comments(project_id: str):
    return db.table("comments").select("*").eq("project_id", project_id).order("created_at", desc=True).execute().data

# ─── Sharing Substrate ────────────────────────────────────────────────────────
from pydantic import BaseModel, Field
from typing import Literal

# Note: define models here if not imported from schemas to avoid drift
class ShareLinkCreate(BaseModel):
    label: str = Field(default="Shared Link", max_length=60)
    role: Literal["tester", "reviewer", "viewer"] = "tester"
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365)
    max_uses: Optional[int] = Field(default=None, ge=1, le=10000)
    password: Optional[str] = Field(default=None, max_length=100)

class ShareLinkOut(BaseModel):
    id: str
    project_id: str
    token: str
    label: str
    role: str
    expires_at: Optional[str]
    max_uses: Optional[int]
    use_count: int
    is_active: bool
    created_at: str
    share_url: str

def build_share_url(token: str) -> str:
    base = settings.frontend_url or "http://localhost:3000"
    return f"{base.rstrip('/')}/t/{token}"

def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

@app.get("/projects/{project_id}/share-links", response_model=List[ShareLinkOut])
def list_share_links(project_id: str):
    # Validate UUID format before DB query
    try:
        uuid.UUID(project_id)
    except ValueError:
        raise AppError("INVALID_UUID", f"'{project_id}' is not a valid UUID format", 400)

    try:
        r = db.table("share_links").select("*").eq("project_id", project_id).order("created_at", desc=True).execute()
        return [
            {**link, "share_url": build_share_url(link["token"])}
            for link in (r.data or [])
        ]
    except Exception as e:
        logger.warning(f"[DB_FALLBACK] Share-links list failed: {str(e)}")
        # Check if it's a migration error
        if "share_links" in str(e):
             raise AppError("MIGRATION_REQUIRED", "Table 'share_links' not found. Run SQL migration.", 412)
        return []

@app.post("/projects/{project_id}/share-links", response_model=ShareLinkOut, status_code=201, dependencies=[Depends(rate_limit(5, 60))])
def create_share_link(project_id: str, body: ShareLinkCreate):
    # Validate UUID format before DB query
    try:
        uuid.UUID(project_id)
    except ValueError:
        raise AppError("INVALID_UUID", f"'{project_id}' is not a valid UUID format", 400)

    # Verify project exists
    try:
        p = db.table("projects").select("id").eq("id", project_id).execute()
        if not p.data:
            raise AppError("NOT_FOUND", "Project not found", 404)
    except Exception as e:
        logger.error(f"Project check failed: {str(e)}")
        raise AppError("DB_ERROR", "Could not verify project existence", 500)

    expires_at = None
    if body.expires_in_days:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)).isoformat()

    password_hash = None
    if body.password:
        password_hash = hash_password(body.password)

    token = secrets.token_urlsafe(20)

    insert_data = {
        "project_id": project_id,
        "token": token,
        "label": body.label,
        "role": body.role,
        "expires_at": expires_at,
        "max_uses": body.max_uses,
        "use_count": 0,
        "is_active": True,
        "password_hash": password_hash,
    }

    try:
        r = db.table("share_links").insert(insert_data).execute()
        if not r.data:
            raise AppError("DB_FAILED", "Insert returned no data", 500)
        link = r.data[0]
        return {**link, "share_url": build_share_url(link["token"])}
    except Exception as e:
        logger.warning(f"Share-link creation failed: {str(e)}")
        if "share_links" in str(e):
            raise AppError("MIGRATION_REQUIRED", "Table 'share_links' not found. Run SQL migration.", 412)
        raise AppError("DB_ERROR", f"Could not create share link: {str(e)}", 500)

@app.delete("/projects/{project_id}/share-links/{link_id}", status_code=200)
def revoke_share_link(project_id: str, link_id: str):
    try:
        db.table("share_links").update({"is_active": False}).eq("id", link_id).eq("project_id", project_id).execute()
        return {"status": "revoked", "id": link_id}
    except Exception as e:
        logger.warning(f"[MIGRATION_REQUIRED] Revovation failed: {str(e)}")
        raise AppError("MIGRATION_REQUIRED", "Table 'share_links' not found. Please run the SQL migration in Supabase.", 412)

class TokenResolveBody(BaseModel):
    password: Optional[str] = None

class PublicTokenResponse(BaseModel):
    project_id: str
    project_name: str
    project_description: Optional[str]
    target_url: str
    role: str
    token: str

@app.post("/resolve-token/{token}")
def resolve_token(token: str, body: dict = Body(default={})):
    # Use limit(1) instead of .single() — .single() throws on missing rows in some postgrest versions
    try:
        r = (
            db.table("share_links")
            .select("*, projects(id, name, description, target_url)")
            .eq("token", token)
            .limit(1)
            .execute()
        )
    except Exception as e:
        err_str = str(e)
        logger.warning(f"[resolve_token] DB error: {err_str}")
        if "share_links" in err_str or "PGRST205" in err_str:
            raise AppError("MIGRATION_REQUIRED", "Please run the share_links SQL migration", 412)
        raise AppError("not_found", "Invalid link", 404)

    if not r.data:
        raise AppError("not_found", "Link not found", 404)

    link    = r.data[0]
    project = link.get("projects") or {}

    if not link.get("is_active", False):
        raise AppError("link_revoked", "This link has been revoked by the owner", 410)

    if link.get("expires_at"):
        try:
            exp = datetime.fromisoformat(link["expires_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > exp:
                raise AppError("link_expired", "This link has expired", 410)
        except AppError:
            raise
        except Exception:
            pass  # Malformed date — allow through

    if link.get("max_uses") and link.get("use_count", 0) >= link["max_uses"]:
        raise AppError("link_exhausted", "This link has reached its usage limit", 410)

    if link.get("password_hash"):
        pw = body.get("password") or ""
        if not pw:
            raise AppError("password_required", "This link requires a password", 401)
        if hashlib.sha256(pw.encode()).hexdigest() != link["password_hash"]:
            raise AppError("wrong_password", "Incorrect password", 401)

    # Increment use count
    try:
        db.table("share_links").update(
            {"use_count": link.get("use_count", 0) + 1}
        ).eq("id", link["id"]).execute()
    except Exception:
        pass  # Non-fatal — don't block the tester from entering

    return {
        "project_id":          project.get("id"),
        "project_name":        project.get("name") or "Untitled Project",
        "project_description": project.get("description") or "",
        "target_url":          project.get("target_url") or "",
        "role":                link.get("role") or "tester",
        "token":               token,
        "is_active":           True,
    }

# ─── Proxy & Overlay Substrate (Phase 4) ────────────────────────────────────

@app.get("/proxy")
async def proxy(
    url: str,
    project_id: str = "",   # passed so overlay.js knows which project
    response: Response = None
):
    if not url:
        raise AppError("MISSING_URL", "url query param is required", 400)

    ssrf_check(url)

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=10.0,
            headers={"User-Agent": "Mozilla/5.0 (Entrext Proxy)"}
        ) as client:
            upstream = await client.get(url)
    except httpx.TimeoutException:
        raise AppError("PROXY_TIMEOUT", "Target site did not respond in time", 504)
    except Exception as e:
        raise AppError("PROXY_ERROR", f"Could not fetch target site", 502)

    content_type = upstream.headers.get("content-type", "")
    if "text/html" not in content_type:
        # Non-HTML asset — return as-is (CSS, JS, images)
        return Response(
            content=upstream.content,
            media_type=content_type,
            headers={"X-Proxy-Status": "passthrough"}
        )

    # ── DOM transformation ──────────────────────────────────────────────────
    soup = BeautifulSoup(upstream.text, "lxml")
    base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"

    # Rewrite all relative URLs to absolute
    for tag, attr in [("a","href"),("link","href"),("script","src"),
                       ("img","src"),("form","action"),("source","src")]:
        for el in soup.find_all(tag, **{attr: True}):
            val = el[attr]
            if val.startswith(("http://","https://","data:","#","javascript:")):
                continue
            el[attr] = urljoin(base, val)

    # Remove X-Frame-Options and CSP meta tags that block iframe
    for meta in soup.find_all("meta"):
        http_equiv = (meta.get("http-equiv") or "").lower()
        if "x-frame-options" in http_equiv or "content-security-policy" in http_equiv:
            meta.decompose()

    # ── Bridge injection — overlay.js served by Next.js frontend ───────────
    # Pass projectId and apiBase as data attributes so overlay.js knows them
    bridge = soup.new_tag("script")
    bridge["src"]          = f"{FRONTEND_BASE}/overlay.js"
    bridge["data-project"] = project_id
    bridge["data-api"]     = BACKEND_URL
    bridge["defer"]        = True

    body = soup.find("body")
    if body:
        body.append(bridge)
    else:
        soup.append(bridge)

    return HTMLResponse(
        content=str(soup),
        headers={
            "X-Proxy-Status":            "ok",
            "X-Proxy-Origin":            base,
            "Access-Control-Allow-Origin": "*",
        }
    )

# ─── Data Persistence & Export (Phase 5) ────────────────────────────────────

from .export_engine import build_report

@app.get("/export")
async def export_project(project_id: str, format: str = "markdown"):
    print(f"[Export] Received project_id={project_id!r} format={format!r}")

    # Fetch project
    proj = db.table("projects").select("*").eq("id", project_id).execute()
    print(f"[Export] Project found: {bool(proj.data)}")
    if not proj.data:
        raise AppError("NOT_FOUND", "Project not found", 404)
    
    project = proj.data[0]

    # Fetch all comments
    all_comments = db.table("comments").select("*").eq("project_id", project_id).execute()
    comments = all_comments.data or []
    print(f"[Export] Comments count: {len(comments)}")

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    open_issues     = [c for c in comments if c.get("status","open") == "open"]
    resolved_issues = [c for c in comments if c.get("status","open") == "resolved"]

    # ─────────────────────────────────────────────────────────────────────────
    # MARKDOWN
    # ─────────────────────────────────────────────────────────────────────────
    if format == "markdown":
        SEV_ICON = {"P0":"🔴","P1":"🟠","P2":"🟡","P3":"⚪"}

        def comment_block(c: dict, idx: int) -> str:
            sev      = c.get("severity") or "P2"
            status   = c.get("status", "open")
            selector = c.get("component_selector") or c.get("xpath") or "unknown"
            tester   = c.get("tester_name") or "Anonymous"
            page     = c.get("page_url") or "/"
            tag      = c.get("tag_name") or ""
            text     = c.get("text") or ""
            created  = (c.get("created_at") or "")[:19].replace("T"," ")

            lines = [
                f"### Issue #{idx} — {SEV_ICON.get(sev,'⚪')} {sev} {'✅ Resolved' if status == 'resolved' else '🔴 Open'}",
                "",
                f"| Field | Value |",
                f"|-------|-------|",
                f"| **Component** | `{selector}` |",
                f"| **Tag** | `{tag}` |",
                f"| **Page** | `{page}` |",
                f"| **Tester** | {tester} |",
                f"| **Reported** | {created} |",
                f"| **Priority** | {sev} |",
                f"| **Status** | {status.capitalize()} |",
                "",
                f"**Feedback:**",
                f"> {text}",
                "",
            ]

            if c.get("inner_text"):
                lines.insert(-1, f"**Element text:** `{c['inner_text'][:100]}`")
                lines.insert(-1, "")

            return "\n".join(lines)

        md = [
            f"# Entrext Feedback Report",
            f"## {project.get('name','Untitled Project')}",
            "",
            f"| | |",
            f"|---|---|",
            f"| **Target URL** | {project.get('target_url','')} |",
            f"| **Exported** | {ts} |",
            f"| **Total Issues** | {len(comments)} |",
            f"| **Open** | {len(open_issues)} |",
            f"| **Resolved** | {len(resolved_issues)} |",
            "",
            "---",
            "",
        ]

        if open_issues:
            md.append("## 🔴 Open Issues\n")
            for i, c in enumerate(open_issues, 1):
                md.append(comment_block(c, i))

        if resolved_issues:
            md.append("## ✅ Resolved Issues\n")
            for i, c in enumerate(resolved_issues, 1):
                md.append(comment_block(c, i))

        if not comments:
            md.append("_No feedback has been submitted yet._\n")

        md += [
            "---",
            f"_Generated by Entrext · {ts}_",
        ]

        content = "\n".join(md)
        filename = f"entrext-{project.get('name','export').replace(' ','-').lower()}-{project_id[:8]}.md"
        return Response(
            content=content,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    # ─────────────────────────────────────────────────────────────────────────
    # JSON
    # ─────────────────────────────────────────────────────────────────────────
    if format == "json":
        import json as json_lib
        payload = {
            "meta": {
                "exported_at":    ts,
                "project_id":     project.get("id"),
                "project_name":   project.get("name"),
                "target_url":     project.get("target_url"),
                "total_issues":   len(comments),
                "open_issues":    len(open_issues),
                "resolved_issues": len(resolved_issues),
            },
            "issues": [
                {
                    "id":                 c.get("id"),
                    "number":             i + 1,
                    "text":               c.get("text",""),
                    "component_selector": c.get("component_selector",""),
                    "xpath":              c.get("xpath",""),
                    "tag_name":           c.get("tag_name",""),
                    "inner_text":         c.get("inner_text",""),
                    "page_url":           c.get("page_url",""),
                    "tester_name":        c.get("tester_name","Anonymous"),
                    "severity":           c.get("severity","P2"),
                    "status":             c.get("status","open"),
                    "x":                  c.get("x",0),
                    "y":                  c.get("y",0),
                    "marker_number":      c.get("marker_number",0),
                    "screenshot_url":     c.get("screenshot_url"),
                    "created_at":         c.get("created_at",""),
                }
                for i, c in enumerate(comments)
            ]
        }
        filename = f"entrext-{project_id[:8]}.json"
        return Response(
            content=json_lib.dumps(payload, indent=2, ensure_ascii=False),
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    # ─────────────────────────────────────────────────────────────────────────
    # CSV
    # ─────────────────────────────────────────────────────────────────────────
    if format == "csv":
        import csv, io
        buf = io.StringIO()
        FIELDS = [
            "number","text","component_selector","xpath","tag_name",
            "inner_text","page_url","tester_name","severity",
            "status","x","y","marker_number","created_at"
        ]
        writer = csv.DictWriter(buf, fieldnames=FIELDS, extrasaction='ignore')
        writer.writeheader()
        for i, c in enumerate(comments):
            writer.writerow({
                "number":             i + 1,
                "text":               c.get("text",""),
                "component_selector": c.get("component_selector",""),
                "xpath":              c.get("xpath",""),
                "tag_name":           c.get("tag_name",""),
                "inner_text":         c.get("inner_text",""),
                "page_url":           c.get("page_url",""),
                "tester_name":        c.get("tester_name","Anonymous"),
                "severity":           c.get("severity","P2"),
                "status":             c.get("status","open"),
                "x":                  c.get("x",0),
                "y":                  c.get("y",0),
                "marker_number":      c.get("marker_number",0),
                "created_at":         (c.get("created_at",""))[:19],
            })
        filename = f"entrext-{project_id[:8]}.csv"
        return Response(
            content=buf.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    raise AppError("INVALID_FORMAT", "format must be markdown, json, or csv", 400)
