---
date: 2026-02-12
tags: 
  - research
  - findings
  - booking
  - domain-model
  - reservations
status: completed
---

# 📚 Research Findings: Booking Domain Model & Reservation Patterns

> *Comprehensive research on booking system architecture
  - reservation patterns
  - and domain modeling*

## Executive Summary

This research covers the core domain model for Bizing's booking engine
  - including reservation state machines
  - inventory management
  - and prevention of double-booking. Key findings inform the database schema and API design.

---

## 1. Core Booking Domain Concepts

### 1.1 Reservation State Machine

**States:**
```
DRAFT → PENDING → CONFIRMED → COMPLETED
  ↓        ↓          ↓
CANCELLED  EXPIRED   NO_SHOW
```

**State Transitions:**
| From | To | Trigger | Business Rule |
|------|-----|---------|---------------|
| DRAFT | PENDING | User submits | Validate availability |
| PENDING | CONFIRMED | Payment received | Hold inventory |
| PENDING | EXPIRED | Timeout (15min) | Release inventory |
| CONFIRMED | COMPLETED | Event time passed | Mark as done |
| CONFIRMED | CANCELLED | User cancels | Apply cancellation policy |
| CONFIRMED | NO_SHOW | No check-in | Record no-show |

### 1.2 Inventory Management Patterns

**Pattern A: Pessimistic Locking**
- Lock time slot when user starts booking
- Prevents double-booking at database level
- Con: Reduces concurrency
  - abandoned locks

**Pattern B: Optimistic Locking (Versioning)**
- Check availability at submission time
- Use version numbers for conflict detection
- Pro: Better concurrency
  - handles race conditions
- **Recommendation: Use for Bizing**

**Pattern C: Event Sourcing**
- Store all inventory changes as events
- Rebuild current state from event log
- Pro: Complete audit trail
  - time-travel queries
- Con: Complexity
  - requires CQRS

### 1.3 Time Slot Management

**Time Block Types:**
```typescript
interface TimeSlot {
  id: string
  resourceId: string          // What is being booked
  startTime: DateTime
  endTime: DateTime
  duration: Duration
  status: 'available' | 'held' | 'booked' | 'blocked'
  version: number             // For optimistic locking
  holdExpiresAt?: DateTime    // For pending bookings
}
```

**Recurrence Patterns:**
- Daily
  - weekly
  - monthly repeats
- End after N occurrences or end date
- Exclude specific dates (holidays)
- **Implementation:** Generate instances on-demand
  - don't store all

---

## 2. Database Schema Design

### 2.1 Core Tables

```sql
-- Resources (what can be booked)
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('room'
  - 'event_space'
  - 'service'
  - 'product')),
  capacity INTEGER,
  timezone TEXT DEFAULT 'UTC',
  business_id UUID REFERENCES businesses(id),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Availability (when can it be booked)
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true
);

-- Bookings (the reservation)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id),
  customer_id UUID REFERENCES users(id),
  agent_id UUID REFERENCES agents(id)
  -  -- Who made the booking
  
  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,
  
  -- State machine
  status TEXT CHECK (status IN (
    'draft'
  - 'pending'
  - 'confirmed'
  - 'completed'
  - 
    'cancelled'
  - 'expired'
  - 'no_show'
  )),
  
  -- Versioning for optimistic locking
  version INTEGER DEFAULT 1,
  
  -- Payment/Transaction
  payment_status TEXT CHECK (payment_status IN (
    'pending'
  - 'held'
  - 'captured'
  - 'refunded'
  - 'failed'
  )),
  payment_intent_id TEXT
  -  -- Stripe reference
  total_amount DECIMAL(12,2),
  currency TEXT DEFAULT 'USD',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT no_double_booking EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time
  - end_time) WITH &&
  ) WHERE (status IN ('confirmed'
  - 'completed'))
);

-- Booking History (audit log)
CREATE TABLE booking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT,
  changed_by UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time Slot Holds (prevent double-booking during checkout)
CREATE TABLE time_slot_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  held_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  
  CONSTRAINT valid_hold_time CHECK (expires_at > NOW())
);
```

### 2.2 Key Indexes

```sql
-- Fast availability lookups
CREATE INDEX idx_bookings_resource_time 
ON bookings(resource_id
  - start_time
  - end_time) 
WHERE status IN ('confirmed'
  - 'completed');

-- Customer bookings
CREATE INDEX idx_bookings_customer 
ON bookings(customer_id
  - start_time DESC);

-- Agent bookings
CREATE INDEX idx_bookings_agent 
ON bookings(agent_id
  - created_at DESC);

-- Status queries
CREATE INDEX idx_bookings_status_time 
ON bookings(status
  - start_time) 
WHERE status IN ('pending'
  - 'confirmed');
```

---

## 3. Double-Booking Prevention Strategies

### 3.1 Database-Level Constraints

**PostgreSQL EXCLUDE Constraint:**
```sql
-- Prevents overlapping confirmed bookings
ALTER TABLE bookings ADD CONSTRAINT no_overlap
EXCLUDE USING gist (
  resource_id WITH =,
  tstzrange(start_time
  - end_time) WITH &&
)
WHERE (status IN ('confirmed'
  - 'completed'));
```

**How it works:**
- Uses GiST index for efficient range checking
- Only applies to confirmed/completed bookings
- Pending bookings can overlap (during payment)
- Database guarantees no conflicts

### 3.2 Application-Level Validation

**Two-Phase Check:**
```typescript
async function createBooking(data: BookingInput) {
  // Phase 1: Check availability (fast)
  const isAvailable = await checkAvailability(
    data.resourceId,
    data.startTime,
    data.endTime
  );
  
  if (!isAvailable) {
    throw new Error('Time slot no longer available');
  }
  
  // Phase 2: Create with optimistic lock
  try {
    const booking = await db.bookings.create({
      data: {
        ...data,
        status: 'pending',
        version: 1
      }
    });
    
    // Hold the slot
    await holdTimeSlot(booking);
    
    return booking;
  } catch (error) {
    // Handle race condition
    if (error.code === 'P0001') { // Exclusion constraint
      throw new Error('Slot was just booked by someone else');
    }
    throw error;
  }
}
```

### 3.3 Time Slot Holds (Checkout Process)

**Mechanism:**
- When user starts booking: Create hold for 15 minutes
- Hold expires: Release slot
  - mark booking as expired
- Payment received: Convert hold to confirmed booking
- User abandons: Background job cleans up expired holds

```typescript
// Cleanup job (runs every minute)
async function releaseExpiredHolds() {
  await db.timeSlotHolds.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  });
}
```

---

## 4. Advanced Patterns

### 4.1 Waitlist Pattern

When fully booked
  - allow waitlist:
```typescript
interface WaitlistEntry {
  id: string
  resourceId: string
  customerId: string
  preferredTime: DateTime
  flexibility: 'exact' | '1hour' | 'sameday'
  status: 'waiting' | 'offered' | 'expired' | 'converted'
  offeredAt?: DateTime
  expiresAt?: DateTime
}

// On cancellation
async function offerToWaitlist(cancelledBooking: Booking) {
  const waiters = await db.waitlist.findMany({
    where: {
      resourceId: cancelledBooking.resourceId,
      status: 'waiting',
      preferredTime: {
        gte: cancelledBooking.startTime - flexibilityWindow,
        lte: cancelledBooking.startTime + flexibilityWindow
      }
    },
    orderBy: { createdAt: 'asc' },
    take: 3 // Offer to top 3
  });
  
  for (const waiter of waiters) {
    await notifyWaitlistOffer(waiter
  - cancelledBooking);
  }
}
```

### 4.2 Buffer Times

Add cleanup/prep time between bookings:
```typescript
interface ResourceSettings {
  bufferBefore: number;  // minutes
  bufferAfter: number;   // minutes
  minAdvanceBooking: number; // hours
  maxAdvanceBooking: number; // days
}

// When checking availability
function getEffectiveDuration(booking: Booking
  - settings: ResourceSettings) {
  return {
    blockedStart: booking.startTime - settings.bufferBefore * MINUTES,
    blockedEnd: booking.endTime + settings.bufferAfter * MINUTES
  };
}
```

### 4.3 Multi-Resource Bookings

Book multiple resources simultaneously (package deals):
```typescript
interface PackageBooking {
  id: string
  customerId: string
  status: BookingStatus
  bookings: Booking[]  // Linked bookings
  totalAmount: Decimal
  // All-or-nothing: if one fails
  - all fail
}
```

---

## 5. API Design Implications

### 5.1 Core Endpoints

```typescript
// Check availability before booking
GET /api/v1/resources/:id/availability?start=2026-03-01&end=2026-03-07

// Create booking (starts checkout process)
POST /api/v1/bookings
Body: {
  resourceId: string
  startTime: ISOString
  endTime: ISOString
  customerId: string
}
Response: { bookingId
  - status: 'pending'
  - expiresAt }

// Confirm booking (after payment)
POST /api/v1/bookings/:id/confirm
Body: { paymentIntentId }

// Cancel booking
POST /api/v1/bookings/:id/cancel
Body: { reason }

// Get booking details
GET /api/v1/bookings/:id
```

### 5.2 Validation Rules

```typescript
const bookingRules = {
  // Time constraints
  minAdvanceHours: 1,
  maxAdvanceDays: 90,
  maxDurationHours: 8,
  
  // Cancellation policy
  freeCancellationHours: 24,
  partialRefundHours: 4,
  noRefundHours: 1,
  
  // Hold duration
  checkoutTimeoutMinutes: 15
};
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

```typescript
describe('Booking State Machine'
  - () => {
  it('should transition from pending to confirmed on payment'
  - () => {
    const booking = createBooking({ status: 'pending' });
    booking.confirm(paymentIntent);
    expect(booking.status).toBe('confirmed');
  });
  
  it('should expire pending booking after timeout'
  - () => {
    const booking = createBooking({ status: 'pending'
  - expiresAt: past() });
    booking.checkExpiration();
    expect(booking.status).toBe('expired');
  });
});

describe('Double Booking Prevention'
  - () => {
  it('should prevent overlapping confirmed bookings'
  - async () => {
    // Create confirmed booking
    await createBooking({ 
      resourceId: 'room-a',
      start: '2026-03-01T10:00:00Z',
      end: '2026-03-01T11:00:00Z',
      status: 'confirmed'
    });
    
    // Try to create overlapping booking
    await expect(createBooking({
      resourceId: 'room-a',
      start: '2026-03-01T10:30:00Z',
      end: '2026-03-01T11:30:00Z',
      status: 'confirmed'
    })).rejects.toThrow('overlapping booking');
  });
});
```

### 6.2 Integration Tests

```typescript
describe('Concurrent Booking Race Condition'
  - () => {
  it('should handle 10 simultaneous bookings for last slot'
  - async () => {
    const attempts = Array(10).fill(null).map(() => 
      request(app)
        .post('/api/v1/bookings')
        .send({ resourceId: 'single-room'
  - ... })
    );
    
    const results = await Promise.allSettled(attempts);
    const confirmed = results.filter(r => r.value?.status === 201);
    
    expect(confirmed.length).toBe(1); // Only one succeeds
  });
});
```

---

## 7. Implementation Roadmap

### Phase 1: Core Schema (Week 1)
- [ ] Create database tables (resources
  - bookings
  - availability)
- [ ] Implement state machine
- [ ] Add exclusion constraints
- [ ] Basic CRUD API endpoints

### Phase 2: Availability Engine (Week 2)
- [ ] Availability calculation logic
- [ ] Time slot generation
- [ ] Buffer time support
- [ ] Recurring availability patterns

### Phase 3: Booking Flow (Week 3)
- [ ] Checkout process with holds
- [ ] Payment integration hooks
- [ ] Confirmation flow
- [ ] Cancellation/refund logic

### Phase 4: Advanced Features (Week 4)
- [ ] Waitlist system
- [ ] Multi-resource packages
- [ ] Overbooking protection
- [ ] Audit logging

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Double-booking prevention | PostgreSQL EXCLUDE constraint | Database-level guarantee
  - no race conditions |
| Locking strategy | Optimistic (versioning) | Better concurrency than pessimistic locks |
| State management | State machine | Clear transitions
  - audit trail
  - business rules |
| Checkout holds | 15-minute timeout | Balance between UX and inventory availability |
| Recurring bookings | Generate on-demand | Don't store infinite future instances |

---

## References

- [PostgreSQL EXCLUDE Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Saga Pattern for Distributed Transactions](https://microservices.io/patterns/data/saga.html)
- [Optimistic vs Pessimistic Locking](https://www.postgresql.org/docs/current/explicit-locking.html)

---

*Research completed 2026-02-12. Ready for schema implementation.*
