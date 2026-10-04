import { createPublicClient, decodeEventLog, http, parseAbi } from "viem";
import { base } from "viem/chains";

const APP_NAME = "KETTLE";
const VERSION = "1.0.0";
const DEFAULT_FEE_MICRO = "5000"; // 0.005 USDC
const USDC_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, x-payment",
    },
  });
}

function normalizeAddress(value) {
  return String(value || "").toLowerCase().trim();
}

function isValidHttpUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) && !!u.hostname;
  } catch {
    return false;
  }
}

function rejectPrivateHostname(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") return true;
  if (host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("172.")) return true;
  if (host === "metadata.google.internal" || host === "metadata") return true;
  return false;
}

async function verifyBaseUsdcPayment({ txHash, expectedAmountMicrounits, recipient, env }) {
  if (!txHash) {
    return { verified: false, reason: "Missing txHash" };
  }

  const usdcContract = env.USDC_CONTRACT_BASE || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const rpcUrl = env.BASE_RPC_URL || "https://mainnet.base.org";

  try {
    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    });

    const receipt = await client.getTransactionReceipt({ hash: txHash });
    if (!receipt || receipt.status !== "success") {
      return { verified: false, reason: "Transaction unsuccessful or not found" };
    }

    const required = BigInt(expectedAmountMicrounits || DEFAULT_FEE_MICRO);
    let found = false;

    for (const log of receipt.logs || []) {
      if (normalizeAddress(log.address) !== normalizeAddress(usdcContract)) continue;
      try {
        const decoded = decodeEventLog({
          abi: USDC_ABI,
          data: log.data,
          topics: log.topics,
        });

        const to = normalizeAddress(decoded.args.to);
        const value = decoded.args.value || 0n;

        if (to === normalizeAddress(recipient) && value >= required) {
          found = true;
          break;
        }
      } catch {
        // Ignore unrelated logs
      }
    }

    if (!found) {
      return { verified: false, reason: "USDC transfer not found or amount below required threshold" };
    }

    return {
      verified: true,
      txHash,
      amountMicrounits: expectedAmountMicrounits || DEFAULT_FEE_MICRO,
    };
  } catch (error) {
    return { verified: false, reason: String(error.message || error) };
  }
}

async function fetchUrlForCheck(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Kettle/1.0 (+x402)",
        "accept": "text/html,application/json,*/*;q=0.9",
      },
    });

    let html = await response.text();
    if (html.length > 262144) html = html.slice(0, 262144);

    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 200) : "";

    return {
      ok: true,
      status: response.status,
      title,
      content_type: response.headers.get("content-type"),
      bytes: html.length,
      checked_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error.message || error),
      checked_at: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Content-Type, x-payment",
        },
      });
    }

    if (request.method === "GET" && pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: APP_NAME,
        version: VERSION,
        status: "healthy",
        network: "base",
        chain_id: 8453,
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method === "GET" && pathname === "/v1/capabilities") {
      return jsonResponse({
        ok: true,
        service: APP_NAME,
        version: VERSION,
        x402: true,
        usdc_payment: true,
        min_fee_usdc: "0.005",
        fee_microunits: DEFAULT_FEE_MICRO,
        payment_token: env.USDC_CONTRACT_BASE || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        recipient: env.BASE_WALLET_ADDRESS || "0x",
        network: "Base",
      });
    }

    if (request.method === "GET" && pathname === "/v1/stats") {
      return jsonResponse({
        ok: true,
        total_revenue_usdc: 0,
        total_verified_payments: 0,
        total_checks: 0,
        status: "VERIFIED",
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method === "POST" && pathname === "/v1/check-url") {
      try {
        const body = await request.json().catch(() => ({}));
        const targetUrl = String(body.url || "").trim();

        if (!targetUrl || !isValidHttpUrl(targetUrl)) {
          return jsonResponse({ ok: false, error: "Valid http/https URL required" }, 400);
        }

        const parsed = new URL(targetUrl);
        if (rejectPrivateHostname(parsed.hostname)) {
          return jsonResponse({ ok: false, error: `Private or local target rejected: ${parsed.hostname}` }, 400);
        }

        const paymentHeader = request.headers.get("x-payment");
        if (!paymentHeader) {
          return jsonResponse(
            {
              code: 402,
              error: "Payment Required (x402)",
              payment_required: {
                amount: DEFAULT_FEE_MICRO,
                amount_usdc: "0.005",
                token: env.USDC_CONTRACT_BASE || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                recipient: env.BASE_WALLET_ADDRESS || "0x",
                network: "base",
                chain_id: 8453,
                rpc: env.BASE_RPC_URL || "https://mainnet.base.org",
                instruction: "Send 0.005 USDC on Base mainnet to the recipient, then retry with x-payment header containing txHash and amount",
              },
            },
            402
          );
        }

        let payment;
        try {
          const raw = paymentHeader.trim();
          if (raw.startsWith("{")) {
            payment = JSON.parse(raw);
          } else {
            payment = JSON.parse(atob(raw));
          }
        } catch {
          return jsonResponse({ ok: false, error: "Invalid x-payment payload" }, 400);
        }

        const txHash = payment.txHash || payment.tx_hash;
        const requiredAmount = String(payment.amount || env.FEE_AMOUNT_USDC || DEFAULT_FEE_MICRO);

        const verification = await verifyBaseUsdcPayment({
          txHash,
          expectedAmountMicrounits: requiredAmount,
          recipient: env.BASE_WALLET_ADDRESS,
          env,
        });

        if (!verification.verified) {
          return jsonResponse(
            { ok: false, error: "Payment verification failed", details: verification.reason },
            402
          );
        }

        const result = await fetchUrlForCheck(targetUrl);

        return jsonResponse({
          ok: true,
          payment: {
            verified: true,
            tx_hash: txHash,
            amount_usdc: (Number(requiredAmount) / 1_000_000).toFixed(6),
            network: "base",
            chain_id: 8453,
          },
          result,
          metadata: {
            service: APP_NAME,
            version: VERSION,
            checked_at: new Date().toISOString(),
          },
        }, 200);
      } catch (error) {
        return jsonResponse(
          { ok: false, error: "Server error", details: String(error.message || error) },
          500
        );
      }
    }

    return jsonResponse({ ok: false, error: "Endpoint not found" }, 404);
  },
};
