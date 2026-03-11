---
tags:
  - bizing
  - domain
  - generated
  - workforce
---

# Workforce Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/workforce.ts`
- Schema file: `packages/db/src/schema/workforce_core.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Workforce core routes.

ELI5:
This route family exposes workforce architecture end-to-end:
- departments, positions, assignments
- requisitions, candidates, applications + hire workflow
- performance cycles/reviews
- benefits plans/enrollments

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/workforce-departments`
- `POST` `/api/v1/bizes/:bizId/workforce-departments`
- `PATCH` `/api/v1/bizes/:bizId/workforce-departments/:workforceDepartmentId`
- `GET` `/api/v1/bizes/:bizId/workforce-positions`
- `POST` `/api/v1/bizes/:bizId/workforce-positions`
- `PATCH` `/api/v1/bizes/:bizId/workforce-positions/:workforcePositionId`
- `GET` `/api/v1/bizes/:bizId/workforce-assignments`
- `POST` `/api/v1/bizes/:bizId/workforce-assignments`
- `PATCH` `/api/v1/bizes/:bizId/workforce-assignments/:workforceAssignmentId`
- `GET` `/api/v1/bizes/:bizId/workforce-requisitions`
- `POST` `/api/v1/bizes/:bizId/workforce-requisitions`
- `PATCH` `/api/v1/bizes/:bizId/workforce-requisitions/:workforceRequisitionId`
- `GET` `/api/v1/bizes/:bizId/workforce-candidates`
- `POST` `/api/v1/bizes/:bizId/workforce-candidates`
- `PATCH` `/api/v1/bizes/:bizId/workforce-candidates/:workforceCandidateId`
- `GET` `/api/v1/bizes/:bizId/workforce-applications`
- `POST` `/api/v1/bizes/:bizId/workforce-applications`
- `PATCH` `/api/v1/bizes/:bizId/workforce-applications/:workforceApplicationId`
- `POST` `/api/v1/bizes/:bizId/workforce-applications/:workforceApplicationId/hire`
- `GET` `/api/v1/bizes/:bizId/workforce-performance-cycles`
- `POST` `/api/v1/bizes/:bizId/workforce-performance-cycles`
- `PATCH` `/api/v1/bizes/:bizId/workforce-performance-cycles/:workforcePerformanceCycleId`
- `GET` `/api/v1/bizes/:bizId/workforce-performance-reviews`
- `POST` `/api/v1/bizes/:bizId/workforce-performance-reviews`
- `PATCH` `/api/v1/bizes/:bizId/workforce-performance-reviews/:workforcePerformanceReviewId`
- `GET` `/api/v1/bizes/:bizId/workforce-benefit-plans`
- `POST` `/api/v1/bizes/:bizId/workforce-benefit-plans`
- `PATCH` `/api/v1/bizes/:bizId/workforce-benefit-plans/:workforceBenefitPlanId`
- `GET` `/api/v1/bizes/:bizId/workforce-benefit-enrollments`
- `POST` `/api/v1/bizes/:bizId/workforce-benefit-enrollments`
- `PATCH` `/api/v1/bizes/:bizId/workforce-benefit-enrollments/:workforceBenefitEnrollmentId`

## Tables

- `workforce_departments`
- `workforce_positions`
- `workforce_assignments`
- `workforce_requisitions`
- `workforce_candidates`
- `workforce_applications`
- `workforce_candidate_events`
- `workforce_performance_cycles`
- `workforce_performance_reviews`
- `workforce_benefit_plans`
- `workforce_benefit_enrollments`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
