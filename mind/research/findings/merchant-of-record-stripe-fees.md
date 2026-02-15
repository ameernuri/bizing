---
date: 2026-02-12
tags: 
  - research
  - findings
  - payments
  - stripe
  - merchant-of-record
  - fees
  - marketplace
status: completed
---

# 📚 Research Findings: Merchant of Record & Stripe Fee Optimization

> _Understanding MoR responsibilities
  - Stripe fee structures
  - and strategies to minimize transaction costs_

## Executive Summary

This research covers the Merchant of Record (MoR) model
  - when Bizing should become an MoR vs using Stripe Connect
  - and strategies to minimize payment processing fees. Key findings include fee structures
  - tax implications
  - and cost-saving approaches.

---

## 1. What is a Merchant of Record (MoR)?

### 1.1 Definition

**Merchant of Record** = The legal entity that:

- Sells goods/services to the end customer
- Collects payment from the customer
- Bears liability for the transaction
- Handles taxes
  - refunds
  - chargebacks
- Owns the relationship with payment processor

### 1.2 MoR Responsibilities

| Responsibility         | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| **Payment Processing** | Collecting customer payments                         |
| **Tax Collection**     | Calculating
  - collecting
  - remitting sales tax/VAT/GST |
| **Fraud Prevention**   | Handling fraudulent transactions                     |
| **Chargebacks**        | Managing disputes and refunds                        |
| **Compliance**         | PCI-DSS
  - data privacy laws                           |
| **Payouts**            | Paying vendors/agents their share                    |
| **Reporting**          | 1099s
  - tax documents for sellers                     |

### 1.3 MoR vs Platform

**Platform (NOT MoR):**

- Connects buyers and sellers
- Seller is the MoR
- Platform takes commission
- Example: Etsy (sellers are MoR)
  - eBay

**Marketplace as MoR:**

- Marketplace is the legal seller
- Collects all payments
- Pays suppliers/vendors after
- Example: Amazon
  - Uber
  - Airbnb

---

## 2. When Should Bizing Become an MoR?

### 2.1 Signs You Need to Be MoR

✅ **Become MoR if:**

- You control pricing
- You provide unified customer experience
- You handle customer support
- You guarantee the service
- Agents are "invisible" to customers
- You want to optimize payment fees
- You need unified tax handling

❌ **Don't be MoR if:**

- Agents set their own prices
- Customers know they're buying from agents
- Agents handle their own support
- Agents have their own brands
- Simple directory model

### 2.2 Bizing Analysis

**Current Model:**

- Agents provide services
- Bizing takes 6.9% commission
- ??? Who is the MoR ???

**Recommended: Bizing as MoR**

**Why:**

- Unified booking experience
- Bizing handles disputes
- Customer sees "Bizing" on statement
- Can optimize payment flows
- Single tax handling point
- Better fee structure with Stripe

---

## 3. Stripe Fee Structures

### 3.1 Standard Stripe Fees (US)

| Payment Type                | Fee                          |
| --------------------------- | ---------------------------- |
| **Cards (online)**          | 2.9% + $0.30 per transaction |
| **International cards**     | +1% (3.9% + $0.30)           |
| **Currency conversion**     | +1%                          |
| **ACH transfers**           | 0.8% ($5 cap)                |
| **Stripe Tax**              | 0.5% of transaction          |
| **Billing (subscriptions)** | 0.5% on recurring payments   |

**Example:**
$100 booking → $100 × 2.9% + $0.30 = $3.20 fee
Bizing keeps: $100 - $3.20 - $7 commission = $89.80

### 3.2 Stripe Connect Fees (Marketplace)

**Standard Connect:**

- Same 2.9% + $0.30
- Plus platform fee (your markup)

**Express/Custom Connect:**

- 2.9% + $0.30 (paid by platform)
- OR pass fees to connected accounts
- Platform controls payout timing

**Key Difference:**

- Standard: Each agent pays Stripe fees
- Express/Custom: Platform (Bizing) pays fees

### 3.3 Volume Discounts

| Monthly Volume | Discount               |
| -------------- | ---------------------- |
| $0 - $100K     | Standard               |
| $100K - $1M    | Negotiable (~0.1-0.2%) |
| $1M+           | Custom pricing         |

**Strategy:**

- Project Bizing volume
- Negotiate when hitting $100K/month
- Typical discount: 0.1-0.3% off

---

## 4. Strategies to Minimize Stripe Fees

### 4.1 Strategy 1: ACH/Bank Transfers

**Fees:**

- ACH: 0.8% (max $5)
- vs Cards: 2.9% + $0.30

**Savings Example:**
$500 booking:

- Card: $500 × 2.9% + $0.30 = $14.80
- ACH: $500 × 0.8% = $4.00
- **Save: $10.80 (73% reduction)**

**Implementation:**

```typescript
// Offer ACH for large bookings
if (booking.total > 200) {
  paymentMethods.push({
    type: "ach_debit",
    label: "Bank Transfer (Save on fees)",
    fee: "0.8%",
  });
}
```

**When to Use:**

- Enterprise clients
- Recurring bookings
- High-value transactions ($200+)
- B2B bookings

### 4.2 Strategy 2: Stripe Connect Optimization

**Option A: Pass Fees to Agents**

```typescript
// Agent pays Stripe fees
// Bizing only pays commission processing
const platformFee = booking.total * 0.07; // 6.9% commission

await stripe.transfers.create({
  amount: booking.total - platformFee - stripeFees,
  currency: "usd",
  destination: agent.stripeAccountId,
});
```

**Option B: Platform Absorbs Fees (MoR)**

```typescript
// Bizing pays all fees
// Charges customer full amount
const stripeFee = booking.total * 0.029 + 0.3;
const bizingRevenue = booking.total * 0.07 - stripeFee;
```

**Recommendation:**

- B2C: Absorb fees (simpler UX)
- B2B: Pass fees or offer ACH

### 4.3 Strategy 3: Interchange Optimization

**What is Interchange?**

- Fee paid to card-issuing bank
- Part of the 2.9% Stripe charges
- Can be optimized

**Tactics:**

1. **Level 2/3 Data**

```typescript
// Include extra transaction data
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: "usd",
  // Level 2 data
  metadata: {
    customer_reference: "CUST-123",
    tax_amount: 100,
    line_items: JSON.stringify([
      {
        product_code: "SERVICE-1",
        description: "Consultation",
        quantity: 1,
        unit_cost: 2000,
      },
    ]),
  },
});
```

**Savings:** 0.1-0.5% on eligible cards

2. **Recurring Payments (Stored Credentials)**

```typescript
// Mark as merchant-initiated
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: "usd",
  customer: customerId,
  payment_method: paymentMethodId,
  off_session: true
  - // ← Key for lower rates
  confirm: true,
});
```

**Savings:** ~0.3-0.5% on recurring

### 4.4 Strategy 4: Currency Optimization

**Present in Local Currency:**

```typescript
// Detect customer location
const currency = detectCurrency(customer.country);

const paymentIntent = await stripe.paymentIntents.create({
  amount: convertToLocal(amount
  - currency),
  currency: currency
  - // EUR
  - GBP
  - etc.
});
```

**Avoid Conversion Fees:**

- Customer pays in local currency
- No 1% conversion fee
- Better conversion rates

**Setup:**

- Stripe supports 135+ currencies
- Automatic conversion
- Local payment methods

### 4.5 Strategy 5: Fee Surcharging (Legal but Complex)

**What:**

- Pass credit card fees to customers
- Illegal in some states/countries
- Must be transparent

**Where Legal:**

- US: Varies by state (CA
  - CO
  - CT
  - FL
  - KS
  - ME
  - MA
  - OK
  - TX = NO)
- EU: Generally allowed with disclosure
- UK: Allowed with disclosure

**Implementation:**

```typescript
// Add 2.9% surcharge for cards
const surcharge = paymentMethod === "card" ? Math.round(amount * 0.029) : 0;

const total = amount + surcharge;
```

**Alternative:**

- Offer "cash discount" (lower price for ACH)
- More legally friendly

### 4.6 Strategy 6: Volume Consolidation

**Aggregate Transactions:**
Instead of:

- 100 × $50 transactions = $320 fees

Do:

- 10 × $500 transactions = $160 fees
- **Save: $160 (50% reduction)**

**How:**

- Wallet/balance system
- Pre-funding
- Monthly billing

**Bizing Implementation:**

```typescript
// Agent wallet system
// Customer funds wallet once
// Multiple bookings from wallet

// Funding transaction (one fee)
await fundWallet(customerId
  - 1000);

// Wallet bookings (no fees)
await bookFromWallet(customerId
  - booking1); // $0 fee
await bookFromWallet(customerId
  - booking2); // $0 fee
```

---

## 5. Stripe Alternatives & Cost Comparison

### 5.1 Alternative Processors

| Processor        | Fee                        | Notes                   |
| ---------------- | -------------------------- | ----------------------- |
| **Stripe**       | 2.9% + $0.30               | Best features
  - easy API |
| **Square**       | 2.9% + $0.30               | Similar to Stripe       |
| **PayPal**       | 2.9% + $0.30               | Consumer trust          |
| **Adyen**        | 2.9% + $0.11               | Lower per-transaction   |
| **Helcim**       | 0.3% + $0.08 + interchange | ~1.8% total             |
| **Stax**         | $99/mo + $0.08             | Good for $30K+/mo       |
| **Paymentology** | Custom                     | Enterprise only         |

### 5.2 When to Switch

**Stay with Stripe if:**

- Under $100K/month
- Need quick setup
- Want best API/docs
- International payments

**Consider Helcim if:**

- Over $50K/month
- Mostly US customers
- Want lower rates
- Don't need advanced features

**Consider Adyen if:**

- International
- Enterprise volume
- Need local payment methods

### 5.3 Bizing Recommendation

**Phase 1: Stripe Standard**

- 2.9% + $0.30
- Quick setup
- Great API
- Scale to $100K/mo

**Phase 2: Negotiate with Stripe**

- At $100K/mo: Get 0.1-0.2% discount
- At $500K/mo: Get 0.2-0.3% discount
- Typical: 2.6.9% + $0.30

**Phase 3: Evaluate Alternatives**

- At $1M/mo: Consider Helcim or Adyen
- Could save 0.5-1%
- Worth the migration effort

---

## 6. Tax Implications of Being MoR

### 6.1 Sales Tax Responsibilities

**As MoR
  - Bizing must:**

- Calculate tax based on customer location
- Collect tax at checkout
- Remit tax to jurisdictions
- File tax returns

**Tools:**

- Stripe Tax: 0.5% of transaction
- Avalara: Starting at $99/mo
- TaxJar: Starting at $19/mo

**Cost Example:**
$100 booking:

- Stripe Tax: $0.50
- Avalara: ~$0.20 (at scale)

### 6.2 1099 Requirements

**If Bizing is MoR:**

- Must issue 1099s to agents
- For payments over $600/year
- Due January 31

**Automation:**

- Stripe Connect handles 1099s
- Or use Track1099
  - Tax1099

---

## 7. Implementation Recommendations

### 7.1 Bizing as MoR Model

```
Customer → Bizing (MoR) → Agent
   ↓           ↓            ↓
Pays $100   Keeps 6.9%    Gets $93
   ↓           ↓            ↓
Sees        Pays fees   Receives
"Bizing"    Handles tax   payout
on statement
```

**Benefits:**

- Unified brand
- Fee optimization
- Tax handling
- Better UX

### 7.2 Fee Minimization Stack

**Immediate (Week 1):**

- [ ] Enable ACH for bookings $200+
- [ ] Add ACH incentive ("Save 2%")
- [ ] Implement Level 2 data

**Short-term (Month 1):**

- [ ] Set up Stripe Connect (Express)
- [ ] Configure recurring payment flags
- [ ] Implement multi-currency

**Medium-term (Month 3):**

- [ ] Build wallet/balance system
- [ ] Offer monthly billing option
- [ ] Negotiate Stripe rates at $100K/mo

**Long-term (Year 1):**

- [ ] Evaluate Helcim/Adyen at scale
- [ ] Consider surcharging (if legal)
- [ ] Build payment method optimization

### 7.3 Expected Savings

**Conservative Estimates:**

| Strategy                | Savings      | Effort |
| ----------------------- | ------------ | ------ |
| ACH for 20% of bookings | 0.5% overall | Low    |
| Level 2 data            | 0.1%         | Low    |
| Recurring flags         | 0.3%         | Low    |
| Multi-currency          | 1% on intl   | Medium |
| Wallet system           | 1-2%         | High   |
| Volume discount         | 0.2%         | Low    |
| **Total Potential**     | **2-4%**     | Medium |

**Example:**
$1M annual volume

- Current fees: $29,000
- With optimizations: $20,000 - $25,000
- **Annual savings: $4,000 - $9,000**

---

## 8. Key Decisions

| Decision              | Recommendation            | Rationale                            |
| --------------------- | ------------------------- | ------------------------------------ |
| MoR or Platform       | **Bizing as MoR**         | Unified brand
  - fee optimization      |
| Stripe plan           | **Connect Express**       | Platform controls
  - simple for agents |
| ACH offering          | **Enable for $200+**      | 73% fee reduction on large bookings  |
| Fee passing           | **Absorb for B2C**        | Better UX
  - simpler                   |
| Tax handling          | **Stripe Tax initially**  | Easy setup
  - scale to Avalara         |
| 1099s                 | **Stripe Connect auto**   | Zero effort                          |
| Volume discount       | **Negotiate at $100K/mo** | Typical 0.2% reduction               |
| Alternative processor | **Evaluate at $1M/yr**    | Migration cost vs savings            |

---

## References

- [Stripe Pricing](https://stripe.com/pricing)
- [Stripe Connect](https://stripe.com/connect)
- [Stripe Tax](https://stripe.com/tax)
- [Merchant of Record Guide](https://www.adyen.com/knowledge-hub/merchant-of-record)
- [Payment Processing Fees](https://www.nerdwallet.com/article/small-business/payment-processing-fees)
- [Interchange Optimization](https://www.cardfellow.com/blog/interchange-optimization/)

---

_Research completed 2026-02-12. Ready for payment architecture decisions._
