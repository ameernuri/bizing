---
tags:
  - bizing
  - ux
  - ui
  - copy
---

# Bizing UX Principles

This document is the canonical UX/UI direction for customer-facing and biz-owner-facing surfaces.

## Product Posture

Bizing is a business platform. Booking is one capability, not the identity.

## Visual Direction (Non-Negotiable)

1. Keep aesthetics simple, black-and-white, and polished.
2. Aim for high-end software quality: calm, clear, and intentional.
3. Rich in craft, never flashy or loud.
4. Use clean sans-serif typography.
5. Prefer whitespace, hierarchy, and restraint over decorative effects.

## Copy Direction (Non-Negotiable)

1. No jargon.
2. No internal wording.
3. No persona language in user views.
4. Copy must be written for the person on the screen:
   - Biz owner copy for owner surfaces.
   - Customer copy for customer surfaces.
5. State clearly, briefly, and directly.

## Boundary Rule

Never leak dev/admin/internal concepts into customer or biz-owner views.
If information is for debugging, operations, or internal testing, keep it in internal/admin-only surfaces.

## Anti-Patterns To Reject

1. "Booking platform" positioning on primary brand surfaces.
2. Internal labels such as "client-visible interactions," "coverage snapshot," or any debug framing in end-user UI.
3. Security/trust marketing repetition that creates suspicion instead of clarity.
4. Persona-specific public copy (for example, naming Sarah on shared homepage UI).

## Implementation Checklist (For Every New Screen)

1. Is the target persona explicit (`customer`, `biz owner`, or `admin/dev`)?
2. Does visual style match the black/white polished direction?
3. Is all copy plain-language and role-appropriate?
4. Are internal controls and diagnostics hidden from end users?
5. Does the page still make sense to a first-time user in under 5 seconds?
