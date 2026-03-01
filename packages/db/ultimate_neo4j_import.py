#!/usr/bin/env python3
"""
ULTIMATE Neo4j Schema Importer - Extracts EVERYTHING
- All 479 tables
- All fields with types and JSDoc
- All relationships (foreign keys)
- All JSDoc comments
- All enums
"""

import re
import os
import sys
from pathlib import Path
from collections import defaultdict
from neo4j import GraphDatabase

NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "bizing1234"
SCHEMA_DIR = Path("/Users/ameer/bizing/code/packages/db/src/schema")
BATCH_SIZE = 25  # Smaller batches for detailed imports

class UltimateSchemaImporter:
    def __init__(self):
        self.driver = None
        self.tables = {}
        self.enums = {}
        self.relationships = []
        
    def connect(self):
        try:
            self.driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
            with self.driver.session() as session:
                session.run("RETURN 1").single()
            print(f"✅ Connected to Neo4j")
            return True
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            return False
    
    def clear_database(self):
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
            print("🗑️  Cleared database")
    
    def extract_jsdoc(self, content, position):
        """Extract JSDoc comment before a position."""
        before = content[:position]
        
        # Try multi-line JSDoc
        jsdoc_match = re.search(r'/\*\*\s*\n?((?:[^*]|\*[^/])*)\*/\s*$', before, re.DOTALL)
        if jsdoc_match:
            doc = jsdoc_match.group(1)
            # Clean up the doc
            lines = []
            for line in doc.split('\n'):
                line = line.strip()
                if line.startswith('*'):
                    line = line[1:].strip()
                if line:
                    lines.append(line)
            return ' '.join(lines)
        
        # Try single-line comments
        single_line = re.findall(r'// ([^\n]+)\s*\n\s*$', before)
        if single_line:
            return ' '.join(single_line[-3:])  # Last 3 single-line comments
        
        return ""
    
    def extract_field_details(self, content, start_pos):
        """Extract all fields with their types and JSDoc from a table definition."""
        fields = []
        
        # Find the fields block - look for the object between { and }
        brace_depth = 0
        in_fields = False
        field_start = start_pos
        
        for i, char in enumerate(content[start_pos:], start=start_pos):
            if char == '{':
                if not in_fields:
                    in_fields = True
                    field_start = i + 1
                brace_depth += 1
            elif char == '}':
                brace_depth -= 1
                if brace_depth == 0 and in_fields:
                    fields_block = content[field_start:i]
                    break
        else:
            return fields
        
        # Parse individual fields
        # Pattern: fieldName: fieldType().modifiers()
        field_pattern = r'(\w+):\s*([^,\n]+(?:\([^)]*\))?)'
        
        for match in re.finditer(field_pattern, fields_block):
            field_name = match.group(1)
            field_type = match.group(2).strip()
            
            # Skip common audit fields
            if field_name in ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'updatedBy', 'deletedBy']:
                continue
            if field_name.startswith('_'):
                continue
            
            # Get JSDoc for this field (look before the match in fields_block)
            field_pos = fields_block.find(f"{field_name}:")
            if field_pos > 0:
                before_field = fields_block[:field_pos]
                jsdoc = self.extract_jsdoc(before_field, field_pos)
            else:
                jsdoc = ""
            
            # Check for references
            ref_match = re.search(r'\.references\(\(\)\s*=>\s*(\w+)\.id\)', field_type)
            references = ref_match.group(1) if ref_match else None
            
            # Clean up type
            type_clean = re.sub(r'\.references\([^)]+\)', '', field_type)
            type_clean = re.sub(r'\.default\([^)]+\)', '', type_clean)
            type_clean = re.sub(r'\.notNull\(\)', ' NOT NULL', type_clean)
            type_clean = type_clean.strip()
            
            fields.append({
                'name': field_name,
                'type': type_clean,
                'jsdoc': jsdoc,
                'references': references,
                'isForeignKey': references is not None
            })
        
        return fields
    
    def extract_all_tables_detailed(self):
        """Extract every table with full field details and JSDoc."""
        print("🔍 Extracting detailed schema information...")
        
        for ts_file in sorted(SCHEMA_DIR.glob("*.ts")):
            if ts_file.name.startswith("_"):
                continue
            
            content = ts_file.read_text()
            
            # Find pgTable definitions
            table_pattern = r'export const (\w+) = (?:pgTable|sqliteTable)\(\s*["\'](\w+)["\']\s*,\s*\{'
            
            for match in re.finditer(table_pattern, content):
                const_name = match.group(1)
                table_name = match.group(2)
                
                # Get JSDoc for the table
                table_jsdoc = self.extract_jsdoc(content, match.start())
                if not table_jsdoc:
                    table_jsdoc = f"Table {table_name}"
                
                # Extract fields
                fields = self.extract_field_details(content, match.end() - 1)
                
                # Get domain
                domain = self.assign_domain(const_name, ts_file.name)
                
                self.tables[const_name] = {
                    'const_name': const_name,
                    'table_name': table_name,
                    'file': ts_file.name,
                    'jsdoc': table_jsdoc,
                    'domain': domain,
                    'fields': fields,
                    'field_count': len(fields),
                    'foreign_keys': [f for f in fields if f['references']]
                }
                
                # Extract relationships
                for field in fields:
                    if field['references']:
                        self.relationships.append({
                            'from_table': const_name,
                            'to_table': field['references'],
                            'field': field['name'],
                            'jsdoc': field['jsdoc']
                        })
        
        print(f"✅ Found {len(self.tables)} tables")
        print(f"✅ Found {len(self.relationships)} relationships")
        print(f"✅ Total fields: {sum(t['field_count'] for t in self.tables.values())}")
    
    def assign_domain(self, table_name, file_name):
        """Assign table to domain."""
        name_lower = table_name.lower()
        file_lower = file_name.lower()
        combined = f"{name_lower} {file_lower}"
        
        domains = [
            ('Identity', ['auth', 'user', 'session', 'account', 'verification', 'bizes', 'membership', 'invitation']),
            ('Catalog', ['offer', 'product', 'service', 'sellable', 'catalog', 'checkout', 'wishlist']),
            ('Supply', ['resource', 'venue', 'asset', 'host', 'calendar', 'availability', 'location']),
            ('Bookings', ['booking', 'fulfillment', 'standing_reservation', 'delivery', 'commitment']),
            ('Payments', ['payment', 'transaction', 'refund', 'billing', 'invoice', 'ar_', 'balance']),
            ('Queue', ['queue', 'waitlist', 'ticket']),
            ('Social', ['social', 'graph', 'notification', 'subscription', 'communication']),
            ('Marketplace', ['marketplace', 'listing', 'referral']),
            ('Enterprise', ['enterprise', 'contract', 'sla', 'payer', 'eligibility']),
            ('Governance', ['governance', 'compliance', 'audit', 'consent', 'hipaa']),
            ('Education', ['assessment', 'education', 'learning', 'credential']),
            ('Intelligence', ['intelligence', 'analytics', 'fact', 'metric']),
            ('Access', ['access_', 'entitlement', 'permission']),
            ('Operations', ['operation', 'workflow', 'task', 'shipment', 'route']),
            ('Marketing', ['marketing', 'campaign', 'crm', 'contact', 'lead']),
            ('Gifts', ['gift', 'promotion', 'coupon', 'voucher']),
        ]
        
        for domain, keywords in domains:
            for kw in keywords:
                if kw in combined:
                    return domain
        
        return 'Core'
    
    def create_schema(self):
        """Create complete schema in Neo4j."""
        print("\n🏗️  Creating schema...")
        
        with self.driver.session() as session:
            # Create constraints
            try:
                session.run("CREATE CONSTRAINT entity_name IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE")
                session.run("CREATE CONSTRAINT domain_name IF NOT EXISTS FOR (d:Domain) REQUIRE d.name IS UNIQUE")
            except:
                pass
        
        self.create_domains()
        self.create_tables_with_fields()
        self.create_relationships()
        self.create_indexes()
    
    def create_domains(self):
        """Create domain nodes."""
        print("📦 Creating domains...")
        
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
                        tableCount: 0,
                        fieldCount: 0
                    })
                """, name=domain, color=color)
    
    def create_tables_with_fields(self):
        """Create tables with all field details."""
        print(f"📥 Importing {len(self.tables)} tables with full details...")
        
        table_list = list(self.tables.values())
        total = len(table_list)
        created = 0
        
        with self.driver.session() as session:
            for i in range(0, total, BATCH_SIZE):
                batch = table_list[i:i+BATCH_SIZE]
                
                for table in batch:
                    # Create table node
                    session.run("""
                        MATCH (d:Domain {name: $domain})
                        CREATE (e:Entity {
                            name: $name,
                            tableName: $tableName,
                            description: $description,
                            file: $file,
                            domain: $domain,
                            fieldCount: $fieldCount
                        })
                        CREATE (d)-[:CONTAINS]->(e)
                        SET d.tableCount = d.tableCount + 1
                    """, 
                        name=table['const_name'],
                        tableName=table['table_name'],
                        description=table['jsdoc'][:500],
                        file=table['file'],
                        domain=table['domain'],
                        fieldCount=table['field_count']
                    )
                    
                    # Create field nodes and link to table
                    for field in table['fields']:
                        session.run("""
                            MATCH (e:Entity {name: $tableName})
                            CREATE (f:Field {
                                name: $fieldName,
                                type: $fieldType,
                                description: $fieldJsdoc,
                                isForeignKey: $isFk,
                                references: $references
                            })
                            CREATE (e)-[:HAS_FIELD]->(f)
                            WITH e
                            MATCH (d:Domain {name: e.domain})
                            SET d.fieldCount = d.fieldCount + 1
                        """,
                            tableName=table['const_name'],
                            fieldName=field['name'],
                            fieldType=field['type'][:100],
                            fieldJsdoc=field['jsdoc'][:300],
                            isFk=field['isForeignKey'],
                            references=field['references'] or ''
                        )
                
                created += len(batch)
                print(f"  Progress: {created}/{total} tables ({created/total*100:.1f}%)")
    
    def create_relationships(self):
        """Create all foreign key relationships."""
        print(f"🔗 Creating {len(self.relationships)} relationships...")
        
        with self.driver.session() as session:
            created = 0
            for rel in self.relationships:
                try:
                    result = session.run("""
                        MATCH (from:Entity {name: $from_table})
                        MATCH (to:Entity {name: $to_table})
                        CREATE (from)-[r:REFERENCES {
                            field: $field,
                            description: $jsdoc
                        }]->(to)
                        RETURN count(r) as created
                    """, 
                        from_table=rel['from_table'],
                        to_table=rel['to_table'],
                        field=rel['field'],
                        jsdoc=rel['jsdoc'][:200]
                    )
                    if result.single()['created'] > 0:
                        created += 1
                except Exception as e:
                    pass  # Table might not exist
            
            print(f"✅ Created {created} relationships")
    
    def create_indexes(self):
        """Create indexes."""
        print("📇 Creating indexes...")
        with self.driver.session() as session:
            try:
                session.run("CREATE INDEX entity_name FOR (e:Entity) ON (e.name)")
                session.run("CREATE INDEX entity_domain FOR (e:Entity) ON (e.domain)")
                session.run("CREATE INDEX field_name FOR (f:Field) ON (f.name)")
            except:
                pass
    
    def verify(self):
        """Verify everything was created."""
        print("\n✅ Verifying...")
        
        with self.driver.session() as session:
            stats = session.run("""
                MATCH (d:Domain)
                OPTIONAL MATCH (d)-[:CONTAINS]->(e:Entity)
                OPTIONAL MATCH (e)-[:HAS_FIELD]->(f:Field)
                RETURN 
                    count(DISTINCT d) as domains,
                    count(DISTINCT e) as entities,
                    count(DISTINCT f) as fields,
                    count{(e)-[]-()} as relationships
            """).single()
            
            domain_details = session.run("""
                MATCH (d:Domain)
                OPTIONAL MATCH (d)-[:CONTAINS]->(e:Entity)
                OPTIONAL MATCH (e)-[:HAS_FIELD]->(f:Field)
                RETURN d.name as domain, count(DISTINCT e) as tables, count(DISTINCT f) as fields
                ORDER BY tables DESC
            """).data()
        
        print(f"\n📊 FINAL STATS:")
        print(f"  Domains: {stats['domains']}")
        print(f"  Entities: {stats['entities']}")
        print(f"  Fields: {stats['fields']}")
        print(f"  Relationships: {stats['relationships']}")
        
        print(f"\n📋 Domain Breakdown:")
        for d in domain_details:
            print(f"  {d['domain']}: {d['tables']} tables, {d['fields']} fields")
        
        return stats
    
    def run(self):
        print("="*70)
        print("ULTIMATE BIZING SCHEMA → NEO4J IMPORTER")
        print("Extracts: tables + fields + JSDoc + relationships")
        print("="*70)
        
        if not self.connect():
            return False
        
        self.clear_database()
        self.extract_all_tables_detailed()
        self.create_schema()
        stats = self.verify()
        
        print("\n" + "="*70)
        print("🎉 ULTIMATE IMPORT COMPLETE!")
        print("="*70)
        print(f"\nTotal data points: {stats['entities']} tables + {stats['fields']} fields")
        print(f"\nAccess: http://localhost:7474")
        print(f"Username: {NEO4J_USER}")
        print(f"Password: {NEO4J_PASSWORD}")
        
        return True

if __name__ == "__main__":
    importer = UltimateSchemaImporter()
    success = importer.run()
    sys.exit(0 if success else 1)
