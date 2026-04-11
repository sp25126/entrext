export interface Project {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  description?: string;
  target_url: string;
  share_token: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ComponentRef {
  selector?: string;
  x: number;
  y: number;
}

export interface Comment {
  id: string; // UUID
  project_id: string; // UUID
  text: string;
  component_ref: ComponentRef;
  page_url: string;
  author_name: string;
  resolved_status: boolean;
  screenshot_url?: string;
  
  // AI Fields
  severity?: 'P0' | 'P1' | 'P2' | 'P3';
  category?: string;
  ai_summary?: string;
  suggested_fix?: string;
  affected_users_estimate?: string;

  created_at: string;
  updated_at: string;
}

export type CreateProjectInput = Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'share_token' | 'status'>;
export type CreateCommentInput = Omit<Comment, 'id' | 'created_at' | 'updated_at' | 'project_id' | 'resolved_status'>;
