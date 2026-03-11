# Bizing Homepage Polish

## Experience Thesis

The visitor should feel the product's promise before reading it: this is the last platform you'll outgrow. The progression from simple to scale to automate should feel like chapters in a single story, not three separate selling points. Matter-of-fact confidence beats persuasion.

## Front Matter

## Scene: Arrival and immediate orientation

- Audience: business owner arriving for the first time, plus returning owner looking for the sign-in path
- Route: `/`
- Emotional goal: immediate orientation, confidence, and a sense that the product will hold up as the business grows
- Visual direction: typographic lockup first, generous vertical breathing room, quiet but intentional hierarchy, restrained black-and-white premium surface
- Primary UI blocks:
  - Hero statement
  - Subhead
  - Primary CTA and secondary sign-in path
  - Progression sections that widen in scope from simple to scale to automate
  - Capability summary kept subordinate to the main story
- Key copy:
  - Hero headline stays: `start simple. scale without friction. automate with ease.`
  - Subhead: `Operations, finance, and growth. One system, no replatforming.`
  - Primary CTA: `See how it works`
- Empty state: not applicable for public homepage
- Success state: visitor feels the progression without needing an explicit explanation
- Error state: not applicable for the public marketing surface
- Motion: restrained page-load reveal through spacing and stagger, not decorative motion
- Accessibility notes:
  - preserve high contrast
  - keep type sizes large enough for fast scanning
  - ensure CTA hierarchy remains clear without relying on color
- Implementation notes:
  - no hero image
  - clean typographic lockup
  - generous top padding
  - thin rule beneath subhead
  - progression should be communicated through spatial expansion rather than numbered steps

# Design System Notes

- Section headers: 32px, weight 600, tighter tracking, calm and confident
- Body copy: 17px with comfortable line height and warm gray tone
- Microcopy: smaller, quieter, and structural rather than promotional
- Progression should feel spatial:
  - simple: narrow
  - scale: wider
  - automate: broadest / most resolved
- Bordered blocks should be sharper and more utility-first:
  - no border radius
  - no shadow
  - generous internal padding
  - border darkens subtly on hover
- Avoid visible divider overload; let rhythm and spacing do more of the work

# Open Questions

- Should the final automation section invert visually to mark resolution, or stay in the same tonal system?
- Should the primary CTA remain sign-up-first, or point to an on-page explanation anchor?
- Would one stronger proof point outperform the current capability summary row?
