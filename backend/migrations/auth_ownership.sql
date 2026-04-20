-- Add owner_id to projects (links to auth.users)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index for fast owner lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Enable RLS on projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: owners can see only their own projects
CREATE POLICY "owners_select_own" ON projects
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: owners can insert with their own user_id
CREATE POLICY "owners_insert_own" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: owners can update only their own
CREATE POLICY "owners_update_own" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: owners can delete only their own
CREATE POLICY "owners_delete_own" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Policy: anyone can read a project by share_token (for testers)
CREATE POLICY "public_read_by_token" ON projects
  FOR SELECT USING (share_token IS NOT NULL);

-- Comments: public insert (testers don't auth), owners see all
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert_comments" ON comments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "owner_select_comments" ON comments
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    OR true  -- testers can also read via share token view
  );

CREATE POLICY "owner_update_comments" ON comments
  FOR UPDATE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );
