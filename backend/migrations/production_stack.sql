-- Production Stack: Accounts, Plans & Institutional Logic
-- 1. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  full_name     TEXT DEFAULT '',
  avatar_url    TEXT DEFAULT '',
  plan          TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'team')),
  email_notifs  BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Plan Limits Table
CREATE TABLE IF NOT EXISTS plan_limits (
  plan            TEXT PRIMARY KEY,
  max_projects    INTEGER,
  max_comments    INTEGER,
  ai_triage       BOOLEAN,
  github_export   BOOLEAN,
  session_record  BOOLEAN
);

-- Seed Plan Limits
INSERT INTO plan_limits (plan, max_projects, max_comments, ai_triage, github_export, session_record)
VALUES
  ('free',  3,    50,    false, false, false),
  ('pro',   NULL, NULL,  true,  true,  true),
  ('team',  NULL, NULL,  true,  true,  true)
ON CONFLICT (plan) DO UPDATE SET
  max_projects = EXCLUDED.max_projects,
  max_comments = EXCLUDED.max_comments,
  ai_triage = EXCLUDED.ai_triage,
  github_export = EXCLUDED.github_export,
  session_record = EXCLUDED.session_record;

-- 3. Trigger for Automatic Profile Creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
