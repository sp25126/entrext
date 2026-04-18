-- Add design_system configuration to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS design_system JSONB DEFAULT '{
    "colors": ["#000000", "#ffffff"],
    "fonts": ["Inter", "sans-serif"],
    "borderRadii": ["0px", "4px", "8px"],
    "spacingUnit": 4
}'::jsonb;
