# UC1 Story

## Title

Sarah lands on Bizing and gets her first paid booking.

## Experience North Star

This is not a scheduling tool demo. It is the beginning of Sarah's business.

Sarah is a solo consultant. She is just starting out. She is capable, ambitious,
and slightly overloaded. She does not want to learn a system before she can
start earning. She wants momentum. She wants the product to make her feel more
organized, more legitimate, and more ready than she felt ten minutes ago.

Bizing's job in UC1 is to convert uncertainty into traction.

The experience should feel like this:

- first, it feels easy
- then, it feels coherent
- then, it feels real
- then, it feels exciting

The customer should feel something different:

- trusted
- guided
- not rushed
- confident that booking and paying will be simple

The machine underneath is doing a large amount of coordination, but the UI
should make it feel natural and obvious.

## Product Truth

There are three audiences and the UI must respect them:

- `customer`: the person booking and paying
- `biz owner`: Sarah, who configures and runs the business
- `dev/admin`: internal tooling only

Nothing internal should leak into customer or owner surfaces.

## Scene 1

Sarah lands on the home page for the first time.

It is morning. She has decided she is done handling bookings manually in text
threads and DMs. She wants a real booking page today.

She sees a home page that feels confident and direct. The page does not greet
her like a dashboard. It greets her like the front door of a product that can
help her start a business properly. The headline gives her a clear promise:
turn your availability into paid bookings. The supporting copy makes the value
obvious without jargon. Two paths are visible: sign in if she is returning, or
create an account if she is new.

Nothing about this page feels technical. No mention of tenants, memberships,
catalog publishing, lifecycle, fulfillment, or projections. Those ideas exist
in the machine, but not in her vocabulary.

What she should feel:

- relief that she does not have to decipher the product
- belief that this is built for a real business, not a toy
- confidence that she can begin in one click

What the machine is doing:

- waiting for authentication intent
- prepared to create a user, initialize session state, and load role context
- keeping protected routes behind auth while leaving the front door open and calm

## Scene 2

Sarah creates her account.

The account creation screen is compact and respectful. It asks only for what is
needed right now: name, email, password. The page explains what the account is
for in plain language: use your account to manage your business and accept
bookings.

The tone matters. This is not account administration. It is the first step in
setting up her business.

What she should feel:

- fast progress
- no bureaucratic drag
- trust that she is entering a real product environment

What the machine is doing:

- creating the auth identity
- establishing a session cookie
- waiting for session propagation to settle
- loading auth context, memberships, active biz, and permissions

Concepts hidden from Sarah:

- session propagation races
- permission bootstrap
- active organization semantics
- cookie prefix compatibility

## Scene 3

Sarah enters the owner dashboard for the first time.

This is the first critical emotional transition. She should not land in an
empty software shell. She should land in a place that already feels like the
beginning of a business.

If she has no business yet, Bizing silently creates a starter workspace on her
behalf. It gives her a default business, a location, a provider resource, a
calendar, weekday hours, a starter service, and a starter offer. The UI should
present this not as "we generated records" but as "your studio is ready."

The calendar should be the center of gravity. Time is the thing she sells.

What she sees:

- a clean owner dashboard
- her business name in the shell
- a working weekly calendar, not a blank error state
- straightforward navigation: calendar, appointments, customers, services,
  communications, reports, settings

What she should feel:

- "I already have a real setup"
- "I can adjust this, not build it from scratch"
- "this product understands my use case"

What the machine is doing:

- creating the biz root and owner membership
- creating a primary location
- creating a default provider resource
- creating a calendar and calendar bindings
- creating default weekday availability rules
- storing availability metadata on the biz
- creating a service group, service, offer, published offer version
- reloading owner context after bootstrap

The hidden complexity:

- the product is modeling business identity, booking inventory, and scheduling
  policy, but the owner only experiences "my business is ready"

## Scene 4

Sarah refines what she sells.

She goes to Services. The experience should feel like shaping an offer, not
configuring a schema. She can create a service and then create a published offer
with a fixed duration and a price. The form should use plain terms: service
name, duration, price. It should not force her to think about versioning unless
she needs it later.

This is where the product helps her feel professional. She is not just
"available"; she now has a real thing people can book.

What she should feel:

- ownership
- increasing clarity
- confidence that customers will understand what is being offered

What the machine is doing:

- ensuring a service group exists
- creating the service row
- creating the offer row
- creating the published offer version row
- publishing the offer so it appears on customer-facing surfaces

Concepts hidden from Sarah:

- service groups
- offer versioning strategy
- policy model structure

## Scene 5

Sarah sets visibility.

She needs a sane way to decide whether people can find her booking page. The
UI should frame this as a business choice, not as access management.

The control should express three ideas clearly:

- `Published`: people can discover and book the business
- `Unpublished`: hidden while she is preparing
- `Private`: invite-only access

The important thing is that this control feels strategic, not technical.

What she should feel:

- in control of launch timing
- safe making changes
- clear on the difference between public and private

What the machine is doing:

- updating biz visibility
- ensuring public directory, offers, availability, booking, and payment routes
  all enforce the same visibility contract

## Scene 6

A customer arrives on the booking page.

The customer is not entering Sarah's dashboard. They are entering Sarah's
storefront.

The booking page should feel lighter, more direct, and more reassuring than the
owner dashboard. It should start with what matters: which business, which
service, which location if relevant, which date, which time.

The customer should never see:

- business configuration language
- internal status vocabulary
- preview labels
- lab or admin wording

What the customer sees:

- a simple booking header with Sarah's business name
- a selector for business if discovery includes more than one
- a service selector
- a location selector when needed
- a date picker that only exposes sensible dates
- time slots that feel available, not computed
- a booking details panel that reassures before commitment

What the customer should feel:

- calm
- clarity
- trust
- speed

What the machine is doing:

- listing visible businesses according to visibility rules
- listing public locations
- listing public offers
- resolving the current published offer version
- computing visible availability with lead time, advance window, blocked windows,
  and slot visibility policy

Hidden complexity:

- customers do not see scheduling internals, only bookable moments

## Scene 7

The customer chooses a time and confirms the booking.

This is the decision point. The customer has selected a time slot and is about
to commit. The UI should reduce doubt, not amplify it.

The review panel should answer exactly these questions:

- what am I booking
- with whom or where
- when is it
- how much is it

The confirm action should feel final but not scary.

What the customer should feel:

- certainty
- transparency
- no hidden surprises

What the machine is doing:

- validating that the business is still visible to this user
- validating that the offer is active and publicly bookable
- validating the offer version is published
- creating the booking for the authenticated customer
- attaching location metadata
- storing commercial totals canonically

The UI should make the moment feel human, not transactional.

## Scene 8

The machine sends confirmation.

The customer should feel immediately acknowledged. The product should not leave
them wondering whether the booking really happened.

In the current system, the message is recorded as an outbound email lifecycle
message with queued, sent, and delivered events. The UI should treat this as a
confirmation experience, not a message log.

What the customer should see:

- a confirmation state in product
- a concise confirmation email
- optionally later, a short SMS reminder if configured

What the owner should eventually see:

- message activity as part of the business operation

What the machine is doing:

- creating an outbound transactional message row
- creating message events for queued, sent, delivered
- preserving this as audit-able system behavior

Concepts hidden from users:

- provider keys
- event rows
- message lifecycle internals

## Scene 9

The customer pays.

Payment should feel like the final step of booking, not like being punted into
another system. The screen should maintain emotional continuity: you are almost
done, this is secure, here is what you are paying for.

What the customer should feel:

- safe
- unconfused
- finished, not processed

What the machine is doing:

- verifying that the booking belongs to the authenticated customer
- calculating the expected total
- creating a Stripe payment intent
- mirroring provider state into canonical payment rows
- refreshing booking state after payment

Hidden complexity:

- payment intent rows
- tender rows
- transaction allocation rows
- provider reconciliation

The user should only experience:

- amount
- payment action
- success

## Scene 10

Sarah sees her first paid booking.

This is the emotional payoff for UC1. It needs more than a neutral row in a
table. The product should mark the moment.

She returns to the owner dashboard and sees:

- the new booking in appointments
- message activity showing confirmation delivered
- reporting beginning to populate
- a celebratory callout that tells the truth without being loud

The copy should feel warm and earned:

`Yay! You got your first sale.`

Supporting copy:

`Your booking page is live, your payment worked, and your first customer is on the calendar.`

This moment should not be treated as a gimmick. It is a business milestone. It
should appear once, feel rewarding, and then get out of the way.

What Sarah should feel:

- proud
- relieved
- motivated to keep going

What the machine is doing:

- detecting the first successful paid booking milestone
- writing a one-time milestone marker so the celebration is not repeated forever
- making the booking, payment, and message data visible in reporting and owner
  activity surfaces

## UX Principles for UC1

- Every screen should answer the user's immediate question.
- Complexity should appear only when it becomes useful.
- The customer experience should feel lighter than the owner experience.
- The owner experience should feel more operational than the customer experience.
- Delight should come from momentum and clarity, not decoration.
- Internal system language must stay internal.

## Current Backend Contracts This Story Depends On

- auth identity and session establishment
- owner biz bootstrap
- public biz directory visibility enforcement
- public offers and availability
- public booking creation
- Stripe payment intent creation
- outbound lifecycle message persistence
- analytics report rendering and export

## Kimi Brief

Transform this story into UI front matter for:

- `/`
- `/login`
- `/owner`
- `/book`

Keep the current role separation intact.
Do not introduce developer language.
Do not produce generic SaaS patterns.
Design this like Sarah is starting a real business today.
