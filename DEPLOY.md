# KETTLE x402 Deployment & Setup Guide

## Final Production Setup

This is the complete, final deployment package for KETTLE.

---

## Prerequisites

1. **Node.js 18+**
   ```bash
   node --version
   ```

2. **Cloudflare Account** (free tier works)
   - Sign up at https://dash.cloudflare.com

3. **Base Mainnet Wallet**
   - MetaMask, Coinbase Wallet, or any EVM wallet
   - Must have access to your Base wallet address (0x...)
   - Optional: Some USDC or ETH for testing (not required to run)

4. **GitHub Account** (already have it)

---

## Step 1: Install Dependencies

```bash
npm install
npx wrangler --version
```

If wrangler is not installed:
```bash
npm install -D wrangler
```

---

## Step 2: Configure Environment

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:
```
BASE_WALLET_ADDRESS=0xYOUR_BASE_WALLET_HERE
USDC_CONTRACT_BASE=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
BASE_RPC_URL=https://mainnet.base.org
FEE_AMOUNT_USDC=5000
```

**Important:**
- BASE_WALLET_ADDRESS: Your Base mainnet wallet address (starts with 0x)
- FEE_AMOUNT_USDC: 5000 = 0.005 USDC (do not change unless intentional)

---

## Step 3: Login to Cloudflare

```bash
npx wrangler login
```

This opens a browser window. Log in with your Cloudflare account and authorize.

---

## Step 4: Set Cloudflare Secrets

Run the deployment script:
```bash
chmod +x deploy.sh
./deploy.sh
```

Or manually set each secret:
```bash
npx wrangler secret put BASE_WALLET_ADDRESS --env production
npx wrangler secret put USDC_CONTRACT_BASE --env production
npx wrangler secret put BASE_RPC_URL --env production
npx wrangler secret put FEE_AMOUNT_USDC --env production
```

When prompted, enter your values (copy from .env.local).

---

## Step 5: Deploy the Worker

```bash
npx wrangler deploy --env production
```

Output will show your worker URL:
```
✓ Uploaded kettle (1.23 sec)
✓ Published to https://kettle.YOUR-USERNAME.workers.dev
```

**Save this URL.** You'll use it to make API calls.

---

## Step 6: Test the Deployment

### Test 1: Health Check

```bash
curl https://kettle.YOUR-USERNAME.workers.dev/health
```

Expected response:
```json
{
  "ok": true,
  "service": "KETTLE",
  "version": "1.0.0",
  "status": "healthy",
  "network": "base",
  "chain_id": 8453
}
```

### Test 2: Capabilities

```bash
curl https://kettle.YOUR-USERNAME.workers.dev/v1/capabilities
```

Expected response includes your pricing and network details.

### Test 3: Unpaid Request (HTTP 402)

```bash
curl -X POST https://kettle.YOUR-USERNAME.workers.dev/v1/check-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

Expected response (HTTP 402):
```json
{
  "code": 402,
  "error": "Payment Required (x402)",
  "payment_required": {
    "amount": "5000",
    "amount_usdc": "0.005",
    "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "recipient": "0xYOUR_WALLET",
    "network": "base",
    "chain_id": 8453,
    "rpc": "https://mainnet.base.org",
    "instruction": "Send 0.005 USDC on Base mainnet to recipient, then retry with x-payment header"
  }
}
```

---

## Step 7: Test a Real Payment (Optional)

### Option A: Send Real USDC on Base

1. Open your Base wallet (MetaMask with Base selected)
2. Get some USDC on Base (bridge from mainnet or buy on a DEX)
3. Send 0.005 USDC to your recipient wallet from Test 3
4. Wait 30-60 seconds for confirmation
5. Copy the transaction hash (0x...)

### Option B: Use a Testnet (Recommended for Testing)

Base Sepolia testnet allows free test USDC:
1. Switch wallet to Base Sepolia
2. Get testnet USDC from a faucet
3. Send to your testnet wallet
4. Get the tx hash

### Test a Paid Request

```bash
curl -X POST https://kettle.YOUR-USERNAME.workers.dev/v1/check-url \
  -H "Content-Type: application/json" \
  -H "x-payment: {\"txHash\":\"0xYOUR_REAL_TX_HASH\",\"amount\":\"5000\"}" \
  -d '{"url":"https://example.com"}'
```

Expected response (HTTP 200):
```json
{
  "ok": true,
  "payment": {
    "verified": true,
    "tx_hash": "0xYOUR_TX_HASH",
    "amount_usdc": "0.005000",
    "network": "base",
    "chain_id": 8453
  },
  "result": {
    "ok": true,
    "status": 200,
    "title": "Example Domain",
    "content_type": "text/html; charset=UTF-8",
    "bytes": 1256,
    "checked_at": "2026-10-04T16:15:32.123Z"
  },
  "metadata": {
    "service": "KETTLE",
    "version": "1.0.0",
    "checked_at": "2026-10-04T16:15:32.123Z"
  }
}
```

---

## Step 8: Enable GitHub Pages Dashboard

1. Go to your repo settings: https://github.com/phalanejay-alt/kettle/settings/pages
2. Set "Source" to "Deploy from a branch"
3. Select branch: `main`
4. Select folder: `/docs`
5. Save

Your dashboard will be live at: https://phalanejay-alt.github.io/kettle/

---

## Final Production Checklist

✅ **Deployment**
- [ ] npm install completed
- [ ] Cloudflare login successful
- [ ] Secrets set in Cloudflare
- [ ] Worker deployed
- [ ] Worker URL saved

✅ **Testing**
- [ ] /health returns 200
- [ ] /v1/capabilities returns pricing
- [ ] unpaid /v1/check-url returns 402
- [ ] paid /v1/check-url returns 200 (optional, but recommended)

✅ **Public**
- [ ] GitHub repo is public
- [ ] docs/index.html is accessible
- [ ] README is clear

✅ **Production**
- [ ] BASE_WALLET_ADDRESS is set to YOUR wallet
- [ ] FEE_AMOUNT_USDC is 5000
- [ ] Worker is on production env
- [ ] No test secrets remain

---

## Real Revenue Tracking

Revenue only comes from verified payments:

1. **Every paid request** that passes payment verification is counted
2. **The amount** is 0.005 USDC per verified check
3. **The wallet** receives direct USDC transfers

To track revenue:
- Monitor your Base wallet at https://basescan.org
- Search for your wallet address
- Look for incoming USDC transfers
- Each transfer = verified payment

Example:
- 100 verified checks = 0.5 USDC
- 1,000 verified checks = 5 USDC
- 10,000 verified checks = 50 USDC

---

## Important Reality

✅ **This is a real, working payment-verified API**

❌ **This does NOT guarantee automatic revenue**

Revenue depends on:
1. Real demand from users or agents
2. Real USDC payments sent by customers
3. Real adoption and usage

A low fee (0.005 USDC) helps adoption, but adoption itself requires:
- discoverability
- integration into existing tools
- marketing / word of mouth
- real business value

---

## Next Steps After Deployment

1. **Test thoroughly** with a real Base transaction
2. **Share your worker URL** in relevant communities
3. **Integrate into agent frameworks** (Langchain, AutoGPT, etc.)
4. **Track verified revenue** by monitoring your wallet
5. **Iterate based on usage** patterns

---

## Troubleshooting

### 402 response but wrong wallet
Check that BASE_WALLET_ADDRESS secret matches your actual wallet.

### Payment verification fails
- Confirm the tx hash is on Base mainnet (not Sepolia or another chain)
- Confirm USDC was sent TO your wallet address
- Confirm the amount is at least 0.005 USDC (5000 microunits)

### Worker deployment fails
- Run `npx wrangler login` again
- Check wrangler version: `npx wrangler --version`
- Try `npm install -D wrangler@latest`

### Secrets not set
Run individually:
```bash
npx wrangler secret put BASE_WALLET_ADDRESS --env production --text "0x..."
```

---

## Support

- Cloudflare Docs: https://developers.cloudflare.com/workers/
- Base Network: https://base.org
- USDC: https://www.circle.com/usdc
- x402 Spec: https://github.com/cloudflare/x402

---

## Final Note

This is the complete, production-ready KETTLE x402 payment system. It is not a guaranteed money machine. It is a real technical system that can verify payments and serve a low-fee API. Profit depends on real usage.

Deploy it. Test it. Track real revenue. Then scale what works.
