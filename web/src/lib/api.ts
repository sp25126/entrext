// src/lib/api.ts
const BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8765').replace(/\/$/, '')

// ── Core fetcher ─────────────────────────────────────────────────────────────
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: init.signal ?? AbortSignal.timeout(15_000),
    })
  } catch (networkErr: unknown) {
    // True network failure — backend is down or CORS blocked
    const msg = networkErr instanceof Error ? networkErr.message : 'Network error'
    throw new Error(`[Network] ${msg} — is the backend running on ${BASE}?`)
  }

  if (res.ok) {
    // 204 No Content — return empty object
    if (res.status === 204) return {} as T
    return res.json() as Promise<T>
  }

  // ── Parse backend error response ──────────────────────────────────────────
  let backendMessage = `HTTP ${res.status}`
  try {
    const body = await res.json()
    // Log for developer context
    console.error(`[API] ${init.method ?? 'GET'} ${path} → ${res.status}`, JSON.stringify(body, null, 2))

    // 1. Check for our CUSTOM validation error format (from errors.py)
    if (body?.error === 'VALIDATION_FAILED' && Array.isArray(body.fields)) {
      const fields = body.fields.map((f: any) => `${f.field}: ${f.issue}`)
      backendMessage = `Validation failed — ${fields.join(' | ')}`
    }
    // 2. Check for DEFAULT FastAPI Pydantic detail format
    else if (body?.detail && Array.isArray(body.detail)) {
      const fields = body.detail.map((e: any) => {
        const field = e.loc?.slice(-1)[0] ?? 'unknown'
        return `${field}: ${e.msg}`
      })
      backendMessage = `Validation failed — ${fields.join(' | ')}`
    }
    // 3. Check for our standard AppError shape
    else if (body?.message) {
      backendMessage = body.message
    }
    // 4. Fallback for string details
    else if (body?.detail && typeof body.detail === 'string') {
      backendMessage = body.detail
    }
  } catch {
    console.error(`[API] ${init.method ?? 'GET'} ${path} → ${res.status} (non-JSON body)`)
  }
  throw new Error(backendMessage)
}

// ── Typed API methods ─────────────────────────────────────────────────────────

// Projects
export const api = {
  projects: {
    list: ()                   => request<Project[]>('/projects/'),
    get:  (id: string)         => request<Project>(`/projects/${id}`),
    create: (b: ProjectCreate) => request<Project>('/projects/', { method:'POST', body: JSON.stringify(b) }),
    delete: (id: string)       => request<void>(`/projects/${id}`, { method:'DELETE' }),
  },

  comments: {
    list: (projectId: string) =>
      request<Comment[]>(`/comments/${projectId}/`),

    create: (b: CommentCreate) =>
      request<Comment>('/comments', { method:'POST', body: JSON.stringify(b) }),

    resolve: (id: string) =>
      request<Comment>(`/comments/${id}/resolve/`, { method:'PATCH' }),

    delete: (id: string) =>
      request<void>(`/comments/${id}`, { method:'DELETE' }),
  },

  shareLinks: {
    resolve: (token: string) =>
      request<Project>(`/resolve-token/${token}`, { method: 'POST' }),

    list:   (projectId: string) =>
      request<ShareLink[]>(`/projects/${projectId}/share-links`),

    create: (projectId: string, b: ShareLinkCreate) =>
      request<ShareLink>(`/projects/${projectId}/share-links`, { method:'POST', body: JSON.stringify(b) }),

    revoke: (projectId: string, linkId: string) =>
      request<void>(`/projects/${projectId}/share-links/${linkId}`, { method:'DELETE' }),
  },

  export: {
    download: (projectId: string, format: 'markdown' | 'json' | 'csv') =>
      fetch(`${BASE}/export?project_id=${projectId}&format=${format}`)
        .then(r => { if (!r.ok) throw new Error(`Export failed: HTTP ${r.status}`); return r.blob() }),
  },

  health: () => request<{ status: string; db_connected: boolean }>('/health'),
  
  // Proxy (Helper for iframe)
  proxyUrl: (url: string) => `${BASE}/proxy?url=${encodeURIComponent(url)}`,
}

// ── Types (single source of truth — keep in sync with backend Pydantic models) ──

export interface Project {
  id:           string
  name:         string
  description:  string | null
  target_url:   string
  created_at:   string
}

export interface ProjectCreate {
  name:        string
  description?: string
  target_url:  string
}

export interface Comment {
  id:                 string
  project_id:         string
  text:               string
  component_selector: string
  xpath:              string
  tag_name:           string
  inner_text:         string
  page_url:           string
  tester_name:        string
  severity:           'P0' | 'P1' | 'P2' | 'P3' | null
  status:             'open' | 'resolved'
  x:                  number
  y:                  number
  marker_number:      number
  screenshot_url:     string | null
  created_at:         string
}

export interface CommentCreate {
  project_id:         string
  text:               string
  component_selector?: string
  xpath?:              string
  tag_name?:           string
  inner_text?:         string
  page_url?:           string
  tester_name?:        string
  x?:                  number
  y?:                  number
  marker_number?:      number
  screenshot_url?:     string | null
}

export interface ShareLink {
  id:           string
  project_id:   string
  token:        string
  label:        string
  role:         'tester' | 'reviewer' | 'viewer'
  expires_at:   string | null
  max_uses:     number | null
  use_count:    number
  is_active:    boolean
  created_at:   string
  share_url:    string
}

export interface ShareLinkCreate {
  label?:           string
  role?:            'tester' | 'reviewer' | 'viewer'
  expires_in_days?: number
  max_uses?:        number
  password?:        string
}
