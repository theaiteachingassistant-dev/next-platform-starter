-- 1. Create the Curriculum Skills table (The "Columns" of your spreadsheet)
CREATE TABLE IF NOT EXISTS curriculum_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL, -- Locks the curriculum to you
  subject text NOT NULL, -- e.g., 'Maths', 'Writing', 'Reading'
  skill_name text NOT NULL, -- e.g., '3 digit Addition with renaming'
  display_order integer NOT NULL, -- For your left-to-right scanning logic
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Create the Pupil Progress table (The "y/n" or "Independent/Practising" cells)
CREATE TABLE IF NOT EXISTS pupil_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  pupil_id uuid REFERENCES pupils(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES curriculum_skills(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Not Yet', -- 'Achieved', 'Not Yet', 'Practising', 'Introduced'
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(pupil_id, skill_id) -- Prevents duplicate entries for the same pupil/skill combo
);

-- 3. Enable RLS on both tables
ALTER TABLE curriculum_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE pupil_progress ENABLE ROW LEVEL SECURITY;

-- 4. Apply strict Clerk ownership policies
CREATE POLICY "Manage own curriculum" ON curriculum_skills FOR ALL TO authenticated USING (user_id = auth.jwt()->>'sub') WITH CHECK (user_id = auth.jwt()->>'sub');
CREATE POLICY "Manage own pupil progress" ON pupil_progress FOR ALL TO authenticated USING (user_id = auth.jwt()->>'sub') WITH CHECK (user_id = auth.jwt()->>'sub');
