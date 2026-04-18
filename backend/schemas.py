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

class CommentCreate(BaseModel):
    project_id: str = Field(..., min_length=36, max_length=36, description="Valid UUID4")
    text: str = Field(..., min_length=1, max_length=2000)
    component_selector: str = Field(default="unknown", max_length=500)
    page_url: str = Field(default="", max_length=2000)
    tester_name: str = Field(default="Anonymous", max_length=100)
    screenshot_url: str = Field(default="", max_length=500000)  # base64 can be large
    x: float = Field(default=0.0, ge=0.0, le=100.0)  # must be a percentage 0-100
    y: float = Field(default=0.0, ge=0.0, le=100.0)
    selector_score: Optional[int] = Field(default=None, ge=0, le=100)
    session_data: Optional[dict] = Field(default=None)

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
        if not re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', v, re.IGNORECASE):
            raise ValueError("project_id must be a valid UUID4")
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

class CommentResponse(BaseModel):
    id: str
    project_id: str
    text: str
    component_selector: str
    page_url: str
    tester_name: str
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
    session_data: Optional[dict] = None

class HealthResponse(BaseModel):
    status: str
    version: str
    time: str
    db_connected: bool = True
