#!/usr/bin/env python3
"""
Comprehensive Neo4j Schema Importer for Bizing
Imports all 479 tables with proper relationships
"""

import os
import re
import sys
from pathlib import Path
from collections import defaultdict
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError

# Configuration
NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "bizing1234"
SCHEMA_DIR = Path("/Users/ameer/bizing/code/packages/db/src/schema")
BATCH_SIZE = 50

class Neo4jSchemaImporter:
    def __init__(self):
        self.driver = None
        self.tables = {}
        self.relationships = []
        self.domains = {}
        
    def connect(self):
        """Connect to Neo4j."""
        try:
            self.driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
            with self.driver.session() as session:
                result = session.run("RETURN 1 as test")
                result.single()
            print(f"✅ Connected to Neo4j at {NEO4J_URI}")
            return True
        except ServiceUnavailable:
            print(f"❌ Neo4j not available at {NEO4J_URI}")
            print("   Make sure Docker container is running: docker ps | grep neo4j")
            return False
        except AuthError:
            print(f"❌ Authentication failed. Check username/password.")
            return False
    
    def clear_database(self):
        """Clear all existing data."""
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
            print("🗑️  Cleared existing data")
    
    def extract_tables(self):
        """Extract all table definitions from schema files."""
        print("🔍 Extracting tables from schema files...")
        
        for ts_file in sorted(SCHEMA_DIR.glob("*.ts")):
            if ts_file.name.startswith("_"):
                continue
                
            content = ts_file.read_text()
            
            # Find all pgTable definitions
            # Pattern: export const tableName = pgTable("table_name", {...})
            pattern = r'export const (\w+) = (?:pgTable|sqliteTable)\(\s*["\'](\w+)["\']'
            
            for match in re.finditer(pattern, content):
                const_name = match.group(1)
                table_name = match.group(2)
                
                # Get description from preceding comments
                before = content[:match.start()]
                desc_match = re.search(r'/\*\*\s*\n?((?:[^*]|\*[^/])*)\*/\s*$', before)
                if desc_match:
                    description = desc_match.group(1).strip().split('\n')[0].strip().lstrip('*').strip()
                else:
                    # Try single line comment
                    desc_match = re.search(r'// ([^\n]+)\s*\n\s*$', before)
                    description = desc_match.group(1) if desc_match else f"Table {table_name}"
                
                # Clean description
                description = description.replace('"', '\\"').replace("'", "\\'")[:150]
                
                # Get fields
                fields = self._extract_fields(content, match.end())
                
                # Assign domain
                domain = self._assign_domain(const_name, ts_file.name)
                
                self.tables[const_name] = {
                    'const_name': const_name,
                    'table_name': table_name,
                    'file': ts_file.name,
                    'description': description,
                    'fields': fields,
                    'domain': domain
                }
        
        print(f"✅ Found {len(self.tables)} tables")
        
        # Show breakdown
        by_domain = defaultdict(list)
        for name, info in self.tables.items():
            by_domain[info['domain']].append(name)
        
        print("\n📊 Domain breakdown:")
        for domain, tables in sorted(by_domain.items(), key=lambda x: -len(x[1])):
            print(f"  {domain}: {len(tables)} tables")
    
    def _extract_fields(self, content, start_pos):
        """Extract field names from table definition."""
        # Find the fields block
        brace_count = 0
        in_fields = False
        fields = []
        
        for i, char in enumerate(content[start_pos:], start=start_pos):
            if char == '{':
                if not in_fields:
                    in_fields = True
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0 and in_fields:
                    break
            elif in_fields and brace_count == 1 and char == ':':
                # Look back for field name
                field_match = re.search(r'(\w+)\s*:$', content[start_pos:i])
                if field_match:
                    field_name = field_match.group(1)
                    if not field_name.startswith('_') and field_name not in ['id', 'createdAt', 'updatedAt', 'deletedAt']:
                        fields.append(field_name)
        
        return fields[:8]  # Limit to 8 key fields
    
    def _assign_domain(self, table_name, file_name):
        """Assign table to domain based on naming."""
        name_lower = table_name.lower()
        file_lower = file_name.lower()
        combined = f"{name_lower} {file_lower}"
        
        domain_keywords = [
            ('Identity', ['auth', 'user', 'session', 'account', 'verification', 'bizes', 'membership', 'invitation']),
            ('Catalog', ['offer', 'product', 'service', 'sellable', 'catalog', 'checkout', 'wishlist', 'pricing']),
            ('Supply', ['resource', 'venue', 'asset', 'host', 'calendar', 'availability', 'location']),
            ('Bookings', ['booking', 'fulfillment', 'standing_reservation', 'delivery', 'commitment']),
            ('Payments', ['payment', 'transaction', 'refund', 'billing', 'invoice', 'ar_', 'balance', 'ledger']),
            ('Queue', ['queue', 'waitlist', 'ticket']),
            ('Social', ['social', 'graph', 'notification', 'subscription', 'communication', 'channel']),
            ('Marketplace', ['marketplace', 'listing', 'referral', 'cross_biz']),
            ('Enterprise', ['enterprise', 'contract', 'sla', 'payer', 'eligibility', 'group_account']),
            ('Governance', ['governance', 'compliance', 'audit', 'consent', 'hipaa', 'data_residency']),
            ('Education', ['assessment', 'education', 'learning', 'credential', 'certificate']),
            ('Intelligence', ['intelligence', 'analytics', 'fact', 'metric', 'reporting']),
            ('Access', ['access_', 'entitlement', 'permission']),
            ('Operations', ['operation', 'workflow', 'task', 'shipment', 'route', 'transport']),
            ('Marketing', ['marketing', 'campaign', 'crm', 'contact', 'lead', 'ad_']),
            ('Gifts', ['gift', 'promotion', 'coupon', 'voucher']),
        ]
        
        for domain, keywords in domain_keywords:
            for kw in keywords:
                if kw in combined:
                    return domain
        
        return 'Core'
    
    def create_domains(self):
        """Create domain nodes."""
        print("\n🏗️  Creating domains...")
        
        colors = {
            'Identity': '#FF6B6B', 'Catalog': '#4ECDC4', 'Supply': '#45B7D1',
            'Bookings': '#96CEB4', 'Payments': '#FFEAA7', 'Queue': '#DDA0DD',
            'Social': '#98D8C8', 'Marketplace': '#F7DC6F', 'Enterprise': '#BB8FCE',
            'Governance': '#85C1E2', 'Education': '#F8C471', 'Intelligence': '#82E0AA',
            'Access': '#F1948A', 'Operations': '#85C1E9', 'Marketing': '#D7BDE2',
            'Gifts': '#A9DFBF', 'Core': '#D5DBDB'
        }
        
        with self.driver.session() as session:
            for domain in set(t['domain'] for t in self.tables.values()):
                color = colors.get(domain, '#D5DBDB')
                session.run("""
                    CREATE (d:Domain {
                        name: $name,
                        color: $color,
                        tableCount: 0
                    })
                """, name=domain, color=color)
        
        print(f"✅ Created {len(set(t['domain'] for t in self.tables.values()))} domains")
    
    def create_tables(self):
        """Create all table nodes in batches."""
        print(f"\n📥 Importing {len(self.tables)} tables in batches of {BATCH_SIZE}...")
        
        table_list = list(self.tables.values())
        total = len(table_list)
        created = 0
        
        with self.driver.session() as session:
            for i in range(0, total, BATCH_SIZE):
                batch = table_list[i:i+BATCH_SIZE]
                
                # Create tables and link to domains
                for table in batch:
                    session.run("""
                        MATCH (d:Domain {name: $domain})
                        CREATE (e:Entity {
                            name: $name,
                            tableName: $tableName,
                            description: $description,
                            file: $file,
                            domain: $domain,
                            fields: $fields,
                            fieldCount: $fieldCount
                        })
                        CREATE (d)-[:CONTAINS]->(e)
                        SET d.tableCount = d.tableCount + 1
                    """, 
                        name=table['const_name'],
                        tableName=table['table_name'],
                        description=table['description'],
                        file=table['file'],
                        domain=table['domain'],
                        fields=table['fields'],
                        fieldCount=len(table['fields'])
                    )
                
                created += len(batch)
                print(f"  Progress: {created}/{total} tables ({created/total*100:.1f}%)")
        
        print(f"✅ Created {created} table nodes")
    
    def create_key_relationships(self):
        """Create essential relationships between tables."""
        print("\n🔗 Creating key relationships...")
        
        # Define key relationships (from -> to, relationship type)
        key_rels = [
            # Identity
            ('bizes', 'memberships', 'HAS_MEMBERS'),
            ('users', 'memberships', 'HAS_MEMBERSHIP'),
            ('users', 'groupAccounts', 'BELONGS_TO'),
            ('bizes', 'locations', 'OPERATES_AT'),
            
            # Catalog
            ('bizes', 'offers', 'PUBLISHES'),
            ('offers', 'offerVersions', 'HAS_VERSION'),
            ('offerVersions', 'offerComponents', 'CONTAINS'),
            ('offers', 'demandPricing', 'HAS_PRICING'),
            
            # Supply
            ('bizes', 'resources', 'OWNS'),
            ('resources', 'calendars', 'HAS_CALENDAR'),
            ('calendars', 'availabilityRules', 'HAS_RULES'),
            ('resources', 'availabilityBlocks', 'HAS_BLOCKS'),
            
            # Bookings
            ('users', 'bookingOrders', 'PLACES'),
            ('bookingOrders', 'offerVersions', 'USES_VERSION'),
            ('bookingOrders', 'bookingOrderLines', 'HAS_LINES'),
            ('bookingOrderLines', 'fulfillmentUnits', 'SCHEDULED_AS'),
            ('resources', 'fulfillmentUnits', 'FULFILLS'),
            ('users', 'standingReservations', 'HAS_CONTRACT'),
            
            # Payments
            ('users', 'paymentMethods', 'HAS_METHODS'),
            ('bookingOrders', 'paymentIntents', 'REQUIRES_PAYMENT'),
            ('paymentIntents', 'paymentTransactions', 'RESULTS_IN'),
            ('paymentTransactions', 'paymentRefunds', 'REFUNDED_BY'),
            
            # Queue
            ('offers', 'queues', 'HAS_QUEUE'),
            ('queues', 'queueEntries', 'CONTAINS_ENTRY'),
            ('users', 'queueEntries', 'JOINS'),
            
            # Social
            ('users', 'graphIdentities', 'HAS_IDENTITY'),
            ('graphIdentities', 'graphSubjectSubscriptions', 'SUBSCRIBES'),
            ('subjectSubscriptions', 'offers', 'WATCHES'),
            ('subjectSubscriptions', 'bookingOrders', 'WATCHES'),
        ]
        
        with self.driver.session() as session:
            created = 0
            for from_table, to_table, rel_type in key_rels:
                try:
                    result = session.run("""
                        MATCH (a:Entity {name: $from_table})
                        MATCH (b:Entity {name: $to_table})
                        CREATE (a)-[r:RELATES {type: $rel_type}]->(b)
                        RETURN count(r) as created
                    """, from_table=from_table, to_table=to_table, rel_type=rel_type)
                    
                    if result.single()['created'] > 0:
                        created += 1
                except:
                    pass  # One of the tables might not exist
            
            print(f"✅ Created {created} relationships")
    
    def create_indexes(self):
        """Create indexes for performance."""
        print("\n📇 Creating indexes...")
        
        with self.driver.session() as session:
            try:
                session.run("CREATE INDEX entity_name FOR (e:Entity) ON (e.name)")
                session.run("CREATE INDEX entity_domain FOR (e:Entity) ON (e.domain)")
                session.run("CREATE INDEX domain_name FOR (d:Domain) ON (d.name)")
                print("✅ Created indexes")
            except:
                print("⚠️  Some indexes may already exist")
    
    def verify(self):
        """Verify the graph was created correctly."""
        print("\n✅ Verifying graph...")
        
        with self.driver.session() as session:
            # Count domains
            domains = session.run("MATCH (d:Domain) RETURN count(d) as count").single()['count']
            
            # Count entities
            entities = session.run("MATCH (e:Entity) RETURN count(e) as count").single()['count']
            
            # Count relationships
            relationships = session.run("MATCH ()-[r]->() RETURN count(r) as count").single()['count']
            
            # Domain breakdown
            domain_breakdown = session.run("""
                MATCH (d:Domain)
                OPTIONAL MATCH (d)-[:CONTAINS]->(e:Entity)
                RETURN d.name as domain, d.color as color, count(e) as tables
                ORDER BY tables DESC
            """).data()
        
        print(f"\n📊 Final Graph Stats:")
        print(f"  Domains: {domains}")
        print(f"  Entities: {entities}")
        print(f"  Relationships: {relationships}")
        print(f"\n📋 Domain breakdown:")
        for d in domain_breakdown:
            print(f"  {d['domain']}: {d['tables']} tables")
        
        return domains, entities, relationships
    
    def run(self):
        """Main execution."""
        print("="*60)
        print("BIZING SCHEMA → NEO4J IMPORTER")
        print("="*60)
        
        if not self.connect():
            return False
        
        self.clear_database()
        self.extract_tables()
        self.create_domains()
        self.create_tables()
        self.create_key_relationships()
        self.create_indexes()
        self.verify()
        
        print("\n" + "="*60)
        print("🎉 IMPORT COMPLETE!")
        print("="*60)
        print(f"\nAccess your graph at: http://localhost:7474")
        print(f"Username: {NEO4J_USER}")
        print(f"Password: {NEO4J_PASSWORD}")
        print("\nSample queries:")
        print('  MATCH (d:Domain) RETURN d.name, d.tableCount ORDER BY d.tableCount DESC')
        print('  MATCH (e:Entity {domain: "Payments"}) RETURN e.name, e.description')
        print('  MATCH path = (a)-[:RELATES*1..3]-(b) WHERE a.name = "bookingOrders" RETURN path LIMIT 5')
        
        return True

if __name__ == "__main__":
    importer = Neo4jSchemaImporter()
    success = importer.run()
    sys.exit(0 if success else 1)
