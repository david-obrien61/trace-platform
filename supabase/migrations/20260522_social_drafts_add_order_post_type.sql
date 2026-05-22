-- Add order_id and post_type columns to social_drafts.
-- order_id: links each draft back to the order that triggered generation.
-- post_type: identifies the draft variant (educational, customer_story, seasonal).

ALTER TABLE social_drafts
  ADD COLUMN order_id  uuid REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN post_type text CHECK (post_type IN ('educational', 'customer_story', 'seasonal'));
