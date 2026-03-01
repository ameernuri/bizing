#!/usr/bin/env python3
"""
Extract all tables and relationships from Bizing schema files.
Generates comprehensive Cypher for Neo4j graph.
"""

import re
import os
from pathlib import Path
from collections import defaultdict

SCHEMA_DIR = Path("/Users/ameer/bizing/code/packages/db/src/schema")

def extract_tables_and_relationships():
    """Parse all schema files and extract entities + relationships."""
    
    tables = {}  # name -> {file, fields, description}
    relationships = []  # (from_table, to_table, field, type)
    
    for ts_file in sorted(SCHEMA_DIR.glob("*.ts")):
        if ts_file.name.startswith("_"):
            continue
            
        content = ts_file.read_text()
        file_name = ts_file.name
        
        # Find all table definitions
        table_pattern = r'export const (\w+) = (?:pgTable|sqliteTable)\(\s*["\'](\w+)["\']\s*,\s*\{([^}]+)\}'
        
        for match in re.finditer(table_pattern, content, re.DOTALL):
            const_name = match.group(1)
            table_name = match.group(2)
            fields_block = match.group(3)
            
            # Get description from comments before
            desc_match = re.search(r'(?:/\*\*\s*([^*]+)\*/|// ([^\n]+))\s*\n\s*export const ' + const_name, content)
            description = ""
            if desc_match:
                description = (desc_match.group(1) or desc_match.group(2) or "").strip().split('\n')[0]
            
            tables[const_name] = {
                'table_name': table_name,
                'file': file_name,
                'description': description[:200] if description else f"Table {table_name}",
                'fields': []
            }
            
            # Extract fields and relationships
            # Pattern: fieldName: idRef('xxx').references(() => targetTable.id)
            ref_pattern = r'(\w+):\s*idRef\(["\'][^"\']*["\']\)(?:\s*\.references\(\(\)\s*=>\s*(\w+)\.id\))?' 
            
            for field_match in re.finditer(ref_pattern, fields_block):
                field_name = field_match.group(1)
                target_table = field_match.group(2)
                
                tables[const_name]['fields'].append({
                    'name': field_name,
                    'ref_table': target_table
                })
                
                if target_table and target_table in tables:
                    relationships.append({
                        'from': const_name,
                        'to': target_table,
                        'field': field_name,
                        'type': 'N:1'
                    })
            
            # Also look for inline references
            inline_pattern = r'(\w+)Id(?:Ref)?:\s*idRef\(["\']([^"\']+)["\']\)\.references\(\(\)\s*=>\s*(\w+)\.id\)'
            for inline_match in re.finditer(inline_pattern, content):
                field_name = inline_match.group(1)
                target_table = inline_match.group(3)
                
                if target_table and target_table in tables:
                    relationships.append({
                        'from': const_name,
                        'to': target_table,
                        'field': field_name + '_id',
                        'type': 'N:1'
                    })
    
    return tables, relationships

def assign_to_domains(tables):
    """Assign tables to domains based on file name and table name."""
    
    domain_mapping = {
        'Identity & Access': ['bizes', 'users', 'memberships', 'invitations', 'auth', 'authz', 'accounts', 'verifications', 'sessions'],
        'Catalog & Commerce': ['offers', 'products', 'services', 'sellables', 'pricing', 'catalog', 'checkout', 'wishlists'],
        'Supply & Resources': ['resources', 'venues', 'assets', 'hosts', 'calendars', 'availability', 'time_availability'],
        'Bookings & Fulfillment': ['booking', 'fulfillment', 'standing_reservation', 'commitments', 'delivery'],
        'Payments & Money': ['payment', 'transactions', 'refunds', 'billing', 'ar', 'invoices'],
        'Queue & Waitlist': ['queue', 'waitlist', 'tickets'],
        'Social & Notifications': ['social', 'graph', 'notifications', 'subscriptions', 'communications'],
        'Marketplace & Multi-Biz': ['marketplace', 'listings', 'referral', 'cross_biz'],
        'Enterprise & B2B': ['enterprise', 'contracts', 'sla', 'payer', 'eligibility', 'group_accounts'],
        'Governance & Compliance': ['governance', 'compliance', 'audit', 'consent', 'hipaa', 'gdpr', 'data_residency'],
        'Education & Learning': ['assessment', 'education', 'learning', 'credentials', 'certificates'],
        'Intelligence & Analytics': ['intelligence', 'analytics', 'facts', 'metrics', 'reporting'],
        'Access Control': ['access', 'entitlements', 'permissions', 'credentials'],
        'Operations & Workflow': ['operations', 'workflows', 'tasks', 'shipments', 'routes'],
        'Marketing & CRM': ['marketing', 'campaigns', 'crm', 'contacts', 'leads'],
        'Gifts & Promotions': ['gift', 'promotions', 'coupons', 'vouchers'],
    }
    
    table_domains = {}
    
    for table_name, info in tables.items():
        assigned = False
        table_lower = table_name.lower()
        file_lower = info['file'].lower()
        
        for domain, keywords in domain_mapping.items():
            for keyword in keywords:
                if keyword in table_lower or keyword in file_lower:
                    table_domains[table_name] = domain
                    assigned = True
                    break
            if assigned:
                break
        
        if not assigned:
            table_domains[table_name] = 'Core Infrastructure'
    
    return table_domains

def generate_cypher(tables, relationships, table_domains):
    """Generate comprehensive Cypher statements."""
    
    lines = []
    
    # Header
    lines.append("// ============================================")
    lines.append("// COMPREHENSIVE BIZING SCHEMA GRAPH")
    lines.append(f"// Tables: {len(tables)}")
    lines.append(f"// Relationships: {len(relationships)}")
    lines.append("// ============================================")
    lines.append("")
    lines.append("MATCH (n) DETACH DELETE n;")
    lines.append("")
    
    # Create domains
    domains = sorted(set(table_domains.values()))
    colors = [
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
        "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2",
        "#F8C471", "#82E0AA", "#F1948A", "#85C1E9", "#D7BDE2",
        "#A9DFBF"
    ]
    
    lines.append("// Create domains")
    for i, domain in enumerate(domains):
        color = colors[i % len(colors)]
        lines.append(f'CREATE (:{domain.replace(" ", "")}Domain:Domain {{name: "{domain}", color: "{color}"}})')
    
    lines.append("")
    
    # Create entities (in batches to avoid huge transactions)
    lines.append("// Create entities")
    for table_name, info in sorted(tables.items()):
        domain = table_domains.get(table_name, 'Core Infrastructure').replace(" ", "")
        desc = info['description'].replace('"', '\\"').replace("'", "\\'")[:150]
        
        # Get key fields
        key_fields = [f['name'] for f in info['fields'][:8]]
        fields_str = ', '.join(key_fields) if key_fields else 'id'
        
        lines.append(f'''
CREATE (:{domain}Domain:Entity {{
  name: "{table_name}",
  tableName: "{info['table_name']}",
  domain: "{domain}",
  description: "{desc}",
  file: "{info['file']}",
  fieldCount: {len(info['fields'])},
  keyFields: "{fields_str}"
}})''')
    
    lines.append("")
    lines.append("// Create relationships")
    
    # Group relationships to avoid duplicates
    rels_by_pair = defaultdict(list)
    for rel in relationships:
        key = (rel['from'], rel['to'])
        rels_by_pair[key].append(rel)
    
    for (from_table, to_table), rels in sorted(rels_by_pair.items()):
        fields = ', '.join([r['field'] for r in rels[:3]])
        lines.append(f'''
MATCH (a:Entity {{name: "{from_table}"}}), (b:Entity {{name: "{to_table}"}})
CREATE (a)-[:REFERENCES {{fields: "{fields}", type: "N:1"}}]->(b)''')
    
    # Add indexes
    lines.append("")
    lines.append("// Indexes")
    lines.append("CREATE INDEX entity_name FOR (e:Entity) ON (e.name);")
    lines.append("CREATE INDEX entity_domain FOR (e:Entity) ON (e.domain);")
    lines.append("")
    lines.append("// Stats")
    lines.append(f"RETURN '{len(tables)} tables, {len(relationships)} relationships created' as status;")
    
    return '\n'.join(lines)

def main():
    print("Extracting schema...")
    tables, relationships = extract_tables_and_relationships()
    
    print(f"Found {len(tables)} tables")
    print(f"Found {len(relationships)} relationships")
    
    print("Assigning to domains...")
    table_domains = assign_to_domains(tables)
    
    domain_counts = defaultdict(int)
    for d in table_domains.values():
        domain_counts[d] += 1
    
    print("\nDomain breakdown:")
    for domain, count in sorted(domain_counts.items(), key=lambda x: -x[1]):
        print(f"  {domain}: {count}")
    
    print("\nGenerating Cypher...")
    cypher = generate_cypher(tables, relationships, table_domains)
    
    output_file = Path("/Users/ameer/bizing/code/packages/db/neo4j-comprehensive-graph.cypher")
    output_file.write_text(cypher)
    
    print(f"\n✅ Written to: {output_file}")
    print(f"Size: {len(cypher):,} bytes")

if __name__ == "__main__":
    main()
