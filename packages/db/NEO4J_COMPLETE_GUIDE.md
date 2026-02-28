# Neo4j Comprehensive Schema Graph - COMPLETE ✅

## 📊 Final Stats

| Metric | Value |
|--------|-------|
| **Total Tables** | 479 |
| **Domains** | 17 |
| **Relationships** | 502 |
| **Import Time** | ~60 seconds |

## 🌐 Access

**Browser:** http://localhost:7474  
**Username:** neo4j  
**Password:** bizing1234

---

## 📋 Domain Breakdown

| Domain | Tables | Color | Icon |
|--------|--------|-------|------|
| Core | 97 | #D5DBDB | ⚙️ |
| Catalog | 55 | #4ECDC4 | 🏪 |
| Supply | 50 | #45B7D1 | ⚙️ |
| Identity | 40 | #FF6B6B | 👤 |
| Social | 31 | #98D8C8 | 🔔 |
| Bookings | 23 | #96CEB4 | 📅 |
| Intelligence | 23 | #82E0AA | 📊 |
| Enterprise | 23 | #BB8FCE | 🏢 |
| Governance | 21 | #85C1E2 | ⚖️ |
| Education | 19 | #F8C471 | 🎓 |
| Payments | 18 | #FFEAA7 | 💰 |
| Marketing | 17 | #D7BDE2 | 📢 |
| Operations | 17 | #85C1E9 | 🚚 |
| Access | 15 | #F1948A | 🔑 |
| Marketplace | 12 | #F7DC6F | 🌐 |
| Queue | 10 | #DDA0DD | ⏳ |
| Gifts | 8 | #A9DFBF | 🎁 |

---

## 🔥 Recommended Queries

### 1. See All Domains with Table Counts
```cypher
MATCH (d:Domain)
OPTIONAL MATCH (d)-[:CONTAINS]->(e:Entity)
RETURN d.name as Domain, d.color as Color, count(e) as Tables
ORDER BY Tables DESC
```

### 2. Browse a Specific Domain
```cypher
MATCH (d:Domain {name: "Payments"})-[:CONTAINS]->(e:Entity)
RETURN e.name as Table, e.description as Description, e.fieldCount as Fields
ORDER BY e.name
```

### 3. Find Table by Name (Fuzzy Search)
```cypher
MATCH (e:Entity)
WHERE e.name CONTAINS "booking"
RETURN e.name, e.domain, e.description, e.fields
```

### 4. Show Entity Relationships
```cypher
MATCH (e:Entity {name: "bookingOrders"})-[r]-(other)
RETURN e.name, type(r), other.name, other.domain
```

### 5. Visual Domain Map
```cypher
MATCH (d:Domain)
WHERE d.tableCount > 20
OPTIONAL MATCH (d)-[:CONTAINS]->(e:Entity)
RETURN d, collect(e)[0..5] as sample_entities
```

### 6. Find Tables in Multiple Files
```cypher
MATCH (e:Entity)
WITH e.file as file, count(e) as count
WHERE count > 5
RETURN file, count
ORDER BY count DESC
```

### 7. Show Full Architecture (Core Only)
```cypher
MATCH (d:Domain)-[:CONTAINS]->(e:Entity)
WHERE e.name IN ["bizes", "users", "offers", "offerVersions", "bookingOrders", "paymentTransactions", "resources", "queues"]
RETURN d, e
```

### 8. Tables by File
```cypher
MATCH (e:Entity)
WITH e.file as file, collect(e.name)[0..10] as tables
RETURN file, tables, size(tables) as count
ORDER BY count DESC
LIMIT 10
```

### 9. Search by Description
```cypher
MATCH (e:Entity)
WHERE e.description CONTAINS "payment" OR e.description CONTAINS "booking"
RETURN e.name, e.domain, left(e.description, 80) as description
LIMIT 20
```

### 10. Large Tables (Many Fields)
```cypher
MATCH (e:Entity)
WHERE e.fieldCount > 5
RETURN e.name, e.domain, e.fieldCount, e.fields
ORDER BY e.fieldCount DESC
LIMIT 20
```

---

## 🎨 Visual Styling Tips

### In Neo4j Browser, add to Favorites:

```cypher
// Style: Color domains
MATCH (d:Domain)
WITH d, 
  CASE d.name
    WHEN "Identity" THEN "#FF6B6B"
    WHEN "Catalog" THEN "#4ECDC4"
    WHEN "Supply" THEN "#45B7D1"
    WHEN "Bookings" THEN "#96CEB4"
    WHEN "Payments" THEN "#FFEAA7"
    ELSE "#D5DBDB"
  END as color
SET d.style = "background-color: " + color + "; border: 2px solid #333;"
```

```cypher
// Style: Highlight root tables
MATCH (e:Entity)
WHERE e.name IN ["bizes", "users", "offers", "bookingOrders", "paymentTransactions"]
SET e.style = "border: 3px solid #000; font-size: 16px;"
```

---

## 🔧 Regenerating the Graph

If schema changes, run:

```bash
cd ~/bizing/code/packages/db
python3 import_to_neo4j.py
```

This will:
1. Clear existing graph
2. Re-extract all tables from schema files
3. Re-import with updated structure
4. Takes ~60 seconds

---

## 📁 Files Generated

| File | Purpose |
|------|---------|
| `neo4j-full-schema.cypher` | Complete Cypher (400KB) |
| `neo4j-comprehensive-v2.cypher` | Core 24 entities |
| `import_to_neo4j.py` | Python importer script |
| `extract_full_schema.py` | Schema extraction tool |
| `NEO4J_GRAPH_GUIDE.md` | Query cookbook |

---

## 💡 Tips for Exploration

1. **Use Bloom:** Install Neo4j Bloom for interactive visual exploration
2. **Save Favorites:** Save your most-used queries in the browser sidebar
3. **Export Images:** Click download button to save graph visualizations
4. **Zoom:** Use mouse wheel to zoom, drag to pan
5. **Node Selection:** Click any node to see properties

---

## 🎯 What's Not Included (Yet)

The current import includes:
- ✅ All 479 table nodes
- ✅ Domain assignments
- ✅ Key fields per table
- ✅ 23 essential relationships

Could add in future:
- All 7,000+ foreign key relationships (performance intensive)
- Index definitions
- Check constraints
- Enum values

---

**Happy Graph Exploring!** 🎉

The entire Bizing schema is now visual and queryable!
