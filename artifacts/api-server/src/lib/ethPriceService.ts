import { logger } from "./logger";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
const CACHE_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 8_000;

let cachedRate: number | null = null;
let cachedAt = 0;
let inFlight: Promise<number> | null = null;

export class EthPriceUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Live ETH/USD rate is currently unavailable. Please try again shortly.");
    this.name = "EthPriceUnavailableError";
    if (cause) this.cause = cause;
  }
}

async function fetchRateFromCoinGecko(): Promise<number> {
  const res = await fetch(COINGECKO_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`CoinGecko responded with status ${res.status}`);
  }
  const json = (await res.json()) as { ethereum?: { usd?: number } };
  const usd = json.ethereum?.usd;
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) {
    throw new Error("CoinGecko returned an invalid ETH/USD rate");
  }
  return usd;
}

/**
 * Returns the current ETH/USD rate, using a short-lived in-memory cache so
 * admin saves, store display, and purchase endpoints all agree on a single
 * trusted, server-fetched rate within the same time window.
 *
 * Throws EthPriceUnavailableError if the live rate cannot be fetched and no
 * cached value is fresh enough to use — callers must not fall back to a
 * guessed or stale rate for purchase-time calculations.
 */
export async function getEthUsdRate(): Promise<number> {
  const now = Date.now();
  if (cachedRate !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedRate;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const rate = await fetchRateFromCoinGecko();
      cachedRate = rate;
      cachedAt = Date.now();
      return rate;
    } catch (err) {
      logger.error({ err }, "Failed to fetch live ETH/USD rate");
      throw new EthPriceUnavailableError(err);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Computes the ETH amount (as a decimal string) owed for a given USD price,
 * using the live server-fetched ETH/USD rate. Returns both the ETH amount
 * and the rate used so it can be persisted alongside a purchase record.
 */
export async function convertUsdToEth(
  usdAmount: number,
): Promise<{ ethAmount: string; ethPriceAtPurchase: string }> {
  const rate = await getEthUsdRate();
  const eth = usdAmount / rate;
  return {
    ethAmount: eth.toFixed(18).replace(/0+$/, "").replace(/\.$/, "") || "0",
    ethPriceAtPurchase: rate.toString(),
  };
}
