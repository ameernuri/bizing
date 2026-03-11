---
tags:
  - bizing
  - domain
  - generated
  - education
---

# Education Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/education.ts`
- Schema file: `packages/db/src/schema/education.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Education and multi-session program routes.

ELI5:
Some businesses do not sell just one appointment. They sell a course,
bootcamp, corporate training, or repeating program with many sessions.

These routes expose that model directly so the API can prove:
- one program can have many cohorts,
- one cohort can have many sessions,
- one learner/company attendee can be enrolled,
- attendance can be tracked session by session,
- certificates can be awarded from attendance/completion evidence.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/programs`
- `POST` `/api/v1/bizes/:bizId/programs`
- `GET` `/api/v1/bizes/:bizId/program-cohorts`
- `POST` `/api/v1/bizes/:bizId/program-cohorts`
- `POST` `/api/v1/bizes/:bizId/program-sessions`
- `GET` `/api/v1/bizes/:bizId/program-sessions`
- `PATCH` `/api/v1/bizes/:bizId/program-sessions/:sessionId`
- `POST` `/api/v1/bizes/:bizId/cohort-enrollments`
- `GET` `/api/v1/bizes/:bizId/cohort-enrollments`
- `POST` `/api/v1/bizes/:bizId/session-attendance-records`
- `GET` `/api/v1/bizes/:bizId/session-attendance-records`
- `GET` `/api/v1/bizes/:bizId/cohort-enrollments/:enrollmentId/agenda`
- `GET` `/api/v1/bizes/:bizId/program-cohorts/:cohortId/conflicts`
- `POST` `/api/v1/bizes/:bizId/certification-templates`
- `POST` `/api/v1/bizes/:bizId/certification-awards`
- `GET` `/api/v1/bizes/:bizId/certification-awards`

## Tables

- `programs`
- `program_cohorts`
- `program_cohort_sessions`
- `cohort_enrollments`
- `session_attendance_records`
- `certification_templates`
- `certification_awards`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
