

# Audio Briefing: Event-Driven Architecture for Booking Workflows

## Executive Summary

This research covers event-driven architecture patterns for Bizing's booking workflows. Key findings inform the workflow engine and async processing design.

## Why Event-Driven for Bookings?

Event-driven architecture provides four key benefits for booking systems:

Decoupling: Services don't need to know about each other. Each component reacts to events independently.

Scalability: Process events asynchronously. The booking flow can handle high volume without blocking.

Audit Trail: Complete history of all state changes. Every booking transition is recorded.

Extensibility: Easy to add new integrations. Calendar, Zoom, Slack, email can all subscribe to booking events.

## The Booking Workflow as Events

Every state change in a booking becomes an event:

BookingCreated — Triggered when a customer initiates a booking. Triggers availability checks and payment setup.

InventoryHeld — Confirms the time slot is reserved. Prevents double-booking.

PaymentRequested — Creates a Stripe payment intent. Sets up the financial transaction.

PaymentReceived — Confirms payment succeeded. The critical trigger for confirmation.

BookingConfirmed — Final state. All checks passed. Booking is locked in.

NotificationSent — Emails and SMS confirmations delivered to the customer.

CalendarSynced — External calendar updated with the booking.

BookingCancelled — Customer cancelled. Triggers refunds and inventory release.

## The Saga Pattern

The core challenge: booking workflows span multiple services. Database, Stripe, email, calendar. What if payment succeeds but calendar fails?

The solution: Saga pattern with orchestration.

Instead of services reacting to events in a choreographed dance, a central orchestrator manages the flow. This provides better visibility, easier debugging, and centralized error handling.

The booking saga has five steps:

Step one: Hold inventory. Creates a time slot hold in the database.

Step two: Create payment intent. Sets up Stripe transaction.

Step three: Capture payment. Charges the customer's card.

Step four: Confirm booking. Updates the booking status to confirmed.

Step five: Send notifications. Emails and SMS confirmations.

Each step has a compensation action. If step five fails, the saga runs compensation in reverse. Cancels the booking, releases the inventory.

## Webhook Integrations

Two types of webhooks matter for Bizing.

Outgoing webhooks notify external systems when booking events occur. A booking confirmed event can trigger a calendar sync to Google Calendar, a Zoom meeting creation, or a Slack notification.

Incoming webhooks receive events from external systems. Stripe sends payment succeeded webhooks. Bizing converts these to domain events and publishes them on the internal event bus.

Delivery guarantees: At-least-once delivery with idempotency. Webhooks are retried on failure with exponential backoff.

## Event Store and Projections

Events are stored in an append-only event store. Each event includes the event type, aggregate ID, payload with event data, and metadata for correlation and causation chains.

Projections are denormalized read models. They provide fast queries. Instead of replaying thousands of events to answer "what bookings were confirmed this week," the booking projections table has that data ready.

Replays rebuild projections from all events. Useful for recovery or schema changes.

## Infrastructure Choices

For message queuing, start with PostgreSQL since Bizing already uses it. Migrate to Redis with Bull when scaling needs arise.

The event store uses PostgreSQL with JSONB for payload storage. Simple, ACID compliant, and leverages existing infrastructure.

## Implementation Roadmap

Week one: Create the events table. Implement event publisher and subscriber. Add event logging to booking operations. Create the basic booking projection.

Week two: Implement the saga orchestrator. Define the booking confirmation saga. Add compensation logic. Create saga monitoring.

Week three: Implement webhook subscription management. Add outgoing webhook delivery. Implement Stripe incoming webhooks. Add retry logic.

Week four: Add event replay capability. Implement multiple projections. Add event schema versioning. Create monitoring dashboard.

## Key Decisions

Saga pattern: Orchestration over choreography for better visibility.

Message queue: PostgreSQL initially, Redis Bull when needed.

Event store: PostgreSQL JSONB for ACID compliance.

Webhook delivery: At-least-once with idempotency.

Projections: Async with eventual consistency for read performance.

---

*Research completed February 12th. Ready for saga implementation.*
