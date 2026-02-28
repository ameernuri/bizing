#!/usr/bin/env python3
"""
Generate TTS-friendly PDF of the Bizing Schema Bible
"""

from fpdf import FPDF
from pathlib import Path

class SchemaBiblePDF(FPDF):
    def header(self):
        # Title on each page
        if self.page_no() == 1:
            return  # Skip header on first page
        self.set_font('Arial', 'I', 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, 'The Ultimate Bizing Schema Bible', 0, 0, 'C')
        self.ln(5)
        # Line under header
        self.set_draw_color(200, 200, 200)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)
    
    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')
    
    def chapter_title(self, title):
        self.set_font('Arial', 'B', 16)
        self.set_text_color(33, 37, 41)
        self.ln(10)
        self.cell(0, 10, title, 0, 1, 'L')
        self.ln(2)
        # Underline
        self.set_draw_color(74, 144, 226)
        self.set_line_width(0.5)
        self.line(10, self.get_y(), 60, self.get_y())
        self.ln(5)
    
    def chapter_subtitle(self, subtitle):
        self.set_font('Arial', 'B', 13)
        self.set_text_color(44, 62, 80)
        self.ln(8)
        self.cell(0, 8, subtitle, 0, 1, 'L')
        self.ln(2)
    
    def body_text(self, text):
        self.set_font('Arial', '', 11)
        self.set_text_color(33, 37, 41)
        self.multi_cell(0, 6, text)
        self.ln(3)
    
    def bullet_point(self, text, level=0):
        indent = 10 + (level * 5)
        self.set_x(indent)
        self.set_font('Arial', '', 10)
        self.set_text_color(33, 37, 41)
        bullet = '*' if level == 0 else '-'
        self.cell(5, 6, bullet, 0, 0, 'L')
        self.multi_cell(0, 6, text)

def create_pdf():
    pdf = SchemaBiblePDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # Cover Page
    pdf.set_font('Arial', 'B', 28)
    pdf.set_text_color(33, 37, 41)
    pdf.ln(60)
    pdf.cell(0, 15, 'THE ULTIMATE', 0, 1, 'C')
    pdf.cell(0, 15, 'BIZING SCHEMA BIBLE', 0, 1, 'C')
    
    pdf.set_font('Arial', '', 14)
    pdf.set_text_color(74, 144, 226)
    pdf.ln(10)
    pdf.cell(0, 10, 'A Complete Guide to the Booking Platform Architecture', 0, 1, 'C')
    
    pdf.set_font('Arial', 'I', 12)
    pdf.set_text_color(100, 100, 100)
    pdf.ln(20)
    pdf.cell(0, 10, '479 Tables | 8,778 Fields | 515 Relationships | 100+ Use Cases', 0, 1, 'C')
    
    pdf.ln(30)
    pdf.set_font('Arial', '', 10)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 10, 'TTS-Friendly Edition', 0, 1, 'C')
    
    # Content Pages
    pdf.add_page()
    
    # Introduction
    pdf.chapter_title('Introduction')
    pdf.body_text('Bizing equals Business in Action. It is a platform where service providers like salons, doctors, and consultants offer appointments. Customers book time slots. Money flows securely. Resources like people, rooms, and equipment get scheduled. Queues manage waitlists. And enterprises handle complex business to business contracts.')
    
    pdf.chapter_subtitle('The Three Layer Architecture')
    pdf.body_text('Imagine a three story building. The top floor is where customers browse offers, book appointments, pay money, and join queues. The middle floor handles all the business logic like calculating availability, applying pricing rules, assigning resources, and processing payments. The bottom floor is where all the data lives. This is the schema with 479 tables, tenant isolation, audit trails, and relationships.')
    
    # Core Concepts
    pdf.add_page()
    pdf.chapter_title('Core Concepts Explained Simply')
    
    pdf.chapter_subtitle('The Biz, or Tenant')
    pdf.body_text('Think of a biz like an apartment building. Each business gets their own apartment where all their data lives. Sarah\'s Salon cannot see data from Mike\'s Barbershop. They are completely separate. The bizes table is the root tenant record. There are also configuration sets that store settings like how far ahead people can book, and configuration values that store the actual numbers like 7 days.')
    
    pdf.chapter_subtitle('Users and Memberships')
    pdf.body_text('People who use the system are called users. A user can be an owner who runs the business, staff who works there, or a customer who books appointments. The same person can be a customer at one business and staff at another. The users table stores identity information like email, name, and phone. The memberships table connects users to businesses with a specific role. There are also group accounts for families or companies who book together.')
    
    pdf.chapter_subtitle('Offers: Shell versus Version')
    pdf.body_text('This is the most important concept in the entire system. Think of a restaurant menu. The offer is like the menu item that says we sell haircuts. The offer version is like the recipe that says haircut version 2 takes 50 minutes, costs 75 dollars, and is available Tuesday through Thursday.')
    pdf.body_text('We have two tables because the menu item stays the same with a stable URL and reviews, but the recipe can change with new prices or durations. Old bookings still reference the old recipe. So if Sarah booked when the price was 60 dollars, and later the price goes to 75 dollars, Sarah\'s receipt still shows 60 dollars.')
    
    pdf.add_page()
    pdf.body_text('An offer has an execution mode that determines how customers get the service. Slot mode means pick a time, like a standard appointment. Queue mode means join a line, like a walk-in waitlist. Request mode means ask first and the business approves later. Auction mode means bid for time. Async mode means submit a request and get results later. Route trip mode is for transportation scheduling. Open access means no specific time is needed. Itinerary mode is for multi-step experiences.')
    
    pdf.chapter_subtitle('Resources: The Supply Side')
    pdf.body_text('Resources are anything that provides service. A host is a person like a stylist, doctor, or consultant. An asset is a thing like a massage table or equipment. A venue is a place like a room or office. All resources have calendars and can be scheduled.')
    
    pdf.chapter_subtitle('Availability Rules')
    pdf.body_text('Every resource has rules that define when it is available. These rules have a precedence order where the most specific rule wins. A timestamp range blocks a specific time like 2 PM to 2:50 PM on March 15th. A date range closes specific days like Christmas. Recurring rules set regular hours like open 9 to 5 Monday through Friday. The default mode is closed unless opened by rules.')
    
    # Bookings
    pdf.add_page()
    pdf.chapter_title('Booking Orders and Fulfillment')
    
    pdf.body_text('When a customer says I want this and pays or promises to pay, we create a booking order. The critical thing is that booking orders contain snapshots. Just like when you buy something you get a receipt that doesn\'t change even if store prices change later.')
    pdf.body_text('A booking order snapshots the pricing at the time of booking, the policy like cancellation rules at that moment, and which offer version was used. This way if the price changes later, the original booking still shows what was actually paid.')
    pdf.body_text('Booking orders have a status flow. They start as draft, then become pending, then confirmed, then completed. They can also be cancelled or marked as no show.')
    
    pdf.chapter_subtitle('Fulfillment Units')
    pdf.body_text('A fulfillment unit is the smallest schedulable piece of a booking. Imagine you booked a spa day. The booking order is the spa day package. The fulfillment units are the individual pieces. At 9 AM you have a massage with Sarah. At 10:30 AM you have a facial with Mike. At 12 PM you have lunch. Each of these is a separate fulfillment unit that can be assigned to different resources at different times.')
    
    # Payments
    pdf.add_page()
    pdf.chapter_title('Payments and Money Flow')
    
    pdf.body_text('The payment system has a state machine. It starts as created, then may require action like 3D secure verification, then processes, and finally succeeds. It can also fail or be cancelled at various points.')
    pdf.body_text('A payment intent represents the intention to pay a certain amount. It holds the funds temporarily. A tender represents how the customer pays, which could be split across multiple methods like 60 dollars on a card and 40 dollars in points. A transaction is the final immutable record of money movement. Once a transaction succeeds, it is never changed. Refunds create new records.')
    
    # Queues
    pdf.chapter_subtitle('Queues and Waitlists')
    pdf.body_text('When you cannot book a specific time, you join a queue. This is like a restaurant waitlist, a DMV line, or a walk-in clinic. Queues have different service orders. First in first out is fair and common. Last in first out is like a stack. Priority puts VIPs first. Shortest job handles quick tasks first.')
    pdf.body_text('Queue entries track people in line with their position number. The lifecycle goes from waiting, to notified when their table is almost ready, to confirmed when they say they are coming, to serving when they are being helped, to completed.')
    
    # More features
    pdf.add_page()
    pdf.chapter_title('Advanced Features')
    
    pdf.chapter_subtitle('Standing Reservations')
    pdf.body_text('A standing reservation is like saying every Tuesday at 2 PM for the next 6 months. The system uses recurrence rules to generate individual occurrences. These can become real bookings automatically or require confirmation.')
    
    pdf.chapter_subtitle('The Social Graph')
    pdf.body_text('The social graph handles the watch and notify system. It answers requests like notify me when Doctor Smith has openings, alert me when my table is ready, or email me when this item goes on sale. Users create subscriptions that watch specific subjects like offers, bookings, or queues. The system then delivers notifications through various channels like in-app, email, SMS, or push notifications.')
    
    pdf.chapter_subtitle('Enterprise Features')
    pdf.body_text('For complex business contracts, we have enterprise features. Contract rates provide special pricing for big customers. Payer eligibility controls which employees can bill to a company account. Service level agreements track promises about service quality like response times and uptime guarantees.')
    
    pdf.chapter_subtitle('Governance and Compliance')
    pdf.body_text('For legal and data protection, we track where data lives for GDPR compliance, manage user consent for marketing and analytics, log who accessed patient data for HIPAA compliance, and maintain immutable audit logs of everything that happened.')
    
    # Domain Summary
    pdf.add_page()
    pdf.chapter_title('Domain Breakdown Summary')
    
    domains = [
        ('Identity and Access', '40 tables covering users, memberships, group accounts, and authorization'),
        ('Catalog and Commerce', '48 tables covering offers, versions, components, and pricing'),
        ('Supply and Resources', '50 tables covering resources, calendars, and availability'),
        ('Bookings and Fulfillment', '23 tables covering orders, lines, and fulfillment units'),
        ('Payments and Money', '15 tables covering intents, tenders, transactions, and refunds'),
        ('Queue and Waitlist', '10 tables covering queues and entries'),
        ('Social and Notifications', '25 tables covering identities and subscriptions'),
        ('Marketplace and Multi-Business', '12 tables covering listings and referrals'),
        ('Enterprise and B2B', '23 tables covering contracts and eligibility'),
        ('Governance and Compliance', '21 tables covering data residency, consent, and audit logs'),
        ('Education and Learning', '19 tables covering assessments and certifications'),
        ('Intelligence and Analytics', '22 tables covering facts and predictions'),
        ('Access Control', '16 tables'),
        ('Operations and Workflow', '12 tables'),
        ('Marketing and CRM', '18 tables'),
        ('Gifts and Promotions', '9 tables'),
        ('Core Infrastructure', '97 tables for supporting systems'),
    ]
    
    for name, desc in domains:
        pdf.set_font('Arial', 'B', 10)
        pdf.set_text_color(44, 62, 80)
        pdf.cell(0, 7, name, 0, 1, 'L')
        pdf.set_font('Arial', '', 10)
        pdf.set_text_color(33, 37, 41)
        pdf.multi_cell(0, 6, desc)
        pdf.ln(2)
    
    # Summary
    pdf.add_page()
    pdf.chapter_title('Summary')
    
    pdf.body_text('The Bizing schema has 479 tables organized into 17 domains. There are 8,778 fields capturing every data point. There are 515 relationships linking everything together. And over 100 use cases are covered.')
    
    pdf.chapter_subtitle('Key Architectural Decisions')
    pdf.bullet_point('Tenant isolation where every row has a biz_id')
    pdf.bullet_point('Shell plus version where mutable shells have immutable versions')
    pdf.bullet_point('Snapshot pattern where bookings freeze pricing and policy at time of purchase')
    pdf.bullet_point('Polymorphic resources where hosts, assets, and venues share one table')
    pdf.bullet_point('Audit everything with immutable logs for compliance')
    
    pdf.ln(10)
    pdf.set_font('Arial', 'B', 14)
    pdf.set_text_color(74, 144, 226)
    pdf.cell(0, 10, 'This is Bizing. Business in Action.', 0, 1, 'C')
    
    # Save
    output_path = Path('/Users/ameer/bizing/code/packages/db/Bizing_Schema_Bible.pdf')
    pdf.output(str(output_path))
    print(f"✅ PDF created: {output_path}")
    print(f"   Size: {output_path.stat().st_size:,} bytes")
    print(f"   Pages: {pdf.page_no()}")

if __name__ == '__main__':
    create_pdf()
