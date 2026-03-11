INSERT INTO "subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "display_name",
  "category",
  "status",
  "is_linkable",
  "metadata"
)
SELECT
  'subject_' || substr(md5(r."biz_id" || ':resource:' || r."id"), 1, 26),
  r."biz_id",
  'resource',
  r."id",
  r."name",
  r."type"::text,
  'active',
  true,
  jsonb_build_object('source', '0014_schedule_subject_backfill', 'ownerType', 'resource')
FROM "resources" r
WHERE r."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "display_name",
  "category",
  "status",
  "is_linkable",
  "metadata"
)
SELECT
  'subject_' || substr(md5(svc."biz_id" || ':service:' || svc."id"), 1, 26),
  svc."biz_id",
  'service',
  svc."id",
  svc."name",
  svc."type"::text,
  'active',
  true,
  jsonb_build_object('source', '0014_schedule_subject_backfill', 'ownerType', 'service')
FROM "services" svc
WHERE svc."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "display_name",
  "category",
  "status",
  "is_linkable",
  "metadata"
)
SELECT
  'subject_' || substr(md5(sp."biz_id" || ':service_product:' || sp."id"), 1, 26),
  sp."biz_id",
  'service_product',
  sp."id",
  sp."name",
  'service_product',
  'active',
  true,
  jsonb_build_object('source', '0014_schedule_subject_backfill', 'ownerType', 'service_product')
FROM "service_products" sp
WHERE sp."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "display_name",
  "category",
  "status",
  "is_linkable",
  "metadata"
)
SELECT
  'subject_' || substr(md5(o."biz_id" || ':offer:' || o."id"), 1, 26),
  o."biz_id",
  'offer',
  o."id",
  o."name",
  o."execution_mode"::text,
  'active',
  true,
  jsonb_build_object('source', '0014_schedule_subject_backfill', 'ownerType', 'offer')
FROM "offers" o
WHERE o."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "display_name",
  "category",
  "status",
  "is_linkable",
  "metadata"
)
SELECT
  'subject_' || substr(md5(ov."biz_id" || ':offer_version:' || ov."id"), 1, 26),
  ov."biz_id",
  'offer_version',
  ov."id",
  COALESCE(o."name", 'Offer') || ' v' || ov."version"::text,
  COALESCE(o."execution_mode"::text, 'offer_version'),
  'active',
  true,
  jsonb_build_object(
    'source', '0014_schedule_subject_backfill',
    'ownerType', 'offer_version',
    'offerId', ov."offer_id",
    'version', ov."version"
  )
FROM "offer_versions" ov
LEFT JOIN "offers" o
  ON o."biz_id" = ov."biz_id"
 AND o."id" = ov."offer_id"
WHERE ov."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "display_name",
  "category",
  "status",
  "is_linkable",
  "metadata"
)
SELECT
  'subject_' || substr(md5(l."biz_id" || ':location:' || l."id"), 1, 26),
  l."biz_id",
  'location',
  l."id",
  l."name",
  l."type"::text,
  'active',
  true,
  jsonb_build_object('source', '0014_schedule_subject_backfill', 'ownerType', 'location')
FROM "locations" l
WHERE l."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "schedule_subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "schedule_class",
  "display_name",
  "status",
  "scheduling_mode",
  "default_capacity",
  "default_lead_time_min",
  "default_buffer_before_min",
  "default_buffer_after_min",
  "should_project_timeline",
  "policy",
  "metadata"
)
SELECT
  'schedule_subject_' || substr(md5(r."biz_id" || ':resource:' || r."id"), 1, 26),
  r."biz_id",
  'resource',
  r."id",
  'resource',
  r."name",
  'active',
  'exclusive',
  COALESCE(r."capacity", 1),
  0,
  COALESCE(r."buffer_before_minutes", 0),
  COALESCE(r."buffer_after_minutes", 0),
  true,
  '{}'::jsonb,
  jsonb_build_object(
    'source', '0014_schedule_subject_backfill',
    'ownerType', 'resource',
    'resourceType', r."type"::text
  )
FROM "resources" r
WHERE r."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "schedule_subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "schedule_class",
  "display_name",
  "status",
  "scheduling_mode",
  "default_capacity",
  "default_lead_time_min",
  "default_buffer_before_min",
  "default_buffer_after_min",
  "should_project_timeline",
  "policy",
  "metadata"
)
SELECT
  'schedule_subject_' || substr(md5(svc."biz_id" || ':service:' || svc."id"), 1, 26),
  svc."biz_id",
  'service',
  svc."id",
  'service',
  svc."name",
  'active',
  'exclusive',
  1,
  0,
  0,
  0,
  true,
  '{}'::jsonb,
  jsonb_build_object(
    'source', '0014_schedule_subject_backfill',
    'ownerType', 'service',
    'serviceType', svc."type"::text
  )
FROM "services" svc
WHERE svc."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "schedule_subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "schedule_class",
  "display_name",
  "status",
  "scheduling_mode",
  "default_capacity",
  "default_lead_time_min",
  "default_buffer_before_min",
  "default_buffer_after_min",
  "should_project_timeline",
  "policy",
  "metadata"
)
SELECT
  'schedule_subject_' || substr(md5(sp."biz_id" || ':service_product:' || sp."id"), 1, 26),
  sp."biz_id",
  'service_product',
  sp."id",
  'service_product',
  sp."name",
  'active',
  'exclusive',
  1,
  0,
  0,
  0,
  true,
  '{}'::jsonb,
  jsonb_build_object('source', '0014_schedule_subject_backfill', 'ownerType', 'service_product')
FROM "service_products" sp
WHERE sp."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "schedule_subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "schedule_class",
  "display_name",
  "status",
  "scheduling_mode",
  "default_capacity",
  "default_lead_time_min",
  "default_buffer_before_min",
  "default_buffer_after_min",
  "should_project_timeline",
  "policy",
  "metadata"
)
SELECT
  'schedule_subject_' || substr(md5(o."biz_id" || ':offer:' || o."id"), 1, 26),
  o."biz_id",
  'offer',
  o."id",
  'offer',
  o."name",
  'active',
  'exclusive',
  1,
  0,
  0,
  0,
  true,
  '{}'::jsonb,
  jsonb_build_object(
    'source', '0014_schedule_subject_backfill',
    'ownerType', 'offer',
    'executionMode', o."execution_mode"::text
  )
FROM "offers" o
WHERE o."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "schedule_subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "schedule_class",
  "display_name",
  "status",
  "scheduling_mode",
  "default_capacity",
  "default_lead_time_min",
  "default_buffer_before_min",
  "default_buffer_after_min",
  "should_project_timeline",
  "policy",
  "metadata"
)
SELECT
  'schedule_subject_' || substr(md5(ov."biz_id" || ':offer_version:' || ov."id"), 1, 26),
  ov."biz_id",
  'offer_version',
  ov."id",
  'offer_version',
  COALESCE(o."name", 'Offer') || ' v' || ov."version"::text,
  'active',
  'exclusive',
  1,
  0,
  0,
  0,
  true,
  '{}'::jsonb,
  jsonb_build_object(
    'source', '0014_schedule_subject_backfill',
    'ownerType', 'offer_version',
    'offerId', ov."offer_id",
    'version', ov."version",
    'executionMode', o."execution_mode"::text
  )
FROM "offer_versions" ov
LEFT JOIN "offers" o
  ON o."biz_id" = ov."biz_id"
 AND o."id" = ov."offer_id"
WHERE ov."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "schedule_subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "schedule_class",
  "display_name",
  "status",
  "scheduling_mode",
  "default_capacity",
  "default_lead_time_min",
  "default_buffer_before_min",
  "default_buffer_after_min",
  "should_project_timeline",
  "policy",
  "metadata"
)
SELECT
  'schedule_subject_' || substr(md5(l."biz_id" || ':location:' || l."id"), 1, 26),
  l."biz_id",
  'location',
  l."id",
  'location',
  l."name",
  'active',
  'exclusive',
  1,
  0,
  0,
  0,
  true,
  '{}'::jsonb,
  jsonb_build_object(
    'source', '0014_schedule_subject_backfill',
    'ownerType', 'location',
    'locationType', l."type"::text
  )
FROM "locations" l
WHERE l."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

INSERT INTO "schedule_subjects" (
  "id",
  "biz_id",
  "subject_type",
  "subject_id",
  "schedule_class",
  "display_name",
  "status",
  "scheduling_mode",
  "default_capacity",
  "default_lead_time_min",
  "default_buffer_before_min",
  "default_buffer_after_min",
  "should_project_timeline",
  "policy",
  "metadata"
)
SELECT
  'schedule_subject_' || substr(md5(cb."biz_id" || ':custom_subject:' || cb."owner_ref_type" || ':' || cb."owner_ref_id"), 1, 26),
  cb."biz_id",
  cb."owner_ref_type",
  cb."owner_ref_id",
  COALESCE(s."category", cb."owner_ref_type"),
  s."display_name",
  'active',
  'exclusive',
  1,
  0,
  0,
  0,
  true,
  '{}'::jsonb,
  jsonb_build_object(
    'source', '0014_schedule_subject_backfill',
    'ownerType', 'custom_subject'
  )
FROM "calendar_bindings" cb
JOIN "subjects" s
  ON s."biz_id" = cb."biz_id"
 AND s."subject_type" = cb."owner_ref_type"
 AND s."subject_id" = cb."owner_ref_id"
WHERE cb."owner_type" = 'custom_subject'
  AND cb."deleted_at" IS NULL
ON CONFLICT ("biz_id", "subject_type", "subject_id") DO NOTHING;

UPDATE "calendar_bindings" cb
SET "schedule_subject_id" = ss."id"
FROM "schedule_subjects" ss
WHERE cb."biz_id" = ss."biz_id"
  AND cb."schedule_subject_id" IS NULL
  AND cb."owner_type" = 'resource'
  AND ss."subject_type" = 'resource'
  AND ss."subject_id" = cb."resource_id";

UPDATE "calendar_bindings" cb
SET "schedule_subject_id" = ss."id"
FROM "schedule_subjects" ss
WHERE cb."biz_id" = ss."biz_id"
  AND cb."schedule_subject_id" IS NULL
  AND cb."owner_type" = 'service'
  AND ss."subject_type" = 'service'
  AND ss."subject_id" = cb."service_id";

UPDATE "calendar_bindings" cb
SET "schedule_subject_id" = ss."id"
FROM "schedule_subjects" ss
WHERE cb."biz_id" = ss."biz_id"
  AND cb."schedule_subject_id" IS NULL
  AND cb."owner_type" = 'service_product'
  AND ss."subject_type" = 'service_product'
  AND ss."subject_id" = cb."service_product_id";

UPDATE "calendar_bindings" cb
SET "schedule_subject_id" = ss."id"
FROM "schedule_subjects" ss
WHERE cb."biz_id" = ss."biz_id"
  AND cb."schedule_subject_id" IS NULL
  AND cb."owner_type" = 'offer'
  AND ss."subject_type" = 'offer'
  AND ss."subject_id" = cb."offer_id";

UPDATE "calendar_bindings" cb
SET "schedule_subject_id" = ss."id"
FROM "schedule_subjects" ss
WHERE cb."biz_id" = ss."biz_id"
  AND cb."schedule_subject_id" IS NULL
  AND cb."owner_type" = 'offer_version'
  AND ss."subject_type" = 'offer_version'
  AND ss."subject_id" = cb."offer_version_id";

UPDATE "calendar_bindings" cb
SET "schedule_subject_id" = ss."id"
FROM "schedule_subjects" ss
WHERE cb."biz_id" = ss."biz_id"
  AND cb."schedule_subject_id" IS NULL
  AND cb."owner_type" = 'location'
  AND ss."subject_type" = 'location'
  AND ss."subject_id" = cb."location_id";

UPDATE "calendar_bindings" cb
SET "schedule_subject_id" = ss."id"
FROM "schedule_subjects" ss
WHERE cb."biz_id" = ss."biz_id"
  AND cb."schedule_subject_id" IS NULL
  AND cb."owner_type" = 'custom_subject'
  AND ss."subject_type" = cb."owner_ref_type"
  AND ss."subject_id" = cb."owner_ref_id";
