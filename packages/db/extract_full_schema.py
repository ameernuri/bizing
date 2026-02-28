#!/usr/bin/env python3
"""
Extract all tables and relationships from Bizing schema files.
Generates comprehensive Cypher for Neo4j graph - FIXED VERSION.
"""

import re
import os
from pathlib import Path
from collections import defaultdict

SCHEMA_DIR = Path("/Users/ameer/bizing/code/packages/db/src/schema")

def clean_for_cypher(text):
    """Escape special characters for Cypher."""
    if not text:
        return ""
    return text.replace('"', '\\"').replace("'", "\\'").replace('\n', ' ').strip()[:200]

def extract_tables():
    """Parse all schema files and extract entities."""
    tables = {}
    
    for ts_file in sorted(SCHEMA_DIR.glob("*.ts")):
        if ts_file.name.startswith("_"):
            continue
            
        content = ts_file.read_text()
        
        # Find all table definitions
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
            
            tables[const_name] = {
                'table_name': table_name,
                'file': ts_file.name,
                'description': clean_for_cypher(description)
            }
    
    return tables

def assign_domain(table_name, file_name):
    """Assign table to a domain."""
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

def generate_cypher(tables):
    """Generate Cypher statements."""
    
    # Group by domain
    by_domain = defaultdict(list)
    for name, info in tables.items():
        domain = assign_domain(name, info['file'])
        by_domain[domain].append((name, info))
    
    lines = []
    lines.append("// ============================================")
    lines.append(f"// BIZING SCHEMA GRAPH - {len(tables)} TABLES")
    lines.append("// ============================================")
    lines.append("")
    lines.append("MATCH (n) DETACH DELETE n;")
    lines.append("")
    
    # Create domains
    colors = {
        'Identity': '#FF6B6B', 'Catalog': '#4ECDC4', 'Supply': '#45B7D1',
        'Bookings': '#96CEB4', 'Payments': '#FFEAA7', 'Queue': '#DDA0DD',
        'Social': '#98D8C8', 'Marketplace': '#F7DC6F', 'Enterprise': '#BB8FCE',
        'Governance': '#85C1E2', 'Education': '#F8C471', 'Intelligence': '#82E0AA',
        'Access': '#F1948A', 'Operations': '#85C1E9', 'Marketing': '#D7BDE2',
        'Gifts': '#A9DFBF', 'Core': '#D5DBDB'
    }
    
    lines.append("// Create domains")
    for domain in sorted(by_domain.keys()):
        color = colors.get(domain, '#D5DBDB')
        lines.append(f'CREATE ({domain}Domain:Domain {{name: "{domain}", color: "{color}"}})')
    
    lines.append("")
    lines.append("// Create entities")
    
    # Create entities in batches
    for domain, tables_list in sorted(by_domain.items()):
        lines.append(f"")
        lines.append(f"// {domain} ({len(tables_list)} tables)")
        
        for name, info in sorted(tables_list):
            desc = clean_for_cypher(info['description'])
            if not desc:
                desc = f"Table from {info['file']}"
            
            lines.append(f'''CREATE ({name}Node:Entity {{
  name: "{name}",
  tableName: "{info['table_name']}",
  domain: "{domain}",
  description: "{desc}",
  file: "{info['file']}"
}})''')
            
            # Link to domain
            lines.append(f'CREATE ({domain}Domain)-[:CONTAINS]->({name}Node)')
    
    # Add indexes
    lines.append("")
    lines.append("// Indexes")
    lines.append("CREATE INDEX entity_name_idx FOR (e:Entity) ON (e.name);")
    lines.append("CREATE INDEX entity_domain_idx FOR (e:Entity) ON (e.domain);")
    
    # Stats
    lines.append("")
    lines.append(f"RETURN '{len(tables)} tables created across {len(by_domain)} domains' as status;")
    
    return '\n'.join(lines)

def main():
    print("Extracting tables...")
    tables = extract_tables()
    print(f"Found {len(tables)} tables")
    
    # Show sample
    by_domain = defaultdict(int)
    for name, info in tables.items():
        domain = assign_domain(name, info['file'])
        by_domain[domain] += 1
    
    print("\nDomain breakdown:")
    for domain, count in sorted(by_domain.items(), key=lambda x: -x[1]):
        print(f"  {domain}: {count}")
    
    print("\nGenerating Cypher...")
    cypher = generate_cypher(tables)
    
    output = Path("/Users/ameer/bizing/code/packages/db/neo4j-full-schema.cypher")
    output.write_text(cypher)
    
    print(f"\n✅ Written: {output}")
    print(f"Size: {len(cypher):,} bytes")
    print(f"Lines: {len(cypher.splitlines()):,}")

if __name__ == "__main__":
    main()
