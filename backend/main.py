import os, uuid, socket, ipaddress, json, asyncio
from datetime import datetime, timezone
from time import time
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse
from contextlib import asynccontextmanager
from supabase import create_client
import httpx
from bs4 import BeautifulSoup
from schemas import (
    ProjectCreate, ProjectResponse, PublicProjectResponse, 
    CommentCreate, CommentResponse, HealthResponse
)
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from pydantic import BaseModel, Field

from export_engine import build_report
from github_export import push_to_github

load_dotenv()

# ─── WebSocket Manager (Hardened) ─────────────────────────────────────────────
class Manager:
    def __init__(self):
        self.rooms: dict[str, dict] = {}
        
    async def connect(self, ws: WebSocket, room: str, tid: str, name: str):
        await ws.accept()
        self.rooms.setdefault(room, {})[tid] = {
            "ws": ws,
            "name": name,
            "connected_at": time(),
            "last_ping": time()
        }
    
    def disconnect(self, room: str, tid: str):
        room_data = self.rooms.get(room, {})
        room_data.pop(tid, None)
        if not room_data and room in self.rooms:
            del self.rooms[room]
            
    async def broadcast(self, room: str, msg: dict, exclude: str = None):
        dead = []
        payload = json.dumps(msg)
        
        # Enforce max message size: 64KB to prevent OOM
        if len(payload) > 65536:
            print(f"[WS] Message too large ({len(payload)} bytes) — skipped")
            return

        for tid, c in list(self.rooms.get(room, {}).items()):
            if tid == exclude: continue
            try:
                await c["ws"].send_text(payload)
            except Exception:
                dead.append(tid)
        
        for tid in dead:
            self.disconnect(room, tid)

    async def ping_all(self):
        """Send ping to all connections. Prune dead ones."""
        dead = []
        for room, testers in list(self.rooms.items()):
            for tid, c in list(testers.items()):
                try:
                    await c["ws"].send_json({"type": "PING", "ts": time()})
                    c["last_ping"] = time()
                except Exception:
                    dead.append((room, tid))
        for r, t in dead:
            self.disconnect(r, t)

    def testers(self, room: str) -> list:
        return [{"id": tid, "name": c["name"]} for tid, c in self.rooms.get(room, {}).items()]

ws_manager = Manager()

# ─── Lifespan Tasks ────────────────────────────────────────────────────────────
async def cleanup_rate_limit_windows():
    """Runs every 5 minutes, removes all expired rate limit windows"""
    while True:
        await asyncio.sleep(300)
        _windows = get_windows()
        now = time()
        keys_to_delete = []
        for key, timestamps in list(_windows.items()):
            action = key.split(":")[-1]
            _, window_seconds = LIMITS.get(action, LIMITS["default"])
            fresh = [t for t in timestamps if t > now - window_seconds]
            if not fresh:
                keys_to_delete.append(key)
            else:
                _windows[key] = fresh
        for k in keys_to_delete:
            del _windows[k]

async def heartbeat_loop():
    """Industrial-grade heartbeat: every 30s"""
    while True:
        await asyncio.sleep(30)
        await ws_manager.ping_all()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fire and forget background tasks for the app lifecycle
    asyncio.create_task(cleanup_rate_limit_windows())
    asyncio.create_task(heartbeat_loop())
    yield

# ─── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Entrext", version="1.0.0", redirect_slashes=False, lifespan=lifespan)

# Exception Handlers
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time()
    response = await call_next(request)
    duration_ms = round((time() - start) * 1000)
    logger.info(
        f"{request.method} {request.url.path} → {response.status_code} [{duration_ms}ms] "
        f"IP:{request.client.host if request.client else 'unknown'}"
    )
    return response

# Models moved to schemas.py
class GitHubConfigRequest(BaseModel):
    github_repo: str = Field(..., pattern=r'^[\w.-]+/[\w.-]+$', description="owner/repo format")
    github_token: str = Field(..., min_length=10)

class DesignSystemConfig(BaseModel):
    colors: list[str] = Field(default_factory=list)
    fonts: list[str] = Field(default_factory=list)
    borderRadii: list[str] = Field(default_factory=list)
    spacingUnit: int = 4

# ─── Health ────────────────────────────────────────────────────────────────────
def health():
    return {
        "status": "ok", 
        "version": "1.0.0", 
        "time": datetime.now(timezone.utc).isoformat(),
        "db_connected": True
    }

# ─── Projects ──────────────────────────────────────────────────────────────────
@app.post("/projects/", status_code=201, response_model=ProjectResponse)
def create_project(b: ProjectCreate, request: Request):
    check_rate_limit(request, "create_project")
    try:
        r = db.table("projects").insert({
            "name": b.name,
            "description": b.description,
            "target_url": b.target_url,
            "share_token": uuid.uuid4().hex[:16],
        }).execute()
        if not r.data: raise AppError("DB_INSERT_FAILED", "Failed to create project", 500)
        return r.data[0]
    except AppError: raise
    except Exception as e:
        raise AppError("INTERNAL_ERROR", "An internal error occurred", 500)

@app.get("/projects/", response_model=list[ProjectResponse])
def list_projects():
    return db.table("projects").select("*").order("created_at", desc=True).execute().data

@app.get("/projects/by-id/{pid}/", response_model=ProjectResponse)
def get_project(pid: str):
    r = db.table("projects").select("*").eq("id", pid).execute()
    if not r.data: raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    return r.data[0]

@app.get("/projects/by-token/{token}/", response_model=PublicProjectResponse)
def get_by_token(token: str):
    # Public view doesn't return created_at to stay minimal
    r = db.table("projects").select("id,name,description,target_url,share_token").eq("share_token", token).execute()
    if not r.data: raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    return r.data[0]

@app.delete("/projects/{pid}/")
def delete_project(pid: str):
    db.table("projects").delete().eq("id", pid).execute()
    return {"deleted": pid}

@app.put("/projects/{project_id}/github")
async def save_github_config(project_id: str, body: GitHubConfigRequest):
    db.table("projects").update({
        "github_repo": body.github_repo,
        "github_token": body.github_token  # In production: encrypt this
    }).eq("id", project_id).execute()
    return {"status": "saved"}

@app.put("/projects/{project_id}/design-system")
def save_design_system(project_id: str, body: DesignSystemConfig):
    db.table("projects").update({
        "design_system": body.model_dump()
    }).eq("id", project_id).execute()
    return {"status": "saved"}

@app.post("/projects/{project_id}/push-github")
async def push_github_issues(project_id: str, request: Request):
    check_rate_limit(request, "export")
    p_data = db.table("projects").select("*").eq("id", project_id).execute().data
    if not p_data: raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    project = p_data[0]
    
    if not project.get("github_token") or not project.get("github_repo"):
        raise AppError("GITHUB_NOT_CONFIGURED", "GitHub not configured for this project", 400)
        
    comments = db.table("comments").select("*").eq("project_id", project_id).execute().data
    result = await push_to_github(comments, project, project["github_token"], project["github_repo"])
    return result

# ─── Comments ──────────────────────────────────────────────────────────────────
@app.post("/comments/", status_code=201, response_model=CommentResponse)
def create_comment(b: CommentCreate, request: Request, background_tasks: BackgroundTasks):
    check_rate_limit(request, "create_comment")
    try:
        r = db.table("comments").insert({
            "project_id": b.project_id,
            "text": b.text,
            "component_selector": b.component_selector,
            "page_url": b.page_url,
            "tester_name": b.tester_name,
            "screenshot_url": b.screenshot_url,
            "x": b.x, "y": b.y,
            "status": "open",
            "selector_score": b.selector_score,
            "session_data": b.session_data,
        }).execute()
        if not r.data: raise AppError("DB_INSERT_FAILED", "Failed to save comment", 500)
        
        comment = r.data[0]
        # Fire AI Triage AFTER response is sent
        background_tasks.add_task(
            triage_comment, 
            comment["id"], 
            b.text, 
            b.component_selector, 
            b.project_id
        )
        return comment
    except AppError: raise
    except Exception as e:
        raise AppError("INTERNAL_ERROR", "An internal error occurred", 500)

@app.get("/comments/{pid}/", response_model=list[CommentResponse])
def get_comments(pid: str):
    return db.table("comments").select("*").eq("project_id", pid).order("created_at").execute().data

@app.patch("/comments/{cid}/resolve/", response_model=CommentResponse)
def resolve(cid: str):
    r = db.table("comments").update({"status": "resolved"}).eq("id", cid).execute()
    if not r.data: raise AppError("COMMENT_NOT_FOUND", "Comment not found", 404)
    return r.data[0]

# ─── Export ────────────────────────────────────────────────────────────────────
@app.get("/export")
def export_md(project_id: str, request: Request):
    check_rate_limit(request, "export")
    p_data = db.table("projects").select("*").eq("id", project_id).execute().data
    if not p_data:
        raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    p = p_data[0]
    comments = db.table("comments").select("*").eq("project_id", project_id).order("created_at").execute().data
    
    report = build_report(p, comments)
    filename = p['name'].replace(' ', '_').lower()[:30]
    
    return Response(
        content=report,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="entrext_{filename}_{project_id[:8]}.md"',
            "X-Total-Issues": str(len(comments)),
        }
    )

@app.get("/export/json")
def export_json(project_id: str, request: Request):
    """Returns structured JSON for programmatic consumption"""
    check_rate_limit(request, "export")
    p_data = db.table("projects").select("*").eq("id", project_id).execute().data
    if not p_data: raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    comments = db.table("comments").select("*").eq("project_id", project_id).order("severity", "created_at").execute().data
    return {
        "project": p_data[0],
        "summary": {
            "total": len(comments),
            "open": len([c for c in comments if c.get("status") != "resolved"]),
            "by_severity": {s: len([c for c in comments if c.get("severity") == s]) for s in ["P0","P1","P2","P3"]},
        },
        "issues": comments
    }

@app.get("/export/csv")
def export_csv(project_id: str, request: Request):
    """Returns CSV for spreadsheet import"""
    import csv, io
    check_rate_limit(request, "export")
    p_data = db.table("projects").select("*").eq("id", project_id).execute().data
    if not p_data: raise AppError("PROJECT_NOT_FOUND", "Project not found", 404)
    
    comments = db.table("comments").select("*").eq("project_id", project_id).execute().data
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["id","severity","category","ai_summary","text","component_selector","tester_name","status","created_at","suggested_fix"])
    writer.writeheader()
    for c in comments:
        writer.writerow({k: c.get(k, "") for k in writer.fieldnames})
        
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="entrext_{project_id[:8]}.csv"'}
    )

# ─── SSRF Guard (Nuclear Edition) ──────────────────────────────────────────────
FORBIDDEN_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),   # AWS/GCP metadata
    ipaddress.ip_network("100.64.0.0/10"),    # Carrier-grade NAT
    ipaddress.ip_network("::1/128"),           # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),          # IPv6 private
    ipaddress.ip_network("fe80::/10"),         # IPv6 link-local
    ipaddress.ip_network("0.0.0.0/8"),         # This network
]

def resolve_and_validate(hostname: str) -> str:
    """
    Resolves hostname to IP, validates against all forbidden networks.
    Return the first safe IP string.
    """
    try:
        # Resolve both IPv4 and IPv6
        results = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror:
        raise ValueError("Hostname could not be resolved")
    
    if not results:
        raise ValueError("No DNS records found")
    
    first_safe_ip = None
    for (family, _, _, _, sockaddr) in results:
        raw_ip = sockaddr[0] # sockaddr is (ip, port, ...)
        try:
            addr = ipaddress.ip_address(raw_ip)
        except ValueError:
            continue
            
        for network in FORBIDDEN_NETWORKS:
            if addr in network:
                raise ValueError("URL not allowed")
                
        if first_safe_ip is None:
            first_safe_ip = raw_ip
            
    if not first_safe_ip:
        raise ValueError("No safe IP found")
    return first_safe_ip

def ssrf_safe_v2(url: str) -> tuple[bool, str]:
    """Returns (is_safe, resolved_ip)"""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False, ""
        if not parsed.hostname:
            return False, ""
        ip = resolve_and_validate(parsed.hostname)
        return True, ip
    except ValueError:
        return False, ""

# ─── Proxy ─────────────────────────────────────────────────────────────────────
PROXY_FAIL_HTML = """<!DOCTYPE html>
<html><head><meta name="entrext-proxy-status" content="failed"></head>
<body data-entrext-failed="true" style="background:#0a0a0a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
  <div style="text-align:center;opacity:0.5;">[ PROXY_SIGNAL_INTERRUPTED ]</div>
</body></html>"""

PROXY_ADVANCED_HTML = """<!DOCTYPE html>
<html><head><meta name="entrext-proxy-status" content="advanced"></head>
<body data-entrext-failed="advanced" style="background:#0a0a0a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
  <div style="text-align:center;opacity:0.5;">[ ADVANCED_RENDER_DETECTED ]</div>
</body></html>"""

@app.get("/proxy", response_class=HTMLResponse)
async def proxy(url: str, request: Request):
    check_rate_limit(request, "proxy")
    is_safe, resolved_ip = ssrf_safe_v2(url)
    if not is_safe:
        raise AppError("SSRF_BLOCKED", "URL not allowed", 400)
    
    parsed = urlparse(url)
    transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Referer": url,
        "DNT": "1",
        "Connection": "keep-alive",
        "Host": parsed.hostname
    }

    try:
        async with httpx.AsyncClient(transport=transport, timeout=10, follow_redirects=False) as client:
            curr_url = url
            max_redirects = 3
            redirect_count = 0
            
            resp = await client.get(curr_url, headers=headers)
            
            while resp.is_redirect and redirect_count < max_redirects:
                redirect_url = urljoin(curr_url, resp.headers.get("location", ""))
                if not redirect_url:
                    break
                
                r_safe, r_ip = ssrf_safe_v2(redirect_url)
                if not r_safe:
                    raise AppError("SSRF_BLOCKED", "Redirect target not allowed", 400)
                
                curr_url = redirect_url
                headers["Host"] = urlparse(curr_url).hostname
                resp = await client.get(curr_url, headers=headers)
                redirect_count += 1

        ct = resp.headers.get("content-type", "")
        if "html" not in ct:
            return HTMLResponse(PROXY_ADVANCED_HTML, headers={"X-Entrext-Status": "advanced"})
            
        soup = BeautifulSoup(resp.text, "lxml")
        
        scripts = " ".join(s.get("src", "") + (s.string or "") for s in soup.find_all("script"))
        is_advanced = any(kw in scripts.lower() for kw in ["three.js", "webgl", "spline", "@splinetool", "babylon", "pixi", "canvas"])
        if is_advanced:
            return HTMLResponse(PROXY_ADVANCED_HTML, headers={"X-Entrext-Status": "advanced"})

        for tag in soup.find_all(True):
            for attr in ["href", "src", "action"]:
                v = tag.get(attr, "")
                if v and not v.startswith(("http", "data:", "#", "javascript:", "mailto:", "//")):
                    tag[attr] = urljoin(curr_url, v)
        
        for meta in soup.find_all("meta", attrs={"http-equiv": lambda v: v and "x-frame-options" in v.lower()}):
            meta.decompose()
        
        # Inject html2canvas + overlay
        h2c = soup.new_tag("script", src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js")
        overlay_src = "http://localhost:3000/overlay.js"
        overlay = soup.new_tag("script", src=overlay_src)
        
        target = soup.body or soup.html or soup
        target.append(h2c)
        target.append(overlay)
        
        return HTMLResponse(
            str(soup), 
            headers={
                "X-Proxy-Cache": "MISS", 
                "X-Entrext-Status": "ok",
                "Access-Control-Allow-Origin": "*"
            }
        )
    except httpx.TimeoutException:
        return HTMLResponse(PROXY_FAIL_HTML, headers={"X-Entrext-Status": "timeout"})
    except HTTPException: raise
    except Exception as e:
        print(f"[PROXY] Error: {e}")
        return HTMLResponse(PROXY_FAIL_HTML, headers={"X-Entrext-Status": "error"})

# ─── AI Triage Engine (Groq Pipeline) ──────────────────────────────────────────
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

TRIAGE_SYSTEM = """You are a senior QA engineer. Analyze UI feedback comments and classify them into a structured triage report.
Return ONLY valid JSON matching this exact schema, no markdown, no explanation:
{
  "severity": "P0|P1|P2|P3",
  "category": "visual_bug|functional_bug|ux_issue|performance|accessibility|copy_error",
  "ai_summary": "max 10 words describing the issue",
  "suggested_fix": "one sentence describing how to fix it"
}
Severity guide:
P0 = App-breaking, data loss, security issue, complete feature failure
P1 = Major feature broken, significantly impacts user flow
P2 = Minor bug, visual inconsistency, UX friction
P3 = Cosmetic, copy error, micro-polish item"""

async def triage_comment(comment_id: str, text: str, selector: str, project_id: str):
    """Background task: calls Groq, classifies comment, updates DB, broadcasts via WS"""
    if not GROQ_API_KEY:
        print("[Triage] GROQ_API_KEY not set — skipping triage")
        return

    try:
        user_prompt = f'Component: `{selector}`\nFeedback: "{text}"'
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": TRIAGE_SYSTEM},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 200,
                    "response_format": {"type": "json_object"}
                }
            )
        
        if resp.status_code != 200:
            print(f"[Triage] Groq error {resp.status_code}: {resp.text[:200]}")
            return

        raw = resp.json()["choices"][0]["message"]["content"].strip()
        analysis = json.loads(raw)
        
        # Enforce valid fields
        if analysis.get("severity") not in ("P0", "P1", "P2", "P3"): analysis["severity"] = "P2"
        valid_cats = {"visual_bug","functional_bug","ux_issue","performance","accessibility","copy_error"}
        if analysis.get("category") not in valid_cats: analysis["category"] = "ux_issue"

        # Update DB with the intelligence
        db.table("comments").update({
            "severity": analysis["severity"],
            "category": analysis["category"],
            "ai_summary": analysis["ai_summary"],
            "suggested_fix": analysis["suggested_fix"]
        }).eq("id", comment_id).execute()

        # Final broadcast push
        await ws_manager.broadcast(project_id, {
            "type": "COMMENT_TRIAGED",
            "comment_id": comment_id,
            "severity": analysis["severity"],
            "category": analysis["category"],
            "ai_summary": analysis["ai_summary"],
            "suggested_fix": analysis["suggested_fix"]
        })
        print(f"[Triage] ✓ {comment_id} → {analysis['severity']} / {analysis['category']}")

    except Exception as e:
        print(f"[Triage] Pipeline failed for {comment_id}: {e}")

# ─── WebSocket (Harden implementation in next step) ───────────────────────────
@app.websocket("/ws/project/{project_id}")
async def ws_endpoint(ws: WebSocket, project_id: str, tester_id: str = "", tester_name: str = "Anonymous"):
    tid = tester_id or uuid.uuid4().hex
    print(f"[WS_ATTEMPT] Project: {project_id} | Tester: {tester_name} ({tid})")
    
    try:
        await ws_manager.connect(ws, project_id, tid, tester_name)
        print(f"[WS_CONNECTED] {tid}")
        
        await ws_manager.broadcast(project_id, {"type": "TESTER_JOINED", "tester_id": tid, "name": tester_name}, exclude=tid)
        await ws.send_json({"type": "SYNC", "testers": ws_manager.testers(project_id)})
        
        while True:
            data = await ws.receive_json()
            # Broadcast the cursor move or action
            await ws_manager.broadcast(project_id, {**data, "tester_id": tid, "name": tester_name}, exclude=tid)
    except WebSocketDisconnect:
        ws_manager.disconnect(project_id, tid)
        await ws_manager.broadcast(project_id, {"type": "TESTER_LEFT", "tester_id": tid, "name": tester_name})
    except Exception as e:
        ws_manager.disconnect(project_id, tid)
        print(f"[WS] Error: {e}")
