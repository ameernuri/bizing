# Neo4j Schema Graph Guide

## 🌐 Access the Graph

**Browser URL:** http://localhost:7474  
**Username:** neo4j  
**Password:** bizing1234

---

## 📊 What's in the Graph

### Nodes (46 total)

| Type | Count | Description |
|------|-------|-------------|
| **Domain** | 10 | Visual grouping (Identity, Catalog, Booking, etc.) |
| **Entity** | 36 | Database tables/models |
| **FlowNode** | 5 | Customer journey flow |

### Relationships (51 total)

Foreign key relationships, containment, and business flows.

---

## 🎯 Useful Cypher Queries

### 1. View All Domains (Color-Coded)
```cypher
MATCH (d:Domain)
RETURN d.name, d.icon, d.color
ORDER BY d.order
```

### 2. Show Booking Flow (Customer Journey)
```cypher
MATCH path = (customer:FlowNode {label: "Customer"})-[:FLOWS_TO*]-(payment:FlowNode {label: "Payment"})
RETURN path
```

### 3. Find Entity by Name
```cypher
MATCH (e:Entity)
WHERE e.name CONTAINS "booking"
RETURN e.name, e.label, e.description
```

### 4. Show All Relationships for One Entity
```cypher
MATCH (e:Entity {name: "booking_orders"})-[r]-(other)
RETURN e.name, type(r), other.name, r.description
```

### 5. Visual Domain Breakdown
```cypher
MATCH (d:Domain)-[:INCLUDES]-(e:Entity)
RETURN d.name, d.icon, collect(e.label) as entities
ORDER BY d.order
```

### 6. Critical Path: Offer to Payment
```cypher
MATCH path = (offer:Entity {name: "offers"})-[:HAS_VERSION]-()-[:USES_RESOURCES]-()-[:FULFILLS]-()-[:REQUIRES_PAYMENT]-()
RETURN path
LIMIT 1
```

### 7. Find Immutable Entities
```cypher
MATCH (e:Entity)
WHERE e.immutabilityNote IS NOT NULL
RETURN e.label, e.immutabilityNote
```

### 8. Show Tenant Isolation Pattern
```cypher
MATCH (biz:Entity {name: "bizes"})-[:CONTAINS|OWNS|PUBLISHES|MANAGES|RECEIVES_PAYMENTS]-(other)
RETURN biz.label, collect(DISTINCT other.label) as connected_entities
```

### 9. Queue System Overview
```cypher
MATCH (queue:Entity {name: "queues"})-[:CONTAINS]-(entry:Entity)
RETURN queue.label, queue.keyFields, entry.label, entry.keyFields
```

### 10. Full Graph Visualization
```cypher
MATCH (d:Domain)-[:INCLUDES]-(e:Entity)-[r]-(other)
RETURN d, e, r, other
LIMIT 100
```

---

## 🎨 Visual Styling (Neo4j Browser)

Add this to your Neo4j Browser favorites for automatic styling:

```cypher
// Style: Domain nodes
MATCH (d:Domain)
SET d.style = "background-color: " + d.color + "; border: 2px solid #333;"

// Style: Root entity (Biz)
MATCH (e:Entity {name: "bizes"})
SET e.style = "background-color: #FF6B6B; border: 4px solid #000; font-size: 18px;"

// Style: Immutable entities
MATCH (e:Entity)
WHERE e.immutabilityNote IS NOT NULL
SET e.style = "border: 3px dashed #E74C3C;"
```

---

## 🔍 Key Patterns to Explore

### Pattern 1: Shell + Version
```cypher
MATCH (shell:Entity)-[:HAS_VERSION]-(version:Entity)
WHERE shell.name = "offers"
RETURN shell.label, version.label, version.immutabilityNote
```

### Pattern 2: Polymorphic Resources
```cypher
MATCH (r:Entity {name: "resources"})
RETURN r.label, r.polymorphismNote, r.keyFields
```

### Pattern 3: Availability Precedence
```cypher
MATCH (calendar:Entity)-[:HAS_RULES]-(rules:Entity)
WHERE calendar.name = "calendars"
RETURN rules.label, rules.precedenceNote
```

### Pattern 4: Subject Subscriptions (Polymorphic)
```cypher
MATCH (sub:Entity {name: "graph_subject_subscriptions"})-[w]-(target)
WHERE type(w) STARTS WITH "WATCHES"
RETURN sub.label, type(w), target.label
```

---

## 🚀 Advanced Queries

### Find Circular Dependencies
```cypher
MATCH path = (e:Entity)-[:*3..5]-(e)
RETURN [n in nodes(path) | n.name] as cycle
LIMIT 5
```

### Find Orphan Entities (No Relationships)
```cypher
MATCH (e:Entity)
WHERE NOT (e)-[]-()
RETURN e.name, e.label
```

### Domain Connectivity Matrix
```cypher
MATCH (d1:Domain)-[:INCLUDES]-(e1:Entity)-[]-(e2:Entity)-[:INCLUDES]-(d2:Domain)
WHERE d1 <> d2
RETURN d1.name, d2.name, count(*) as connections
ORDER BY connections DESC
```

### Critical Path Analysis
```cypher
MATCH path = shortestPath(
  (start:Entity {name: "users"})-[:*]-(end:Entity {name: "payment_transactions"})
)
RETURN [n in nodes(path) | n.label] as critical_path,
       length(path) as hops
```

---

## 📝 Graph Schema Legend

| Symbol | Meaning |
|--------|---------|
| 🔐 | Identity & Access |
| 🏪 | Catalog & Commerce |
| ⚙️ | Supply & Resources |
| 📅 | Bookings & Fulfillment |
| 💰 | Payments |
| ⏳ | Queue |
| 🔔 | Social & Notifications |
| 🌐 | Marketplace |
| 🏢 | Enterprise |
| ⚖️ | Governance |

**Line Styles:**
- Solid: Standard relationship
- Dashed: Immutable entity border
- Bold: Root entity (Biz)

---

## 🔄 Keeping the Graph Updated

When schema changes:

1. **Add new entity:**
```cypher
MATCH (d:Domain {name: "Your Domain"})
CREATE (new:Entity {name: "new_table", label: "New Table", ...})
CREATE (d)-[:INCLUDES]->(new)
```

2. **Add relationship:**
```cypher
MATCH (e1:Entity {name: "entity1"}), (e2:Entity {name: "entity2"})
CREATE (e1)-[:NEW_REL {type: "1:N"}]->(e2)
```

3. **Regenerate full graph:**
```bash
# Re-run the cypher script
docker exec -i neo4j-bizing cypher-shell -u neo4j -p bizing1234 < neo4j-schema-graph.cypher
```

---

## 💡 Tips for Neo4j Browser

1. **Use Bloom for exploration:** Install Neo4j Bloom for interactive graph exploration

2. **Save favorites:** Save your most-used queries in the browser sidebar

3. **Use parameters:**
```cypher
:param entityName => "booking_orders"
MATCH (e:Entity {name: $entityName})-[r]-(other)
RETURN e, r, other
```

4. **Export visualizations:** Click the download button to save graph images

5. **Style with GraSS:** Use Graph Style Sheet for consistent visualization

---

## 🔗 Integration with Application

### Query Schema Metadata from App
```javascript
// Example: Get entity relationships
const query = `
  MATCH (e:Entity {name: $tableName})-[r]-(other)
  RETURN e.description, type(r), other.name, other.description
`;

const result = await session.run(query, { tableName: "booking_orders" });
```

### Generate ER Diagram from Graph
```cypher
// Export to Graphviz DOT format
MATCH (e:Entity)-[r]-(other:Entity)
RETURN "\"" + e.name + "\" -> \"" + other.name + "\" [label=\"" + type(r) + "\"];" as dot_line
```

---

**Happy Graph Exploring!** 🌀
