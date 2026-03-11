# Experience Thesis

Bizing's UC1 front matter converts Sarah's uncertainty into business momentum through a carefully staged emotional arc: from confident landing through frictionless setup to legitimate operations, culminating in a celebrated first sale. The UI must make complex backend orchestration feel like natural business progression—never exposing internal machinery while ensuring both owner and customer surfaces feel purpose-built for their distinct roles.

---

# Front Matter

## Scene: Landing

- **Audience:** Prospective biz owner (Sarah, unauthenticated)
- **Route:** `/`
- **Emotional goal:** Relief, belief, immediate confidence to begin
- **Visual direction:** Confident, direct, warm but not playful; generous whitespace; single focal action; no dashboard density
- **Primary UI blocks:**
  - Hero: headline "Turn your availability into paid bookings" + supporting value line
  - Primary CTA: "Start your business" (creates account)
  - Secondary path: "Sign in" (subtle, for returning users)
  - Minimal trust markers: clean typography, no clutter, no feature grids
- **Key copy:**
  - Headline: "Turn your availability into paid bookings"
  - Subhead: "One page. One link. Your business, ready today."
  - CTA: "Start your business — free"
  - Sign in: "Already have a business? Sign in"
- **Empty state:** N/A (static landing)
- **Success state:** Click transitions to `/signup` with momentum preserved
- **Error state:** N/A at this stage
- **Motion:** Subtle entrance of hero text; CTA hover state only; no loading spinners on initial paint
- **Accessibility notes:** Focus order: headline → CTA → sign in; color contrast 4.5:1 minimum; no auto-playing motion
- **Implementation notes:** No authentication check required; static render with client-side routing; preload `/signup` assets on CTA hover

---

## Scene: Account Creation

- **Audience:** Prospective biz owner (Sarah, creating identity)
- **Route:** `/signup`
- **Emotional goal:** Fast progress, no bureaucratic drag, entering a real product environment
- **Visual direction:** Compact, respectful density; clear progression indicator (step 1 of 2); no sidebar navigation yet
- **Primary UI blocks:**
  - Compact form: name, email, password
  - Context line explaining purpose
  - Submit: "Create my business"
  - Link: "Already have an account? Sign in"
- **Key copy:**
  - Title: "Create your business account"
  - Context: "Use this account to manage your business and accept bookings."
  - Submit: "Create my business"
  - Error inline: "Please check your email and try again"
- **Empty state:** N/A
- **Success state:** Redirect to `/owner` with session establishing; show subtle loading state "Setting up your business..."
- **Error state:** Inline validation with specific guidance; no generic "error occurred" messaging; preserve entered values
- **Motion:** Form fields stagger in; button loading state on submit; smooth redirect transition
- **Accessibility notes:** Required fields marked; password visibility toggle; error announcements via live region; focus to first error on validation failure
- **Implementation notes:** Handle session propagation gracefully—show loading state rather than blank screen; do not expose "initializing membership" or similar language

---

## Scene: Owner Dashboard — First Entry

- **Audience:** Biz owner (Sarah, authenticated, post-bootstrap)
- **Route:** `/owner`
- **Emotional goal:** "I already have a real setup"; relief that configuration is not required; confidence to adjust rather than build
- **Visual direction:** Operational but welcoming; calendar as center of gravity; navigation reveals scope without overwhelm; no empty states
- **Primary UI blocks:**
  - Shell: business name in header, clean navigation (Calendar, Appointments, Customers, Services, Communications, Reports, Settings)
  - Calendar: weekly view with actual availability rendered, not placeholder
  - Welcome: subtle "Your studio is ready" acknowledgment, not a tutorial overlay
  - Quick actions: "Share your booking page", "Add a service"
- **Key copy:**
  - Welcome: "Your studio is ready"
  - Subhead: "Your calendar is live. Adjust your hours, add services, or share your page when you're ready."
  - Business name: [auto-generated or editable default]
  - Navigation labels: plain verbs/nouns only
- **Empty state:** N/A — bootstrap ensures no empty calendar, no "create your first" dead ends
- **Success state:** Fully rendered calendar with availability; navigation functional; no blocking modals
- **Error state:** If bootstrap fails, graceful degradation to manual setup path (rare, not primary flow)
- **Motion:** Calendar renders with subtle slot appearance; navigation settles; no celebratory animation yet (saved for Scene 10)
- **Accessibility notes:** Calendar keyboard navigable; navigation landmarks clear; business name readable by screen reader on entry
- **Implementation notes:** Bootstrap happens server-side; UI receives hydrated state; no exposure of "creating provider resource" or similar; calendar timezone derived from business location default

---

## Scene: Services — Shaping the Offer

- **Audience:** Biz owner (Sarah, refining business)
- **Route:** `/owner/services` and `/owner/services/new`
- **Emotional goal:** Ownership, clarity, professional confidence; feeling of having a real thing to sell
- **Visual direction:** Form feels like crafting an offer, not configuring a database; plain language labels; preview of customer-facing representation
- **Primary UI blocks:**
  - Service list: existing services with status (live/paused)
  - Create flow: simple form — service name, duration, price
  - Preview: how this appears to customers
  - Publish toggle: immediate or save as draft
- **Key copy:**
  - Title: "What you offer"
  - Service name label: "Service name (customers will see this)"
  - Duration: "How long is this?"
  - Price: "Price"
  - Submit: "Save and publish"
  - Preview label: "Your customers will see:"
- **Empty state:** N/A (starter service exists), but new service form starts blank
- **Success state:** Service appears in list as "Live"; preview updates; option to "View on your booking page"
- **Error state:** Inline validation; specific guidance on pricing format, duration limits
- **Motion:** Preview updates live as fields change; success subtle checkmark, not confetti
- **Accessibility notes:** Live region for preview updates; price field with proper currency announcement; duration with unit clarity
- **Implementation notes:** No exposure of "service groups" or "offer versioning"; publish action creates version transparently; form validation before any backend call

---

## Scene: Visibility — Launch Control

- **Audience:** Biz owner (Sarah, controlling go-to-market)
- **Route:** `/owner/settings/visibility` (or within onboarding context)
- **Emotional goal:** Strategic control, safety to prepare, clarity on public vs. private
- **Visual direction:** Decision feels like a business choice; three clear options with plain consequences; no access-control vocabulary
- **Primary UI blocks:**
  - Visibility selector: three radio cards
  - Current state indicator
  - Consequence summary for each option
  - Save confirmation
- **Key copy:**
  - Title: "Who can book with you"
  - Options:
    - "Published — Anyone can find and book your services"
    - "Unpublished — Hidden while you're getting ready"
    - "Private — Only people with your link can book"
  - Save: "Update visibility"
  - Confirmation: "Your booking page is now [state]"
- **Empty state:** N/A
- **Success state:** Clear confirmation; if Published, "Share your page" CTA appears
- **Error state:** Network failure with retry; no state confusion
- **Motion:** Selected card elevates subtly; confirmation slides in; if transitioning to Published, subtle emphasis on share action
- **Accessibility notes:** Radio group properly labeled; state change announced; focus to confirmation on save
- **Implementation notes:** Single source of truth for all visibility enforcement; UI does not explain "directory" or "route enforcement"

---

## Scene: Customer Booking Page — Storefront

- **Audience:** Customer (booking Sarah's service)
- **Route:** `/book/:businessSlug` or `/book` with selector
- **Emotional goal:** Calm, clarity, trust, speed; feeling of entering a professional storefront, not a configuration tool
- **Visual direction:** Lighter than owner dashboard; generous spacing; clear progression; no operational density; reassuring before commitment
- **Primary UI blocks:**
  - Header: business name, optional business image
  - Service selector: clear names, durations, prices
  - Location selector: when multiple locations exist
  - Date picker: sensible defaults, no past dates, no unreasonable advance windows
  - Time slots: available moments, not "computed availability"
  - Booking details panel: summary before commitment
- **Key copy:**
  - Header: [Business name]
  - Service label: "What would you like to book?"
  - Location label: "Where?"
  - Date label: "When?"
  - Time label: "Choose a time"
  - Details panel: "You're booking [service] with [business] on [date] at [time]"
  - CTA: "Continue to details"
- **Empty state:** If no services published, graceful "This business is not accepting bookings" with owner-appropriate messaging (not customer-facing error)
- **Success state:** Selections made, continue to confirmation/review
- **Error state:** Slot taken while selecting — graceful refresh with next available; no technical language
- **Motion:** Smooth progression between selection steps; time slots appear with subtle stagger; no jarring reloads
- **Accessibility notes:** Full keyboard navigation through date/time selection; screen reader announces available slots count; focus management between steps
- **Implementation notes:** No exposure of "published offer version" or "availability computation"; slots appear as simple choices; enforce visibility rules silently

---

## Scene: Booking Confirmation — The Decision

- **Audience:** Customer (committing to booking)
- **Route:** `/book/:businessSlug/confirm` (or modal/inline)
- **Emotional goal:** Certainty, transparency, no hidden surprises; final but not scary
- **Visual direction:** Review-focused; clear information hierarchy; final CTA prominent but not aggressive; security reassurance subtle
- **Primary UI blocks:**
  - Review panel: what, with whom/where, when, how much
  - Customer details form: name, email, phone (if not authenticated)
  - Payment preview: amount, "You'll pay securely next"
  - Confirm action: "Confirm booking"
  - Edit links for each section
- **Key copy:**
  - Title: "Confirm your booking"
  - Review labels: "What", "Where", "When", "Total"
  - Payment note: "You'll complete payment on the next step"
  - Confirm: "Confirm booking"
  - Security: "Secure booking • Cancel anytime"
- **Empty state:** N/A
- **Success state:** Booking created, transition to payment or confirmation based on configuration
- **Error state:** Slot no longer available — specific message with alternative times; validation errors inline
- **Motion:** Review panel settles; confirm button has clear active state; transition to next step smooth
- **Accessibility notes:** Review information readable as list; confirm action has clear focus; error announcements immediate
- **Implementation notes:** Validation of all business rules before booking creation; no exposure of "booking row creation" or "commercial totals"

---

## Scene: Payment — Final Step

- **Audience:** Customer (completing transaction)
- **Route:** `/book/:businessSlug/pay/:bookingId`
- **Emotional goal:** Safety, unconfused, finished not processed; emotional continuity maintained
- **Visual direction:** Secure but not clinical; maintains business branding; clear final step indicator; no external system jarring
- **Primary UI blocks:**
  - Progress indicator: "Payment" as final step
  - Booking summary: condensed, reassuring
  - Payment form: Stripe Elements, styled to match
  - Amount: prominent, clear
  - Security markers: subtle, not overwhelming
  - Submit: "Pay [amount]"
- **Key copy:**
  - Title: "Complete your booking"
  - Summary: "[Service] with [Business] on [Date]"
  - Amount: "Total: [amount]"
  - Submit: "Pay [amount]"
  - Security: "Secure payment processed by Stripe"
  - Success: "Payment confirmed. You're all set."
- **Empty state:** N/A
- **Success state:** Clear confirmation, booking details, what happens next
- **Error state:** Card decline with specific, helpful guidance; retry without re-entry of booking details
- **Motion:** Stripe Elements load smoothly; success transition to confirmation; no redirect jarring
- **Accessibility notes:** Payment form fully keyboard accessible; error announcements clear; focus to error field on decline
- **Implementation notes:** Stripe Elements custom styled; no exposure of "payment intent" or "tender rows"; mirror state silently

---

## Scene: First Paid Booking — The Milestone

- **Audience:** Biz owner (Sarah, returning to dashboard)
- **Route:** `/owner` (with milestone detection)
- **Emotional goal:** Proud, relieved, motivated; recognized business milestone without gimmick
- **Visual direction:** Celebratory but respectful; prominent but dismissible; warm copy; not repeated
- **Primary UI blocks:**
  - Milestone callout: "Yay! You got your first sale."
  - Supporting copy: "Your booking page is live, your payment worked, and your first customer is on the calendar."
  - Dismiss: "Got it" or auto-dismiss on next navigation
  - Booking highlight: the specific booking emphasized in appointments list
  - Optional: gentle prompt to "Share your page to get more bookings"
- **Key copy:**
  - Headline: "Yay! You got your first sale."
  - Body: "Your booking page is live, your payment worked, and your first customer is on the calendar."
  - CTA: "See your booking" / "Share your page" / "Got it"
- **Empty state:** N/A (triggered by specific condition)
- **Success state:** Callout dismissed, normal dashboard operations; milestone marker prevents repeat
- **Error state:** N/A
- **Motion:** Callout enters with subtle warmth, not animation excess; dismisses smoothly; booking row has subtle highlight
- **Accessibility notes:** Callout announced on entry; dismiss action clear; focus management to main content on dismiss
- **Implementation notes:** One-time milestone marker in backend; UI checks on dashboard load; no "analytics" or "report row" language exposed

---

# Design System Notes

- **Typography:** System fonts, generous line-height for readability; no decorative display fonts
- **Color:** Warm neutrals with single accent for primary actions; no semantic color overload
- **Spacing:** Progressive density — landing spacious, owner operational, customer light
- **Elevation:** Subtle shadows for cards, none for structural elements
- **Motion:** Purposeful only — loading states, transitions, feedback; no decorative animation
- **Language:** Plain, active voice; no internal terms; no "tenant," "membership," "catalog," "lifecycle," "fulfillment"
- **Icons:** Functional only, paired with text; no icon-only critical actions
- **Forms:** Inline validation, preserved values, specific error guidance
- **Loading:** Skeleton for content, spinner for actions, never blank

---

# Open Questions

1. **Milestone persistence:** Should the "first sale" callout appear only on immediate return after payment, or on any dashboard visit until dismissed? (Story implies detection on return, but timing affects implementation.)

2. **Customer authentication:** Is payment always required to complete booking, or is there a "reserve now, pay later" path? (Story assumes payment required, but affects confirmation flow.)

3. **Multi-business discovery:** If customer lands on `/book` without specific business, what is the discovery experience? (Story mentions selector "if discovery includes more than one" — is this in scope for UC1?)

4. **Mobile priority:** Should any scenes prioritize mobile-specific patterns, or is responsive sufficient? (Story implies desktop-first consultant use case, but customer booking likely mobile.)

5. **Calendar timezone:** How is customer's timezone handled relative to business location? (Story mentions "sensible dates" but not explicit timezone UI.)
