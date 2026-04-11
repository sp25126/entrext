const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8765"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 
        "Content-Type": "application/json", 
        ...options?.headers 
      },
    })
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail ?? "Request failed")
    }
    
    return res.json()
  } finally {
    clearTimeout(timeout)
  }
}

const mapComment = (c: any) => ({
  ...c,
  component_ref: {
    selector: c.component_selector,
    x: c.x,
    y: c.y
  },
  resolved_status: c.status === 'resolved'
})

export const api = {
  // Projects
  createProject: (body: { name: string; description?: string; target_url: string }) =>
    request<any>("/projects/", { method: "POST", body: JSON.stringify(body) }),
  
  listProjects: () => 
    request<any[]>("/projects/"),
  
  getProject: (id: string) => 
    request<any>(`/projects/by-id/${id}/`),
  
  getProjectByToken: (token: string) => 
    request<any>(`/projects/by-token/${token}/`),
  
  // Comments
  createComment: async (body: any) => {
    const res = await request<any>("/comments/", { method: "POST", body: JSON.stringify(body) });
    return mapComment(res);
  },
  
  getComments: async (projectId: string) => {
    const res = await request<any[]>(`/comments/${projectId}/`);
    return res.map(mapComment);
  },
  
  resolveComment: async (commentId: string) => {
    const res = await request<any>(`/comments/${commentId}/resolve/`, { method: "PATCH" });
    return mapComment(res);
  },
  
  // Export
  exportMarkdown: (projectId: string) =>
    fetch(`${BASE}/export?project_id=${projectId}`).then(r => r.text()),
  
  // Proxy
  proxyUrl: (url: string) =>
    `${BASE}/proxy?url=${encodeURIComponent(url)}`,
}
