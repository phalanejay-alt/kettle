#!/usr/bin/env bash
set -euo pipefail

echo "Setting KETTLE Cloudflare Worker secrets..."

if [ -f .env.example ]; then
  source .env.example
fi

read -p "Base wallet address (0x...): " BASE_WALLET_ADDRESS
read -p "USDC contract (default: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913): " USDC_CONTRACT_BASE
USDC_CONTRACT_BASE=${USDC_CONTRACT_BASE:-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}

read -p "Base RPC URL (default: https://mainnet.base.org): " BASE_RPC_URL
BASE_RPC_URL=${BASE_RPC_URL:-https://mainnet.base.org}

read -p "Fee in microunits (default: 5000 = 0.005 USDC): " FEE_AMOUNT_USDC
FEE_AMOUNT_USDC=${FEE_AMOUNT_USDC:-5000}

npx wrangler secret put BASE_WALLET_ADDRESS --env production --text "$BASE_WALLET_ADDRESS"
npx wrangler secret put USDC_CONTRACT_BASE --env production --text "$USDC_CONTRACT_BASE"
npx wrangler secret put BASE_RPC_URL --env production --text "$BASE_RPC_URL"
npx wrangler secret put FEE_AMOUNT_USDC --env production --text "$FEE_AMOUNT_USDC"

echo "Secrets set. Run: npx wrangler deploy"
