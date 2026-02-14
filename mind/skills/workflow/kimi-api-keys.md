# Kimi API Keys

*How to get API keys for Bizing AI.*

---

## Two Types of API Keys

Kimi offers two different API access models:

### 1. Metered API (Pay-as-you-go)
- **Portal:** https://platform.moonshot.cn/
- **Billing:** Pay per token used
- **Best for:** Development, variable usage
- **Key format:** `sk-...`

### 2. Subscription API (Fixed price)
- **Portal:** Different from platform — needs clarification
- **Billing:** Fixed monthly subscription
- **Best for:** Production, predictable costs
- **Key format:** `sk-...` (same format, different generation portal)

---

## Metered API (platform.moonshot.cn)

1. Go to https://platform.moonshot.cn/
2. Sign up / log in
3. Verify account (phone/email)
4. Go to **API 密钥管理** (API Key Management)
5. Click **新建** (Create New)
6. Copy the key

---

## Subscription API

**Need to clarify the correct portal.**

Possible locations:
- Business/Enterprise portal (different URL)
- Console after subscribing to a plan
- Separate developer dashboard for subscription accounts

**If you have a subscription:**
- Check your email for welcome/onboarding links
- Look for "Console" or "开发者中心" after logging in
- Check for "API Keys" in account settings

---

## Current Status

**Awaiting clarification on subscription API key generation.**

Once we confirm the correct portal/URL, we'll update this documentation.

---

## For Now

If you have a **subscription API key** already:
1. Add it to `apps/api/.env`:
   ```
   KIMI_API_KEY=sk-your-subscription-key
   ```
2. The code should work with the standard endpoint
3. If it doesn't work, we may need to adjust the base URL

---

## Testing

After adding your key:
```bash
cd apps/api && pnpm dev
```

Then go to `/bizing` and test the chat.

---

## Related

- [[../../knowledge/domain/why-agents-love-bizing|Why Agents Love Bizing]]
- [[../../symbiosis/standup|Standup]]
- [[Talking To Bizing|Talking to Bizing]]
