# UC1 Theatre Story - Sarah's First Sale

This story is the source script for the live UI and the API choreography behind it.
It is written as an experience, not a checklist.

## Cast

- Sarah: business owner
- Alex: customer booking Sarah's service
- Admin lab user: internal operator for diagnostics only (`/dev/lab`)

Role boundary rule:

- Customer sees customer flow only (`/book`)
- Business owner sees owner dashboard only (`/owner`)
- Internal tooling stays in admin lab only (`/dev/lab`)

## Act 1 - Sarah arrives

Sarah lands on `/`. She sees a confident landing page with one clear promise: start taking bookings and get paid.
Nothing technical leaks into this moment. No schema terms, no internal status language, no setup anxiety.

She clicks the primary action and moves to `/login?mode=sign_up&next=/owner`.

Behind the curtain:

- Auth client creates identity and session.
- Session context resolves via `AuthProvider` and route guards.
- If session exists, navigation moves Sarah to `/owner`.

## Act 2 - Sarah opens her dashboard

Sarah enters `/owner`. The page feels operational and clean, not like an engineering tool.
Navigation uses plain business language: calendar, appointments, customers, services, communications, reports, settings.

If her business context is sparse, the app fills essential defaults so she can move immediately:

- a business context
- a location
- a resource/provider
- a calendar and bindings
- weekday availability

Behind the curtain (owner context load):

- `GET /api/v1/bizes?perPage=200`
- `GET /api/v1/bizes/:bizId/locations?perPage=200`
- `GET /api/v1/bizes/:bizId/resources?perPage=200`
- `GET /api/v1/bizes/:bizId/calendars?perPage=200`
- `GET /api/v1/bizes/:bizId/offers?perPage=200`

If no calendar exists and Sarah creates one from the UI:

- `POST /api/v1/bizes/:bizId/calendars`
- `POST /api/v1/bizes/:bizId/calendars/:calendarId/availability-rules`
- `POST /api/v1/bizes/:bizId/calendar-bindings`
- `PATCH /api/v1/bizes/:bizId` with availability metadata

## Act 3 - Sarah defines what she sells

Sarah goes to Services and creates a service and an offer. The UI uses plain terms: service name, duration, price.
The interaction feels like shaping a real offering, not editing records.

Behind the curtain:

- `POST /api/v1/bizes/:bizId/services`
- `POST /api/v1/bizes/:bizId/offers`
- `POST /api/v1/bizes/:bizId/offers/:offerId/versions`
- `PATCH /api/v1/bizes/:bizId/offers/:offerId` to publish visibility state

Payload shape (example):

```json
{
  "name": "Compliance Advisory Session",
  "defaultDurationMin": 60,
  "basePriceMinor": 15000,
  "currency": "USD",
  "status": "published"
}
```

## Act 4 - Sarah decides who can book

In Customers/Settings, Sarah sets visibility with business language:

- Published
- Unpublished
- Private (invite only)

She chooses Published so customers can discover her.

Behind the curtain:

- `PATCH /api/v1/bizes/:bizId`

```json
{
  "visibility": "published"
}
```

This single state drives public availability and booking access checks across public routes.

## Act 5 - Alex books as a customer

Alex opens `/book`. The screen is intentionally lighter than owner UI.
It shows only customer decisions:

- choose business
- choose location
- choose service
- choose date
- choose time
- review and pay

No internal text appears. No admin concepts appear.

Behind the curtain (customer discovery and sloting):

- `GET /api/v1/bizes/public?limit=200&search=...`
- `GET /api/v1/public/bizes/:bizId/locations`
- `GET /api/v1/public/bizes/:bizId/offers`
- `GET /api/v1/public/bizes/:bizId/offers/:offerId/walk-up?...`
- `GET /api/v1/public/bizes/:bizId/offers/:offerId/availability?limit=40&locationId=...`

When Alex reserves a slot:

- `POST /api/v1/public/bizes/:bizId/booking-orders`

```json
{
  "offerId": "...",
  "offerVersionId": "...",
  "status": "confirmed",
  "requestedStartAt": "2026-03-10T17:00:00.000Z",
  "requestedEndAt": "2026-03-10T18:00:00.000Z",
  "confirmedStartAt": "2026-03-10T17:00:00.000Z",
  "confirmedEndAt": "2026-03-10T18:00:00.000Z",
  "locationId": "...",
  "totalMinor": 15000,
  "currency": "USD"
}
```

## Act 6 - Payment and confirmation

Alex lands on review and payment, taps Pay with card, and receives confirmation.
Language stays simple: review details, pay securely, booking confirmed.

Behind the curtain:

- `POST /api/v1/public/bizes/:bizId/booking-orders/:bookingOrderId/payments/stripe/payment-intents`

```json
{
  "confirmNow": true,
  "tipMinor": 0
}
```

Then the UI refreshes booking state:

- `GET /api/v1/public/bizes/:bizId/booking-orders?perPage=100`

## Act 7 - Sarah sees her first sale

Sarah returns to `/owner`.
A milestone banner appears once: "Yay! You got your first sale."
It is celebratory but calm, and dismissible.

Behind the curtain:

- Owner dashboard checks payment intents:
  - `GET /api/v1/bizes/:bizId/payment-intents?perPage=100`
- If a `succeeded` or `captured` intent exists and no local dismissal is saved for that business, the banner renders.

## Notes for implementation quality

- Typography: simple sans-serif (`font-sans`) across user-facing surfaces.
- Copy: plain language only. No internal terms in owner/customer flows.
- Boundaries: customer and owner pages contain no admin diagnostics.
- Diagnostics and scenario controls remain inside FAB/admin lab only.

## Replay definition

Use browser saga for reproducible walkthrough and screenshots:

- Command: `HOLD_MS=0 UC_ID=1 bun run --cwd code/apps/api sagas:browser`
- Latest passing artifact (this session): `/tmp/browser-saga-uc1-mmeztku4/run-manifest.json`
