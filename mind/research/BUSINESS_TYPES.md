# Business Types & Booking Requirements

> Research document. Updated 2026-02-09.

## Overview

This document catalogs different business types that use booking systems, their unique requirements, core features, use cases, and user personas. The goal is to understand the diversity of needs to inform platform design.

---

## 1. Healthcare

### Business Types
- General practitioners
- Dental clinics
- Specialty doctors (dermatologists, cardiologists, orthopedists)
- Mental health professionals (therapists, psychiatrists)
- Chiropractic and physical therapy
- Urgent care clinics
- Veterinary clinics
- Alternative medicine (acupuncture, naturopathy)

### Special Requirements
- **HIPAA compliance** - Patient data privacy and security
- **Insurance verification** - Verify coverage before appointment
- **Medical history** - Pre-appointment forms, health questionnaires
- **Referral handling** - Physician referrals for specialists
- **Long appointment slots** - 30-60 min appointments, not 15-min
- **Recurring visits** - Treatment plans with multiple appointments
- **Waitlist management** - Cancellations fill quickly
- **Telehealth integration** - Video consultations
- **Minors consent** - Parental permission forms

### Core Features
- Insurance verification flow
- Medical intake forms
- Patient portal
- Prescription reminders
- Multi-provider scheduling
- Room/equipment assignment

### User Personas
- **Patient** - Book appointments, view history, fill forms
- **Receptionist** - Manage calendar, check insurance, handle walk-ins
- **Provider** - View schedule, patient notes, availability
- **Billing admin** - Insurance claims, copay collection

### Scenarios
1. New patient books initial consultation, fills intake forms
2. Returning patient books follow-up, insurance auto-verified
3. Doctor refers to specialist, patient books with referral code
4. Patient cancels, waitlist notified, slot filled

---

## 2. Fitness & Wellness

### Business Types
- Gyms and fitness centers
- Yoga and Pilates studios
- Boutique fitness (Barry's, SoulCycle, OrangeTheory)
- Martial arts schools
- Dance studios
- Swimming pools
- Climbing gyms
- Sports training facilities

### Special Requirements
- **Class-based booking** - Group classes vs personal training
- **Membership tiers** - Class packs, unlimited plans, credits
- **Capacity limits** - Maximum participants per class
- **Waitlist** - Auto-enroll when spots open
- **Recurring memberships** - Monthly/annual billing
- **Package expiry** - Credits expire if unused
- **Equipment reservation** - Treadmills, squat racks, bikes
- **Time-based check-in** - Members book time slots

### Core Features
- Class schedule calendar
- Membership management
- Waitlist automation
- Credit/punch card system
- Check-in tracking
- Package expiration

### User Personas
- **Member** - Book classes, view schedule, manage membership
- **Instructor** - View roster, manage class capacity
- **Front desk** - Check-ins, handle no-shows, sales
- **Manager** - Schedule classes, instructor assignments, reports

### Scenarios
1. Member books 6am yoga class, waitlisted spots available
2. Class fills up, new members join waitlist
3. Member cancels, waitlist auto-notified, spot filled
4. Member's 10-class pack expires in 2 weeks, reminder sent
5. New member signs up, chooses membership tier

---

## 3. Beauty & Personal Care

### Business Types
- Hair salons
- Barbershops
- Nail salons
- Spas and medispas
- Beauty salons
- Lash and brow studios
- Tattoo shops
- Piercing studios
- Makeup artistry

### Special Requirements
- **Staff specialization** - Stylists, colorists, estheticians
- **Service duration** - Exact timing (30 min, 90 min, all day)
- **Pre-booking** - Clients book next appointment before leaving
- **Tip processing** - Add tip to booking
- **Product sales** - Retail add-ons at checkout
- **Gift cards** - Purchase and redemption
- **Deposit required** - High-value appointments
- **Reopening time** - Buffer between appointments

### Core Features
- Staff/service matrix
- Duration-based scheduling
- Pre-booking prompts
- Tip and deposit handling
- Gift card system
- Client history

### User Personas
- **Client** - Book with preferred stylist, view history
- **Stylist** - Manage personal calendar, client notes
- **Receptionist** - Answer phones, fill open slots
- **Owner** - Staff schedules, inventory, revenue reports

### Scenarios
1. Client books with preferred stylist, gets 90-min color appointment
2. Stylist finishes, prompts client to book next visit
3. Client no-shows, deposit forfeited
4. New client books first time, selects "new client" special
5. Gift card purchased and applied to service

---

## 4. Home Services

### Business Types
- Cleaning services
- Handyman and repairs
- HVAC and plumbing
- Lawn care and landscaping
- Pest control
- Moving services
- Home security installation
- Personal chefs and catering
- Pet grooming and sitting

### Special Requirements
- **Location routing** - Geographic scheduling, drive time
- **Time windows** - "Between 2pm and 5pm" ranges
- **Multi-technician** - Jobs requiring multiple people
- **Materials/parts** - Ordering ahead
- **Customer at home** - Need access, instructions
- **Access codes** - Gate codes, lockbox combinations
- **Photos required** - Before/after photos
- **Quote system** - Estimated vs actual pricing

### Core Features
- Route optimization
- Time window scheduling
- Technician assignment
- Access code storage
- Job notes and photos
- Quote/estimate workflow

### User Personas
- **Customer** - Book service, provide access, pay
- **Dispatcher** - Route technicians, handle changes
- **Technician** - View route, complete jobs, collect payment
- **Office** - Quotes, customer service, scheduling

### Scenarios
1. Customer books cleaning for Saturday 8am-12pm
2. Dispatcher assigns to tech nearest location
3. Tech arrives, follows access code instructions
4. Customer adds extra room, job updated
5. Job complete, photo uploaded, customer pays + tip

---

## 5. Professional Services

### Business Types
- Law firms
- Accounting and tax prep
- Consulting firms
- Real estate agents
- Financial advisors
- Architects and designers
- Photography studios
- Event planning
- Coaching and tutoring

### Special Requirements
- **Consultation types** - Free consult vs paid session
- **Project-based** - Multi-session engagements
- **Lead time** - Bookings weeks/months ahead
- **Confidentiality** - NDA handling
- **Document sharing** - Secure file exchange
- **Meeting rooms** - Virtual or physical room booking
- **Recurring clients** - Monthly/quarterly engagements

### Core Features
- Consultation types
- Multi-session bookings
- Secure document sharing
- Meeting room integration
- Lead time management
- Client portal

### User Personas
- **Client** - Book consultations, upload documents
- **Professional** - Manage calendar, prepare for meetings
- **Paralegal/Assistant** - Scheduling, document prep
- **Office manager** - Room booking, resource allocation

### Scenarios
1. Prospective client books free 30-min consultation
2. Consultation converts to paid engagement, series booked
3. Client uploads documents via secure portal
4. Meeting scheduled, video link sent automatically
5. Follow-up sessions booked after each meeting

---

## 6. Events & Entertainment

### Business Types
- Event venues
- Tour operators
- Activity centers
- Escape rooms
- Axe throwing
- Mini golf
- Bowling alleys
- Museums and attractions
- Theater and concerts

### Special Requirements
- **Group bookings** - 10, 20, 50+ people
- **Ticket inventory** - Specific seats, timeslots
- **Capacity limits** - Max per time slot
- **Discount codes** - Group rates, promotions
- **Add-ons** - Food, equipment, instruction
- **Waivers** - Liability agreements
- **Rain dates** - Weather-dependent activities

### Core Features
- Group booking flow
- Seat selection
- Capacity management
- Waiver collection
- Add-on products
- Calendar integration

### User Personas
- **Guest** - Book tickets, select time, pay
- **Group organizer** - Manage group size, collect waivers
- **Staff** - Check-in, manage capacity, handle issues
- **Manager** - Capacity reports, pricing, promotions

### Scenarios
1. Family of 4 books Sunday afternoon mini golf
2. Company books team event for 30 people, gets discount
3. Waiver sent to all attendees, must sign before arrival
4. Weather threatens outdoor event, rain date offered
5. Equipment rental added to booking

---

## 7. Automotive

### Business Types
- Auto repair shops
- Car dealerships (test drives)
- Car washes and detailing
- Tire shops
- Oil change chains
- Collision repair
- Rental car companies
- Motorcycle dealers

### Special Requirements
- **Vehicle info** - Year, make, model required
- **Appointment duration** - Precise timing (45 min, 2 hours)
- **Parts ordering** - Schedule around parts arrival
- **Loaner cars** - Availability and scheduling
- **Multi-vehicle** - Household management
- **Service milestones** - Oil change reminders, inspections

### Core Features
- Vehicle profile management
- Service type selection
- Parts lookup
- Loaner car allocation
- Reminder system
- Service history

### User Personas
- **Customer** - Book service, add vehicles, view history
- **Service advisor** - Schedule work, communicate with customers
- **Technician** - View work order, complete job
- **Dispatcher** - Parts ordering, workflow management

### Scenarios
1. Customer adds second car to profile
2. Books oil change, system checks mileage for service due
3. Advisor schedules for next week, orders filter
4. Loaner car requested, availability confirmed
5. Service complete, video inspection sent, customer pays

---

## 8. Education

### Business Types
- Tutoring centers
- Music schools
- Driving schools
- Language schools
- Professional training
- Coding bootcamps
- Dance schools
- Sports academies
- Continuing education

### Special Requirements
- **Instructor specialization** - Specific teachers
- **Curriculum progression** - Level-based advancement
- **Package deals** - 10 lessons for discount
- **Recurring schedules** - Weekly same time
- **Make-up sessions** - Missed class options
- **Parent portal** - For children's classes
- **Attendance tracking** - Required for certifications

### Core Features
- Instructor profiles
- Curriculum levels
- Package management
- Recurring bookings
- Make-up tracking
- Parent access

### User Personas
- **Student/Parent** - Book lessons, view progress
- **Instructor** - View students, curriculum, schedule
- **Administrator** - Enrollment, reporting, communications
- **School admin** - Compliance, certifications

### Scenarios
1. Parent books piano lessons for child with preferred teacher
2. Weekly Saturday 10am slot recurring for semester
3. Student misses class, make-up session scheduled
4. Progress tracked, level advancement suggested
5. Package of 10 lessons consumed, renewal reminder

---

## 9. Hospitality & Tourism

### Business Types
- Hotels and resorts
- Vacation rentals
- Tours and activities
- Restaurant reservations
- Spa bookings (hotel spas)
- Conference rooms
- Event spaces
- Airport transfers

### Special Requirements
- **Room/equipment inventory** - Real-time availability
- **Duration pricing** - Hourly, daily, nightly rates
- **Peak pricing** - Weekends, holidays
- **Packages** - Room + breakfast, tour + lunch
- **Cancellations** - Varying policies
- **Group blocks** - Room blocks for events
- **Channel management** - Sync with Booking.com, Airbnb

### Core Features
- Real-time inventory
- Rate management
- Package builder
- Cancellation policies
- Group booking
- Channel sync

### User Personas
- **Guest** - Book room/service, manage reservation
- **Front desk** - Check-in/out, room assignment
- **Concierge** - Book tours, restaurant reservations
- **Revenue manager** - Pricing, availability, channels

### Scenarios
1. Guest books beachfront room for 4 nights
2. Airport transfer and dinner reservation added
3. Peak pricing applied for holiday weekend
4. Guest modifies reservation, date changed
5. Room block created for wedding group

---

## 10. B2B Services

### Business Types
- Coworking spaces
- Meeting room rentals
- Equipment rental (A/V, construction)
- Printing and signs
- Courier and delivery
- Mailing services
- Storage units
- Office supply

### Business Requirements
- **Company accounts** - Billing to business
- **Purchase orders** - PO number tracking
- **Net terms** - Payment after 30/60 days
- **Multi-user access** - Company employees book
- **Usage limits** - Monthly quotas
- **Approval workflow** - Manager approves large bookings
- **Reports** - Expense tracking by department

### Core Features
- Company accounts
- PO tracking
- Approval workflows
- Usage quotas
- Expense reporting
- Bulk booking

### User Personas
- **Employee** - Book resources for work
- **Admin** - Manage company account
- **Account manager** - Client relationships
- **Finance** - Invoice review, payment

### Scenarios
1. Employee books conference room for client meeting
2. Requires manager approval, sent for sign-off
3. Approved, confirmation sent, calendar invites
4. Printing job submitted, PO number attached
5. Monthly usage report generated, expenses allocated

---

## Universal Features Across All Business Types

### Scheduling
- Calendar views (day, week, month)
- Time slot selection
- Resource assignment
- Blocked time management
- Overbooking rules
- Buffer time

### Customer Management
- Customer profiles
- Communication history
- Preferences storage
- Notes and tags
- VIP status
- Do-not-book flags

### Communication
- Email confirmations
- SMS reminders
- Calendar invites (Google, Apple, Outlook)
- Marketing emails
- Two-way messaging

### Payments
- Credit card processing
- Deposits and prepayments
- Refunds and credits
- Gift cards
- Packages and bundles
- Invoicing

### Reporting
- Revenue reports
- Booking analytics
- Customer insights
- Staff performance
- Popular services/times
- No-show rates

### Integration
- Payment processors (Stripe, Square, PayPal)
- Calendar sync (Google, Apple, Outlook)
- Video conferencing (Zoom, Meet, Teams)
- Accounting (QuickBooks, Xero)
- Marketing (Mailchimp, Klaviyo)
- CRM integration

---

## Common User Personas (All Industries)

### For Customers
- **The Planner** - Books weeks ahead, organized
- **The Last-Minute** - Same-day bookings, spontaneous
- **The Repeater** - Recurring appointments, loyalty
- **The Browser** - Looks frequently, books rarely
- **The Group Bookers** - Books for others (family, team)

### For Staff
- **The Scheduler** - Manages calendar, fills slots
- **The Bookkeeper** - Handles payments, invoices
- **The Service Provider** - Delivers the service
- **The Manager** - Oversees operations, reports

### For Administrators
- **The Setup Person** - Configures services, pricing, staff
- **The Optimizer** - Adjusts schedules, pricing, marketing
- **The Support** - Handles issues, cancellations, complaints

---

## Key Insights for Platform Design

1. **Multi-tenancy is essential** - Each business has unique needs
2. **Customization depth matters** - No one-size-fits-all
3. **Integration is critical** - Payment, calendar, video
4. **Mobile-first for customers** - Most bookings on mobile
5. **Offline support for staff** - Need to work without internet
6. **Automated reminders** - Reduce no-shows dramatically
7. **Easy rebooking** - Biggest revenue opportunity
8. **Clear policies** - Cancellation, no-show, deposit rules
9. **Group booking support** - B2B and events need this
10. **Analytics for owners** - Revenue, utilization, trends

---

*Document created 2026-02-09. Research source: Industry analysis of booking system requirements across sectors.*
