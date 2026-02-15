---
date: 2026-02-12
tags: 
  - session
  - log
  - research
  - merchant-of-record
  - stripe
  - fees
  - payments
---

# 📝 Session: Merchant of Record & Stripe Fee Research

> *Research on MoR responsibilities and strategies to minimize payment processing fees*

## Research Completed

**Topic:** Merchant of Record model and Stripe fee optimization

**Output:** `mind/research/findings/merchant-of-record-stripe-fees.md` (12.2KB)

---

## Key Findings

### 1. Merchant of Record (MoR)

**What is MoR:**
- Legal entity that sells to end customer
- Collects payment
- Bears transaction liability
- Handles taxes
  - refunds
  - chargebacks
- Owns payment processor relationship

**Bizing Should Be MoR:**
- Unified booking experience
- Bizing handles disputes
- Customer sees "Bizing" on statement
- Can optimize payment flows
- Single tax handling point
- Better fee structure

### 2. Stripe Fee Structure

**Standard Fees:**
- Cards: 2.9% + $0.30
- International: +1%
- Currency conversion: +1%
- ACH: 0.8% (max $5)

**Volume Discounts:**
- $100K/mo: Negotiate 0.1-0.2% off
- $1M/mo: Custom pricing

### 3. Fee Optimization Strategies

| Strategy | Savings | Implementation |
|----------|---------|----------------|
| **ACH for $200+** | 73% fee reduction | Offer bank transfer option |
| **Level 2 data** | 0.1% | Include transaction metadata |
| **Recurring flags** | 0.3% | Mark stored credentials |
| **Multi-currency** | 1% on intl | Present in local currency |
| **Wallet system** | 1-2% | Pre-fund wallet
  - multiple bookings |
| **Volume discount** | 0.2% | Negotiate at $100K/mo |

**Example Savings:**
$1M annual volume:
- Current: $29,000 in fees
- Optimized: $20,000 - $25,000
- **Save: $4,000 - $9,000/year**

### 4. Recommended Approach

**Phase 1: Immediate**
- Enable ACH for bookings $200+
- Add Level 2 data
- Set up Stripe Connect Express

**Phase 2: Short-term**
- Implement recurring payment flags
- Multi-currency support
- Wallet/balance system

**Phase 3: Scale**
- Negotiate Stripe rates at $100K/mo
- Evaluate Helcim/Adyen at $1M/yr

### 5. Tax Implications

**As MoR
  - Bizing must:**
- Calculate tax (customer location)
- Collect at checkout
- Remit to jurisdictions
- File returns
- Issue 1099s to agents

**Tools:**
- Stripe Tax: 0.5%
- Avalara: ~$0.20/transaction

---

## Files Updated

| File | Changes |
|------|---------|
| `mind/research/findings/merchant-of-record-stripe-fees.md` | Complete research (12.2KB) |
| `mind/research/backlog.md` | Marked as completed ✅ |
| `mind/MAP.md` | Added to completed findings |
| `mind/symbiosis/feedback.md` | Learning logged |
| `mind/memory/sessions/2026-02-12-mor-stripe-research.md` | This session log |

---

## Key Recommendations

1. **Bizing as MoR** — Yes
  - for unified brand and fee optimization
2. **Stripe Connect Express** — Platform controls
  - simple for agents
3. **Enable ACH** — 73% fee savings on large bookings
4. **Absorb fees for B2C** — Better UX
  - simpler
5. **Negotiate at $100K/mo** — Typical 0.2% reduction
6. **Consider alternatives at $1M/yr** — Helcim/Adyen for lower rates

---

*Research ready for payment architecture decisions.*
