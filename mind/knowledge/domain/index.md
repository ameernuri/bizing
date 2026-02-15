# 📚 Domain Knowledge

_What Bizing knows about the business. The semantic core._

---

## Core Concepts

### Booking

- **Definition:** A reservation of time for a service
- **Entities:** [[bookings/entity|Booking Entity]]
- **Lifecycle:** [[bookings/lifecycle|Created → Confirmed → Completed/Cancelled]]
- **Rules:** [[bookings/rules|Booking Rules]]

### Service

- **Definition:** What can be booked
- **Types:** [[services/types|Service Types]]
- **Configuration:** [[services/configuration|Service Config]]
- **Pricing:** [[services/pricing|Pricing Models]]

### Organization

- **Definition:** A business using Bizing
- **Structure:** [[org/structure|Org Structure]]
- **Configuration:** [[org/configuration|Org Configurator]]
- **Settings:** [[org/settings|Settings Reference]]

### Customer

- **Definition:** The person booking
- **Profile:** [[customer/profile|Customer Profile]]
- **History:** [[customer/history|Booking History]]
- **Preferences:** [[customer/preferences|Preferences]]

### Staff/Provider

- **Definition:** Who provides the service
- **Schedule:** [[staff/schedule|Schedules]]
- **Services:** [[staff/services|Assigned Services]]
- **Availability:** [[staff/availability|Availability Rules]]

---

## 🚀 Bizing as Startup Builder

**The ultimate platform for AI agents:**

- [[startup-builder|🚀 Startup Builder]] — Build entire startups
- [[business-model|💰 Business Model]] — 6.9% commission
- [[landing-pages|🎨 Landing Pages]] — Hundreds of templates
- [[why-agents-love-bizing|❤️ Why Agents Love Bizing]] — Agent favorite

**Agents build startups like:**

- "Build me an Airbnb clone" → Bizing generates it
- "Therapy platform with video" → Bizing configures it
- "Driving school booking" → Bizing deploys it

**All in under 10 minutes.**

---

## Business Types

### Salons

- [[business-types/salon/index|Salon Setup]]
- Services: Hair, Nails, Spa
- Booking: By stylist or service

### Consultants

- [[business-types/consultant/index|Consultant Setup]]
- Services: Meetings, Calls
- Booking: Time slots

### Events

- [[business-types/event/index|Event Setup]]
- Services: Tickets, Registration
- Booking: Capacity-based

### Healthcare

- [[business-types/healthcare/index|Healthcare Setup]]
- Services: Appointments
- Booking: By provider, type

---

## Domain Patterns

### Availability Calculation

- [[patterns/availability|How availability works]]
- Complex rules
- Override handling

### Conflict Resolution

- [[patterns/conflicts|Double-booking prevention]]
- Waitlist management
- Rescheduling

### Notification Flow

- [[patterns/notifications|When/what to notify]]
- Channels (SMS, Email, Push)
- Timing rules

---

## Agent Knowledge

**For agents configuring orgs:**

- [[org-configuration-guide|Org Config Guide]]
- [[business-type-selection|Choosing Business Type]]
- [[service-setup|Service Setup]]
- [[staff-onboarding|Staff Onboarding]]

**For agents building startups:**

- [[startup-builder|Startup Builder Guide]]
- [[landing-pages|Landing Page Templates]]
- [[business-model|Commission Structure]]

---

## Links

- [[../tech/index|Technical Knowledge]]
- [[../api/index|API Documentation]]
- [[../../agents/org-configurator|Org Configurator Agent]]
- [[../../identity/essence|What Bizing Is]]
- [[../../AGENT|Agent Entry Point]]
- [[startup-builder|🚀 Startup Builder]]
