# 🎯 ULTIMATE NEO4J SCHEMA GUIDE
## Complete Bizing Database - Every Table, Every Field, Every Relationship

---

## 📊 THE NUMBERS

| Metric | Count |
|--------|-------|
| **Tables (Entities)** | 479 |
| **Fields** | 8,778 |
| **Relationships (Foreign Keys)** | 515 |
| **Domains** | 17 |
| **JSDoc Comments** | 9,000+ |

---

## 🌐 ACCESS

**URL:** http://localhost:7474  
**Username:** neo4j  
**Password:** bizing1234

---

## 🚀 QUICK START - ESSENTIAL QUERIES

### 1. See Everything (Overview)
```cypher
MATCH (d:Domain)
OPTIONAL MATCH (d)-[:CONTAINS]->(e:Entity)
OPTIONAL MATCH (e)-[:HAS_FIELD]->(f:Field)
RETURN d.name as Domain, 
       d.color as Color,
       count(DISTINCT e) as Tables,
       count(DISTINCT f) as Fields
ORDER BY Tables DESC
```

### 2. Explore a Table (Full Detail)
```cypher
// Replace 'bookingOrders' with any table name
MATCH (e:Entity {name: 'bookingOrders'})
OPTIONAL MATCH (e)-[:HAS_FIELD]->(f:Field)
RETURN e.name as Table,
       e.description as Description,
       e.file as File,
       collect({
         field: f.name, 
         type: f.type, 
         description: f.description,
         isForeignKey: f.isForeignKey,
         references: f.references
       }) as Fields
```

### 3. Find Tables by Keyword
```cypher
// Search in table names and descriptions
MATCH (e:Entity)
WHERE e.name CONTAINS 'payment' 
   OR e.description CONTAINS 'payment'
RETURN e.name, e.domain, left(e.description, 100)
LIMIT 20
```

### 4. Browse a Domain
```cypher
// View all tables in Payments domain
MATCH (d:Domain {name: 'Payments'})-[:CONTAINS]->(e:Entity)
OPTIONAL MATCH (e)-[:HAS_FIELD]->(f:Field)
RETURN e.name as Table, 
       left(e.description, 80) as Description,
       count(f) as FieldCount
ORDER BY e.name
```

### 5. Show Field Details for One Table
```cypher
MATCH (e:Entity {name: 'offerVersions'})-[:HAS_FIELD]->(f:Field)
RETURN f.name as Field,
       f.type as Type,
       f.isForeignKey as IsFK,
       f.references as References,
       left(f.description, 100) as Description
ORDER BY f.name
```

---

## 🔍 DEEP EXPLORATION QUERIES

### 6. Find Foreign Key Relationships
```cypher
// Show all relationships for a table
MATCH (e:Entity {name: 'bookingOrders'})-[r:REFERENCES]->(target)
RETURN e.name as FromTable,
       r.field as FieldName,
       target.name as ToTable,
       left(r.description, 50) as Relationship
```

### 7. Find Tables Referenced By Others
```cypher
// Find the most referenced tables (core entities)
MATCH (e:Entity)<-[:REFERENCES]-(ref)
WITH e, count(ref) as refCount
WHERE refCount > 5
RETURN e.name as CoreTable, 
       e.domain as Domain,
       refCount as ReferencedBy
ORDER BY refCount DESC
```

### 8. Explore Field Types
```cypher
// Find all timestamp fields
MATCH (f:Field)
WHERE f.type CONTAINS 'timestamp' OR f.name CONTAINS 'At'
RETURN f.name as Field, 
       count(f) as Occurrences,
       collect(DISTINCT f.type)[0..5] as Examples
ORDER BY Occurrences DESC
LIMIT 20
```

### 9. Find Enum Fields
```cypher
// Find all enum-type fields
MATCH (f:Field)
WHERE f.type CONTAINS 'Enum'
RETURN f.name as Field,
       f.type as EnumType,
       count(*) as Count
ORDER BY Count DESC
LIMIT 30
```

### 10. Show Table with Relationships Visual
```cypher
// Visual path from booking to payment
MATCH path = (booking:Entity {name: 'bookingOrders'})-[:REFERENCES*1..3]-(other)
WHERE other.name IN ['paymentTransactions', 'users', 'offerVersions']
RETURN path
LIMIT 10
```

---

## 📋 DOMAIN-SPECIFIC EXPLORATION

### Payments Domain
```cypher
MATCH (d:Domain {name: 'Payments'})-[:CONTAINS]->(e:Entity)
OPTIONAL MATCH (e)-[:HAS_FIELD]->(f:Field)
OPTIONAL MATCH (e)-[:REFERENCES]->(ref)
RETURN e.name as Table,
       count(DISTINCT f) as Fields,
       count(DISTINCT ref) as Relationships,
       left(e.description, 60) as Description
ORDER BY Fields DESC
```

### Booking Domain
```cypher
MATCH (d:Domain {name: 'Bookings'})-[:CONTAINS]->(e:Entity)
RETURN e.name, e.description
ORDER BY e.name
```

### Core Infrastructure
```cypher
MATCH (d:Domain {name: 'Core'})-[:CONTAINS]->(e:Entity)
RETURN e.name, left(e.description, 80)
LIMIT 20
```

---

## 🔗 RELATIONSHIP EXPLORATION

### Show Entity Relationship Map
```cypher
// Find tables connected to bizes
MATCH (biz:Entity {name: 'bizes'})
MATCH (biz)-[:REFERENCES|REFERENCES*1..2]-(connected)
RETURN biz.name, collect(DISTINCT connected.name)[0..15] as ConnectedTables
```

### Find Circular Dependencies
```cypher
MATCH path = (a:Entity)-[:REFERENCES*2..4]->(a)
RETURN [n in nodes(path) | n.name] as Cycle
LIMIT 5
```

### Show Dependency Chain
```cypher
// How deep is the dependency tree?
MATCH path = (root:Entity {name: 'bizes'})-[:REFERENCES*]->(leaf)
RETURN root.name, length(path) as Depth, leaf.name as Leaf
ORDER BY Depth DESC
LIMIT 10
```

---

## 🎨 VISUAL STYLING

### Color Code by Domain
```cypher
// In Neo4j Browser, this styles nodes by their domain color
MATCH (d:Domain)
WITH d, d.color as color
MATCH (d)-[:CONTAINS]->(e:Entity)
SET e.color = color
RETURN d.name, count(e)
```

### Highlight Root Tables
```cypher
// Mark tables with most relationships as "core"
MATCH (e:Entity)<-[:REFERENCES]-(ref)
WITH e, count(ref) as refs
WHERE refs > 10
SET e.isCore = true, e.coreLevel = refs
RETURN e.name, refs
ORDER BY refs DESC
```

---

## 📊 SCHEMA STATISTICS

### Field Type Distribution
```cypher
MATCH (f:Field)
WITH CASE 
  WHEN f.type CONTAINS 'varchar' THEN 'String'
  WHEN f.type CONTAINS 'integer' THEN 'Integer'
  WHEN f.type CONTAINS 'timestamp' THEN 'Timestamp'
  WHEN f.type CONTAINS 'boolean' THEN 'Boolean'
  WHEN f.type CONTAINS 'jsonb' THEN 'JSONB'
  WHEN f.type CONTAINS 'Enum' THEN 'Enum'
  ELSE 'Other'
END as Type,
f
RETURN Type, count(*) as Count
ORDER BY Count DESC
```

### Tables by File
```cypher
MATCH (e:Entity)
WITH e.file as File, count(e) as TableCount
RETURN File, TableCount
ORDER BY TableCount DESC
LIMIT 20
```

### Most Complex Tables (Most Fields)
```cypher
MATCH (e:Entity)
OPTIONAL MATCH (e)-[:HAS_FIELD]->(f:Field)
WITH e, count(f) as FieldCount
RETURN e.name, e.domain, FieldCount
ORDER BY FieldCount DESC
LIMIT 20
```

---

## 🔎 ADVANCED SEARCH

### Full-Text Search (Name + Description + Fields)
```cypher
// Search across everything
MATCH (e:Entity)
WHERE e.name CONTAINS 'booking' 
   OR e.description CONTAINS 'booking'
OPTIONAL MATCH (e)-[:HAS_FIELD]->(f:Field)
WHERE f.name CONTAINS 'booking' OR f.description CONTAINS 'booking'
RETURN DISTINCT e.name as Table,
       e.domain as Domain,
       left(e.description, 100) as Description
LIMIT 20
```

### Find Tables Without Descriptions
```cypher
MATCH (e:Entity)
WHERE e.description IS NULL OR e.description = '' OR e.description CONTAINS 'Table '
RETURN e.name, e.file
ORDER BY e.file
LIMIT 30
```

### Find All Foreign Keys to a Table
```cypher
// Who references bookingOrders?
MATCH (e:Entity)-[r:REFERENCES]->(target:Entity {name: 'bookingOrders'})
RETURN e.name as ReferencingTable,
       r.field as Field,
       e.domain as Domain
ORDER BY e.domain
```

---

## 🗺️ SCHEMA NAVIGATION PATTERNS

### Pattern 1: Tenant Isolation
```cypher
// All tables with biz_id (tenant isolation)
MATCH (e:Entity)-[:HAS_FIELD]->(f:Field)
WHERE f.name = 'bizId'
RETURN e.domain, count(e) as TableCount
ORDER BY TableCount DESC
```

### Pattern 2: Audit Trail Fields
```cypher
// Tables with audit fields
MATCH (e:Entity)-[:HAS_FIELD]->(f:Field)
WHERE f.name IN ['createdAt', 'updatedAt', 'deletedAt']
WITH e, count(f) as AuditFields
WHERE AuditFields >= 3
RETURN e.name, e.domain, AuditFields
ORDER BY AuditFields DESC
LIMIT 20
```

### Pattern 3: Immutable Snapshots
```cypher
// Find tables with snapshot fields
MATCH (e:Entity)-[:HAS_FIELD]->(f:Field)
WHERE f.name CONTAINS 'Snapshot' OR f.name CONTAINS 'snapshot'
RETURN e.name, f.name, left(f.description, 50)
```

---

## 💡 TIPS FOR EXPLORATION

1. **Start with Domains**: Use `MATCH (d:Domain)` to see the big picture
2. **Drill into Tables**: Pick a domain, then explore its entities
3. **Check Relationships**: Use `[:REFERENCES]` to understand connections
4. **Read JSDoc**: Every table and field has a `description` property
5. **Use Field Info**: Fields have `type`, `isForeignKey`, and `references`

---

## 🎯 EXAMPLE WORKFLOWS

### Understanding a Feature (Booking Flow)
```cypher
// Step 1: Find booking-related tables
MATCH (e:Entity)
WHERE e.name CONTAINS 'booking' OR e.description CONTAINS 'booking'
RETURN e.name, e.domain, left(e.description, 80)

// Step 2: Explore the main booking table
MATCH (e:Entity {name: 'bookingOrders'})-[:HAS_FIELD]->(f)
RETURN f.name, f.type, f.isForeignKey, f.references

// Step 3: See what references bookings
MATCH (e)-[:REFERENCES]->(booking:Entity {name: 'bookingOrders'})
RETURN e.name, e.domain
```

### Understanding Payments
```cypher
// Payment flow tables
MATCH (d:Domain {name: 'Payments'})-[:CONTAINS]->(e:Entity)
OPTIONAL MATCH (e)-[:REFERENCES]->(ref)
RETURN e.name, collect(DISTINCT ref.name)[0..5] as ReferencesTo
```

---

## 📈 SCHEMA GROWTH

### Compare Table Counts
```cypher
// Already calculated in domain stats above
```

---

**Your complete Bizing schema is now fully explorable!** 🎉

Every table, every field, every relationship, every JSDoc comment is in Neo4j and queryable.
