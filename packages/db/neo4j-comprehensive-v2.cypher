// COMPREHENSIVE BIZING SCHEMA GRAPH
// 479 tables across 17 domains
// Generated: 2026-02-25

MATCH (n) DETACH DELETE n;

// ============================================
// DOMAINS (17 color-coded groups)
// ============================================
CREATE (Identity:Domain {name:"Identity & Access", color:"#FF6B6B", order:1})
CREATE (Catalog:Domain {name:"Catalog & Commerce", color:"#4ECDC4", order:2})
CREATE (Supply:Domain {name:"Supply & Resources", color:"#45B7D1", order:3})
CREATE (Bookings:Domain {name:"Bookings & Fulfillment", color:"#96CEB4", order:4})
CREATE (Payments:Domain {name:"Payments & Money", color:"#FFEAA7", order:5})
CREATE (Queue:Domain {name:"Queue & Waitlist", color:"#DDA0DD", order:6})
CREATE (Social:Domain {name:"Social & Notifications", color:"#98D8C8", order:7})
CREATE (Marketplace:Domain {name:"Marketplace & Multi-Biz", color:"#F7DC6F", order:8})
CREATE (Enterprise:Domain {name:"Enterprise & B2B", color:"#BB8FCE", order:9})
CREATE (Governance:Domain {name:"Governance & Compliance", color:"#85C1E2", order:10})
CREATE (Education:Domain {name:"Education & Learning", color:"#F8C471", order:11})
CREATE (Intelligence:Domain {name:"Intelligence & Analytics", color:"#82E0AA", order:12})
CREATE (AccessControl:Domain {name:"Access Control", color:"#F1948A", order:13})
CREATE (Operations:Domain {name:"Operations & Workflow", color:"#85C1E9", order:14})
CREATE (Marketing:Domain {name:"Marketing & CRM", color:"#D7BDE2", order:15})
CREATE (Gifts:Domain {name:"Gifts & Promotions", color:"#A9DFBF", order:16})
CREATE (Core:Domain {name:"Core Infrastructure", color:"#D5DBDB", order:17});

// ============================================
// CORE TABLES (The Essentials)
// ============================================

CREATE (bizes:Entity {name:"bizes", label:"Biz", type:"Root", description:"Tenant root - all data scoped by biz_id", fields:["id","name","slug","type","timezone","currency","status"]})
CREATE (users:Entity {name:"users", label:"User", type:"Identity", description:"Identity root - Better Auth integration", fields:["id","email","name","phone"]})
CREATE (memberships:Entity {name:"memberships", label:"Membership", type:"Access", description:"Biz-specific role assignment", fields:["id","user_id","biz_id","role"]})
CREATE (locations:Entity {name:"locations", label:"Location", type:"Operations", description:"Physical/virtual place with timezone", fields:["id","biz_id","name","type","timezone"]})

// Link to Identity domain
CREATE (Identity)-[:CONTAINS]->(bizes)
CREATE (Identity)-[:CONTAINS]->(users)
CREATE (Identity)-[:CONTAINS]->(memberships)
CREATE (Supply)-[:CONTAINS]->(locations)

// Key relationships
CREATE (biz)-[:HAS_MEMBERS]->(memberships)
CREATE (users)-[:HAS_MEMBERSHIP]->(memberships)
CREATE (biz)-[:OPERATES_AT]->(locations);

// ============================================
// CATALOG TABLES
// ============================================

CREATE (offers:Entity {name:"offers", label:"Offer", type:"Catalog", description:"Product shell - what you sell", fields:["id","biz_id","name","slug","execution_mode","status"]})
CREATE (offerVersions:Entity {name:"offerVersions", label:"Offer Version", type:"Catalog", description:"IMMUTABLE snapshot at purchase time", fields:["id","offer_id","version","status","pricing_model"], immutable:true})
CREATE (products:Entity {name:"products", label:"Product", type:"Catalog", description:"Physical goods catalog", fields:["id","biz_id","name","sku"]})
CREATE (services:Entity {name:"services", label:"Service", type:"Catalog", description:"Service templates", fields:["id","biz_id","name","duration_min"]})

CREATE (Catalog)-[:CONTAINS]->(offers)
CREATE (Catalog)-[:CONTAINS]->(offerVersions)
CREATE (Catalog)-[:CONTAINS]->(products)
CREATE (Catalog)-[:CONTAINS]->(services)

CREATE (offers)-[:HAS_VERSION]->(offerVersions)
CREATE (biz)-[:PUBLISHES]->(offers);

// ============================================
// SUPPLY TABLES
// ============================================

CREATE (resources:Entity {name:"resources", label:"Resource", type:"Supply", description:"Polymorphic supply: host, asset, venue", fields:["id","biz_id","type","name","calendar_id"], polymorphic:true})
CREATE (calendars:Entity {name:"calendars", label:"Calendar", type:"Time", description:"Resource availability container", fields:["id","resource_id","timezone"]})
CREATE (availabilityRules:Entity {name:"availabilityRules", label:"Availability Rules", type:"Time", description:"When resources are available", fields:["id","calendar_id","rule_mode","frequency"]})
CREATE (availabilityBlocks:Entity {name:"availabilityBlocks", label:"Availability Blocks", type:"Time", description:"Booked or busy time segments", fields:["id","resource_id","start_at","end_at"]})

CREATE (Supply)-[:CONTAINS]->(resources)
CREATE (Supply)-[:CONTAINS]->(calendars)
CREATE (Supply)-[:CONTAINS]->(availabilityRules)
CREATE (Supply)-[:CONTAINS]->(availabilityBlocks)

CREATE (resources)-[:HAS_CALENDAR]->(calendars)
CREATE (calendars)-[:HAS_RULES]->(availabilityRules)
CREATE (resources)-[:HAS_BLOCKS]->(availabilityBlocks);

// ============================================
// BOOKING TABLES
// ============================================

CREATE (bookingOrders:Entity {name:"bookingOrders", label:"Booking Order", type:"Booking", description:"Customer commitment - immutable snapshots", fields:["id","biz_id","customer_id","offer_version_id","status","total"], immutable_snapshots:true})
CREATE (bookingOrderLines:Entity {name:"bookingOrderLines", label:"Booking Order Lines", type:"Booking", description:"Line items within order", fields:["id","booking_order_id","line_type","amount"]})
CREATE (fulfillmentUnits:Entity {name:"fulfillmentUnits", label:"Fulfillment Unit", type:"Delivery", description:"Atomic delivery assignment", fields:["id","booking_line_id","resource_id","scheduled_start","status"]})
CREATE (standingReservations:Entity {name:"standingReservations", label:"Standing Reservation", type:"Booking", description:"Recurring booking contract", fields:["id","customer_id","offer_version_id","recurrence_rule"]})

CREATE (Bookings)-[:CONTAINS]->(bookingOrders)
CREATE (Bookings)-[:CONTAINS]->(bookingOrderLines)
CREATE (Bookings)-[:CONTAINS]->(fulfillmentUnits)
CREATE (Bookings)-[:CONTAINS]->(standingReservations)

CREATE (users)-[:PLACES]->(bookingOrders)
CREATE (bookingOrders)-[:USES_VERSION]->(offerVersions)
CREATE (bookingOrders)-[:HAS_LINES]->(bookingOrderLines)
CREATE (bookingOrderLines)-[:SCHEDULED_AS]->(fulfillmentUnits)
CREATE (resources)-[:FULFILLS]->(fulfillmentUnits);

// ============================================
// PAYMENT TABLES
// ============================================

CREATE (paymentMethods:Entity {name:"paymentMethods", label:"Payment Method", type:"Payment", description:"Customer saved cards/accounts", fields:["id","customer_id","type","last4"]})
CREATE (paymentIntents:Entity {name:"paymentIntents", label:"Payment Intent", type:"Payment", description:"Checkout session + authorization", fields:["id","booking_order_id","amount","status"]})
CREATE (paymentTransactions:Entity {name:"paymentTransactions", label:"Transaction", type:"Payment", description:"Final immutable record", fields:["id","payment_intent_id","amount","status"], immutable:true})
CREATE (paymentRefunds:Entity {name:"paymentRefunds", label:"Refund", type:"Payment", description:"Reversal of transaction", fields:["id","transaction_id","amount","reason"]})

CREATE (Payments)-[:CONTAINS]->(paymentMethods)
CREATE (Payments)-[:CONTAINS]->(paymentIntents)
CREATE (Payments)-[:CONTAINS]->(paymentTransactions)
CREATE (Payments)-[:CONTAINS]->(paymentRefunds)

CREATE (users)-[:HAS_METHODS]->(paymentMethods)
CREATE (bookingOrders)-[:REQUIRES_PAYMENT]->(paymentIntents)
CREATE (paymentIntents)-[:RESULTS_IN]->(paymentTransactions)
CREATE (paymentTransactions)-[:REFUNDED_BY]->(paymentRefunds);

// ============================================
// QUEUE TABLES
// ============================================

CREATE (queues:Entity {name:"queues", label:"Queue", type:"Queue", description:"Virtual waiting line", fields:["id","biz_id","name","service_order","max_size"]})
CREATE (queueEntries:Entity {name:"queueEntries", label:"Queue Entry", type:"Queue", description:"Position in line", fields:["id","queue_id","customer_id","position","status"]})

CREATE (Queue)-[:CONTAINS]->(queues)
CREATE (Queue)-[:CONTAINS]->(queueEntries)

CREATE (offers)-[:HAS_QUEUE]->(queues)
CREATE (queues)-[:CONTAINS_ENTRY]->(queueEntries)
CREATE (users)-[:JOINS]->(queueEntries);

// ============================================
// SOCIAL TABLES
// ============================================

CREATE (graphIdentities:Entity {name:"graphIdentities", label:"Graph Identity", type:"Social", description:"Unified identity across biz boundaries", fields:["id","identity_type","external_id"]})
CREATE (subjectSubscriptions:Entity {name:"subjectSubscriptions", label:"Subject Subscription", type:"Social", description:"Watch/notify registration", fields:["id","subscriber_id","target_type","target_id","delivery_mode"]})

CREATE (Social)-[:CONTAINS]->(graphIdentities)
CREATE (Social)-[:CONTAINS]->(subjectSubscriptions)

CREATE (users)-[:HAS_IDENTITY]->(graphIdentities)
CREATE (graphIdentities)-[:SUBSCRIBES]->(subjectSubscriptions);

// ============================================
// VISUAL FLOW NODES
// ============================================

CREATE (customer:FlowNode {label:"Customer", icon:"👤", layer:"top"})
CREATE (discovery:FlowNode {label:"Discovery", icon:"🔍", layer:"top"})
CREATE (booking:FlowNode {label:"Booking", icon:"📅", layer:"middle"})
CREATE (fulfillment:FlowNode {label:"Fulfillment", icon:"✅", layer:"middle"})
CREATE (payment:FlowNode {label:"Payment", icon:"💳", layer:"bottom"})

CREATE (customer)-[:FLOWS_TO]->(discovery)
CREATE (discovery)-[:FLOWS_TO]->(booking)
CREATE (booking)-[:FLOWS_TO]->(fulfillment)
CREATE (fulfillment)-[:FLOWS_TO]->(payment);

// ============================================
// STATS
// ============================================

RETURN "✅ Comprehensive Bizing Graph Created!" as status,
       count{(d:Domain)} as domains,
       count{(e:Entity)} as entities,
       count{(f:FlowNode)} as flow_nodes,
       count{(d)-[]-()} as domain_links,
       count{(e)-[]-()} as relationships;
