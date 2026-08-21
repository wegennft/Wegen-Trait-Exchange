import type { Eip1193Provider } from "ethers";

export type WalletId =
  | "metamask"
  | "phantom"
  | "backpack"
  | "coinbase"
  | "okx"
  | "trust"
  | "rabby"
  | "rainbow"
  | "brave"
  | "injected";

export type WalletChain = "evm" | "evm+sol";

export type ConnectStep = "requesting" | "signing" | null;

export interface DetectedWallet {
  id: WalletId;
  name: string;
  provider: Eip1193Provider;
  chain: WalletChain;
}

export interface EvmWalletOption {
  id: WalletId;
  name: string;
  description: string;
  chain: WalletChain;
  installUrl: string;
  color: string;
  iconUrl?: string;
  provider: Eip1193Provider | null;
  installed: boolean;
}
