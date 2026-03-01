# Neo4j "Explode" Queries - See Everything at Once

## 🎯 THE KEY INSIGHT

`MATCH (a) RETURN a` only shows **nodes**.  
To "explode" and see connections, you need to return **paths/relationships**.

---

## 🔥 QUERIES TO EXPLODE THE VIEW

### 1. **Domain + Tables** (Clean Overview)
```cypher
MATCH (d:Domain)
OPTIONAL MATCH (d)-[:CONTAINS]->(e:Entity)
RETURN d, e
```
**Result:** See all 17 domains with their 479 tables

---

### 2. **Tables + Relationships** (The "Exploded" View)
```cypher
MATCH (e:Entity)-[r:REFERENCES]->(ref:Entity)
RETURN e, r, ref
LIMIT 200
```
**Result:** See tables connected by foreign keys

---

### 3. **Complete Architecture** (Domain → Table → Field)
```cypher
MATCH (d:Domain)-[:CONTAINS]->(e:Entity)
OPTIONAL MATCH (e)-[:HAS_FIELD]->(f:Field)
RETURN d, e, f
LIMIT 300
```
**Result:** Everything in one view (may be busy!)

---

### 4. **Just Core Tables** (Most Useful)
```cypher
MATCH (e:Entity)
WHERE e.name IN [
  'bizes', 'users', 'offers', 'offerVersions',
  'bookingOrders', 'paymentTransactions', 
  'resources', 'queues'
]
OPTIONAL MATCH (e)-[:REFERENCES]->(ref)
RETURN e, ref
```
**Result:** The 8 most important tables and their connections

---

### 5. **One Domain Fully Exploded**
```cypher
MATCH (d:Domain {name: 'Bookings'})-[:CONTAINS]->(e:Entity)
OPTIONAL MATCH (e)-[:HAS_FIELD]->(f:Field)
OPTIONAL MATCH (e)-[:REFERENCES]->(ref:Entity)
RETURN d, e, f, ref
```
**Result:** Everything in the Bookings domain

---

### 6. **Relationship Web** (Visual Spider Web)
```cypher
MATCH path = (a:Entity)-[:REFERENCES*1..2]-(b:Entity)
WHERE a.name IN ['bookingOrders', 'users', 'offers']
RETURN path
```
**Result:** See how core tables connect to others

---

### 7. **The "Full Explosion"** ⚠️ (May be slow!)
```cypher
MATCH (d:Domain)
OPTIONAL MATCH (d)-[:CONTAINS]->(e:Entity)
OPTIONAL MATCH (e)-[:HAS_FIELD]->(f:Field)
OPTIONAL MATCH (e)-[:REFERENCES]->(ref:Entity)
RETURN d, e, f, ref
LIMIT 500
```
**Result:** Everything - domains, tables, fields, relationships

---

## 🎨 Neo4j Browser Tips

### Auto-Connect Results
1. Run any query above
2. Look for **"Connect result nodes"** button (two linked circles icon)
3. Click it to auto-expand relationships

### Double-Click to Expand
1. See a node you want to explore?
2. **Double-click** it
3. Neo4j will fetch and show its relationships

### Max Nodes Setting
```cypher
:param maxNeighbours => 100
```
Increase to show more connections at once

### Use Bloom for Big Graphs
For 479 tables, install **Neo4j Bloom**:
1. Left sidebar → "Bloom"
2. Search: "Show me the Bookings domain"
3. Visual exploration without writing Cypher

---

## 🚀 Quick Wins

### See Booking Flow
```cypher
MATCH path = (users:Entity {name: 'users'})-[:REFERENCES|REFERENCES*1..3]-(booking:Entity {name: 'bookingOrders'})-[:REFERENCES*1..3]-(payment:Entity {name: 'paymentTransactions'})
RETURN path
```

### See All Relationships to "bizes"
```cypher
MATCH (e:Entity)-[r:REFERENCES]->(bizes:Entity {name: 'bizes'})
RETURN e, r, bizes
LIMIT 50
```

### Domain Overview (No Overlap)
```cypher
MATCH (d:Domain)
OPTIONAL MATCH (d)-[:CONTAINS]->(e:Entity)
WITH d, collect(e)[0..10] as tables
RETURN d, tables
```

---

## 💡 Pro Tip

If the graph looks like a **hairball** (too many connections):

1. **Filter by domain:**
```cypher
MATCH (d:Domain {name: 'Payments'})-[:CONTAINS]->(e:Entity)
OPTIONAL MATCH (e)-[:REFERENCES]->(ref:Entity)
WHERE ref.domain = 'Payments'
RETURN e, ref
```

2. **Show only core tables:**
```cypher
MATCH (e:Entity)
WHERE e.name IN ['bizes', 'users', 'offers', 'bookingOrders', 'paymentTransactions']
OPTIONAL MATCH (e)-[:REFERENCES]->(ref)
RETURN e, ref
```

3. **Use LIMIT:**
Always add `LIMIT 100` or `LIMIT 200` to avoid overwhelming the browser

---

## 🎯 Recommended Starting Point

**Start with this query:**
```cypher
MATCH (d:Domain)
OPTIONAL MATCH (d)-[:CONTAINS]->(e:Entity)
RETURN d, e
```

Then **double-click** any domain to see its tables, or **double-click** any table to see its relationships!

---

**The key difference:**
- ❌ `RETURN a` = just nodes
- ✅ `RETURN a, r, b` = nodes + relationships (the "exploded" view)
