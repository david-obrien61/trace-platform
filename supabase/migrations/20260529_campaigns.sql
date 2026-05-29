-- Campaign Scheduler — shared cross-vertical feature
-- Requires: 20260529_businesses_a_create_tables.sql (businesses table) to be run first

CREATE TABLE campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            text NOT NULL,
  campaign_type   text NOT NULL DEFAULT 'seasonal'
    CHECK (campaign_type IN ('seasonal','holiday','clearance','product_launch','custom')),
  start_date      date,
  end_date        date,
  target_category text,
  description     text,
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','completed','cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_owner ON campaigns FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE TABLE campaign_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  business_id         uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  platform            text NOT NULL
    CHECK (platform IN ('instagram','facebook','sms','email')),
  scheduled_date      date,
  copy_text           text NOT NULL,
  image_prompt        text,
  edited_copy         text,
  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','reviewed','scheduled','published','failed')),
  published_at        timestamptz,
  post_submission_id  text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE campaign_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_posts_owner ON campaign_posts FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Tone learning: capture human edits to improve future AI output
CREATE TABLE campaign_tone_samples (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  platform      text NOT NULL,
  original_text text NOT NULL,
  edited_text   text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE campaign_tone_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY tone_samples_owner ON campaign_tone_samples FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));


-- Seed: Mother's Day 2026 campaign for LAWNS Tree Farm
-- business_id matches LAWNS nursery_id (same UUID after businesses migration)
INSERT INTO campaigns (id, business_id, name, campaign_type, start_date, end_date, target_category, description, status)
VALUES (
  'c0010000-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Mother''s Day 2026',
  'holiday',
  '2026-05-01',
  '2026-05-11',
  'flowering',
  'Mother''s Day gifting — flowering trees, ornamental shrubs, hanging baskets',
  'active'
);

INSERT INTO campaign_posts (campaign_id, business_id, platform, scheduled_date, copy_text, image_prompt, status)
VALUES
  (
    'c0010000-0000-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'instagram',
    '2026-05-01',
    'Mother''s Day is ten days out, and there''s no better gift than something that grows.

At LAWNS, we have flowering crape myrtles, ornamental pears, and potted roses ready to go — all container-grown right here in Leander.

She''ll think of you every time it blooms.

#MothersDayGift #LAWNS #LeandTX #TreeFarm #GiftIdeas #PlantMom',
    'A flowering crape myrtle or rose in a container, close-up shot in warm morning light. Make it look like a gift. No text overlay.',
    'draft'
  ),
  (
    'c0010000-0000-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'facebook',
    '2026-05-03',
    'Looking for a Mother''s Day gift that lasts longer than flowers from the grocery store?

We have flowering trees and ornamental shrubs that will still be blooming years from now — and you can pick them up right here at LAWNS.

Stop by this week and we''ll help you find the right one. Our staff knows every plant on the lot and can help you pick something that fits her yard and her style.

Hours: Mon–Sat 8am–5pm · 400 Honeycomb Mesa, Leander TX',
    'Staff member helping a customer pick out a flowering plant. Warm, genuine moment — not posed. Should feel like a neighborhood nursery, not a big box store.',
    'draft'
  ),
  (
    'c0010000-0000-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'instagram',
    '2026-05-07',
    'Three days until Mother''s Day.

These container-grown ornamental pears are some of our favorites this time of year — showy in spring, beautiful shade in summer, brilliant color in fall.

One tree. Four seasons of wow.

Come see us before Sunday — we''re here Mon–Sat 8–5.

#LAWNS #LeandTX #MothersDayGift #OrnamentalTree #PlantGift',
    'Ornamental pear or similar flowering/ornamental tree in a container, shot in golden hour light. The tree should be the full frame subject. No text.',
    'draft'
  ),
  (
    'c0010000-0000-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'facebook',
    '2026-05-09',
    'Two days left!

If you''re still looking for a Mother''s Day gift, we have you covered. Swing by LAWNS today or tomorrow and our team will help you find something she''ll love — flowering, ornamental, or a fruit tree she can actually harvest from.

We can even help you load it up and get it in her yard.

400 Honeycomb Mesa, Leander TX · Open 8am–5pm',
    'Quick, candid shot of a loaded truck or someone carrying a potted tree. Show the "this is happening" energy — last-minute but not desperate.',
    'draft'
  ),
  (
    'c0010000-0000-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'sms',
    '2026-05-10',
    'LAWNS: Mother''s Day tomorrow! Flowering trees & ornamentals in stock. We can help load. 400 Honeycomb Mesa, Leander. Open 8–5 today.',
    '',
    'draft'
  );


-- Seed: Summer Clearance 2026 campaign (in draft — not yet generated)
INSERT INTO campaigns (id, business_id, name, campaign_type, start_date, end_date, target_category, description, status)
VALUES (
  'c0010000-0000-0000-0000-000000000002',
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Summer Clearance',
  'clearance',
  '2026-07-15',
  '2026-08-15',
  NULL,
  'End-of-season inventory reduction — large containers, shade trees, clearance pricing',
  'draft'
);
