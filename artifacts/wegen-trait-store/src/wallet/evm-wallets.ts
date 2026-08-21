import type { Eip1193Provider } from "ethers";
import type { DetectedWallet, EvmWalletOption, WalletChain, WalletId } from "./types";
import {
  getDiscoveredProviders,
  getEip6963Provider,
  rdnsToWalletId,
  requestEip6963Providers,
  startEip6963Discovery,
} from "./eip6963";

export { requestEip6963Providers, startEip6963Discovery, hasMultipleEvmWallets } from "./eip6963";

type EvmProvider = Eip1193Provider & {
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  isBackpack?: boolean;
  isTrust?: boolean;
  isRainbow?: boolean;
};

type AnyWindow = Window & {
  ethereum?: EvmProvider;
  phantom?: { ethereum?: Eip1193Provider };
  backpack?: { ethereum?: Eip1193Provider; isBackpack?: boolean };
  coinbaseWalletExtension?: Eip1193Provider;
  okxwallet?: Eip1193Provider;
  trustwallet?: { ethereum?: Eip1193Provider };
};

export const WALLET_COLORS: Record<WalletId, string> = {
  metamask: "#E2761B",
  phantom: "#AB9FF2",
  backpack: "#E33E3F",
  coinbase: "#0052FF",
  okx: "#000000",
  trust: "#3375BB",
  rabby: "#8697FF",
  rainbow: "#174299",
  brave: "#FF5500",
  injected: "#6B7280",
};

export const WALLET_ICONS: Partial<Record<WalletId, string>> = {
  metamask: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg",
  phantom:
    "https://raw.githubusercontent.com/phantom-labs/phantom-brand-assets/main/phantom-icon-purple.svg",
  backpack: "https://raw.githubusercontent.com/coral-xyz/backpack/master/assets/backpack.png",
  coinbase:
    "https://raw.githubusercontent.com/coinbase/coinbase-wallet-sdk/master/packages/wallet-sdk/src/assets/coinbaseWalletLogo.svg",
  okx: "https://static.okx.com/cdn/assets/imgs/2211/6BB53EF6A4CF49718CC14EA04EB9E29F.png",
  trust: "https://trustwallet.com/assets/images/media/assets/TWT.png",
  rabby: "https://raw.githubusercontent.com/RabbyHub/Rabby/master/src/_raw/images/icon-128.png",
  rainbow: "https://avatars.githubusercontent.com/u/48327834",
  brave: "https://brave.com/static-assets/images/brave-logo-sans-text.svg",
};

/** Curated EVM wallets — always shown in the picker. */
const EVM_WALLET_CATALOG: Omit<EvmWalletOption, "provider" | "installed">[] = [
  {
    id: "metamask",
    name: "MetaMask",
    description: "Popular Ethereum browser extension & mobile app",
    chain: "evm",
    installUrl: "https://metamask.io/download/",
    color: WALLET_COLORS.metamask,
    iconUrl: WALLET_ICONS.metamask,
  },
  {
    id: "backpack",
    name: "Backpack",
    description: "Multi-chain wallet with Ethereum support",
    chain: "evm+sol",
    installUrl: "https://backpack.app/download",
    color: WALLET_COLORS.backpack,
    iconUrl: WALLET_ICONS.backpack,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    description: "Coinbase self-custody wallet",
    chain: "evm",
    installUrl: "https://www.coinbase.com/wallet/downloads",
    color: WALLET_COLORS.coinbase,
    iconUrl: WALLET_ICONS.coinbase,
  },
  {
    id: "rabby",
    name: "Rabby",
    description: "EVM-focused browser wallet",
    chain: "evm",
    installUrl: "https://rabby.io/",
    color: WALLET_COLORS.rabby,
    iconUrl: WALLET_ICONS.rabby,
  },
  {
    id: "rainbow",
    name: "Rainbow",
    description: "Ethereum wallet for desktop & mobile",
    chain: "evm",
    installUrl: "https://rainbow.me/",
    color: WALLET_COLORS.rainbow,
    iconUrl: WALLET_ICONS.rainbow,
  },
  {
    id: "trust",
    name: "Trust Wallet",
    description: "Mobile-first multi-chain wallet",
    chain: "evm",
    installUrl: "https://trustwallet.com/download",
    color: WALLET_COLORS.trust,
    iconUrl: WALLET_ICONS.trust,
  },
  {
    id: "okx",
    name: "OKX Wallet",
    description: "OKX Web3 wallet",
    chain: "evm+sol",
    installUrl: "https://www.okx.com/web3",
    color: WALLET_COLORS.okx,
    iconUrl: WALLET_ICONS.okx,
  },
  {
    id: "brave",
    name: "Brave Wallet",
    description: "Built into the Brave browser",
    chain: "evm",
    installUrl: "https://brave.com/wallet/",
    color: WALLET_COLORS.brave,
    iconUrl: WALLET_ICONS.brave,
  },
  {
    id: "phantom",
    name: "Phantom",
    description: "Phantom Ethereum provider",
    chain: "evm+sol",
    installUrl: "https://phantom.app/download",
    color: WALLET_COLORS.phantom,
    iconUrl: WALLET_ICONS.phantom,
  },
];

/** Returns injected providers currently available in the browser. */
export function detectWallets(): DetectedWallet[] {
  const w = window as AnyWindow;
  const results: DetectedWallet[] = [];
  const seen = new Set<unknown>();

  const tryAdd = (
    id: WalletId,
    name: string,
    provider: Eip1193Provider | undefined,
    chain: WalletChain = "evm",
  ) => {
    if (!provider?.request || seen.has(provider)) return;
    seen.add(provider);
    results.push({ id, name, provider, chain });
  };

  // EIP-6963 providers first — each wallet gets its own isolated provider object
  for (const detail of getDiscoveredProviders().values()) {
    const id = rdnsToWalletId(detail.info.rdns, detail.info.name);
    if (!id) continue;
    const chain: WalletChain =
      id === "phantom" || id === "backpack" || id === "okx" ? "evm+sol" : "evm";
    tryAdd(id, detail.info.name, detail.provider, chain);
  }

  // Dedicated namespace fallbacks — when EIP-6963 not available yet
  tryAdd("phantom", "Phantom", w.phantom?.ethereum, "evm+sol");
  tryAdd("backpack", "Backpack", w.backpack?.ethereum, "evm+sol");
  tryAdd("coinbase", "Coinbase Wallet", w.coinbaseWalletExtension, "evm");
  tryAdd("okx", "OKX Wallet", w.okxwallet, "evm+sol");
  tryAdd("trust", "Trust Wallet", w.trustwallet?.ethereum, "evm");

  const eth = w.ethereum;
  if (eth?.request && !seen.has(eth)) {
    if (eth.isPhantom) {
      tryAdd("phantom", "Phantom", eth, "evm+sol");
    } else if (eth.isBackpack) {
      tryAdd("backpack", "Backpack", eth, "evm+sol");
    } else if (eth.isCoinbaseWallet) {
      tryAdd("coinbase", "Coinbase Wallet", eth, "evm");
    } else if (eth.isRabby) {
      tryAdd("rabby", "Rabby", eth, "evm");
    } else if (eth.isRainbow) {
      tryAdd("rainbow", "Rainbow", eth, "evm");
    } else if (eth.isBraveWallet) {
      tryAdd("brave", "Brave Wallet", eth, "evm");
    } else if (eth.isMetaMask) {
      tryAdd("metamask", "MetaMask", eth, "evm");
    } else {
      tryAdd("injected", "Browser Wallet", eth, "evm");
    }
  }

  return results;
}

/** Full wallet list for the picker — catalog entries + installed status. */
export function getEvmWalletOptions(): EvmWalletOption[] {
  const detected = detectWallets();
  const byId = new Map<WalletId, DetectedWallet>();
  for (const w of detected) {
    if (!byId.has(w.id)) byId.set(w.id, w);
  }

  const options: EvmWalletOption[] = EVM_WALLET_CATALOG.map((entry) => {
    const match = byId.get(entry.id);
    return {
      ...entry,
      provider: match?.provider ?? null,
      installed: !!match?.provider,
    };
  });

  const generic = byId.get("injected");
  if (generic && !options.some((o) => o.provider === generic.provider)) {
    options.push({
      id: "injected",
      name: "Browser Wallet",
      description: "Generic injected Ethereum provider",
      chain: "evm",
      installUrl: "https://ethereum.org/en/wallets/",
      color: WALLET_COLORS.injected,
      provider: generic.provider,
      installed: true,
    });
  }

  return options;
}

export function getInstalledWallet(id: WalletId): DetectedWallet | undefined {
  const eip6963 = getEip6963Provider(id);
  if (eip6963) {
    const catalog = EVM_WALLET_CATALOG.find((e) => e.id === id);
    return {
      id,
      name: catalog?.name ?? id,
      provider: eip6963,
      chain: catalog?.chain ?? "evm",
    };
  }

  // Phantom: always use window.phantom.ethereum — never a Rabby-proxied provider
  if (id === "phantom") {
    const phantomEth = (window as AnyWindow).phantom?.ethereum;
    if (phantomEth?.request) {
      return { id: "phantom", name: "Phantom", provider: phantomEth, chain: "evm+sol" };
    }
  }

  return detectWallets().find((w) => w.id === id);
}

export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
