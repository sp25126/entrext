import os, uuid, socket, ipaddress
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel
from supabase import create_client
import httpx
from bs4 import BeautifulSoup

load_dotenv()

# ─── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Entrext", version="1.0.0", redirect_slashes=False)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── DB ────────────────────────────────────────────────────────────────────────
db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

# ─── WebSocket Manager ─────────────────────────────────────────────────────────
class Manager:
    def __init__(self):
        self.rooms: dict[str, dict] = {}
    async def connect(self, ws, room, tid, name):
        await ws.accept()
        self.rooms.setdefault(room, {})[tid] = {"ws": ws, "name": name}
    def disconnect(self, room, tid):
        if room in self.rooms:
            self.rooms[room].pop(tid, None)
    async def broadcast(self, room, msg, exclude=None):
        for tid, c in list(self.rooms.get(room, {}).items()):
            if tid != exclude:
                try: 
                    await c["ws"].send_json(msg)
                except: 
                    self.disconnect(room, tid)
    def testers(self, room):
        return [{"id": t, "name": c["name"]} for t, c in self.rooms.get(room, {}).items()]

ws_manager = Manager()

# ─── Schemas ───────────────────────────────────────────────────────────────────
class ProjectIn(BaseModel):
    name: str
    description: str = ""
    target_url: str

class CommentIn(BaseModel):
    project_id: str
    text: str
    component_selector: str = ""
    page_url: str = ""
    tester_name: str = "Anonymous"
    screenshot_url: str = ""
    x: float = 0
    y: float = 0

# ─── Health ────────────────────────────────────────────────────────────────────
@app.get("/health/")
def health():
    return {"status": "ok", "version": "1.0.0", "time": datetime.now(timezone.utc).isoformat()}

# ─── Projects ──────────────────────────────────────────────────────────────────
@app.post("/projects/", status_code=201)
def create_project(b: ProjectIn):
    try:
        r = db.table("projects").insert({
            "name": b.name,
            "description": b.description,
            "target_url": b.target_url,
            "share_token": uuid.uuid4().hex[:16],
        }).execute()
        if not r.data: raise HTTPException(500, "Insert failed")
        return r.data[0]
    except Exception as e:
        print(f"[REBAL] Project Create Error: {e}")
        raise HTTPException(500, str(e))

@app.get("/projects/")
def list_projects():
    return db.table("projects").select("*").order("created_at", desc=True).execute().data

@app.get("/projects/by-id/{pid}/")
def get_project(pid: str):
    r = db.table("projects").select("*").eq("id", pid).execute()
    if not r.data: raise HTTPException(404, "Not found")
    return r.data[0]

@app.get("/projects/by-token/{token}/")
def get_by_token(token: str):
    r = db.table("projects").select("id,name,description,target_url,share_token,created_at").eq("share_token", token).execute()
    if not r.data: raise HTTPException(404, "Not found")
    return r.data[0]

@app.delete("/projects/{pid}/")
def delete_project(pid: str):
    db.table("projects").delete().eq("id", pid).execute()
    return {"deleted": pid}

# ─── Comments ──────────────────────────────────────────────────────────────────
@app.post("/comments/", status_code=201)
def create_comment(b: CommentIn):
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
        }).execute()
        if not r.data: raise HTTPException(500, "Insert failed")
        return r.data[0]
    except Exception as e:
        print(f"[REBAL] Comment Create Error: {e}")
        raise HTTPException(500, str(e))

@app.get("/comments/{pid}/")
def get_comments(pid: str):
    return db.table("comments").select("*").eq("project_id", pid).order("created_at").execute().data

@app.patch("/comments/{cid}/resolve/")
def resolve(cid: str):
    r = db.table("comments").update({"status": "resolved"}).eq("id", cid).execute()
    if not r.data: raise HTTPException(404, "Not found")
    return r.data[0]

# ─── Export ────────────────────────────────────────────────────────────────────
@app.get("/export/", response_class=PlainTextResponse)
def export_md(project_id: str):
    p_data = db.table("projects").select("*").eq("id", project_id).execute().data
    if not p_data: raise HTTPException(404, "Project not found")
    p = p_data[0]
    comments = db.table("comments").select("*").eq("project_id", project_id).execute().data
    lines = [
        f"# Feedback: {p['name']}",
        f"> URL: {p['target_url']}",
        f"> Generated: {datetime.now(timezone.utc).isoformat()}",
        f"> Total: {len(comments)} issues",
        "---",
    ]
    for i, c in enumerate(comments, 1):
        lines += [
            f"### Issue #{i}",
            f"- **Component:** `{c.get('component_selector','unknown')}`",
            f"- **Tester:** {c.get('tester_name','Anonymous')}",
            f"- **Status:** {c.get('status','open')}",
            f"- **Time:** {c.get('created_at','')}",
            f"\n> {c.get('text','')}",
            "---",
        ]
    return "\n".join(lines)

# ─── SSRF Guard ────────────────────────────────────────────────────────────────
def ssrf_safe(url: str) -> bool:
    try:
        h = urlparse(url).hostname
        if not h: return False
        ip = ipaddress.ip_address(socket.gethostbyname(h))
        return not (ip.is_private or ip.is_loopback or ip.is_reserved or str(ip) == "169.254.169.254")
    except: return False

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
async def proxy(url: str):
    if not ssrf_safe(url):
        raise HTTPException(400, "URL not allowed")
    try:
        # Modern Stealth Headers
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Referer": url,  # Fix for challenge.js issues
            "DNT": "1",
            "Connection": "keep-alive"
        }
        
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as c:
            resp = await c.get(url, headers=headers)
        
        ct = resp.headers.get("content-type", "")
        if "html" not in ct:
            return HTMLResponse(PROXY_ADVANCED_HTML, headers={"X-Entrext-Status": "advanced"})
            
        soup = BeautifulSoup(resp.text, "lxml")
        
        # Detect WebGL / 3D Libraries
        scripts = " ".join(s.get("src", "") + (s.string or "") for s in soup.find_all("script"))
        is_advanced = any(kw in scripts.lower() for kw in ["three.js", "webgl", "spline", "@splinetool", "babylon", "pixi", "canvas"])
        if is_advanced:
            return HTMLResponse(PROXY_ADVANCED_HTML, headers={"X-Entrext-Status": "advanced"})

        # Rewrite asset URLs & Fix common issues
        for tag in soup.find_all(True):
            for attr in ["href", "src", "action"]:
                v = tag.get(attr, "")
                if v and not v.startswith(("http", "data:", "#", "javascript:", "mailto:", "//")):
                    tag[attr] = urljoin(url, v)
            
            # Fix srcset
            if tag.get("srcset"):
                parts = []
                for part in tag["srcset"].split(","):
                    bits = part.strip().split()
                    if bits:
                        if not bits[0].startswith("http"):
                            bits[0] = urljoin(url, bits[0])
                        parts.append(" ".join(bits))
                tag["srcset"] = ", ".join(parts)

        # Remove security headers/meta that block frames
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

# ─── WebSocket ─────────────────────────────────────────────────────────────────
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
