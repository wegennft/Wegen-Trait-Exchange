import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";

type CoinGeckoResponse = {
  ethereum: {
    usd: number;
    usd_24h_change: number;
  };
};

export type EthPriceData = {
  usd: number;
  change24h: number;
  direction: "up" | "down" | "flat";
};

export function useEthPrice() {
  const prevRef = useRef<number | null>(null);

  const { data, isLoading, isError } = useQuery<EthPriceData>({
    queryKey: ["eth-live-price"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true",
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error("CoinGecko fetch failed");
      const json: CoinGeckoResponse = await res.json();
      const usd = json.ethereum.usd;
      const change24h = json.ethereum.usd_24h_change ?? 0;

      const prev = prevRef.current;
      const direction: "up" | "down" | "flat" =
        prev === null ? "flat" : usd > prev ? "up" : usd < prev ? "down" : "flat";
      prevRef.current = usd;

      return { usd, change24h, direction };
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: 2,
  });

  return {
    ethUsd: data?.usd ?? null,
    change24h: data?.change24h ?? null,
    direction: data?.direction ?? "flat",
    isLoading,
    isError,
  };
}

export function formatUsd(ethAmount: string | number, ethUsd: number | null): string | null {
  if (ethUsd === null) return null;
  const eth = typeof ethAmount === "string" ? parseFloat(ethAmount) : ethAmount;
  if (isNaN(eth)) return null;
  const usd = eth * ethUsd;
  if (usd < 0.01) return "<$0.01";
  if (usd < 10) return `$${usd.toFixed(2)}`;
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
