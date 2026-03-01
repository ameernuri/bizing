#!/bin/bash
# Build comprehensive Neo4j graph in batches

NEO4J="docker exec -i neo4j-bizing cypher-shell -u neo4j -p bizing1234"

echo "Clearing existing data..."
echo "MATCH (n) DETACH DELETE n;" | $NEO4J 2>/dev/null

echo "Creating domains..."
cat <> 'EOF' | $NEO4J 2>/dev/null
CREATE (d1:Domain {name: "Identity", color: "#FF6B6B", icon: "👤"})
CREATE (d2:Domain {name: "Catalog", color: "#4ECDC4", icon: "🏪"})
CREATE (d3:Domain {name: "Supply", color: "#45B7D1", icon: "⚙️"})
CREATE (d4:Domain {name: "Bookings", color: "#96CEB4", icon: "📅"})
CREATE (d5:Domain {name: "Payments", color: "#FFEAA7", icon: "💰"})
CREATE (d6:Domain {name: "Queue", color: "#DDA0DD", icon: "⏳"})
CREATE (d7:Domain {name: "Social", color: "#98D8C8", icon: "🔔"})
CREATE (d8:Domain {name: "Marketplace", color: "#F7DC6F", icon: "🌐"})
CREATE (d9:Domain {name: "Enterprise", color: "#BB8FCE", icon: "🏢"})
CREATE (d10:Domain {name: "Governance", color: "#85C1E2", icon: "⚖️"})
CREATE (d11:Domain {name: "Education", color: "#F8C471", icon: "🎓"})
CREATE (d12:Domain {name: "Intelligence", color: "#82E0AA", icon: "📊"})
CREATE (d13:Domain {name: "Access", color: "#F1948A", icon: "🔑"})
CREATE (d14:Domain {name: "Operations", color: "#85C1E9", icon: "🚚"})
CREATE (d15:Domain {name: "Marketing", color: "#D7BDE2", icon: "📢"})
CREATE (d16:Domain {name: "Gifts", color: "#A9DFBF", icon: "🎁"})
CREATE (d17:Domain {name: "Core", color: "#D5DBDB", icon: "⚙️"})
EOF

echo "✅ Domains created!"
