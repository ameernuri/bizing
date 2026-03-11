DO $$ BEGIN
  CREATE TYPE capacity_reservation_kind AS ENUM ('booking_claim', 'capacity_hold');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS capacity_reservations (
  id text PRIMARY KEY,
  biz_id text NOT NULL REFERENCES bizes(id),
  reservation_kind capacity_reservation_kind NOT NULL,
  time_scope_id text,
  scope_type time_scope_type NOT NULL,
  scope_ref_key varchar(320) NOT NULL,
  effect_mode capacity_hold_effect_mode NOT NULL DEFAULT 'blocking',
  status capacity_hold_status NOT NULL DEFAULT 'active',
  quantity integer NOT NULL DEFAULT 1,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  source_ref_type varchar(80) NOT NULL,
  source_ref_id text NOT NULL,
  owner_ref_key varchar(320),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by text REFERENCES users(id),
  updated_by text REFERENCES users(id),
  deleted_by text REFERENCES users(id),
  CONSTRAINT capacity_reservations_biz_time_scope_fk
    FOREIGN KEY (biz_id, time_scope_id)
    REFERENCES time_scopes(biz_id, id),
  CONSTRAINT capacity_reservations_bounds_check
    CHECK (
      length(scope_ref_key) > 0
      AND length(source_ref_type) > 0
      AND quantity > 0
      AND ends_at > starts_at
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS capacity_reservations_biz_id_id_unique
  ON capacity_reservations (biz_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS capacity_reservations_source_scope_unique
  ON capacity_reservations (biz_id, reservation_kind, source_ref_type, source_ref_id, scope_ref_key);

CREATE INDEX IF NOT EXISTS capacity_reservations_biz_scope_window_idx
  ON capacity_reservations (biz_id, scope_ref_key, status, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS capacity_reservations_biz_source_idx
  ON capacity_reservations (biz_id, reservation_kind, source_ref_type, source_ref_id);

CREATE INDEX IF NOT EXISTS capacity_reservations_biz_time_scope_idx
  ON capacity_reservations (biz_id, time_scope_id, status, starts_at, ends_at);

INSERT INTO capacity_reservations (
  id,
  biz_id,
  reservation_kind,
  time_scope_id,
  scope_type,
  scope_ref_key,
  effect_mode,
  status,
  quantity,
  starts_at,
  ends_at,
  source_ref_type,
  source_ref_id,
  owner_ref_key,
  metadata,
  created_at,
  updated_at,
  deleted_at,
  created_by,
  updated_by,
  deleted_by
)
SELECT
  'capacity_reservation_' || substr(md5('booking_claim:' || bcc.id || ':' || clock_timestamp()::text), 1, 26) AS id,
  bcc.biz_id,
  'booking_claim'::capacity_reservation_kind,
  bcc.time_scope_id,
  bcc.scope_type,
  bcc.scope_ref_key,
  'blocking'::capacity_hold_effect_mode,
  'active'::capacity_hold_status,
  bcc.quantity,
  bcc.starts_at,
  bcc.ends_at,
  'booking_order',
  bcc.booking_order_id,
  NULL,
  bcc.metadata,
  bcc.created_at,
  bcc.updated_at,
  bcc.deleted_at,
  bcc.created_by,
  bcc.updated_by,
  bcc.deleted_by
FROM booking_capacity_claims bcc
ON CONFLICT (biz_id, reservation_kind, source_ref_type, source_ref_id, scope_ref_key) DO NOTHING;

INSERT INTO capacity_reservations (
  id,
  biz_id,
  reservation_kind,
  time_scope_id,
  scope_type,
  scope_ref_key,
  effect_mode,
  status,
  quantity,
  starts_at,
  ends_at,
  source_ref_type,
  source_ref_id,
  owner_ref_key,
  metadata,
  created_at,
  updated_at,
  deleted_at,
  created_by,
  updated_by,
  deleted_by
)
SELECT
  'capacity_reservation_' || substr(md5('capacity_hold:' || ch.id || ':' || clock_timestamp()::text), 1, 26) AS id,
  ch.biz_id,
  'capacity_hold'::capacity_reservation_kind,
  ch.time_scope_id,
  COALESCE(ts.scope_type,
    CASE ch.target_type
      WHEN 'calendar' THEN 'calendar'::time_scope_type
      WHEN 'capacity_pool' THEN 'capacity_pool'::time_scope_type
      WHEN 'resource' THEN 'resource'::time_scope_type
      WHEN 'offer_version' THEN 'offer_version'::time_scope_type
      WHEN 'custom_subject' THEN 'custom_subject'::time_scope_type
    END
  ) AS scope_type,
  COALESCE(ts.scope_ref_key, ch.target_ref_key) AS scope_ref_key,
  ch.effect_mode,
  ch.status,
  ch.quantity,
  ch.starts_at,
  ch.ends_at,
  'capacity_hold',
  ch.id,
  ch.owner_ref_key,
  jsonb_build_object(
    'targetType', ch.target_type,
    'targetRefKey', ch.target_ref_key,
    'sourceSignalType', ch.source_signal_type,
    'holdSourceRefType', ch.source_ref_type,
    'holdSourceRefId', ch.source_ref_id,
    'requestKey', ch.request_key,
    'reasonCode', ch.reason_code,
    'policySnapshot', ch.policy_snapshot,
    'holdMetadata', ch.metadata
  ),
  ch.created_at,
  ch.updated_at,
  ch.deleted_at,
  ch.created_by,
  ch.updated_by,
  ch.deleted_by
FROM capacity_holds ch
LEFT JOIN time_scopes ts
  ON ts.biz_id = ch.biz_id
 AND ts.id = ch.time_scope_id
ON CONFLICT (biz_id, reservation_kind, source_ref_type, source_ref_id, scope_ref_key) DO NOTHING;
