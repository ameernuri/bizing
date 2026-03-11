INSERT INTO service_groups (
  id,
  biz_id,
  name,
  slug,
  description,
  status,
  metadata,
  created_at,
  updated_at
)
SELECT
  'svcgrp_' || substr(md5(o.biz_id || ':catalog'), 1, 24),
  o.biz_id,
  'Catalog',
  'catalog',
  'Default catalog group created during offer/service-product consolidation.',
  'active',
  '{}'::jsonb,
  now(),
  now()
FROM offers o
LEFT JOIN service_groups sg
  ON sg.biz_id = o.biz_id
 AND sg.slug = 'catalog'
 AND sg.deleted_at IS NULL
WHERE sg.id IS NULL
GROUP BY o.biz_id;

ALTER TABLE offers
ADD COLUMN IF NOT EXISTS service_group_id text;

UPDATE offers o
SET service_group_id = sg.id
FROM service_groups sg
WHERE o.biz_id = sg.biz_id
  AND sg.slug = 'catalog'
  AND sg.deleted_at IS NULL
  AND o.service_group_id IS NULL;

ALTER TABLE offers
ALTER COLUMN service_group_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'offers_biz_service_group_fk'
  ) THEN
    ALTER TABLE offers
    ADD CONSTRAINT offers_biz_service_group_fk
    FOREIGN KEY (biz_id, service_group_id)
    REFERENCES service_groups (biz_id, id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS offers_biz_service_group_idx
  ON offers (biz_id, service_group_id);
