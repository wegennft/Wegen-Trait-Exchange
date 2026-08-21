import type { Eip1193Provider } from "ethers";
import type { WalletId } from "./types";

export interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface Eip6963ProviderDetail {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
}

/** Known reverse-DNS identifiers for popular wallets (EIP-6963). */
export const WALLET_RDNS: Partial<Record<WalletId, string[]>> = {
  metamask: ["io.metamask", "io.metamask.flask"],
  rabby: ["io.rabby"],
  phantom: ["app.phantom"],
  coinbase: ["com.coinbase.wallet"],
  rainbow: ["me.rainbow"],
  backpack: ["app.backpack"],
  okx: ["com.okex.wallet", "com.okx.wallet"],
  brave: ["com.brave.wallet"],
  trust: ["com.trustwallet.app"],
};

const discovered = new Map<string, Eip6963ProviderDetail>();
let listening = false;

function isEip1193Provider(provider: unknown): provider is Eip1193Provider {
  return (
    !!provider &&
    typeof provider === "object" &&
    typeof (provider as Eip1193Provider).request === "function"
  );
}

function onAnnounce(event: Event) {
  const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
  if (detail?.info?.rdns && isEip1193Provider(detail.provider)) {
    discovered.set(detail.info.rdns, detail);
  }
}

/** Start listening for wallet announcements (call once on app load). */
export function startEip6963Discovery(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

/** Ask all installed wallets to announce themselves; resolves after a short window. */
export function requestEip6963Providers(
  timeoutMs = 600,
): Promise<Map<string, Eip6963ProviderDetail>> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(new Map());
      return;
    }

    startEip6963Discovery();
    const batch = new Map<string, Eip6963ProviderDetail>();

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (detail?.info?.rdns && isEip1193Provider(detail.provider)) {
        batch.set(detail.info.rdns, detail);
        discovered.set(detail.info.rdns, detail);
      }
    };

    window.addEventListener("eip6963:announceProvider", handler);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", handler);
      resolve(batch);
    }, timeoutMs);
  });
}

export function getDiscoveredProviders(): Map<string, Eip6963ProviderDetail> {
  return discovered;
}

export function rdnsToWalletId(rdns: string, name: string): WalletId | null {
  for (const [id, rdnsList] of Object.entries(WALLET_RDNS) as [WalletId, string[]][]) {
    if (rdnsList.includes(rdns)) return id;
  }

  const n = name.toLowerCase();
  if (n.includes("metamask")) return "metamask";
  if (n.includes("rabby")) return "rabby";
  if (n.includes("phantom")) return "phantom";
  if (n.includes("backpack")) return "backpack";
  if (n.includes("coinbase")) return "coinbase";
  if (n.includes("rainbow")) return "rainbow";
  if (n.includes("okx")) return "okx";
  if (n.includes("trust")) return "trust";
  if (n.includes("brave")) return "brave";
  return null;
}

/** Resolve an isolated EIP-6963 provider for a wallet id (avoids Rabby/MetaMask hijacking). */
export function getEip6963Provider(walletId: WalletId): Eip1193Provider | null {
  const rdnsList = WALLET_RDNS[walletId];
  if (!rdnsList) return null;
  for (const rdns of rdnsList) {
    const detail = discovered.get(rdns);
    if (detail && isEip1193Provider(detail.provider)) return detail.provider;
  }
  return null;
}

export function hasMultipleEvmWallets(): boolean {
  return discovered.size > 1;
}
