-- RLS for social_drafts table.
-- Serverless functions use service key (bypasses RLS).
-- Frontend dashboard queries social_drafts as authenticated user to show pending count.

ALTER TABLE social_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_social_drafts"
  ON social_drafts
  FOR SELECT
  TO authenticated
  USING (true);
