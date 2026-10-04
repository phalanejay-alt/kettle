# How to Connect KETTLE to Cloudflare & Add Your API Key

## Quick Start (5 Minutes)

### Step 1: Get Your Cloudflare API Key

1. Go to https://dash.cloudflare.com
2. Login with your account
3. Click your profile icon (bottom left)
4. Select "API Tokens"
5. Click "Create Token"
6. Choose "Edit Cloudflare Workers" template
7. Click "Use this template"
8. Review permissions (should be automatic)
9. Click "Create Token"
10. **Copy the token** (save it somewhere safe)

This is your CLOUDFLARE_API_TOKEN.

---

### Step 2: Get Your Cloudflare Account ID

1. Still in https://dash.cloudflare.com
2. Go to any domain or just stay on home
3. On the right side, find "Account ID"
4. **Copy it**

This is your CLOUDFLARE_ACCOUNT_ID.

---

### Step 3: Add Environment Variables to Your Local Machine

**On Mac/Linux:**
```bash
export CLOUDFLARE_API_TOKEN="paste_your_token_here"
export CLOUDFLARE_ACCOUNT_ID="paste_your_account_id_here"
```

**On Windows (PowerShell):**
```powershell
$env:CLOUDFLARE_API_TOKEN = "paste_your_token_here"
$env:CLOUDFLARE_ACCOUNT_ID = "paste_your_account_id_here"
```

Or create a `.env` file:
```
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

Then load it:
```bash
source .env
```

---

### Step 4: Login to Wrangler (Cloudflare's CLI tool)

```bash
npx wrangler login
```

This opens your browser. Click "Allow" to authorize Wrangler to manage your Workers.

---

### Step 5: Configure Your Base Wallet

Edit `.env.local` with your Base wallet address:

```
BASE_WALLET_ADDRESS=0xYOUR_BASE_WALLET_ADDRESS_HERE
USDC_CONTRACT_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
BASE_RPC_URL=https://mainnet.base.org
FEE_AMOUNT_USDC=5000
```

Replace `0xYOUR_BASE_WALLET_ADDRESS_HERE` with your actual Base mainnet wallet (starts with 0x).

Example:
```
BASE_WALLET_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
```

---

### Step 6: Set Cloudflare Worker Secrets

These are your payment parameters stored securely in Cloudflare:

```bash
npx wrangler secret put BASE_WALLET_ADDRESS --env production
npx wrangler secret put USDC_CONTRACT_BASE --env production
npx wrangler secret put BASE_RPC_URL --env production
npx wrangler secret put FEE_AMOUNT_USDC --env production
```

When each prompt appears, copy the value from your `.env.local` and paste it.

Example for BASE_WALLET_ADDRESS:
```
? Enter a secret value: › 0x1234567890abcdef1234567890abcdef12345678
```

---

### Step 7: Deploy to Cloudflare

```bash
npx wrangler deploy --env production
```

Output will show:
```
✓ Uploaded kettle (1.23 sec)
✓ Published to https://kettle.YOUR-USERNAME.workers.dev
```

**Save this URL.** This is your live API endpoint.

---

## Now You Have Your API Key

Your API key is your **Cloudflare Worker URL**.

It looks like:
```
https://kettle.YOUR-USERNAME.workers.dev
```

You use it like this:

### Request without payment (returns 402):
```bash
curl -X POST https://kettle.YOUR-USERNAME.workers.dev/v1/check-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

### Request with payment (returns 200):
```bash
curl -X POST https://kettle.YOUR-USERNAME.workers.dev/v1/check-url \
  -H "Content-Type: application/json" \
  -H "x-payment: {\"txHash\":\"0xYOUR_TX_HASH\",\"amount\":\"5000\"}" \
  -d '{"url":"https://example.com"}'
```

---

## How Your API Key Works

1. **No traditional API key needed** - x402 uses on-chain payment verification
2. **Payment is the authentication** - clients send USDC, you verify on Base
3. **Your wallet receives payments** - directly, no middleman
4. **Cloudflare hosts the Worker** - your code runs on Cloudflare's servers globally

---

## Where Payments Go

When a client pays:
1. Client sends 0.005 USDC on Base mainnet
2. Sends payment to: `BASE_WALLET_ADDRESS` (your wallet)
3. You receive the USDC directly in your wallet
4. Monitor at: https://basescan.org (search your wallet address)

---

## Testing Everything

### Test 1: Health Check
```bash
curl https://kettle.YOUR-USERNAME.workers.dev/health
```

Should return:
```json
{
  "ok": true,
  "service": "KETTLE",
  "status": "healthy"
}
```

### Test 2: Check Capabilities
```bash
curl https://kettle.YOUR-USERNAME.workers.dev/v1/capabilities
```

Should return your pricing and network info.

### Test 3: Unpaid Request (HTTP 402)
```bash
curl -X POST https://kettle.YOUR-USERNAME.workers.dev/v1/check-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

Should return:
```json
{
  "code": 402,
  "error": "Payment Required (x402)",
  "payment_required": {
    "amount": "5000",
    "amount_usdc": "0.005",
    "recipient": "0xYOUR_WALLET"
  }
}
```

### Test 4: Paid Request (HTTP 200)

First, send 0.005 USDC to your wallet on Base (testnet or mainnet).

Then:
```bash
curl -X POST https://kettle.YOUR-USERNAME.workers.dev/v1/check-url \
  -H "Content-Type: application/json" \
  -H "x-payment: {\"txHash\":\"0xYOUR_REAL_TX_HASH\",\"amount\":\"5000\"}" \
  -d '{"url":"https://example.com"}'
```

Should return:
```json
{
  "ok": true,
  "payment": {
    "verified": true,
    "tx_hash": "0xYOUR_TX_HASH",
    "amount_usdc": "0.005000"
  },
  "result": {
    "ok": true,
    "status": 200,
    "title": "Example Domain"
  }
}
```

---

## Summary

| Item | Value |
|------|-------|
| Your API Endpoint | https://kettle.YOUR-USERNAME.workers.dev |
| API Key Type | x402 (payment-based) |
| Authentication | USDC on Base mainnet |
| Fee | 0.005 USDC per request |
| Payment Recipient | Your Base wallet (0x...) |
| Payment Network | Base mainnet (chain ID 8453) |
| Hosting | Cloudflare Workers (free tier) |
| Revenue Tracking | Monitor your Base wallet at basescan.org |

---

## Real Next Steps

1. ✅ Get Cloudflare API token
2. ✅ Get Cloudflare Account ID
3. ✅ Set environment variables
4. ✅ Login to Wrangler
5. ✅ Configure your Base wallet
6. ✅ Set Cloudflare secrets
7. ✅ Deploy with `npx wrangler deploy --env production`
8. ✅ Test the health endpoint
9. ✅ Test the 402 unpaid flow
10. ✅ Send a real USDC payment and test the paid flow
11. ✅ Monitor your wallet at basescan.org for incoming payments

That's it. Your API is now live and accepting payments on Base mainnet.
