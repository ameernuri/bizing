---
tags:
  - bizing
  - domain
  - generated
  - education
---

# Education Domain

This file is generated from route/schema source files and exists to keep domain docs synchronized with code reality.

## Source

- Route file: `/Users/ameer/bizing/code/apps/api/src/routes/education.ts`
- Schema file: `/Users/ameer/bizing/code/packages/db/src/schema/education.ts`

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

- `GET` `/bizes/:bizId/programs`
- `POST` `/bizes/:bizId/programs`
- `GET` `/bizes/:bizId/program-cohorts`
- `POST` `/bizes/:bizId/program-cohorts`
- `POST` `/bizes/:bizId/program-sessions`
- `GET` `/bizes/:bizId/program-sessions`
- `PATCH` `/bizes/:bizId/program-sessions/:sessionId`
- `POST` `/bizes/:bizId/cohort-enrollments`
- `GET` `/bizes/:bizId/cohort-enrollments`
- `POST` `/bizes/:bizId/session-attendance-records`
- `GET` `/bizes/:bizId/session-attendance-records`
- `GET` `/bizes/:bizId/cohort-enrollments/:enrollmentId/agenda`
- `GET` `/bizes/:bizId/program-cohorts/:cohortId/conflicts`
- `POST` `/bizes/:bizId/certification-templates`
- `POST` `/bizes/:bizId/certification-awards`
- `GET` `/bizes/:bizId/certification-awards`

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
