from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import datetime
import re

# ── Validators ────────────────────────────────────────────────────────────────
def non_empty_str(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("Field cannot be empty or whitespace")
    return v

def safe_url(v: str) -> str:
    v = v.strip()
    # Basic check for http/https scheme
    if not v.lower().startswith(("http://", "https://")):
        raise ValueError("URL must use http:// or https:// scheme only")
    
    # Block dangerous schemes embedded in URL
    if re.search(r'(javascript|data|vbscript|file|ftp):', v, re.IGNORECASE):
        raise ValueError("URL contains a forbidden scheme")
    return v

# ── Request Schemas ───────────────────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Project display name")
    description: str = Field(default="", max_length=500)
    target_url: str = Field(..., description="Full URL of the site to audit")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        return non_empty_str(v)

    @field_validator("target_url")
    @classmethod
    def validate_url(cls, v):
        return safe_url(v)

class ShareLinkCreate(BaseModel):
    label: str = Field(default="Shared Link", max_length=60)
    role: Literal["tester", "viewer", "reviewer"] = "tester"
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365)
    max_uses: Optional[int] = Field(default=None, ge=1, le=10000)
    password: Optional[str] = Field(default=None, max_length=100)

class ShareTokenResolveRequest(BaseModel):
    password: Optional[str] = None

class CommentCreate(BaseModel):
    project_id:         str = Field(..., description="Required Project UUID")
    text:               str = Field(..., min_length=1, max_length=2000)
    component_selector: Optional[str] = Field(default="")
    xpath:              Optional[str] = Field(default="")
    tag_name:           Optional[str] = Field(default="")
    inner_text:         Optional[str] = Field(default="")
    page_url:           Optional[str] = Field(default="/")
    tester_name:        Optional[str] = Field(default="Anonymous")
    x:                  Optional[float] = Field(default=0.0)
    y:                  Optional[float] = Field(default=0.0)
    marker_number:      Optional[int]   = Field(default=0)
    screenshot_url:     Optional[str]   = Field(default=None)
    session_data:       Optional[dict]  = Field(default=None)

    @field_validator(
        'component_selector', 'xpath', 'tag_name', 
        'inner_text', 'page_url', 'tester_name',
        mode='before'
    )
    @classmethod
    def coerce_to_string(cls, v):
        if v is None: return ""
        return str(v)

    @field_validator('screenshot_url', mode='before')
    @classmethod
    def validate_screenshot(cls, v):
        if not v or not isinstance(v, str) or v == "": return None
        if v.startswith('data:image'): return v
        return None

    @field_validator('x', 'y', mode='before')
    @classmethod
    def coerce_float(cls, v):
        if v is None: return 0.0
        try: return float(v)
        except: return 0.0

    @field_validator('marker_number', mode='before')
    @classmethod
    def coerce_int(cls, v):
        if v is None: return 0
        try: return int(v)
        except: return 0

    @field_validator("text")
    @classmethod
    def validate_text(cls, v):
        return non_empty_str(v)

    @field_validator("tester_name")
    @classmethod
    def validate_tester_name(cls, v):
        return v.strip() or "Anonymous"

    @field_validator("project_id")
    @classmethod
    def validate_uuid(cls, v):
        import re
        # Relaxed UUID regex (allows v1, v4, etc.)
        if not re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', v, re.IGNORECASE):
            raise ValueError("project_id must be a valid UUID")
        return v

# ── Response Schemas (control exactly what leaves the API) ────────────────────
class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    target_url: str
    share_token: str
    created_at: datetime

class PublicProjectResponse(BaseModel):
    """Used for share token resolution — never exposes internal fields"""
    id: str
    name: str
    description: str
    target_url: str
    share_token: str
    role: str  # tester, viewer, or reviewer

class ShareLinkResponse(BaseModel):
    id: str
    token: str
    label: str
    role: str
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    use_count: int
    is_active: bool
    created_at: datetime
    share_url: str  # Full URL for sharing

class CommentResponse(BaseModel):
    id: str
    project_id: str
    text: str
    component_selector: str
    xpath: str
    tag_name: str
    inner_text: str
    page_url: str
    tester_name: str
    marker_number: int
    screenshot_url: Optional[str] = None
    x: float
    y: float
    status: Literal["open", "resolved"]
    created_at: datetime
    # AI triage fields — None until background task completes
    severity: Optional[Literal["P0", "P1", "P2", "P3"]] = None
    category: Optional[str] = None
    ai_summary: Optional[str] = None
    suggested_fix: Optional[str] = None
    # V2 Enrichment
    selector_score: Optional[int] = None
    marker_number: Optional[int] = 0
    screenshot_url: Optional[str] = None
    xpath: Optional[str] = None
    tag_name: Optional[str] = None
    inner_text: Optional[str] = None
    session_data: Optional[dict] = None

class DesignSystemConfig(BaseModel):
    colors: list[str] = Field(default_factory=list)
    fonts: list[str] = Field(default_factory=list)
    borderRadii: list[str] = Field(default_factory=list)
    spacingUnit: int = 4

class GitHubConfigRequest(BaseModel):
    github_repo: str = Field(..., pattern=r'^[\w.-]+/[\w.-]+$', description="owner/repo format")
    github_token: str = Field(..., min_length=10)

class HealthResponse(BaseModel):
    status: str        # "ok" or "degraded"
    version: str
    env: str
    time: str
    db_connected: bool
    db_latency_ms: int

class AnalyticsResponse(BaseModel):
    health_score: int
    total: int
    open: int
    resolved: int
    by_severity: dict[str, int]
    sparkline: list[int]
    unique_testers: int
    testers: list[str]
    hot_components: list[dict]
    resolution_rate: int
