---
date: 2026-02-17
tags:
  - research
  - use-cases
  - booking
  - scenarios
  - comprehensive
  - v3
---

# Comprehensive Booking Use Cases v3.0: Expanded Catalog (Natural Language)

> Exhaustive human-language descriptions of booking scenarios in the same style as v2. This version keeps the original catalog, fixes inconsistent logic, and adds missing production-grade scenarios.

---

## Configuration Principle (Simple to Complex)

### Simple setup must stay simple
For common SMB use cases, owners should be able to launch with a short setup flow:
- Select service type
- Set weekly hours
- Set base price and duration
- Add cancellation/deposit policy
- Publish booking link

No advanced rule builder should be required for this path.

### Complex setup must still be possible
For advanced businesses, the platform must support layered rules without forcing them onto simple users:
- Per-service availability
- Multi-resource constraints
- Manual peak/holiday pricing overrides
- Approval workflows and eligibility rules
- Multi-location and multi-organization logic

The same core model should power both paths.

---

## Part 1: Universal / Table Stakes (Must Work in v1.0)

### UC-1: The Solo Consultant (Fixed Duration)
**Who:** Independent professional (therapist, coach, consultant)
**What:** Offers 1-on-1 sessions with fixed time slots
**Needs:**
- Simple online booking page
- Fixed-duration appointments (e.g., 50 minutes)
- Basic availability (M-F 9-5)
- Email confirmations
- Calendar sync (Google/Outlook)
- Payment collection (Stripe)
- Simple cancellation (24-hour notice)
- Booking notes ("allergic to lavender")

**Scenario:** Sarah is a career coach. Clients visit her booking page, see available 50-minute slots, pick a time, enter credit card, receive Zoom link. Cancel more than 24 hours ahead = automatic refund. Sarah sees all bookings in Google Calendar. She adds private note: "This client is switching careers from finance to tech."

---

### UC-2: The Solo Consultant (Variable Duration)
**Who:** Consultant who lets clients choose session length
**What:** Flexible appointment duration chosen by client
**Needs:**
- Variable duration selection (30 minutes to 4 hours)
- Hourly pricing that scales with duration
- Availability shown in variable chunks
- Automatic buffer calculation based on selected duration
- Booking summary: "2.5 hours @ $100/hr = $250"

**Scenario:** Mark is a business consultant. Clients select anywhere from 1-hour quick consults to 4-hour deep dives. System shows his availability in flexible blocks. Client books 2.5 hours. System automatically adds 15-minute buffer after. If client needs to extend mid-session, provider can modify booking and charge additional time.

---

### UC-3: The Hair Salon with Commission Tracking
**Who:** Small service business with multiple staff and commission splits
**What:** Various services with different durations, commission tracking per provider
**Needs:**
- Multiple service types (15 min to 3 hours)
- Multiple providers (stylists) with individual calendars
- Commission configuration per provider (60% to stylist, 40% to salon)
- Automatic commission calculation per booking
- Pay stub generation with earnings breakdown
- Buffer time between appointments (cleanup)
- Walk-in support (queue management)
- Service add-ons (deep conditioning)
- Deposit for expensive services (color)

**Scenario:** Maria runs a salon with 4 stylists. Each stylist has their own commission rate - veterans get 70%, juniors get 50%. Customer books color with Stylist A (senior, 70% commission, $200 service = $140 to stylist). System tracks this automatically. Walk-ins join digital queue with estimated wait times. At month end, system generates pay stubs showing: base services, add-ons, tips, total commission owed.

---

### UC-4: The Salon with Provider Favorability/Ranking
**Who:** Salon using performance-based slot allocation
**What:** Top-rated providers get priority booking slots, new providers get overflow
**Needs:**
- Provider ranking system (rating + review count + tenure)
- Favorability score calculation
- Slot allocation based on favorability
- Manual admin override for seasonality
- Veteran status tracking
- Performance analytics (booking rate, cancellation rate)

**Scenario:** Salon has 5 stylists. Stylist A: 4.9 stars, 200 reviews, 5 years = favorability score 95. Stylist E: 3.8 stars, 15 reviews, 2 months = score 45. Prime slots (Saturday 10am-2pm) only shown for Stylists A-C. New stylist E only gets Tuesday-Thursday slots until score improves. Manager can temporarily boost a stylist's favorability during busy seasons.

---

### UC-5: The Medical Clinic with Room Pairing
**Who:** Healthcare provider with specific room requirements
**What:** Appointments requiring specific rooms/equipment, provider-room pairing
**Needs:**
- Provider + room pairing (Dr. Smith needs Exam Room 2 with her equipment)
- Room-specific availability (if Room 2 breaks, Dr. Smith's appointments pause)
- Different appointment types (annual physical vs sick visit)
- Insurance verification before booking
- Patient forms completed online
- Reminder calls/texts (reduce no-shows)
- Waitlist for cancellations
- HIPAA-compliant everything
- Multi-type notes (clinical, billing, patient-facing)

**Scenario:** Family practice has 3 doctors and 5 exam rooms. Dr. Jones is always paired with Room 3 (contains her specialized equipment). If Room 3's examination table breaks, system automatically blocks all Dr. Jones' appointments until room repaired. Annual physicals = 30 minutes + 15 min buffer for notes. Sick visits = 15 minutes. Patient cancels? Waitlist notified in priority order (established patients first).

---

### UC-6: The Medical Clinic with Approval Workflow
**Who:** Specialist requiring manual review before confirmation
**What:** Complex appointments that need provider approval
**Needs:**
- Request-based booking (not immediate confirmation)
- Provider approval workflow (accept, decline, or suggest alternative)
- Approval deadline (respond within 24 hours)
- Hold card but don't charge until approved
- Patient notification of approval/decline
- Reason field for decline

**Scenario:** Patient requests appointment with renowned cardiologist. Submits request with symptoms and referral info. Cardiologist reviews within 24 hours - can accept, decline ("not taking new patients"), or suggest alternative time. Only charged upon approval. If no response in 24 hours, patient gets "Still reviewing, will update soon" notification.

---

### UC-7: The Fitness Class Studio
**Who:** Gym or boutique fitness with group classes
**What:** Group classes with capacity limits, equipment assignment
**Needs:**
- Class capacity (max 30 people)
- Minimum to run (cancel if under 5)
- Instructor assignment
- Room assignment
- Equipment per participant (bike #1, bike #2)
- Membership vs drop-in pricing
- Late cancellation fees
- Waitlist
- Cancellation tracking (3 strikes = penalty)

**Scenario:** Spin City offers 6 classes daily. Each bike is numbered; members have favorites. Classes need 5 people to run or cancelled 2 hours before with full refund. Member Sarah loves bike #12. If bike #12 taken, system offers #11 or #13 as alternatives. If class full, join waitlist. If Sarah cancels within 8 hours, charged $10. After 3 late cancellations in a month, booking privileges suspended for 2 weeks.

---

### UC-8: The Tutoring Center with Packages
**Who:** Education service with session packages
**What:** Recurring sessions with package deals
**Needs:**
- Weekly recurring bookings (Tuesdays 4pm)
- Subject matching (algebra tutor, not English)
- Parent booking for child
- Progress notes per session
- Package deals (buy 10 sessions, get 1 free)
- Package tracking (sessions remaining: 7 of 10)
- Substitute tutor if regular is sick
- Expiration dates on packages (use within 6 months)

**Scenario:** Johnsons buy "20 Math Sessions" package for $1800 (10% discount). Every Tuesday 4pm with Ms. Rodriguez. System shows: "Sessions remaining: 17 of 20. Expires: Aug 15, 2026." If Ms. Rodriguez sick, system assigns substitute Mr. Chen (also math-certified) and notifies family. After each session, tutor adds notes: "Covered quadratic equations, struggled with factoring, review next week."

---

### UC-9: The Front Desk Receptionist Calendar
**Who:** Receptionist managing multiple providers
**What:** Central view of all provider calendars with different permissions
**Needs:**
- Central calendar view showing all providers
- Overlay or side-by-side display
- Different permissions than providers (can book, can block, can't see patient details)
- Walk-in booking capability
- Override availability ("emergency slot")
- Real-time updates
- Patient privacy (sees "blocked" not patient names)

**Scenario:** Medical receptionist sees 4 doctors' calendars overlaid. Can see Dr. A has opening at 2pm, Dr. B is full. Walk-in patient arrives - receptionist checks "who's available in next 30 minutes?" and books them. Can see Dr. C's slot says "blocked" but not "John Smith - physical." Can add emergency appointment overriding normal availability for urgent cases.

---

## Part 2: Common / Expected Features (Should Have)

### UC-10: The Multi-Location Chain
**Who:** Business with multiple branches
**What:** Same services offered at different locations
**Needs:**
- Location selection by customer
- Different hours per location
- Some providers work multiple locations
- Transfer bookings between locations
- Location-specific pricing (downtown premium)
- Central management view
- Location-specific availability

**Scenario:** Clean Teeth Dental has 5 offices. Patients can book at any location. Dr. Williams works Mondays downtown, Wednesdays suburban. Prices 10% higher downtown (rent premium). If downtown X-ray machine breaks, appointments auto-transfer to nearest location with capacity and patient gets text: "Your appointment moved to our Midtown location (same time)."

---

### UC-11: The Multi-Provider Appointment with Commission Split
**Who:** Services requiring multiple people with different pay rates
**What:** One booking, multiple staff, automatic commission calculation
**Needs:**
- Primary + assistant assignment
- All must be available for slot to show
- Different pay rates per role (lead: $150, assistant: $75)
- Automatic commission calculation per person
- Backup if primary unavailable
- Role-based compensation rules

**Scenario:** Wedding photography package: lead photographer ($300), second shooter ($150), assistant ($75). Total: $525 package. Customer pays $525. System automatically splits: lead gets $300, second gets $150, assistant gets $75 on their pay stubs. If lead gets sick 2 days before, backup lead activated and gets full $300 rate.

---

### UC-12: The Equipment-Required Service with Auto-Maintenance
**Who:** Services needing specific equipment with automated maintenance
**What:** Provider + equipment must both be free, automatic maintenance scheduling
**Needs:**
- Equipment calendar (MRI machine, massage table)
- Equipment maintenance blocks
- Auto-maintenance trigger ("after 40 hours use, schedule cleaning")
- Different equipment for different services
- Usage tracking per equipment
- Equipment failure cascade handling

**Scenario:** MRI clinic has 2 machines. Machine A auto-schedules maintenance every 100 scans or 40 hours of use. At 35 hours, system creates "maintenance block" in calendar. If Machine A breaks unexpectedly, all its appointments for next 7 days get reassigned to Machine B or patients notified to reschedule.

---

### UC-13: The Multi-Day Rental with Gap Management
**Who:** Equipment or property rental
**What:** Bookings spanning multiple days with cleaning gaps
**Needs:**
- Check-in/check-out times
- Gap days/hours for cleaning/service
- Different daily vs weekly rates
- Damage deposit hold
- Late return fees
- Different return location (one-way rental)
- Gap time calculation and enforcement

**Scenario:** Beach House Rentals: Check-in 4pm, check-out 11am. Cleaner needs 5 hours between guests. If Guest A checks out 11am, Guest B can't check in until 4pm (5-hour gap). System enforces this - no booking possible that violates gap. Weekly rate 20% off. $500 damage deposit held, released 48 hours after checkout if no issues reported.

---

### UC-14: The Corporate Training with Attendance Tracking
**Who:** B2B training provider
**What:** Multi-session programs for companies with attendance
**Needs:**
- Multi-session packages (5 weekly sessions)
- Attendance tracking per session
- Certificate upon completion (80% attendance required)
- Company pays (invoicing, not immediate charge)
- Substitute employees (anyone from company can attend)
- Minimum attendance to run class
- Makeup session options

**Scenario:** TechCorp buys "Leadership 101" for 12 employees. 5 Tuesday afternoons. Attendance tracked each week: Sarah attended 4/5, John attended 5/5. Sarah completes course (80% threshold met). John gets "Perfect Attendance" note on certificate. If fewer than 8 show up, class rescheduled. If employee misses session 3, can make up at another company's session next week.

---

### UC-15: The Mobile Service with Route Optimization
**Who:** Provider travels to customer
**What:** Location-based scheduling with optimized routes
**Needs:**
- Service area definition (zip codes or radius)
- Travel time between appointments
- Optimized route planning (minimize drive time)
- Customer location saved
- "I'm on my way" notifications
- ETA updates
- Unpaid drive time tracking (for timesheets)

**Scenario:** Mike's Mobile Dog Grooming serves 20-mile radius. System optimizes daily route: 9am Smiths, 10:15am Johnsons (12 min drive), 11:30am Parkers. Drive time tracked but unpaid - only grooming time paid at $40/hr. Customer gets "Mike is 10 minutes away" text when he's approaching. If traffic delays, ETA updates automatically.

---

## Part 3: Advanced Features (Occasional)

### UC-16: The Package Deal with Expiration
**Who:** Any service business
**What:** Pre-paid bundles that are flexible across services, with expiration and transfer rules
**Needs:**
- Buy 5 get 1 free structure
- Track remaining sessions
- Expiration dates (use within 6 months)
- Transferable to friend
- Partial refund for unused sessions (prorated)
- Package sharing within household

**Scenario:** Yoga studio sells a "10-class flex pass" for $150 (vs $20 drop-in). Sarah buys one, attends 6 classes, then moves away. She transfers the remaining 4 classes to her friend (transfer fee: $5). Pass expires 6 months from purchase. If she requests a refund instead, the system calculates unused value minus consumed discount and transfer/cancellation policy, then shows the exact amount before confirmation.

---

### UC-17: The Dynamic/Surge Pricing
**Who:** High-demand limited supply
**What:** Price changes based on demand
**Needs:**
- Surge pricing algorithm (Uber model)
- Last-minute discounts to fill empty slots
- Early bird pricing
- Waitlist with priority bidding
- Fill-rate based pricing (20% full = $20, 80% full = $30)

**Scenario:** Celebrity stylist has 4 slots per week. Base price $200. If 10+ people want same slot, price surges to $400. If slot still empty 2 hours before, price drops to $150 to fill it. VIP clients ($50/month membership) see prices 24 hours before general public, avoiding surge.

---

### UC-18: The Seat Selection Venue
**Who:** Venues with specific seating
**What:** Customer picks exact seat/spot
**Needs:**
- Visual seat map
- Different pricing per seat (front row premium)
- Group seating (keep seats together)
- Accessibility seating
- Hold seats while paying (10-minute reservation)
- Seat preferences (aisle vs middle)

**Scenario:** Theater sells tickets online. Seat map shows: Orchestra $75, Mezzanine $50, Balcony $35. Row A (front) $95. Wheelchair accessible seats are clearly marked. Customer selects 4 seats together, and the seats are held for 10 minutes during checkout. If payment fails, seats are released automatically. For group bookings, the system recommends adjacent seats first, but can allow split seating when the customer explicitly accepts it.

---

### UC-19: The Waitlist with Auto-Offer and Pricing
**Who:** High-demand services
**What:** Priority waitlist that can auto-offer a released slot with a response timer
**Needs:**
- Waitlist queue with position
- Pay to join waitlist ($5 fee)
- Automatic offer when slot opens
- Time to accept (2 hours)
- Auto-confirm if customer opted into "instant accept"
- Fee policy if offer is declined after acceptance
- Priority tiers (members first)
- Refund if never gets spot

**Scenario:** Popular restaurant is fully booked, with 50 people on the waitlist for Saturday 7pm. Joining costs $5. When a cancellation happens, the first person in line receives an offer and has 2 hours to accept. If they enabled "instant accept," the system confirms automatically and charges according to policy. If they decline or time out, the offer moves to the next person. If they never receive a slot by the waitlist cutoff, the $5 waitlist fee is refunded.

---

### UC-20: The First-Confirm-First-Booked Waitlist
**Who:** Fair competition for limited slots
**What:** Multiple people notified simultaneously, first to claim gets it
**Needs:**
- Broadcast notification to all waitlisters
- Race condition handling (first tap wins)
- Real-time status updates ("Claimed by someone else")
- Auto-refresh showing new availability
- Equal opportunity (no priority tiers)

**Scenario:** 10 people on waitlist for sold-out yoga class. Spot opens. All 10 get simultaneous notification: "Spot available! Tap to claim." Three people tap within 2 seconds. First tap (Sarah) gets booking confirmation. Other two see "Sorry, claimed by another user" with option to join waitlist for next opening.

---

### UC-21: The Recurring Subscription with Pause
**Who:** Ongoing services
**What:** Same time every week/month indefinitely with flexibility
**Needs:**
- Weekly recurring (every Tuesday 2pm)
- Skip individual occurrences
- Reschedule single instance
- Automatic payment (subscription)
- Pause subscription (keep slot reserved)
- Credit rollover for unused time

**Scenario:** House cleaner every other Friday 9am. $120/month subscription. Homeowner can skip specific dates (vacation) without losing subscription. Can move one cleaning to Thursday for that week only. Pauses for 2 months (maternity leave) - subscription on hold, same time slot reserved for return. Unused hours from previous month rollover as credit.

---

### UC-22: The Tour/Experience with Minimum Viable
**Who:** Guided experiences
**What:** Fixed-start group events with minimums
**Needs:**
- Minimum to run (need 4 people)
- Maximum capacity (12 people)
- Multiple time slots per day
- Different languages
- Weather-dependent (with cancellation policy)
- Guide assignment

**Scenario:** Walking tour company offers "Historic Downtown" at 10am and 2pm daily. Tours need at least 4 people or cancelled (full refund). Max 12 per guide. Spanish and English options. If severe weather forecast, guests can reschedule or get refund. If only 3 book by T-2 hours, tour cancelled with apologies and rebooking offers.

---

## Part 4: Enterprise & Complex

### UC-23: The Franchise Chain with Royalty
**Who:** Franchisor with franchisee locations
**What:** Brand consistency with local control, royalty tracking
**Needs:**
- Franchisee operates independently
- Brand standards enforced
- Royalty tracking per booking (6% to franchisor)
- Corporate visibility across all locations
- Transfer customers between franchisees
- Marketing fund contributions
- Centralized reporting

**Scenario:** SuperCuts has 500 franchise locations. Each owner manages staff and bookings. Corporate requires all use same booking system, same service names, same pricing tiers. Every $100 haircut: $94 to franchisee, $6 royalty to corporate. Corporate marketing team runs "$10 off all cuts" promo across all locations with one click. Franchisees can't opt out.

---

### UC-24: The Multi-Step Medical Procedure
**Who:** Complex healthcare with prerequisites
**What:** Multi-step process over days with dependencies
**Needs:**
- Pre-appointment requirements (fast 12 hours before)
- Multiple appointments linked (consult → procedure → follow-up)
- Different providers each step
- Insurance pre-authorization
- Care instructions between appointments
- Prerequisite checking (can't book surgery without consultation)

**Scenario:** Colonoscopy requires: 1) Consultation with doctor, 2) Pre-procedure prep kit pickup, 3) Procedure day, 4) Follow-up call. System books all 4 at once with appropriate gaps. Patient gets reminder 1 week before to start special diet. Can't book procedure without completed consultation showing in records. Prep kit must be picked up 3 days before procedure.

---

### UC-25: The Multi-Resource Event
**Who:** Event planners, weddings, productions
**What:** One event requiring multiple coordinated resources
**Needs:**
- Venue + catering + AV + staff all in one booking
- All must be available same time
- Quote/proposal before booking
- Partial deposits (venue now, catering later)
- Contingency planning (backup venues)
- Resource dependencies

**Scenario:** Wedding needs ceremony space, reception hall, caterer, DJ, photographer, florist. Couple gets package quote: $15,000. They pay 25% deposit ($3,750) to hold date. 6 months before: pay caterer deposit. 1 month before: final headcount and payment. If outdoor ceremony selected, indoor backup automatically reserved at no extra charge until day-before weather decision.

---

### UC-26: The Union Production with Complex Rules
**Who:** Film/TV/stage production
**What:** Complex scheduling with union rules
**Needs:**
- Cast + crew + equipment + locations
- Union-mandated break times
- Overtime calculations (time-and-a-half after 8 hours)
- Child actor restrictions (school hours, tutor, max 6 hours)
- Location permits with time windows
- Weather contingencies
- Call sheet generation

**Scenario:** Movie shoot needs lead actor, stunt double, director, camera crew, street location (permitted 6am-6pm only). Union rules: meal break every 6 hours, 1 hour minimum. Past 8 hours = overtime rates. Child actor (10 years old): max 6 hours on set, must have 3 hours tutoring, done by 4pm. System builds schedule backwards from 4pm, ensures all constraints met, generates call sheets.

---

### UC-27: The Equipment Sharing Pool
**Who:** Organizations sharing expensive equipment
**What:** Multiple departments booking same resources
**Needs:**
- Priority levels (emergency surgery vs training)
- Equipment checkout/check-in
- Usage tracking (hours/miles)
- Maintenance scheduling
- Cost allocation per department
- GPS tracking for vehicles
- Overbooking prevention

**Scenario:** Hospital system shares 3 MRI machines across 5 locations. Priority: Emergency (stroke) > Urgent (suspected tumor) > Scheduled (routine screening). Real-time availability shows all machines. At 8pm, emergency scan can bump tomorrow's routine appointment (patient notified, rescheduled). Each scan logs machine hours. After 1000 hours, automatic maintenance block. Usage costs billed to each department monthly.

---

### UC-28: The Airline-Style Overbooking
**Who:** High no-show industries
**What:** Intentionally book more than capacity
**Needs:**
- Historical no-show rates by service/time
- Overbooking algorithm (book 105% of capacity)
- Volunteer incentives (discount for taking later slot)
- Compensation for bumped customers
- Real-time capacity adjustment
- No-show prediction

**Scenario:** Dentist knows 15% of patients no-show. Books 17 appointments for 16 chairs. If everyone shows, offers $50 credit to volunteer to reschedule. System learns: Monday mornings 5% no-shows, Friday afternoons 25%. Adjusts overbooking accordingly. Predicts Sarah has 30% no-show probability based on history - her appointment counts as 0.7 toward capacity, allowing slight overbooking.

---

### UC-29: The Conditional/Rule-Based Booking
**Who:** Regulated industries
**What:** Can only book if conditions met
**Needs:**
- Prerequisites (must have had consultation first)
- Age restrictions (21+ for certain services)
- Certification requirements (must be certified diver)
- Medical clearances
- Background checks
- Expiration tracking (certifications expire)

**Scenario:** Skydiving company requires: 1) Tandem jump first, 2) Ground school completed, 3) Medical clearance from doctor (good for 1 year), 4) Age 18+. System checks all before allowing solo jump booking. Diver got medical clearance 13 months ago - expired! Booking blocked until renewal submitted. After tandem jump completed yesterday, system unlocks ground school booking.

---

## Part 5: Edge Cases & Special Scenarios

### UC-30: The Standing Reservation
**Who:** VIP or recurring customers
**What:** Same slot reserved indefinitely until cancelled
**Needs:**
- Permanent hold (every Friday 2pm)
- Pay monthly regardless of attendance
- Easy cancellation of single occurrence
- Priority rebooking if cancelled
- Pause without losing slot

**Scenario:** CEO has standing weekly massage every Friday 2pm. Charged $400/month whether they come or not. Can cancel one Friday for business travel, but slot held for next week. If they need to reschedule within same week, gets priority over other requests. Can pause for vacation month without losing preferred time permanently.

---

### UC-31: The Floating Appointment
**Who:** Flexible timing
**What:** Book without specific time, get assigned later
**Needs:**
- "Any time Tuesday" or "This week" booking
- Provider assigns specific slot based on optimization
- Customer approval or auto-accept
- Time window selection (morning, afternoon, evening)
- Reassignment if needed

**Scenario:** Patient needs MRI "sometime this week." Selects "Tuesday-Thursday, morning preferred." Books floating appointment. System optimizes: assigns Wednesday 10:30am based on technician availability and machine schedule. Patient gets text: "Assigned Wednesday 10:30am. Reply YES to confirm or call to reschedule." No response in 2 hours = automatic confirmation.

---

### UC-32: The Reverse Auction Marketplace
**Who:** Service marketplace
**What:** Customers post needs, providers bid
**Needs:**
- Customer posts requirements with budget/timeline
- Providers submit bids (price + availability)
- Provider portfolios/reviews visible
- Customer reviews and selects winner
- Booking created from winning bid
- Rating both directions
- Marketplace fee (5% to platform)

**Scenario:** Homeowner posts: "Need roof repair, 2000 sq ft asphalt shingles, by next Friday, budget $2000-$3000." Three roofers bid: ABC Roofing $2500 (Thursday), Top Roof $2300 (Friday), Quick Fix $2800 (tomorrow). Homeowner reviews portfolios, sees ABC has 4.8 stars and 50 reviews, picks them. Booking created at $2500. Bizing takes 5% fee ($125). Both parties rate each other after completion.

---

### UC-33: The Cascading Appointment
**Who:** Sequential dependent services
**What:** One booking triggers downstream bookings
**Needs:**
- Initial booking creates follow-ups automatically
- Linked appointments (color → tone → cut)
- Different providers per step
- Time between steps (processing time)
- Skip/cancel affects downstream
- Package pricing for full sequence

**Scenario:** Hair transformation package: Bleach (2 hours) → Wait 30 min → Tone (1 hour) → Wait 20 min → Cut (30 min). Customer books "Full Platinum Transformation" - one price, one booking. System schedules 4.5-hour block, knows it's 3 services with gaps. If bleach step cancelled day before, downstream tone and cut auto-cancelled with customer notification and rebooking offer.

---

### UC-34: The Multi-Timezone Coordination
**Who:** Global teams, telehealth across borders
**What:** Find times working across timezones
**Needs:**
- All parties see times in their timezone
- System finds overlap (9am NY = 6am LA = 11pm Tokyo)
- Rotate inconvenient times fairly
- DST handling with stored timezone snapshots
- Visual timezone converter
- Suggest alternatives

**Scenario:** Global team meeting needs London, New York, and Sydney participants. System shows: "Proposed: Tuesday 9am ET / 2pm GMT / 11pm AEDT." Sydney participant says that is too late. System suggests: "Wednesday 7am ET / 12pm GMT / 9pm AEDT." It stores each participant's timezone at booking time so reminders and history remain accurate when daylight saving changes later.

---

### UC-35: The Disaster Recovery Mass Reschedule
**Who:** Critical services
**What:** Continue operating when primary fails
**Needs:**
- Automatic failover to backup location
- Mass customer notification
- Provider reassignment
- Emergency contact override
- Post-disaster rescheduling en masse
- Priority triage (urgent vs routine)

**Scenario:** Fire closes Downtown Medical Clinic. System automatically: 1) Identifies all patients with appointments next 48 hours (247 appointments), 2) Sends batch text: "Downtown closed due to emergency. Reply 1 for Uptown location, 2 for reschedule, 3 for cancel," 3) Processes 200 responses automatically (180 choose Uptown, 30 reschedule, 10 cancel), 4) Prioritizes urgent appointments for same-day Uptown slots, 5) Updates all calendars in real-time.

---

## Part 6: New Concepts (v3.0 Refinements)

### UC-36: The Company as Provider
**Who:** Businesses that provide services (not individuals)
**What:** "ABC Plumbing Corp" not "John the Plumber"
**Needs:**
- Company profile with multiple technicians
- Dispatch assignment (who goes where)
- Company handles scheduling, not individual
- Unified company reviews (not per-technician)
- Technician swap without customer knowing
- Company-level availability, technician-level assignment

**Scenario:** Customer books "ABC Plumbing" for Tuesday 2pm. ABC's dispatcher sees 3 technicians available, assigns Technician Mike based on location/skill. Customer gets notification "ABC Plumbing arriving Tuesday 2pm." Day of, Mike sick, dispatcher reassigns to Technician Sarah. Customer never knows - just sees "ABC Plumbing" arrival. Leaves review for "ABC Plumbing" overall, not individual tech.

---

### UC-37: The Household/Family Account
**Who:** Families or groups sharing bookings
**What:** One account, multiple people, permissions
**Needs:**
- Parent books for child
- Spouse sees/modifies partner's bookings
- Separate profiles per family member
- Family package pricing (shared pool)
- Permissions (teen can book but parent gets notified)
- Household member management
- Delegated authority

**Scenario:** Smith family account: Mom, Dad, Teen (16), Child (10). Mom books pediatrician for Child. Dad can see it and reschedule if needed. Teen books tennis lessons - Mom gets notification "Jamie booked tennis lesson Friday 4pm." Family has "10 swim lessons" package shared across all members - anyone can use. Mom has full authority, Teen has limited, Child has none.

---

### UC-38: The Product + Service Bundle
**Who:** Businesses selling services with physical goods
**What:** Haircut + shampoo, massage + oil, training + materials
**Needs:**
- Service with product add-on
- Product pickup timing (now or at appointment)
- Inventory tracking
- Shipping if not pickup
- Product-only purchases
- Digital products (download links)
- Bundle pricing (cheaper together)

**Scenario:** Salon offers "Luxury Hair Package" - cut/color ($150) plus take-home shampoo/conditioner ($40 value). Customer chooses: "Give products at appointment" or "Ship to me." If shipping, added to order with $8 shipping, tracking number provided. Inventory decrements when order placed (not when picked up). Digital option: "Hair Care Guide" PDF download included.

---

### UC-39: The Program with Attendance Tracking
**Who:** Multi-session courses, certifications
**What:** Cohort-based program with milestones, attendance, and graduation outcomes
**Needs:**
- Enroll once, attend multiple sessions
- Track attendance per session (present/absent)
- Makeup sessions for missed classes
- Completion certificate (80% attendance required)
- Payment plans (monthly for 3-month program)
- Progress dashboard
- Prerequisites checking

**Scenario:** "Yoga Teacher Training" runs Saturdays 9am-5pm for 12 weeks as one named cohort. Sarah enrolls and pays in 3 monthly installments ($400/month). She attends 11 of 12 sessions, completes the required practicum, and crosses the graduation threshold. System marks her as "Complete" and sends a certificate. If she misses Session 8, she can make it up in a designated makeup cohort and keep the same graduation timeline.

---

### UC-40: The Cascading Availability (Controlled Access)
**Who:** High-demand providers managing demand
**What:** Open slots progressively, not all at once
**Needs:**
- Only show next 3 available slots initially
- When one books, open next slot
- Premium pricing for "skip the line" (see 10 slots)
- Loyalty gets earlier access (30 days vs 7 days)
- Prevent scalping
- Reward regular customers

**Scenario:** Celebrity therapist books 30 days out. Regular patients see only next 3 available slots (oldest first). When one books, next month's slot becomes visible. VIP patients ($100/year membership) see 10 slots ahead. Patient wants specific date not shown yet - can pay $50 "priority access" to unlock it. Regulars who've had 10+ sessions get 14-day view instead of 7-day.

---

### UC-41: The Filler Booking Discount
**Who:** Avoiding empty slots
**What:** Offer discounts to fill last-minute openings
**Needs:**
- Detect empty slots within 24-48 hours
- Calculate discount percentage
- Target past customers who might book
- SMS/email blast: "50% off tomorrow 2pm - first to book!"
- Time-limited offers (expires in 2 hours)
- Revenue protection (better 50% than 0%)

**Scenario:** Photographer has empty slot tomorrow 2pm (normally $300). System detects at risk, sends to 20 past clients: "Flash Sale: $150 for tomorrow 2pm portrait session. First to book gets it!" Slot fills in 8 minutes. If no takers after 2 hours, discount increases to 60% off and resent to wider list.

---

### UC-42: The Host Cancellation Penalty
**Who:** Penalizing provider cancellations
**What:** Financial and reputation consequences for late cancellations
**Needs:**
- Cancellation window tracking (within 48 hours = penalty)
- Financial penalty (lose 20% of fee)
- Favorability score impact
- Points system affecting future slot allocation
- Strike system (3 strikes = suspension)
- Emergency exceptions

**Scenario:** Doctor cancels appointment within 48 hours. Loses $40 of $200 fee (20% penalty). Favorability score drops from 85 to 78. After 3 late cancellations in a month, temporarily removed from booking system for 2 weeks. After 5 in a quarter, required meeting with administrator. Legitimate emergency (hospital called in) can be appealed.

---

### UC-43: The Dynamic Duration with Price Adjustment
**Who:** Services where time is unpredictable
**What:** Estimate-based booking with final price adjustment
**Needs:**
- Estimated time range (2-3 hours)
- Initial booking at minimum time
- Time tracking during service
- Automatic extension if running long
- Overtime pricing (higher rate for extra time)
- Refund if finished early
- Customer notification of price changes

**Scenario:** Handyman job estimated 2-3 hours. Customer books 2 hours at $80/hour = $160. Job takes 3.5 hours. System charges additional 1.5 hours at $100/hour (overtime rate) = $150 extra. Total: $310. If finished in 1.5 hours, customer refunded 0.5 hours ($40). Customer gets real-time updates: "Job running longer than estimated, additional charges may apply."

---

### UC-44: The Overtime Prediction and Avoidance
**Who:** Preventing employee overtime
**What:** Alert before overtime threshold hit
**Needs:**
- Track scheduled hours per employee
- Predict if upcoming bookings will exceed threshold (8 hours)
- Alert dispatcher/manager
- Suggest alternatives (assign to different employee)
- Overtime cost calculation
- Weekly/monthly overtime tracking

**Scenario:** Plumber has 3 jobs scheduled: 9am-11am (2hr), 12pm-3pm (3hr), 4pm-6pm (2hr) = 7 hours. Dispatcher adds 4th job 7pm-9pm (2hr). System alerts: "This will put Mike at 9 hours (1 hour overtime). Suggest: Assign 7pm job to Sarah to avoid overtime costs." Manager can override or reassign.

---

### UC-45: The Service-Specific Availability
**Who:** Same person, different availability per service
**What:** Provider available for some services but not others at certain times
**Needs:**
- Calendar per service type per provider
- Granular availability (consultations mornings, procedures afternoons)
- Service category restrictions
- Override capability
- Patient communication ("Dr. Smith only does consultations on Mondays")

**Scenario:** Dr. Smith is available Monday mornings for 30-minute consultations but NOT for 2-hour procedures (needs full day blocked). Same person, different availability. Patient looking for procedure sees Dr. Smith only Tuesday-Friday. Patient looking for consultation sees Dr. Smith Monday-Friday. System tracks separately.

---

### UC-46: The Available by Default vs Unavailable by Default
**Who:** Different staffing models
**What:** Configurable default state for availability
**Needs:**
- Staff-level configuration
- Available by default (typical 9-5 workers)
- Unavailable by default (on-call specialists)
- Mark specific slots as available (for on-call)
- Toggle between modes
- Bulk availability setting

**Scenario:** Most clinic staff (receptionists, nurses) are "available by default" during business hours - they show as bookable unless marked off. On-call specialists (cardiologists for emergencies) are "unavailable by default" - they don't show as bookable unless they specifically mark "available for emergency consult Tuesday 2pm-4pm."

---

### UC-47: The Use-It-Anytime Membership
**Who:** Facilities with open access
**What:** Pay for time allowance, use anytime during open hours
**Needs:**
- Time-based membership (10 hours/week)
- Entry/exit tracking
- Real-time usage display ("You've used 7 of 10 hours")
- Block entry if allowance exceeded
- Upgrade offers at entry
- Rollover unused hours (or not)
- Peak vs off-peak hours

**Scenario:** Gym membership: $50/month for 10 hours/week access. Member scans card to enter, scans to exit. System tracks time. After 7 hours used, gets text: "3 hours remaining this week." Tries to enter after 10 hours - door denies entry with screen: "Weekly limit reached. Upgrade to unlimited for $20?" Unused hours don't roll over (use it or lose it).

---

### UC-48: The Auction-Based Booking
**Who:** High-demand exclusive access
**What:** Competitive bidding for limited slots
**Needs:**
- Open bidding period (7 days)
- Minimum bid
- Anonymous bidding (don't see others' bids)
- Automatic bid extension if bid in final hour (prevent sniping)
- Winner notification
- Loser notification with next available dates
- Payment collection from winner

**Scenario:** 3 slots available for celebrity chef's private dinner. Bidding open 7 days. Minimum $500. Sarah bids $750, John bids $800, Maria bids $950. With 10 minutes left, Sarah increases to $1000. Auction extends 10 minutes. John bids $1100. No more bids. John wins, charged $1100. Sarah and Maria get "You lost this auction, next available dates: March 15, April 2."

---

### UC-49: The AI Agent Notes
**Who:** System-generated insights about bookings/customers
**What:** Three types of notes with different visibility
**Needs:**
- Public notes (visible to all): "Allergic to lavender"
- Private notes (provider only): "Difficult customer, be extra patient"
- AI agent notes (system insights): "Tends to book last minute, send reminder 24h early"
- Note permissions and visibility rules
- AI learning from patterns
- Note categories and searchability

**Scenario:** Customer books massage. Public note (they added): "Prefer lighter pressure." Provider private note: "Gift certificate user, mention expiration." AI agent note (system learned): "This customer has cancelled 2 of last 10 bookings, send extra reminder." Different notes visible to different people.

---

### UC-50: The Complete Audit Trail
**Who:** Compliance and accountability
**What:** Every change tracked immutably
**Needs:**
- Log every create, read, update, delete
- Capture: who, what, when, before value, after value, reason
- Immutable storage (can't be deleted)
- Policy-based retention (configured per industry and tenant)
- Searchable by user, date, field, booking
- Export capability
- Anomaly detection

**Scenario:** Booking originally set for Tuesday 2pm is moved to Wednesday 3pm by the receptionist at patient request. Audit log captures actor, action, before/after values, timestamp, reason, and source IP. Records cannot be edited or removed by normal users. Retention follows the tenant's compliance profile, and admins can search by booking ID, user, date, or field change.

---

### UC-51: The Multi-Level Organization Booking
**Who:** Organization hiring another organization
**What:** Wedding planner on Bizing books caterer also on Bizing
**Needs:**
- Cross-organization booking
- Both orgs' calendars affected
- Internal visibility per org (planner sees full details, caterer sees relevant details)
- Payment between organizations
- Commission or finder fee
- Shared timeline but private internal notes

**Scenario:** Wedding planning company "Forever After" on Bizing platform books caterer "Gourmet Events" also on Bizing. Forever After's calendar shows "Smith-Jones Wedding." Gourmet Events' calendar shows "Catering for Smith-Jones (booked by Forever After)." Forever After sees full wedding timeline. Gourmet Events sees only their catering slot and setup time. Payment flows: Customer → Forever After → Gourmet Events (minus 10% commission).

---

### UC-52: The Hybrid Virtual + In-Person
**Who:** Services that can be delivered either way
**What:** Consultation starts virtual, continues in person
**Needs:**
- Mode selection per booking (virtual, in-person, hybrid)
- Sequential modes (virtual then in-person)
- Different pricing per mode (virtual cheaper)
- Virtual waiting room
- Seamless handoff between modes
- Same booking, multiple connection methods

**Scenario:** Therapy session: First 30 minutes virtual (video call), then client comes to office for in-person 30 minutes. One booking, two modes. Zoom link sent first, then office address. If virtual portion runs long, in-person start time adjusts automatically. Virtual portion billed at $100, in-person at $150 (premium for office space).

---

### UC-53: The Virtual Waiting Room
**Who:** Telehealth and virtual services
**What:** Queue management for virtual appointments
**Needs:**
- Check-in for virtual appointments
- Virtual queue position
- Estimated wait time
- Provider sees queue and starts next session
- Waiting room announcement capability
- Virtual "reception area"

**Scenario:** Telehealth appointment scheduled for 2pm. Patient checks in online at 1:55pm, enters virtual waiting room. Sees: "You are #2 in line. Dr. Smith is finishing with patient #1. Estimated wait: 8 minutes." Can see educational content while waiting. Doctor sees queue, clicks "Start next session," patient automatically connected.

---

### UC-54: The Anonymous/Sensitive Booking
**Who:** Services requiring privacy
**What:** Booking without revealing identity until arrival
**Needs:**
- Anonymous booking option
- Code/alias instead of name
- Verification at arrival (ID check)
- Provider doesn't see name until in-person
- Privacy protection for domestic violence survivors, celebrities
- Secure messaging without identity reveal

**Scenario:** Domestic violence shelter offers counseling. Survivor books online using code "Bluebird-472" instead of real name. Counselor sees only code on schedule. At arrival, survivor provides code and ID for verification. Real name revealed only in private session. All records use code, not real name.

---

### UC-55: The Referral Unlock Reward
**Who:** Incentivizing customer referrals
**What:** Unlock benefits by referring friends
**Needs:**
- Referral tracking (unique codes/links)
- Count successful referrals (friend booked and completed)
- Tiered rewards (3 referrals = VIP status)
- Automatic status upgrade
- Benefits: early booking, discounts, free add-ons

**Scenario:** Salon customer gets referral code. Shares with 3 friends. All 3 book and complete appointments. System detects: "3 successful referrals!" Customer automatically upgraded to "VIP" status. Benefits unlocked: can book 14 days out instead of 7, 10% discount on all services, free deep conditioning add-on. Gets congratulatory email: "You're a VIP! Enjoy your new benefits."

---

### UC-56: The Booking Transfer
**Who:** Passing appointment to someone else
**What:** Original booker can't attend, transfers to friend
**Needs:**
- Transfer link generation
- Recipient acceptance
- Liability/attendee change
- Original booker credit as thank you
- Transfer deadline (can't transfer within 24 hours)
- Transfer history

**Scenario:** Sarah books $200 cooking class but gets sick. Generates transfer link, sends to friend Emma. Emma clicks link, sees class details, accepts transfer. Booking now in Emma's name. Sarah gets $20 store credit as thank you. If Emma cancels, cancellation policy applies to Emma (not Sarah). Transfer not allowed within 24 hours of class (too late to refill).

---

### UC-57: The Impulse Booking Cooldown
**Who:** Preventing regret cancellations
**What:** Short review period before capture for high-ticket services
**Needs:**
- Booking hold period (1 hour)
- No charge during hold
- Cancel penalty-free during hold
- Reminder before hold expires
- Automatic confirmation if not cancelled
- Reduce rapid cancel/rebook churn

**Scenario:** Customer books a $500 premium photoshoot late at night. System places the booking on a 1-hour hold and sends: "Your booking is reserved. Confirm now or cancel within 1 hour at no charge." If the customer takes no action, it auto-confirms and captures payment according to policy. This reduces impulsive cancellations and repeated slot churn.

---

### UC-58: The Seasonal Availability Flip
**Who:** Seasonal businesses
**What:** Completely unavailable certain times of year
**Needs:**
- Seasonal availability blocks
- "Returns [date]" messaging (not "no availability")
- Automatic reopening on schedule
- Pre-booking for next season
- Waitlist for seasonal opening

**Scenario:** Ski instructor available December 1 - March 31. April 1 - November 30: completely unavailable (not just booked up, but professionally inactive). Calendar shows "Returns December 1" with countdown. Loyal customers can pre-book December slots starting November 1. Waitlist opens October 1 for priority access.

---

### UC-59: The Simultaneous Multi-Location
**Who:** Events needing multiple locations at once
**What:** One booking, multiple venues simultaneously
**Needs:**
- Multiple location selection
- All must be available same time
- If any unavailable, whole booking blocked
- Location-specific details
- Travel time between locations (if applicable)

**Scenario:** Corporate conference call needs meeting rooms in New York, London, and Singapore booked simultaneously for video conference. One booking, 3 locations. If London room unavailable, entire booking blocked - can't have 2/3 locations. System shows: "Available in NY and Singapore, need different time for London."

---

### UC-60: The Mandatory Follow-Up Lock
**Who:** Services requiring post-care
**What:** Follow-up appointment required, can't be cancelled independently
**Needs:**
- Auto-created follow-up appointment
- Linked to original (parent-child relationship)
- Original cancellation → follow-up auto-cancels
- Follow-up can be rescheduled but not cancelled without doctor approval
- Reminder escalation

**Scenario:** Surgery booking auto-creates 2-week follow-up. If surgery cancelled, follow-up auto-cancels. If surgery completed, follow-up is mandatory. Patient tries to cancel follow-up - gets message: "This follow-up is medically required. Call office to discuss." System tracks who didn't show for follow-up, flags for care coordinator.

---

## Summary: What These Use Cases Demand

### Must Support in Core Schema:
- Variable and fixed duration
- A "quick setup" path for basic bookings (no complex UI required)
- An "advanced mode" for layered rules and enterprise workflows
- Multiple bookable types (person, equipment, space, company)
- Households with permissions (customers AND providers)
- Products alongside services
- Packages with tracking
- Memberships with allowances
- Service-specific availability
- Commission calculations
- Favorability/ranking systems
- Complete audit trails
- Multi-org booking
- Marketplace listings
- Public/private/AI notes
- Cancellation penalties
- Dynamic pricing
- Waitlists with payment
- Prerequisites and unlocking
- Approval workflows
- Auto-booking triggers
- Overtime tracking
- Hybrid virtual/in-person
- AI-generated insights
- Tenant-specific compliance policies
- Idempotent booking actions under retries
- Manual pricing overrides by day, hour, and date range
- Call-related fee types (booking fee, phone consult fee, after-hours fee)

### Can Defer to Later:
- Complex AI/ML predictions
- Real-time video collaboration features
- White-label theming
- Multi-brand hierarchy
- Advanced marketplace auctions and bidding mechanics

---

## Part 7: New v3.0 Additions (Missing but Critical)

### UC-61: The Insurance Eligibility Re-Check
**Who:** Medical and wellness providers accepting insurance
**What:** Coverage can change between booking date and appointment date
**Needs:**
- Eligibility check at booking
- Automatic re-check before service (e.g., 72 hours prior)
- Pre-authorization tracking with expiration
- Alternate payment path if coverage fails
- Patient notification and action steps

**Scenario:** Patient books an MRI 3 weeks in advance. Insurance is valid at booking time, so request is accepted. Two days before the appointment, eligibility re-check fails because plan changed. System notifies patient and staff, opens a self-pay option, and asks patient to upload updated insurance details before appointment time.

---

### UC-62: The Split-Tender Payment
**Who:** Businesses with gift cards, wallets, and cards
**What:** One booking paid using multiple payment sources
**Needs:**
- Payment priority rules (gift card first, then wallet, then card)
- Partial authorization and capture
- Refund routing back to original sources
- Clear receipt breakdown
- Failure handling if one source declines

**Scenario:** Customer books a $180 service. They apply a $50 gift card, $30 wallet credit, and charge the remaining $100 to a credit card. Receipt shows all three components clearly. If a $40 partial refund is issued later, system applies refund according to configured policy and records each refund leg for reconciliation.

---

### UC-63: The Chargeback/Dispute Lifecycle
**Who:** Businesses processing card-not-present payments
**What:** Customer disputes payment after service
**Needs:**
- Dispute status tracking
- Evidence package assembly (timestamp, signed policy, attendance logs)
- Financial reserve/hold visibility
- Staff workflows for response deadlines
- Outcome tracking (won/lost/partial)

**Scenario:** Customer disputes a no-show fee on a missed consultation. System compiles proof: reminder delivery logs, cancellation policy acceptance at checkout, and check-in record showing absence. Staff submits evidence before processor deadline. Booking remains operationally closed while dispute state is tracked separately in finance.

---

### UC-64: The Fraud-Risk Manual Review
**Who:** High-demand or high-fraud businesses
**What:** Suspicious bookings should be reviewed before confirmation
**Needs:**
- Risk score on booking creation
- Rule-based holds (velocity, mismatched location, repeated card failures)
- Manual approve/decline queue
- Customer messaging during review
- Auto-release if risk clears

**Scenario:** New account attempts 8 high-value bookings in 10 minutes with 3 different cards. System flags the activity and places bookings into review instead of instant confirmation. Reviewer checks signals, approves one legitimate booking, declines the rest, and sends clear messaging so legitimate customers can retry safely.

---

### UC-65: The Idempotent API Retry
**Who:** Integrators and marketplaces using API/webhooks
**What:** Network retries should not create duplicate bookings
**Needs:**
- Idempotency key support
- Deterministic response replay for duplicate requests
- Safe webhook retry handling
- Duplicate prevention in payment capture
- Audit events for replayed requests

**Scenario:** Partner app times out during booking creation and retries the same request twice. Because the same idempotency key is provided, system returns the original booking instead of creating duplicates. Payment captures only once, and logs show replay detection for audit purposes.

---

### UC-66: The Offline Front Desk Mode
**Who:** Clinics and retail counters with intermittent internet
**What:** Continue check-ins and basic scheduling during outages
**Needs:**
- Local temporary queue/check-in storage
- Offline booking holds with conflict warnings
- Sync and reconciliation on reconnect
- Staff prompts for conflict resolution
- Offline action audit trail

**Scenario:** Internet drops at a busy clinic for 45 minutes. Front desk continues checking in patients locally and creates temporary holds for walk-ins. When connection returns, system syncs events, detects one time collision, and asks staff to confirm which patient keeps the slot while offering alternatives to the other.

---

### UC-67: The External Channel Sync
**Who:** Businesses listing inventory on third-party marketplaces
**What:** Availability and bookings must stay in sync across channels
**Needs:**
- Channel mapping per service/resource
- Real-time or near-real-time inventory updates
- External reservation references
- Retry queue for failed syncs
- Oversell protection policy

**Scenario:** A tour operator sells seats on direct site and two marketplace partners. A seat sold on Partner A immediately reduces capacity everywhere else. If Partner B sync call fails, system retries and temporarily tightens local availability to prevent overselling until channel consistency is restored.

---

### UC-68: The Data Residency Tenant Boundary
**Who:** Multi-tenant platforms serving regulated or regional customers
**What:** Tenant data must stay isolated and in approved regions
**Needs:**
- Tenant-level region assignment
- Strict cross-tenant isolation
- Region-aware backups and exports
- Access logs showing data location
- Admin controls for legal hold exceptions

**Scenario:** EU healthcare tenant requires all patient booking data to remain in EU region. US tenant runs separately in US region. Platform admin can view operational metrics across tenants but cannot access tenant private booking records without explicit scoped authorization and audit logging.

---

### UC-69: The Legal Blackout Window
**Who:** Industries with statutory booking constraints
**What:** Certain services need minimum notice or blackout windows
**Needs:**
- Rule engine for minimum lead times
- Date/time blackout periods
- Public explanation message when blocked
- Admin override for emergencies (with reason)
- Jurisdiction-specific configuration

**Scenario:** A notary service in one jurisdiction requires at least 24 hours notice for certain document types and blocks bookings on public holidays. Customer tries to book same-day on a restricted service and sees a clear message with nearest valid time options. Staff can override only if legal emergency criteria are met.

---

### UC-70: The Deletion vs Retention Conflict
**Who:** Regulated businesses handling privacy requests
**What:** User deletion requests may conflict with required financial/compliance retention
**Needs:**
- Request intake and verification
- Selective redaction/anonymization workflow
- Retention hold tracking for non-deletable records
- User-facing completion report
- Policy-driven timelines

**Scenario:** Customer requests deletion of account and booking history. System anonymizes profile and removes non-required personal fields, but retains legally required invoice and audit records under retention hold. Customer receives a completion report explaining what was deleted, anonymized, and retained with policy reasons.

---

## Part 8: Additional v3.0 Scenarios (Pricing, Fees, UX Coverage)

### UC-71: The Phone/Call Booking Fee
**Who:** Businesses that still take bookings by phone
**What:** Charge a call-handling fee for manual phone bookings, optionally waived
**Needs:**
- Optional phone booking fee (flat or percentage)
- Waive fee for members/VIP/customers with accessibility needs
- Separate line item on receipt
- Staff override with reason
- Different fee rules by service type

**Scenario:** A salon accepts online and phone bookings. Online bookings have no extra fee. Phone bookings add a $5 call-handling fee because staff manually process the request. VIP members and customers flagged for accessibility support are auto-waived. Front desk can also waive manually, but must choose a reason that is logged in audit history.

---

### UC-72: The Paid Discovery Call
**Who:** Consultants, legal, financial, coaching, and clinics
**What:** Short paid call before a full appointment
**Needs:**
- Bookable call service (15-30 minutes)
- Dedicated call price
- Option to credit call fee toward a full booking
- Auto-generated call link or phone instructions
- No-show and late-cancel policy for calls

**Scenario:** A business consultant offers a 20-minute paid discovery call for $40. Customer books the call and receives a meeting link. After the call, if they book a 2-hour strategy session within 7 days, the $40 call fee is automatically credited. If they no-show the call, standard no-show policy applies.

---

### UC-73: The Manual Day-and-Hour Pricing Grid
**Who:** Businesses with predictable peak periods
**What:** Prices vary by day and time using manual rules (not algorithmic surge)
**Needs:**
- Manual pricing table by weekday + time block
- Rule priority (specific rule beats default price)
- Effective date range
- Preview mode ("what will Tuesday 6pm cost?")
- Change history with who/when/why

**Scenario:** Barbershop sets weekday daytime cuts at $35, weekday evenings at $45, and Saturday slots at $55. Owner configures these values in a pricing grid once. Booking page shows the exact price per selected slot before checkout. No dynamic algorithm is involved; all changes are intentionally set by staff.

---

### UC-74: The Holiday and Special-Date Pricing Override
**Who:** Businesses with holiday demand spikes
**What:** Specific dates have fixed override pricing
**Needs:**
- Date-specific price overrides (single date or range)
- Recurring annual holiday templates
- Override reason label ("New Year's premium")
- Conflict resolution when multiple rules apply
- Customer-facing explanation text

**Scenario:** Massage studio charges $90 normally, but sets Valentine's week to $120 and Mother's Day weekend to $140. These are configured as explicit date overrides months in advance. If a weekend rule and holiday rule overlap, holiday rule takes priority. Customers see "Holiday pricing applies for this date" before payment.

---

### UC-75: The After-Hours and Emergency Callout Fee
**Who:** Home services, healthcare on-call, urgent support teams
**What:** Additional fee for same-day urgent or after-hours jobs
**Needs:**
- Time-window definitions for after-hours (e.g., 8pm-7am)
- Emergency same-day surcharge
- Separate fee line item
- Fee waivers for service contracts/plans
- Clear pre-confirmation disclosure

**Scenario:** Plumbing company charges standard daytime rate for routine jobs. For after-hours calls or emergency same-day dispatch, system adds a $75 callout fee. Customers on annual maintenance plans get this fee waived. The surcharge appears as a distinct line item during booking so there are no surprises.

---

### UC-76: The One-Page Quick Setup vs Advanced Builder
**Who:** Platform admins and small business owners
**What:** Two ways to configure the same booking engine
**Needs:**
- Quick setup wizard (service, hours, price, booking link)
- Advanced builder hidden behind explicit opt-in
- Safe defaults that produce a working booking page immediately
- Migration from quick setup to advanced without data loss
- "Complexity score" indicator so admins know when settings become advanced

**Scenario:** A solo therapist signs up and uses quick setup in under 10 minutes: sets service duration, business hours, and price, then publishes booking link. Three months later, they need different prices for evenings and holidays plus a paid intake call. They switch to advanced builder, add those rules, and keep all existing bookings and customer history intact.

---

### UC-77: The On-Site Visit Fee (Charged on Arrival)
**Who:** Plumbers, electricians, locksmiths, appliance repair, and field technicians
**What:** A guaranteed trip/diagnostic fee is charged once the provider arrives, even if no repair is performed
**Needs:**
- Clear "visit fee" policy shown before booking confirmation
- Trigger condition: provider arrival/check-in on site
- Fee charged even if customer declines service after arrival
- Optional crediting of visit fee toward completed repair invoice
- Waiver/discount rules (membership, repeat-customer goodwill, provider fault)
- Dispute workflow with photo/GPS/time evidence

**Scenario:** Customer books a plumber for a leak. The booking terms state a $95 on-site visit fee. Plumber arrives, checks in via app with timestamp and GPS, then customer says they already fixed it and no longer need service. System still charges the $95 visit fee because arrival occurred. If customer proceeds with repair, the $95 is credited toward the final invoice. If there is a dispute, staff can review arrival proof and apply a waiver if policy conditions are met.

---

### UC-78: The Walk-In Queue with Estimates (Barber Shop)
**Who:** Service businesses with walk-in customers and uncertain service times
**What:** Fixed-price services with estimated (not guaranteed) durations, managed as a queue
**Needs:**
- Queue-based system (not fixed-time appointments)
- Service time estimates (15-45 min ranges, not exact)
- Fixed pricing regardless of actual time taken
- Real-time queue position display
- Estimated wait time calculation based on queue
- Check-in system for walk-ins
- Service completion tracking (actual time vs estimate)
- Provider assignment based on queue and availability
- Price transparency upfront (no surprises based on time)

**Scenario:** Neighborhood barber shop accepts walk-ins. Customer arrives, checks in digitally: "Service: Haircut ($35), Estimated: 25 min." System shows: "3 people ahead of you, estimated wait: 45 minutes." Customer gets text when 2nd in line. Barber A is faster (avg 20 min), Barber B is slower (avg 35 min) but more detailed. Prices same regardless of which barber or how long it takes. Actual service takes 32 minutes - customer still pays $35. Queue estimates improve over time based on historical data per service and per provider.

---

### UC-79: The Government Service Queue (DMV/Office)
**Who:** Government offices, permitting counters, administrative services
**What:** Fixed-fee services with variable processing times, walk-in queue management
**Needs:**
- Ticket-based queue system (take a number)
- Service categories with different estimated times
- Fixed fees set by regulation (no dynamic pricing)
- Wait time estimates by service type
- Multi-counter support (Window 1, Window 2, etc.)
- Appointment option for complex cases (separate from walk-in queue)
- Priority handling (elderly, disabled, urgent cases)
- Service complexity detection (simple renewal vs complex case)
- Overflow handling (come back tomorrow if closing soon)

**Scenario:** DMV office offers: License renewal (est. 10 min, $35), New license (est. 25 min, $75), Title transfer (est. 40 min, $55). Customer walks in, kiosk asks service type, prints ticket: "C-47, New License, Est. wait: 55 min." System knows 2 of 4 counters handle new licenses, tracks their current customers' progress. Counter 2 finishes early, calls "C-47 to Window 2." Customer's actual processing takes 35 min due to missing document - they must return tomorrow, but fee was already fixed at $75 regardless of outcome.

---

### UC-80: The Fixed-Price Variable-Time Service (Car Wash)
**Who:** Car washes, detailing services, quick-lube shops
**What:** Service packages with fixed prices but duration varies by vehicle condition
**Needs:**
- Fixed-price service tiers (Basic $15, Deluxe $35, Premium $65)
- Variable time based on vehicle size and dirtiness
- Queue position with range estimates ("25-40 min")
- Vehicle type input (sedan vs SUV vs truck)
- Express lane for simple cases
- Add-on services that extend time but not base price confusion
- Throughput tracking (cars per hour)
- Re-queue capability if quality check fails

**Scenario:** Car wash has three packages. Customer selects Deluxe ($35) for their muddy SUV. System estimates 30-45 minutes based on: package type + vehicle size + current queue. Basic sedans ahead in line will take 10-15 min each. After 42 minutes, wash completes but quality check spots missed spots - car goes back through part of line (no extra charge). Final price remains $35 even though service took 55 minutes total. Customer who arrived later in a clean compact gets Basic wash and is done in 8 minutes - also pays fixed price.

---

### UC-81: The Host-Dependent and Complexity-Based Duration
**Who:** Services where provider skill and case complexity drastically affect time
**What:** Same service, different actual durations based on who performs it and what they encounter
**Needs:**
- Provider-specific time estimates (experienced vs trainee)
- Complexity assessment (simple, standard, complex)
- Fixed pricing despite variable effort
- Host assignment based on case complexity
- Time tracking per provider per service type
- Learning system (improve estimates based on actuals)
- Escalation path (junior hits complex case, senior takes over)
- Customer communication about potential extended time

**Scenario:** Dental cleaning service: Fixed price $120. Junior hygienist averages 45 min, senior averages 30 min. Patient with heavy tartar buildup flagged as "likely complex" - system assigns senior hygienist and estimates 35-45 min. Mid-procedure, senior discovers unexpected issue requiring 20 extra minutes. Price remains $120. System logs: "Senior hygienist, complex cleaning, actual: 52 min" to improve future estimates. Different patient with light buildup gets junior, done in 38 min, same $120 price.

---

## Summary Update: Queue-Based Patterns (UC-78 through UC-81)

These four use cases introduce a distinct booking pattern: **fixed price, variable time, queue management** rather than fixed-time slot booking.

Key requirements this adds:
- Queue position tracking (not calendar slots)
- Estimated wait times with ranges (not exact appointment times)
- Time estimation per service + per provider learning
- Walk-in check-in flow alongside (or instead of) appointment booking
- Fixed pricing guarantee regardless of actual duration
- Service complexity detection affecting queue assignment
- Historical actual-time tracking to improve estimates

## Part 9: Transportation & Vehicle Services

### UC-82: The Scheduled Shuttle Service (Airport/Route-Based)
**Who:** Airport shuttles, corporate commuter shuttles, intercity buses
**What:** Fixed-route transportation with scheduled departure times and capacity limits
**Needs:**
- Route definition with stops (Airport → Hotel Zone → Downtown)
- Scheduled departure times (not on-demand)
- Per-route capacity limits (14 passengers per van)
- Stop-by-stop availability (seats may be available from Airport but not Hotel Zone)
- Luggage quantity and size tracking
- Real-time vehicle tracking for passengers
- Waitlist when route is full
- Group bookings (family of 4 wants to sit together)
- Dynamic routing for traffic/road closures

**Scenario:** Airport shuttle runs every 30 minutes from 5am to midnight. Route: Airport Terminal 3 → Terminal 1 → Business District → Convention Center → Hotels. Customer books 2pm departure from Terminal 1. System shows: "8 seats available from Terminal 1, 12 seats available from Airport." Passenger has 3 large suitcases - system notes "requires luggage space" and reserves back row. Real-time tracking shows van running 10 min late due to traffic. 14-seat capacity reached at Terminal 1, but someone cancels - waitlisted passenger gets notified and books.

---

### UC-83: The On-Demand Shuttle (Zone-Based Pickup)
**Who:** Corporate campus shuttles, hotel area shuttles, university transport
**What:** Request-based pickup within defined zones, not fixed schedule
**Needs:**
- Zone-based service area (map-defined)
- Request-triggered routing (nearest available vehicle)
- Estimated pickup time (5-12 minutes)
- Real-time ETA updates
- Multiple passenger pooling (shared ride)
- Capacity tracking (standing room vs seated only)
- Priority levels (executive vs standard)
- Recurring ride requests (daily commute pickup)

**Scenario:** Tech campus has 5 shuttles circulating between buildings. Employee requests pickup from Building C to Building H. System assigns nearest shuttle (2 min away) with 3 seats available. ETA: 4 minutes. Another employee requests same route - pooled, ETA updates to 6 minutes for both. Shuttle arrives, both board. Driver confirms passenger count. Different employee has "executive" status - their requests get priority assignment even if farther from a shuttle.

---

### UC-84: The Limo/Black Car Service (Scheduled by Time)
**Who:** Executive car services, luxury transportation, special occasion limos
**What:** Premium vehicle booking with specific pickup time and duration
**Needs:**
- Vehicle type selection (sedan, SUV, stretch limo, party bus)
- Exact pickup time reservation (not a window)
- Duration-based pricing (minimum 3 hours for limo)
- Special occasion packages (wedding, prom, bachelor party)
- Stops/multiple destinations allowed
- Chauffeur assignment and tracking
- Vehicle amenity selection (champagne, decorations)
- Late night/early morning surcharges
- Gratuity auto-calculation and distribution

**Scenario:** Wedding party books 6-hour stretch limo package for $800. Pickup: 2pm at bride's house. Destinations: hair salon (3pm-4:30pm), photo location (5pm-6pm), ceremony (6:30pm), reception (7pm). System calculates route time between stops, adds buffer. Champagne and decorations included. Driver assigned 48 hours before, vehicle prepped day-of. Gratuity auto-calculated at 20% ($160) distributed to chauffeur after completion.

---

### UC-85: The Limo Service (Point-to-Point Transfer)
**Who:** Airport transfers, corporate client pickup, event transportation
**What:** One-way or round-trip fixed-route premium transport
**Needs:**
- Origin and destination addresses
- Flight tracking integration (airport pickups)
- "Meet and greet" service option
- Luggage capacity per vehicle type
- Waiting time policy (15 min included, then hourly)
- Child seat availability
- Accessibility vehicle option
- Multi-passenger pricing (same car, multiple people)
- Real-time driver location sharing

**Scenario:** Executive books airport transfer from JFK to Manhattan office. Enters flight number AA1234. System tracks flight - arrival delayed 45 minutes. Driver automatically adjusts pickup time, monitors actual landing. Meet-and-greet: driver waits at baggage claim with name sign. First 15 min waiting included. If executive delayed at customs (25 min), additional $25 charge applies. Driver has child seat available (requested in booking). Real-time location shared with executive's assistant.

---

### UC-86: The Charter Bus/Group Transportation
**Who:** Event planners, schools, corporate outings, wedding parties
**What:** Large group vehicle booking for specific date and itinerary
**Needs:**
- Group size input (determines bus size: 25, 35, 55 passenger)
- Multi-stop itinerary builder
- Driver rest/break time regulations
- Parking and toll calculations
- Overnight driver accommodation (for multi-day)
- Quote request before booking (not instant book)
- Deposit structure (50% to hold, 50% before trip)
- Cancellation tiers (90 days out = full refund, 30 days = 50%)
- Damage/cleaning deposit hold

**Scenario:** Company plans team-building trip for 45 employees. Requests quote: pickup 8am from office, 2-hour drive to mountain resort, return 6pm. System quotes: 55-passenger coach, $1,200 + $150 driver gratuity + $45 tolls. Quote valid 7 days. Company accepts, pays $600 deposit. One week before, pays remaining $795. Day of trip, driver follows itinerary, mandatory 30-min break at 10:30am per DOT regulations. Minor cleaning required post-trip (food spill), $75 cleaning fee deducted from $200 damage deposit, $125 returned.

---

## Part 10: Rental & Equipment Services

### UC-87: The Tool Rental (Home Depot Style)
**Who:** Hardware stores, equipment rental companies, DIY centers
**What:** Physical items rented by hour, day, or week with deposit and return requirements
**Needs:**
- Rental duration options (4-hour, daily, weekly rates)
- Inventory availability by location
- Equipment condition documentation (photos at pickup)
- Damage protection/waiver options
- Security deposit hold (released on return)
- Late return fees (hourly after due time)
- Cleaning fee if returned dirty
- Fuel/charge level requirements (return full/charged)
- Extension requests (if no one waiting)
- Accessory add-ons (drill bits, safety gear)

**Scenario:** Homeowner rents pressure washer for 24 hours at $75/day. $200 security deposit held on card. Pickup: Saturday 9am, due back Sunday 9am. Photos document pre-existing scratches. Damage waiver declined. Returns Sunday 11am (2 hours late) - $20 late fee applies. Gas tank half-empty - $15 refueling fee. Minor cleaning needed - $10 cleaning fee. Total: $75 + $20 + $15 + $10 = $120. Security deposit released. If equipment damaged during rental, repair cost deducted from deposit with photo evidence.

---

### UC-88: The Party/Event Equipment Rental
**Who:** Party supply companies, event rental services, wedding suppliers
**What:** Tables, chairs, tents, linens, dishware rented for events with setup/breakdown
**Needs:**
- Delivery and pickup scheduling (not customer pickup)
- Setup and breakdown service option
- Event date vs rental period (rent Friday-Monday for Saturday event)
- Quantity-based availability (need 20 tables, have 18 available)
- Package deals (wedding package: tent + tables + chairs + linens)
- Weather contingency (tent sidewalls if rain forecast)
- Damage waiver for linens/dishware
- Last-minute availability (48-hour window)
- Venue coordination (delivery window restrictions)

**Scenario:** Wedding planner books for Saturday event: 150 chairs, 20 tables, tent, linens, dishware. Rental period: Friday delivery/setup to Sunday breakdown/pickup. Venue restricts delivery to 10am-2pm Friday. Setup service adds $300. Weather shows 60% rain - adds tent sidewalls ($150). Package pricing saves $200 vs individual items. Damage waiver for dishware ($75) covers accidental breakage. One week before, couple wants 10 more chairs - only 8 available, suggests 2 benches as alternative.

---

### UC-89: The Vehicle Rental (Car/Truck/Van)
**Who:** Traditional rental companies, peer-to-peer car sharing, moving truck rentals
**What:** Self-drive vehicle rental by day or week
**Needs:**
- Vehicle category selection (compact, SUV, truck, van)
- Pickup and return location (different locations allowed)
- Mileage limits and overage charges
- Insurance options (decline, basic, premium)
- Driver verification (license, age requirements)
- Fuel policy (return full or prepay)
- Additional driver authorization
- Child seat/GPS add-ons
- Late return grace period (29 minutes free)
- One-way rental pricing (drop at different location)

**Scenario:** Customer rents moving truck for 3 days at $120/day + $0.79/mile. Pickup at downtown location, return at suburban location (one-way). Insurance selected: premium ($35/day) with $0 deductible. Driver uploads license photo for verification. Prepaid fuel option declined - will return full. Day 2 realizes need extends to 4th day - calls to extend, rate remains same if available. Returns 45 minutes late - charged additional 1 day because past grace period. 312 miles driven = $246.24 mileage. Total: ($120 × 4) + ($35 × 4) + $246.24 = $866.24.

---

### UC-90: The Peer-to-Peer Equipment Rental (Fat Llama Style)
**Who:** Individuals renting personal equipment to others, camera gear, drones, tools
**What:** Owner-listed items with availability calendar and pickup coordination
**Needs:**
- Owner-managed availability calendar
- Item condition photos and description
- Security deposit and verification level
- Handoff method (pickup, delivery, locker)
- Rental request approval (owner can decline)
- Late return mediation
- Damage claim process with evidence
- Owner rating and reliability score
- Insurance/integration with platform policy

**Scenario:** Photographer lists professional camera kit for rent at $85/day. Sets availability: weekends only, not available Dec 24-25. Renter requests Dec 10-12 (3 days). Owner approves after viewing renter's verification (ID + 5 positive past rentals). Handoff: owner meets at coffee shop for exchange, photos condition. Renter returns Dec 12 evening. Minor scuff discovered on lens body - owner submits claim with before/after photos. Platform mediates, determines normal wear vs damage, reimburses owner $50 from deposit. Renter and owner rate each other.

---

## Part 11: Virtual & Remote Services

### UC-91: The Virtual Consultation Service
**Who:** Telehealth, online therapy, virtual legal consults, remote coaching
**What:** Scheduled video/audio sessions with pre-session requirements
**Needs:**
- Video platform integration (Zoom, Teams, custom)
- Pre-session intake forms/questionnaires
- File upload for review (medical records, documents)
- Technology check (test camera/mic beforehand)
- Waiting room with queue position
- Session timer with warnings (5 min remaining)
- Recording option (with consent)
- Post-session follow-up tasks
- No-show policy (charge if tech issues vs true no-show)

**Scenario:** Patient books 30-min telehealth appointment. Receives link 24 hours before. System prompts to upload photos of rash and complete symptom questionnaire 2 hours before. Patient joins waiting room 5 min early, sees "Doctor will see you soon." Doctor running 10 min late - waiting room shows updated ETA. Session starts, 25-min timer visible. Doctor shares screen, reviews uploaded photos. With 5 min left, both see warning. Doctor assigns prescription delivery task post-session. Patient had camera issues - tech support resolved in 3 min, not charged as no-show.

---

### UC-92: The Async Virtual Service (Review & Response)
**Who:** Proofreading, design review, code review, legal document review
**What:** Not real-time - customer submits work, provider reviews and responds by deadline
**Needs:**
- File submission with format requirements
- Turnaround time selection (24hr, 3-day, 1-week pricing tiers)
- Word/page count pricing
- Provider availability calendar (when can they deliver)
- Progress status updates (received, in review, complete)
- Deliverable return (annotated document, video feedback)
- Revision rounds included or add-on
- Rush delivery option (12-hour for extra fee)
- Quality dispute and revision request

**Scenario:** Student submits 15-page essay for proofreading. Selects 3-day turnaround at $5/page = $75. System confirms provider available to deliver by Friday 5pm. File uploaded, word count verified. Provider receives notification, starts work. Status updates: "In review" within 6 hours. Completed Friday 3pm - annotated document with track changes returned. Student reviews, requests one revision round (included) for unclear section. Provider responds within 24 hours with additional notes. If student needed it faster, 24-hour option was $8/page ($120).

---

### UC-93: The Live Virtual Class/Workshop
**Who:** Online education, fitness classes, cooking workshops, art instruction
**What:** Scheduled group session with live instructor, interactive elements
**Needs:**
- Class capacity limits (max 20 for interaction)
- Minimum to run (cancel if under 5)
- Waitlist with auto-promote
- Pre-class materials (ingredient list, supply checklist)
- Recording access for limited time post-class
- Breakout room capability (pair/group work)
- Participation tracking (attended, completed)
- Multi-session series (Week 1, Week 2, Week 3)
- Skill level filtering (beginner, intermediate, advanced)

**Scenario:** Cooking school offers "French Pastry Basics" live class, max 12 students, $45. Registration open until 2 hours before. Only 4 sign up by T-2hr - class cancelled, refunds issued. Next week's class: 15 sign up, 3 on waitlist. Ingredient list sent 48 hours before (butter, flour, eggs, etc.). Class starts, instructor demonstrates, students cook along. Breakout rooms for 10 min to share results. Recording available for 7 days post-class. Attendance tracked for "complete 5 classes, get 6th free" loyalty program.

---

### UC-94: The Virtual Office/Meeting Room
**Who:** Coworking spaces, virtual office providers, conference room booking
**What:** Book virtual meeting rooms or temporary virtual office presence
**Needs:**
- Virtual room capacity and features (breakout rooms, whiteboard, recording)
- Time zone handling for global teams
- Recurring meeting room (every Monday 10am)
- Persistent room (same link all month)
- Room customization (branding, waiting room settings)
- Technical support availability during booking
- Usage analytics (attendance, duration)
- Integration with calendar systems
- Security options (password, waiting room, registration)

**Scenario:** Startup books virtual board room for monthly investor meetings. Persistent room with company branding, password protected. 12-person capacity, breakout rooms enabled, recording to cloud. Same link every month for consistency. Admin can customize waiting room message. Usage reports show: average 8 attendees, 90-min meetings, 2 no-shows last quarter. Time zone smart scheduling: shows "10am EST / 7am PST / 4pm CET" to all invitees.

---

### UC-95: The Virtual Fitness Class Subscription
**Who:** Boutique fitness studios, yoga instructors, personal trainers online
**What:** Live classes with subscription or drop-in pricing, personal training credits
**Needs:**
- Class schedule with multiple daily options
- Drop-in vs membership pricing ($20 vs $150/month unlimited)
- Equipment requirements (mat, weights, bands)
- Difficulty level indication
- Camera on/off policy
- Playlist/music integration
- Calorie/effort tracking integration
- Personal training booking add-on
- Freeze membership option

**Scenario:** Yoga studio offers: $18 drop-in or $139/month unlimited live classes. Member sees weekly schedule: 6am Sunrise Flow, 12pm Lunch Express, 6pm Power Yoga, 8pm Restorative. Equipment notes: "Bring mat, optional blocks." Camera-optional - instructor sees attendee count but not faces unless enabled. Member attends 12 classes/month - effective $11.58/class. Can book 1-on-1 private session for $85/hour. Goes on vacation for 2 weeks, freezes membership (no charge, holds spot).

---

## Part 12: Physical & Virtual Classrooms

### UC-96: The Classroom/Lab Booking (University/Corporate)
**Who:** Universities, training centers, corporate campuses
**What:** Bookable rooms with specific equipment and capacity for classes or events
**Needs:**
- Room capacity and layout (theater, classroom, lab stations)
- Equipment requirements (projector, whiteboard, lab equipment)
- Recurring semester booking (MWF 10am-11:30am)
- Priority booking windows (registrar books first, then faculty, then students)
- Conflict detection with academic calendar
- Setup/breakdown time buffers
- Catering integration for long sessions
- Accessibility features (hearing loop, wheelchair access)
- After-hours access request

**Scenario:** Professor requests Room 302 for Spring semester: Monday/Wednesday 2pm-3:30pm. System checks: room has 40 seats, projector, lab stations (matches course needs). Registrar priority window open, request approved. Academic calendar shows Spring Break March 10-14 - automatically excluded. 15-min buffer before/after for setup. One session needs extended to 5pm - separate approval for after-hours building access. Catering ordered for final session celebration. Room shows as booked in campus system, students see location.

---

### UC-97: The Training Room (Corporate)
**Who:** Corporate L&D departments, external training providers
**What:** Professional development space with specific training technology
**Needs:**
- Room features (video conferencing, recording, flip charts)
- Capacity with different layouts (u-shape, classroom, boardroom)
- Catering/lunch options
- Multi-day booking with overnight storage
- External trainer access (badging, parking)
- AV technical support booking
- Material printing/distribution services
- Evaluation form distribution post-training
- CPE/CEU credit tracking for attendees

**Scenario:** Company books Training Room A for 3-day leadership workshop. 20 participants, u-shape layout. Day 1: 9am-5pm with lunch. AV support booked for 8:30am setup. External facilitator needs visitor badge and parking pass. Materials printed and placed at seats. Recording for absentees. Day 3 evaluation forms auto-sent post-session. Attendees receive completion certificates with CPE credits. Room reconfigured to classroom layout for next day's different workshop.

---

### UC-98: The Virtual Classroom (K-12/Higher Ed)
**Who:** Online schools, universities with remote programs
**What:** Scheduled online learning sessions with student management
**Needs:**
- Enrollment-based roster (registered students auto-admitted)
- Attendance tracking and participation scoring
- Breakout room assignment (random or predetermined groups)
- Assignment submission during/after class
- Gradebook integration
- Office hours booking (1-on-1 slots)
- Recording auto-posted to learning management system
- Accessibility compliance (captions, screen reader)
- Parent/guardian observer access (K-12)

**Scenario:** Online high school algebra class meets Tuesday/Thursday 10am. 28 students enrolled, roster syncs from SIS. Students auto-admitted from waiting room. Teacher takes attendance via participation check. Random breakout rooms of 4 for problem-solving. One group struggles - teacher joins to help. Assignment due end of class submitted via integrated form. Recording posted to LMS within 1 hour. Parent portal shows attendance and participation score. Student books office hours for Friday 2pm for extra help.

---

### UC-99: The Virtual Workshop Room (Interactive)
**Who:** Workshop facilitators, design sprints, collaborative training
**What:** Highly interactive virtual space with collaborative tools
**Needs:**
- Collaborative whiteboards (Miro, FigJam integration)
- Multiple screen sharing simultaneously
- Polls and quizzes in-session
- Digital "sticky notes" and voting
- Small group rooms with shared workspaces
- Workshop timer visible to all
- Output export (boards, notes, decisions)
- Participant engagement scoring
- Template loading (sprint templates, workshop frameworks)

**Scenario:** Design sprint facilitator books virtual workshop room for 5-day sprint. 8 participants. Day 1: loads "Design Sprint Template" with pre-set whiteboard, timers, sticky note colors. Participants use digital sticky notes for ideation. Voting via dot-voting feature. Breakout rooms for pairs to sketch. All work persists on shared board. End of week: export all boards to PDF for client. Engagement report shows: 95% camera-on time, all participated in voting, 2 participants dominated speaking time (feedback for facilitator).

---

### UC-100: The Exam/Proctored Session
**Who:** Certification bodies, universities, professional licensing
**What:** High-stakes assessment with identity verification and anti-cheating measures
**Needs:**
- Identity verification (ID upload, facial recognition)
- Secure browser lockdown
- Live proctor monitoring or AI proctoring
- Room scan requirement (360 camera view)
- Scheduled start time with check-in window
- Accommodations management (extra time, breaks)
- Technical issue protocol (lost connection)
- Results delivery timeline
- Appeal/retake scheduling

**Scenario:** Professional certification exam scheduled for Saturday 9am. Candidate checks in 15 min early: ID verification, facial match, room scan showing clear desk. Secure browser launches, blocks other applications. 3-hour exam with one 10-min break (proctor monitors exit and return). AI proctoring flags if candidate looks away too long. Connection lost at 2 hours - candidate rejoins, proctor verifies identity again, time paused during outage. Results available in 5 business days. Candidate fails by 2 points, appeals, schedules retake in 30 days.

---

### UC-101: The Hybrid Classroom (In-Person + Remote)
**Who:** Universities, corporate training with distributed teams
**What:** Simultaneous in-person and virtual attendance with equal participation
**Needs:**
- In-person capacity + unlimited (or capped) virtual
- Classroom camera/mic setup for remote visibility
- Remote participant visibility on classroom screen
- Hybrid participation parity (remote can ask questions, vote)
- Recording for asynchronous viewers
- Switch modality (in-person to remote if sick)
- Equipment check for classroom tech
- Teaching assistant monitoring remote chat

**Scenario:** Graduate seminar: 15 in-person seats + 10 virtual slots. Professor in classroom with camera showing professor and whiteboard. Remote students on 55" screen visible to class. Hand-raising works both ways. Polls include all participants. One in-person student feels ill Wednesday morning - switches to virtual, seat opens for waitlist. Recording available for students in other time zones. TA monitors chat for remote questions professor might miss. Breakout groups: 3 in-person pairs + 2 virtual pairs.

---

### UC-102: The Pop-Up/Temporarily Bookable Space
**Who:** Community centers, churches, vacant retail, outdoor spaces
**What:** Space not normally bookable but available for specific dates/events
**Needs:**
- Limited date availability (only specific weekends)
- Event type restrictions (no alcohol, noise curfew)
- Insurance requirement verification
- Setup/teardown time included or added
- Power/catering/water access notes
- Permit assistance (if required)
- Weather contingency (outdoor spaces)
- Damage/cleaning bond

**Scenario:** Community center gym available for rent Saturdays 2pm-10pm only. Event planner books for charity gala. Insurance certificate required 2 weeks before. Setup starts 2pm, event 6pm-10pm, cleanup by midnight included. Kitchen access available, no alcohol per policy. 200-person capacity. $500 damage deposit held. Outdoor portion has tent weather backup option. One month before, center cancels due to unexpected maintenance - full refund including deposit.

---

## Part 13: Additional Service Patterns

### UC-103: The Subscription Box with Appointment
**Who:** Meal kits, wine clubs, beauty boxes with scheduled consultations
**What:** Physical product subscription plus periodic virtual/in-person consultations
**Needs:**
- Subscription management (pause, skip, frequency)
- Consultation booking included (monthly check-in)
- Preference learning affecting box contents
- Consultation prep (review past boxes, feedback)
- Expert matching (nutritionist, stylist)
- Box delivery coordination with consultation
- Progress tracking over time
- Upgrade/downgrade tiers

**Scenario:** Meal kit subscriber gets monthly 30-min nutritionist consultation included. System schedules based on subscriber preference (Tuesday evenings). Nutritionist reviews past month's meal choices, weight goals, feedback. Adjusts next box contents. Subscriber can book extra consultations à la carte ($40). Skipped consultation doesn't roll over - use it or lose it. After 3 months, subscriber upgrades to weekly box + bi-weekly consultations.

---

### UC-104: The Membership with Included Services
**Who:** Gyms, spas, coworking spaces with monthly credits
**What:** Fixed monthly fee includes bookable services or credits
**Needs:**
- Monthly credit allowance (4 massage credits/month)
- Credit rollover or expire (use or lose)
- Guest privileges (bring friend once/month)
- Peak vs off-peak booking windows
- Upgrade for additional credits
- Credit usage tracking
- Freeze membership (keep credits, pause billing)
- Priority booking (members book before public)

**Scenario:** Spa membership: $199/month includes 4 service credits (any 60-min service), 10% off additional services. Credits expire month-end (no rollover). Member books monthly facial using credit. Tries to book 5th service - charged member rate with 10% discount. Can freeze for up to 3 months (travel) - credits on hold, no new credits accrue. Members get 7-day advance booking vs 3-day for non-members. Guest pass once/month lets friend use member's credit.

---

### UC-105: The Field Service with Parts Ordering
**Who:** Appliance repair, HVAC, garage door services
**What:** Diagnosis visit plus follow-up with parts installation
**Needs:**
- Initial diagnostic appointment
- Parts ordering with ETA
- Follow-up appointment scheduling
- Multi-visit coordination
- Parts deposit if special order
- Warranty tracking on parts and labor
- Service contract integration (parts covered)
- Temporary equipment loan during repair

**Scenario:** Refrigerator not cooling. Technician visit 1 ($95 diagnostic): determines compressor failure. Part costs $280, 3-day shipping. Customer pays $95 + $280 parts deposit. Part arrives, system auto-schedules installation visit. Visit 2: installation (1 hour), labor $150. Total: $525. Part under 1-year warranty, labor under 90-day warranty. Service contract customer: diagnostic free, part covered, pays only labor ($150). Loaner mini-fridge offered during repair.

---

### UC-106: The Curated Experience/Itinerary
**Who:** Travel planners, concierge services, day-trip organizers
**What:** Multi-stop experience with timing coordination
**Needs:**
- Itinerary builder with time estimates
- Multi-vendor coordination (restaurant + activity + transport)
- Backup options if one vendor cancels
- Real-time itinerary updates
- Group coordination (split payments)
- Dietary/restriction tracking across stops
- Weather-dependent alternatives
- Local guide assignment
- Post-experience photo sharing

**Scenario:** Food tour of Little Italy: 4 stops, 3 hours. Stop 1: appetizer at Bistro (2:00pm), Stop 2: pasta making class (2:45pm), Stop 3: gelato tasting (4:00pm), Stop 4: espresso at Cafe (4:30pm). System coordinates timing between venues. Group of 6 friends book, one pays, others pay share via split. Guide assigned. Itinerary updates: Bistro running 15 min late, all stops adjust. Dietary restrictions noted: 1 vegetarian, 1 gluten-free - all venues notified. Rains during tour - backup indoor route activated. Photos shared to group album post-tour.

---

## Summary: Part 9-13 Additions

This expansion adds **25 new use cases** (UC-82 through UC-106) covering:

**Transportation & Vehicle Services (UC-82-86):**
- Shuttle services (scheduled routes and on-demand zones)
- Limo/black car (scheduled and point-to-point)
- Charter bus/group transportation

**Rental & Equipment Services (UC-87-90):**
- Tool/equipment rental with deposits
- Party/event equipment rental
- Vehicle rental with mileage
- Peer-to-peer equipment rental

**Virtual & Remote Services (UC-91-95):**
- Virtual consultations
- Async virtual services
- Live virtual classes/workshops
- Virtual meeting rooms
- Virtual fitness subscriptions

**Physical & Virtual Classrooms (UC-96-102):**
- University classroom/lab booking
- Corporate training rooms
- Virtual K-12/higher ed classrooms
- Interactive workshop rooms
- Proctored exams
- Hybrid classrooms
- Pop-up/temporary spaces

**Additional Service Patterns (UC-103-106):**
- Subscription boxes with consultations
- Membership with included credits
- Field service with parts ordering
- Curated multi-stop experiences

---

*Comprehensive Booking Use Cases v3.0 - 106 scenarios covering transportation, rentals, virtual services, classrooms, and complex multi-step service patterns. Updated 2026-02-19.*
