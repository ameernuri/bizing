---
date: 2026-02-12
tags: 
  - research
  - findings
  - event-driven
  - architecture
  - workflows
  - saga
status: completed
---

# 📚 Research Findings: Event-Driven Architecture for Booking Workflows

> *Event-driven patterns for booking lifecycle management
  - webhook integrations
  - and distributed transactions*

## Executive Summary

This research covers event-driven architecture patterns for Bizing's booking workflows
  - including state machines
  - saga patterns for distributed transactions
  - webhook integrations
  - and audit trails. Key findings inform the workflow engine and async processing design.

---

## 1. Event-Driven Architecture Fundamentals

### 1.1 Why Event-Driven for Bookings?

**Benefits:**
- **Decoupling:** Services don't need to know about each other
- **Scalability:** Process events asynchronously
- **Audit Trail:** Complete history of all state changes
- **Extensibility:** Easy to add new integrations (Calendar
  - Zoom
  - Slack)
- **Resilience:** Retry failed operations
  - dead letter queues

**Booking Workflow Complexity:**
```
Create Booking → Hold Inventory → Process Payment → Confirm → Send Notifications
     ↓                ↓                ↓              ↓            ↓
  Validate        Check DB        Stripe API      Update DB    Email/SMS
  Availability    Exclusion        Charge Card     Release Hold Calendar
```

Each step can fail independently and needs retries.

### 1.2 Core Components

```typescript
// Event
interface DomainEvent {
  id: string                    // UUID v4
  type: string                  // booking.created
  - payment.received
  aggregateId: string           // booking ID
  aggregateType: string         // 'booking'
  payload: Record<string
  - any>  // Event data
  metadata: {
    correlationId: string       // Trace across services
    causationId: string         // Previous event (chain)
    userId: string             // Who triggered
    timestamp: Date
    version: number            // Event schema version
  }
}

// Event Bus
interface EventBus {
  publish(event: DomainEvent): Promise<void>
  subscribe(eventType: string
  - handler: EventHandler): void
}
```

---

## 2. Booking State Machine as Events

### 2.1 State Transitions = Events

Every state change is an event:

```typescript
type BookingEvent =
  | { type: 'BookingCreated'
  - payload: { resourceId
  - customerId
  - timeRange } }
  | { type: 'InventoryHeld'
  - payload: { holdId
  - expiresAt } }
  | { type: 'PaymentRequested'
  - payload: { amount
  - stripeIntentId } }
  | { type: 'PaymentReceived'
  - payload: { stripeChargeId } }
  | { type: 'BookingConfirmed'
  - payload: { confirmedAt } }
  | { type: 'NotificationSent'
  - payload: { channel
  - recipient } }
  | { type: 'CalendarSynced'
  - payload: { provider
  - eventId } }
  | { type: 'BookingCancelled'
  - payload: { reason
  - refundAmount } }
  | { type: 'InventoryReleased'
  - payload: { holdId } }
```

### 2.2 Event Handlers

```typescript
// Each event has dedicated handlers
const handlers: EventHandlers = {
  'BookingCreated': [
    new ValidateAvailabilityHandler(),
    new HoldInventoryHandler(),
    new CreatePaymentIntentHandler()
  ],
  
  'PaymentReceived': [
    new ConfirmBookingHandler(),
    new SendConfirmationEmailHandler(),
    new SyncCalendarHandler(),
    new NotifyAgentHandler()
  ],
  
  'BookingCancelled': [
    new ProcessRefundHandler(),
    new ReleaseInventoryHandler(),
    new SendCancellationEmailHandler(),
    new UpdateAnalyticsHandler()
  ]
};
```

### 2.3 Event Store Schema

```sql
-- Event Store (append-only)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  aggregate_type TEXT NOT NULL DEFAULT 'booking',
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL,
  sequence_number BIGSERIAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(aggregate_id
  - sequence_number)
);

-- Indexes for replay
CREATE INDEX idx_events_aggregate 
ON events(aggregate_type
  - aggregate_id
  - sequence_number);

CREATE INDEX idx_events_type_time 
ON events(type
  - created_at);

-- Projections (read models)
CREATE TABLE booking_projections (
  id UUID PRIMARY KEY,
  customer_id UUID,
  resource_id UUID,
  status TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  version INTEGER
  -  -- Last sequence_number applied
  updated_at TIMESTAMPTZ
);
```

---

## 3. Saga Pattern for Distributed Transactions

### 3.1 The Problem

Booking workflow spans multiple services:
- Database (hold inventory)
- Stripe (process payment)
- Email service (send confirmation)
- Calendar API (create event)

**What if payment succeeds but calendar fails?**

### 3.2 Saga Pattern Solution

**Choreography Saga:** Services react to events
**Orchestration Saga:** Central coordinator manages flow

**Recommendation: Use Orchestration for Bizing**
- More visibility into workflow state
- Easier to debug
- Centralized error handling

### 3.3 Saga Implementation

```typescript
// Saga Definition
interface SagaStep {
  name: string;
  action: () => Promise<void>;
  compensation: () => Promise<void>;  // Undo action
}

const bookingSaga: SagaStep[] = [
  {
    name: 'HoldInventory',
    action: async () => {
      await db.timeSlotHolds.create({ ... });
    },
    compensation: async () => {
      await db.timeSlotHolds.delete({ ... });
    }
  },
  {
    name: 'CreatePaymentIntent',
    action: async () => {
      const intent = await stripe.paymentIntents.create({ ... });
      await db.bookings.update({ stripeIntentId: intent.id });
    },
    compensation: async () => {
      // Nothing to undo
  - intent auto-expires
    }
  },
  {
    name: 'CapturePayment',
    action: async () => {
      await stripe.paymentIntents.capture(intentId);
    },
    compensation: async () => {
      await stripe.refunds.create({ payment_intent: intentId });
    }
  },
  {
    name: 'ConfirmBooking',
    action: async () => {
      await db.bookings.update({ 
        status: 'confirmed',
        confirmedAt: new Date()
      });
    },
    compensation: async () => {
      await db.bookings.update({ status: 'cancelled' });
    }
  },
  {
    name: 'SendNotifications',
    action: async () => {
      await email.sendConfirmation(booking);
      await sms.sendReminder(booking);
    },
    compensation: async () => {
      // Can't unsend email
  - but can send cancellation
      await email.sendCancellation(booking);
    }
  }
];

// Saga Orchestrator
class BookingSagaOrchestrator {
  async execute(bookingId: string) {
    const saga = new Saga(bookingSaga);
    const state = await sagaStateRepository.create({ bookingId });
    
    try {
      for (const step of bookingSaga) {
        await this.executeStep(step
  - state);
      }
      await this.markSagaComplete(state);
    } catch (error) {
      await this.compensate(saga
  - state);
      throw error;
    }
  }
  
  private async executeStep(step: SagaStep
  - state: SagaState) {
    await step.action();
    await sagaStateRepository.addCompletedStep(state.id
  - step.name);
  }
  
  private async compensate(saga: Saga
  - state: SagaState) {
    const completedSteps = state.completedSteps.reverse();
    
    for (const stepName of completedSteps) {
      const step = saga.getStep(stepName);
      try {
        await step.compensation();
      } catch (compError) {
        // Log for manual intervention
        await alertOpsTeam(state.id
  - stepName
  - compError);
      }
    }
  }
}
```

### 3.4 Saga State Management

```sql
CREATE TABLE saga_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saga_type TEXT NOT NULL
  -           -- 'booking_confirmation'
  aggregate_id UUID NOT NULL
  -        -- booking ID
  status TEXT CHECK (status IN (
    'running'
  - 'completed'
  - 'failed'
  - 'compensating'
  - 'compensated'
  )),
  current_step TEXT,
  completed_steps TEXT[],
  failed_step TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Webhook Integrations

### 4.1 Outgoing Webhooks (Bizing → External)

Notify external systems of booking changes:

```typescript
interface WebhookSubscription {
  id: string;
  businessId: string;
  url: string;
  events: string[];  // ['booking.confirmed'
  - 'booking.cancelled']
  secret: string;    // For HMAC signature
  active: boolean;
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
  };
}

// Webhook Delivery
class WebhookService {
  async deliver(event: DomainEvent
  - subscription: WebhookSubscription) {
    const payload = this.buildPayload(event);
    const signature = this.sign(payload
  - subscription.secret);
    
    try {
      await fetch(subscription.url
  - {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bizing-Signature': signature,
          'X-Bizing-Event': event.type
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      await this.scheduleRetry(event
  - subscription);
    }
  }
  
  private sign(payload: object
  - secret: string): string {
    return crypto
      .createHmac('sha256'
  - secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }
}
```

### 4.2 Incoming Webhooks (External → Bizing)

Receive events from Stripe
  - Zoom
  - etc.:

```typescript
// Stripe webhook handler
app.post('/webhooks/stripe'
  - async (req
  - res) => {
  const signature = req.headers['stripe-signature'];
  
  // Verify signature
  const event = stripe.webhooks.constructEvent(
    req.body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
  
  // Convert to domain event
  const domainEvent = stripeEventMapper.toDomainEvent(event);
  
  // Publish to event bus
  await eventBus.publish(domainEvent);
  
  res.json({ received: true });
});

// Event mapper
const stripeEventMapper = {
  toDomainEvent(stripeEvent: Stripe.Event): DomainEvent {
    switch (stripeEvent.type) {
      case 'payment_intent.succeeded':
        return {
          type: 'PaymentReceived',
          aggregateId: stripeEvent.data.object.metadata.bookingId,
          payload: {
            stripeChargeId: stripeEvent.data.object.charges.data[0].id,
            amount: stripeEvent.data.object.amount
          }
        };
      case 'payment_intent.payment_failed':
        return {
          type: 'PaymentFailed',
          aggregateId: stripeEvent.data.object.metadata.bookingId,
          payload: {
            error: stripeEvent.data.object.last_payment_error
          }
        };
    }
  }
};
```

### 4.3 Supported Integrations

| Service | Webhook Type | Events |
|---------|-------------|--------|
| **Stripe** | Incoming | payment_intent.succeeded
  - payment_intent.payment_failed |
| **Google Calendar** | Outgoing | booking.confirmed
  - booking.cancelled |
| **Zoom** | Outgoing | booking.confirmed (create meeting) |
| **Slack** | Outgoing | booking.confirmed
  - payment.received |
| **Twilio** | Outgoing | booking.confirmed (SMS) |

---

## 5. Event Replay & Projections

### 5.1 Why Projections?

Event store is write-optimized. Read queries need denormalized views:

```sql
-- Slow: Query event store
SELECT * FROM events 
WHERE aggregate_type = 'booking' 
AND payload->>'status' = 'confirmed'
AND created_at > NOW() - INTERVAL '7 days';

-- Fast: Query projection
SELECT * FROM booking_projections 
WHERE status = 'confirmed' 
AND start_time > NOW() - INTERVAL '7 days';
```

### 5.2 Building Projections

```typescript
// Projection builder
class BookingProjectionBuilder {
  async handleEvent(event: DomainEvent) {
    switch (event.type) {
      case 'BookingCreated':
        await db.bookingProjections.create({
          id: event.aggregateId,
          status: 'draft',
          ...event.payload
        });
        break;
        
      case 'BookingConfirmed':
        await db.bookingProjections.update({
          where: { id: event.aggregateId },
          data: {
            status: 'confirmed',
            confirmedAt: event.payload.confirmedAt,
            version: event.metadata.sequenceNumber
          }
        });
        break;
        
      case 'BookingCancelled':
        await db.bookingProjections.update({
          where: { id: event.aggregateId },
          data: { status: 'cancelled' }
        });
        break;
    }
  }
}
```

### 5.3 Replay Capability

```typescript
// Replay all events to rebuild projections
async function rebuildProjections() {
  // Clear existing projections
  await db.bookingProjections.deleteMany({});
  
  // Fetch all events in order
  const events = await db.events.findMany({
    orderBy: { sequence_number: 'asc' }
  });
  
  // Replay each event
  const builder = new BookingProjectionBuilder();
  for (const event of events) {
    await builder.handleEvent(event);
  }
}
```

---

## 6. Infrastructure Implementation

### 6.1 Message Queue Options

| Option | Pros | Cons | Best For |
|--------|------|------|----------|
| **Redis + Bull** | Simple
  - fast
  - built-in retries | Single point of failure | Small-medium scale |
| **RabbitMQ** | Mature
  - flexible routing | Complex setup | Enterprise |
| **Kafka** | High throughput
  - persistence | Heavy infrastructure | Large scale |
| **PostgreSQL** | Already using it
  - ACID | Not designed for queues | Start simple |

**Recommendation: Start with PostgreSQL
  - migrate to Redis/Bull when needed**

### 6.2 PostgreSQL Event Queue

```sql
-- Simple event queue using PostgreSQL
CREATE TABLE event_queue (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending'
  - 'processing'
  - 'completed'
  - 'failed')),
  attempts INTEGER DEFAULT 0,
  error TEXT,
  process_after TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Worker polls for pending events
CREATE INDEX idx_event_queue_pending 
ON event_queue(status
  - process_after) 
WHERE status = 'pending';
```

### 6.3 Event Worker

```typescript
class EventWorker {
  async start() {
    while (this.running) {
      const event = await this.pollForEvent();
      if (event) {
        await this.processEvent(event);
      }
      await sleep(100); // 100ms polling interval
    }
  }
  
  async processEvent(queuedEvent: QueuedEvent) {
    try {
      await db.eventQueue.update({
        where: { id: queuedEvent.id },
        data: { status: 'processing' }
      });
      
      const handler = this.handlers[queuedEvent.type];
      await handler(queuedEvent.payload);
      
      await db.eventQueue.update({
        where: { id: queuedEvent.id },
        data: { status: 'completed' }
      });
    } catch (error) {
      await this.handleFailure(queuedEvent
  - error);
    }
  }
  
  async handleFailure(event: QueuedEvent
  - error: Error) {
    const attempts = event.attempts + 1;
    const maxRetries = 3;
    
    if (attempts >= maxRetries) {
      await db.eventQueue.update({
        where: { id: event.id },
        data: { 
          status: 'failed',
          error: error.message,
          attempts
        }
      });
      await alertOpsTeam(event
  - error);
    } else {
      // Exponential backoff
      const delay = Math.pow(2
  - attempts) * 1000; // 2s
  - 4s
  - 8s
      await db.eventQueue.update({
        where: { id: event.id },
        data: {
          status: 'pending',
          attempts,
          process_after: new Date(Date.now() + delay)
        }
      });
    }
  }
}
```

---

## 7. Testing Event-Driven Systems

### 7.1 Unit Testing Handlers

```typescript
describe('BookingConfirmedHandler'
  - () => {
  it('should send confirmation email'
  - async () => {
    const event = createEvent('BookingConfirmed'
  - {
      bookingId: '123',
      customerEmail: 'test@example.com'
    });
    
    const handler = new SendConfirmationEmailHandler();
    await handler.handle(event);
    
    expect(emailService.send).toHaveBeenCalledWith({
      to: 'test@example.com',
      template: 'booking-confirmed',
      data: expect.objectContaining({ bookingId: '123' })
    });
  });
});
```

### 7.2 Integration Testing Saga

```typescript
describe('Booking Saga'
  - () => {
  it('should complete full booking workflow'
  - async () => {
    const booking = await createBooking({ status: 'draft' });
    
    // Execute saga
    await sagaOrchestrator.execute(booking.id);
    
    // Verify final state
    const updated = await db.bookings.findById(booking.id);
    expect(updated.status).toBe('confirmed');
    expect(updated.paymentStatus).toBe('captured');
    
    // Verify side effects
    expect(stripe.paymentIntents.capture).toHaveBeenCalled();
    expect(emailService.sendConfirmation).toHaveBeenCalled();
  });
  
  it('should compensate on payment failure'
  - async () => {
    stripe.paymentIntents.capture.mockRejectedValue(new Error('Card declined'));
    
    const booking = await createBooking({ status: 'draft' });
    
    await expect(sagaOrchestrator.execute(booking.id))
      .rejects.toThrow('Card declined');
    
    // Verify compensation
    const updated = await db.bookings.findById(booking.id);
    expect(updated.status).toBe('cancelled');
    expect(db.timeSlotHolds.findByBookingId(booking.id)).toBeNull();
  });
});
```

---

## 8. Implementation Roadmap

### Phase 1: Event Store (Week 1)
- [ ] Create `events` table
- [ ] Implement event publisher/subscriber
- [ ] Add event logging to booking operations
- [ ] Create basic projection (booking_read_model)

### Phase 2: Saga Framework (Week 2)
- [ ] Implement saga orchestrator
- [ ] Define booking confirmation saga
- [ ] Add compensation logic
- [ ] Create saga monitoring UI

### Phase 3: Webhooks (Week 3)
- [ ] Implement webhook subscription management
- [ ] Add outgoing webhook delivery
- [ ] Implement Stripe incoming webhooks
- [ ] Add webhook retry logic

### Phase 4: Advanced Features (Week 4)
- [ ] Add event replay capability
- [ ] Implement multiple projections
- [ ] Add event schema versioning
- [ ] Create event monitoring dashboard

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Saga pattern | Orchestration | Better visibility
  - centralized error handling |
| Message queue | PostgreSQL → Redis/Bull | Start simple
  - scale when needed |
| Event store | PostgreSQL JSONB | ACID compliance
  - easy queries |
| Webhook delivery | At-least-once + idempotency | Reliability over complexity |
| Projections | Async + eventual consistency | Read performance
  - decoupled writes |

---

## References

- [Saga Pattern - Chris Richardson](https://microservices.io/patterns/data/saga.html)
- [Event Sourcing - Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Building Microservices - Sam Newman](https://samnewman.io/books/building_microservices/)
- [Stripe Webhooks Best Practices](https://stripe.com/docs/webhooks/best-practices)

---

*Research completed 2026-02-12. Ready for saga implementation.*
