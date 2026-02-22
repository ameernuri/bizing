import { sql } from "drizzle-orm";
import { check, foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { idRef, idWithTag, withAuditRefs } from "./_common";
import { bizes } from "./bizes";
import { groupAccounts } from "./group_accounts";
import { locations } from "./locations";
import { resources } from "./resources";
import { users } from "./users";
import { bookingOrders, fulfillmentUnits } from "./fulfillment";
import {
  dispatchTaskStatusEnum,
  etaEventTypeEnum,
  routeStopKindEnum,
  transportRouteStatusEnum,
  transportTripStatusEnum,
  tripManifestStatusEnum,
  vehicleStatusEnum,
} from "./enums";
import { offerVersions } from "./offers";
import { queueEntries } from "./queue";
import { calendarBindings } from "./time_availability";

/**
 * fleet_vehicles
 *
 * ELI5:
 * Vehicle catalog for transportation operations.
 * A vehicle may also be represented as a resource, but this table stores
 * transport-specific fields cleanly (plate, VIN, seat capacity, etc.).
 */
export const fleetVehicles = pgTable(
  "fleet_vehicles",
  {
    /** Stable primary key for one vehicle row. */
    id: idWithTag("fleet_vehicle"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional link to canonical resource row for shared assignment engine use. */
    resourceId: idRef("resource_id").references(() => resources.id),

    /** Vehicle display name for ops UI. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Registration/license plate. */
    plateNumber: varchar("plate_number", { length: 40 }),

    /** Vehicle identification number (if tracked). */
    vin: varchar("vin", { length: 64 }),

    /** Passenger capacity for trip planning. */
    seatCapacity: integer("seat_capacity").notNull(),

    /** Optional luggage/storage capacity scalar. */
    luggageCapacity: integer("luggage_capacity"),

    /** Vehicle operational state. */
    status: vehicleStatusEnum("status").default("active").notNull(),

    /** Structured telemetry/integration fields (device ids, tracker refs). */
    telemetryConfig: jsonb("telemetry_config").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    fleetVehiclesBizIdIdUnique: uniqueIndex("fleet_vehicles_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe child FKs. */

    /** Plate uniqueness when present (per tenant). */
    fleetVehiclesPlateUnique: uniqueIndex("fleet_vehicles_plate_unique")
      .on(table.bizId, table.plateNumber)
      .where(sql`"plate_number" IS NOT NULL`),

    /** Common dispatch lookup path. */
    fleetVehiclesBizStatusIdx: index("fleet_vehicles_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    /** Tenant-safe FK to resource link. */
    fleetVehiclesBizResourceFk: foreignKey({
      columns: [table.bizId, table.resourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "fleet_vehicles_biz_resource_fk",
    }),

    /** Capacity values must be positive/non-negative. */
    fleetVehiclesCapacityBoundsCheck: check(
      "fleet_vehicles_capacity_bounds_check",
      sql`"seat_capacity" > 0 AND ("luggage_capacity" IS NULL OR "luggage_capacity" >= 0)`,
    ),
  }),
);

/**
 * transport_routes
 *
 * ELI5:
 * A reusable route template (sequence of stops) that trips can instantiate.
 */
export const transportRoutes = pgTable(
  "transport_routes",
  {
    /** Stable primary key for route template. */
    id: idWithTag("transport_route"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Human route name. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Stable route slug for APIs and imports. */
    slug: varchar("slug", { length: 140 }).notNull(),

    /** Route lifecycle state. */
    status: transportRouteStatusEnum("status").default("active").notNull(),

    /** Optional default origin location. */
    originLocationId: idRef("origin_location_id").references(() => locations.id),

    /** Optional default destination location. */
    destinationLocationId: idRef("destination_location_id").references(
      () => locations.id,
    ),

    /** Timezone for route-level departure/arrival planning. */
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),

    /** Policy payload (boarding cutoffs, overbooking, stop skip rules, etc.). */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    transportRoutesBizIdIdUnique: uniqueIndex("transport_routes_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe stop/trip FKs. */

    /** Unique route slug per tenant. */
    transportRoutesBizSlugUnique: uniqueIndex("transport_routes_biz_slug_unique").on(
      table.bizId,
      table.slug,
    ),

    /** Common route listing path. */
    transportRoutesBizStatusIdx: index("transport_routes_biz_status_idx").on(
      table.bizId,
      table.status,
    ),

    /** Tenant-safe FK to origin location. */
    transportRoutesBizOriginLocationFk: foreignKey({
      columns: [table.bizId, table.originLocationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "transport_routes_biz_origin_location_fk",
    }),

    /** Tenant-safe FK to destination location. */
    transportRoutesBizDestinationLocationFk: foreignKey({
      columns: [table.bizId, table.destinationLocationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "transport_routes_biz_destination_location_fk",
    }),
  }),
);

/**
 * transport_route_stops
 *
 * ELI5:
 * Ordered stops for a route template.
 */
export const transportRouteStops = pgTable(
  "transport_route_stops",
  {
    /** Stable primary key. */
    id: idWithTag("route_stop"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent route template. */
    routeId: idRef("route_id")
      .references(() => transportRoutes.id)
      .notNull(),

    /** Stop order index (0,1,2...). */
    stopOrder: integer("stop_order").notNull(),

    /** Stop role. */
    kind: routeStopKindEnum("kind").notNull(),

    /** Stop label for UI and manifests. */
    name: varchar("name", { length: 180 }).notNull(),

    /** Optional linked location if stop maps to known location table row. */
    locationId: idRef("location_id").references(() => locations.id),

    /**
     * Optional geo reference object for non-catalog stops.
     * Suggested shape: { lat, lng, address, placeId }.
     */
    geoPoint: jsonb("geo_point").default({}),

    /** Planned offset from trip start in minutes. */
    offsetFromStartMin: integer("offset_from_start_min"),

    /** Planned dwell time at stop in minutes. */
    dwellMin: integer("dwell_min"),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    /** Composite key for tenant-safe references to this route-stop row. */
    transportRouteStopsBizIdIdUnique: uniqueIndex(
      "transport_route_stops_biz_id_id_unique",
    ).on(table.bizId, table.id),

    /** Unique stop order per route. */
    transportRouteStopsRouteOrderUnique: uniqueIndex(
      "transport_route_stops_route_order_unique",
    ).on(table.routeId, table.stopOrder),

    /** Common route-stop expansion path. */
    transportRouteStopsBizRouteIdx: index("transport_route_stops_biz_route_idx").on(
      table.bizId,
      table.routeId,
      table.stopOrder,
    ),

    /** Tenant-safe FK to route. */
    transportRouteStopsBizRouteFk: foreignKey({
      columns: [table.bizId, table.routeId],
      foreignColumns: [transportRoutes.bizId, transportRoutes.id],
      name: "transport_route_stops_biz_route_fk",
    }),

    /** Tenant-safe FK to location. */
    transportRouteStopsBizLocationFk: foreignKey({
      columns: [table.bizId, table.locationId],
      foreignColumns: [locations.bizId, locations.id],
      name: "transport_route_stops_biz_location_fk",
    }),

    /** Numeric values must be non-negative when present. */
    transportRouteStopsNumericBoundsCheck: check(
      "transport_route_stops_numeric_bounds_check",
      sql`
      "stop_order" >= 0
      AND ("offset_from_start_min" IS NULL OR "offset_from_start_min" >= 0)
      AND ("dwell_min" IS NULL OR "dwell_min" >= 0)
      `,
    ),
  }),
);

/**
 * transport_trips
 *
 * ELI5:
 * Concrete execution instance of a route at a specific time.
 */
export const transportTrips = pgTable(
  "transport_trips",
  {
    /** Stable primary key for one trip run. */
    id: idWithTag("transport_trip"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Route template used for this trip. */
    routeId: idRef("route_id")
      .references(() => transportRoutes.id)
      .notNull(),

    /** Optional offer version sold for this trip type. */
    offerVersionId: idRef("offer_version_id").references(() => offerVersions.id),

    /** Optional assigned vehicle. */
    fleetVehicleId: idRef("fleet_vehicle_id").references(() => fleetVehicles.id),

    /** Optional assigned driver resource. */
    driverResourceId: idRef("driver_resource_id").references(() => resources.id),

    /** Optional schedule binding that controls this trip's visibility windows. */
    calendarBindingId: idRef("calendar_binding_id").references(
      () => calendarBindings.id,
    ),

    /** Trip lifecycle state. */
    status: transportTripStatusEnum("status").default("planned").notNull(),

    /** Boarding opens at this time. */
    boardingOpensAt: timestamp("boarding_opens_at", { withTimezone: true }),

    /** Planned departure timestamp. */
    departureAt: timestamp("departure_at", { withTimezone: true }).notNull(),

    /** Planned arrival timestamp. */
    arrivalAt: timestamp("arrival_at", { withTimezone: true }).notNull(),

    /** Seats available for this trip instance. */
    capacitySeats: integer("capacity_seats").notNull(),

    /** Seats intentionally allowed above capacity (controlled overbooking). */
    overbookSeats: integer("overbook_seats").default(0).notNull(),

    /** Policy payload for trip-level overrides. */
    policy: jsonb("policy").default({}),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    transportTripsBizIdIdUnique: uniqueIndex("transport_trips_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Composite unique key for tenant-safe child FKs. */

    /** Operational timeline query path. */
    transportTripsBizStatusDepartureIdx: index(
      "transport_trips_biz_status_departure_idx",
    ).on(table.bizId, table.status, table.departureAt),

    /** Tenant-safe FK to route template. */
    transportTripsBizRouteFk: foreignKey({
      columns: [table.bizId, table.routeId],
      foreignColumns: [transportRoutes.bizId, transportRoutes.id],
      name: "transport_trips_biz_route_fk",
    }),

    /** Tenant-safe FK to offer version. */
    transportTripsBizOfferVersionFk: foreignKey({
      columns: [table.bizId, table.offerVersionId],
      foreignColumns: [offerVersions.bizId, offerVersions.id],
      name: "transport_trips_biz_offer_version_fk",
    }),

    /** Tenant-safe FK to fleet vehicle. */
    transportTripsBizFleetVehicleFk: foreignKey({
      columns: [table.bizId, table.fleetVehicleId],
      foreignColumns: [fleetVehicles.bizId, fleetVehicles.id],
      name: "transport_trips_biz_fleet_vehicle_fk",
    }),

    /** Tenant-safe FK to driver resource. */
    transportTripsBizDriverResourceFk: foreignKey({
      columns: [table.bizId, table.driverResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "transport_trips_biz_driver_resource_fk",
    }),

    /** Tenant-safe FK to calendar binding. */
    transportTripsBizCalendarBindingFk: foreignKey({
      columns: [table.bizId, table.calendarBindingId],
      foreignColumns: [calendarBindings.bizId, calendarBindings.id],
      name: "transport_trips_biz_calendar_binding_fk",
    }),

    /** Basic timeline and capacity sanity checks. */
    transportTripsTimelineCheck: check(
      "transport_trips_timeline_check",
      sql`
      "arrival_at" > "departure_at"
      AND ("boarding_opens_at" IS NULL OR "boarding_opens_at" <= "departure_at")
      `,
    ),

    /** Capacity values must be sane. */
    transportTripsCapacityCheck: check(
      "transport_trips_capacity_check",
      sql`"capacity_seats" > 0 AND "overbook_seats" >= 0`,
    ),
  }),
);

/**
 * trip_stop_inventory
 *
 * ELI5:
 * Per-stop inventory snapshots for one trip.
 * This supports segment-aware seat management and manifest controls.
 */
export const tripStopInventory = pgTable(
  "trip_stop_inventory",
  {
    /** Stable primary key. */
    id: idWithTag("trip_stop_inventory"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Parent trip. */
    tripId: idRef("trip_id")
      .references(() => transportTrips.id)
      .notNull(),

    /** Route stop this inventory snapshot corresponds to. */
    routeStopId: idRef("route_stop_id")
      .references(() => transportRouteStops.id)
      .notNull(),

    /** Total capacity available at this stop state. */
    totalCapacity: integer("total_capacity").notNull(),

    /** Seats currently reserved. */
    reservedCapacity: integer("reserved_capacity").default(0).notNull(),

    /** Seats currently waitlisted. */
    waitlistedCount: integer("waitlisted_count").default(0).notNull(),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    tripStopInventoryBizIdIdUnique: uniqueIndex("trip_stop_inventory_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** One inventory row per trip+stop. */
    tripStopInventoryTripStopUnique: uniqueIndex("trip_stop_inventory_trip_stop_unique").on(
      table.tripId,
      table.routeStopId,
    ),

    /** Common planning query path. */
    tripStopInventoryBizTripIdx: index("trip_stop_inventory_biz_trip_idx").on(
      table.bizId,
      table.tripId,
    ),

    /** Tenant-safe FK to trip. */
    tripStopInventoryBizTripFk: foreignKey({
      columns: [table.bizId, table.tripId],
      foreignColumns: [transportTrips.bizId, transportTrips.id],
      name: "trip_stop_inventory_biz_trip_fk",
    }),

    /** Tenant-safe FK to route stop. */
    tripStopInventoryBizRouteStopFk: foreignKey({
      columns: [table.bizId, table.routeStopId],
      foreignColumns: [transportRouteStops.bizId, transportRouteStops.id],
      name: "trip_stop_inventory_biz_route_stop_fk",
    }),

    /** Inventory counts must be non-negative and coherent. */
    tripStopInventoryBoundsCheck: check(
      "trip_stop_inventory_bounds_check",
      sql`
      "total_capacity" >= 0
      AND "reserved_capacity" >= 0
      AND "waitlisted_count" >= 0
      AND "reserved_capacity" <= ("total_capacity" + 100000)
      `,
    ),
  }),
);

/**
 * trip_manifests
 *
 * ELI5:
 * One manifest row = one passenger/party on one trip.
 */
export const tripManifests = pgTable(
  "trip_manifests",
  {
    /** Stable primary key. */
    id: idWithTag("trip_manifest"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Trip this passenger/party is attached to. */
    tripId: idRef("trip_id")
      .references(() => transportTrips.id)
      .notNull(),

    /** Optional linked booking order. */
    bookingOrderId: idRef("booking_order_id").references(() => bookingOrders.id),

    /** Optional linked fulfillment unit. */
    fulfillmentUnitId: idRef("fulfillment_unit_id").references(
      () => fulfillmentUnits.id,
    ),

    /** Optional source queue entry if trip assignment came from queue. */
    queueEntryId: idRef("queue_entry_id").references(() => queueEntries.id),

    /** Optional passenger user. */
    passengerUserId: idRef("passenger_user_id").references(() => users.id),

    /** Optional passenger group account. */
    passengerGroupAccountId: idRef("passenger_group_account_id").references(
      () => groupAccounts.id,
    ),

    /** Manifest status. */
    status: tripManifestStatusEnum("status").default("booked").notNull(),

    /** Number of seats consumed by this row. */
    seatCount: integer("seat_count").default(1).notNull(),

    /** Optional seat label info. */
    seatLabel: varchar("seat_label", { length: 80 }),

    /** Optional check-in timestamp. */
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),

    /** Optional boarding timestamp. */
    boardedAt: timestamp("boarded_at", { withTimezone: true }),

    /** Optional completion timestamp. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Manifest metadata extension bucket. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    tripManifestsBizIdIdUnique: uniqueIndex("trip_manifests_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common manifest view path by trip and status. */
    tripManifestsBizTripStatusIdx: index("trip_manifests_biz_trip_status_idx").on(
      table.bizId,
      table.tripId,
      table.status,
    ),

    /** Tenant-safe FK to trip. */
    tripManifestsBizTripFk: foreignKey({
      columns: [table.bizId, table.tripId],
      foreignColumns: [transportTrips.bizId, transportTrips.id],
      name: "trip_manifests_biz_trip_fk",
    }),

    /** Tenant-safe FK to booking order. */
    tripManifestsBizBookingOrderFk: foreignKey({
      columns: [table.bizId, table.bookingOrderId],
      foreignColumns: [bookingOrders.bizId, bookingOrders.id],
      name: "trip_manifests_biz_booking_order_fk",
    }),

    /** Tenant-safe FK to fulfillment unit. */
    tripManifestsBizFulfillmentUnitFk: foreignKey({
      columns: [table.bizId, table.fulfillmentUnitId],
      foreignColumns: [fulfillmentUnits.bizId, fulfillmentUnits.id],
      name: "trip_manifests_biz_fulfillment_unit_fk",
    }),

    /** Tenant-safe FK to queue entry. */
    tripManifestsBizQueueEntryFk: foreignKey({
      columns: [table.bizId, table.queueEntryId],
      foreignColumns: [queueEntries.bizId, queueEntries.id],
      name: "trip_manifests_biz_queue_entry_fk",
    }),

    /** Seat count must be positive. */
    tripManifestsSeatCountCheck: check(
      "trip_manifests_seat_count_check",
      sql`"seat_count" > 0`,
    ),

    /** Must have at least one passenger pointer. */
    tripManifestsPassengerPointerCheck: check(
      "trip_manifests_passenger_pointer_check",
      sql`"passenger_user_id" IS NOT NULL OR "passenger_group_account_id" IS NOT NULL`,
    ),
  }),
);

/**
 * dispatch_tasks
 *
 * ELI5:
 * Work packets for dispatch operations tied to trips/resources.
 */
export const dispatchTasks = pgTable(
  "dispatch_tasks",
  {
    /** Stable primary key. */
    id: idWithTag("dispatch_task"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Optional trip this task belongs to. */
    tripId: idRef("trip_id").references(() => transportTrips.id),

    /** Optional resource assignee (driver/dispatcher). */
    assignedResourceId: idRef("assigned_resource_id").references(() => resources.id),

    /** Task title for board/list UIs. */
    title: varchar("title", { length: 220 }).notNull(),

    /** Optional detailed task instruction. */
    instructions: varchar("instructions", { length: 2000 }),

    /** Dispatch task status lifecycle. */
    status: dispatchTaskStatusEnum("status").default("queued").notNull(),

    /** Optional due time. */
    dueAt: timestamp("due_at", { withTimezone: true }),

    /** Optional task start. */
    startedAt: timestamp("started_at", { withTimezone: true }),

    /** Optional task completion. */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Optional linked actor who created task. */
    createdByUserId: idRef("created_by_user_id").references(() => users.id),

    /** Extension payload. */
    metadata: jsonb("metadata").default({}),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    dispatchTasksBizIdIdUnique: uniqueIndex("dispatch_tasks_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Common dispatch queue path. */
    dispatchTasksBizStatusDueIdx: index("dispatch_tasks_biz_status_due_idx").on(
      table.bizId,
      table.status,
      table.dueAt,
    ),

    /** Tenant-safe FK to trip. */
    dispatchTasksBizTripFk: foreignKey({
      columns: [table.bizId, table.tripId],
      foreignColumns: [transportTrips.bizId, transportTrips.id],
      name: "dispatch_tasks_biz_trip_fk",
    }),

    /** Tenant-safe FK to assigned resource. */
    dispatchTasksBizAssignedResourceFk: foreignKey({
      columns: [table.bizId, table.assignedResourceId],
      foreignColumns: [resources.bizId, resources.id],
      name: "dispatch_tasks_biz_assigned_resource_fk",
    }),

    /** Timeline ordering sanity checks. */
    dispatchTasksTimelineCheck: check(
      "dispatch_tasks_timeline_check",
      sql`
      ("started_at" IS NULL OR "completed_at" IS NULL OR "completed_at" >= "started_at")
      `,
    ),
  }),
);

/**
 * eta_events
 *
 * ELI5:
 * Append-only ETA timeline for trip and stop progress.
 */
export const etaEvents = pgTable(
  "eta_events",
  {
    /** Stable primary key. */
    id: idWithTag("eta_event"),

    /** Tenant boundary. */
    bizId: idRef("biz_id")
      .references(() => bizes.id)
      .notNull(),

    /** Trip context for this event. */
    tripId: idRef("trip_id")
      .references(() => transportTrips.id)
      .notNull(),

    /** Optional route stop context. */
    routeStopId: idRef("route_stop_id").references(() => transportRouteStops.id),

    /** ETA event type. */
    eventType: etaEventTypeEnum("event_type").notNull(),

    /** Event emitted time. */
    eventAt: timestamp("event_at", { withTimezone: true }).defaultNow().notNull(),

    /** Predicted/updated ETA timestamp (if applicable). */
    etaAt: timestamp("eta_at", { withTimezone: true }),

    /** Actual arrival/departure timestamp (if applicable). */
    actualAt: timestamp("actual_at", { withTimezone: true }),

    /** Structured telemetry payload. */
    payload: jsonb("payload").default({}).notNull(),

    /** Full audit metadata. */
    ...withAuditRefs(() => users.id),
  },
  (table) => ({
    etaEventsBizIdIdUnique: uniqueIndex("eta_events_biz_id_id_unique").on(
      table.bizId,
      table.id,
    ),
    /** Timeline query path for one trip. */
    etaEventsBizTripEventAtIdx: index("eta_events_biz_trip_event_at_idx").on(
      table.bizId,
      table.tripId,
      table.eventAt,
    ),

    /** Tenant-safe FK to trip. */
    etaEventsBizTripFk: foreignKey({
      columns: [table.bizId, table.tripId],
      foreignColumns: [transportTrips.bizId, transportTrips.id],
      name: "eta_events_biz_trip_fk",
    }),

    /** Tenant-safe FK to stop. */
    etaEventsBizRouteStopFk: foreignKey({
      columns: [table.bizId, table.routeStopId],
      foreignColumns: [transportRouteStops.bizId, transportRouteStops.id],
      name: "eta_events_biz_route_stop_fk",
    }),
  }),
);
