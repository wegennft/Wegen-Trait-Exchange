---
name: USD-primary pricing pattern
description: How trait/bundle/point-pack prices work when the admin-set price is USD but purchases settle in ETH.
---

Admins set a fixed USD price (`priceUsd`, stored as a string to avoid floating point issues) as the source of truth. The ETH-denominated fields (`priceEth`, `priceWei`) are always derived server-side from a live ETH/USD rate and re-snapshotted whenever `priceUsd` changes (on create/update), never accepted as client input.

At purchase time, the ETH amount actually charged (`ethAmount`) and the rate used (`ethPriceAtPurchase`) are computed server-side and persisted on the purchase/transaction record — the client-submitted ETH amount is never trusted, since the live rate can move between page load and purchase confirmation.

If the live rate is unavailable, the relevant endpoint fails with a 503 rather than falling back to a stale or hardcoded rate.

**Why:** ETH price is volatile; trusting a client-supplied ETH amount would let a client under-pay or over-pay relative to the admin's real USD price. Snapshotting the rate at purchase time also gives an accurate historical record without retroactively re-pricing past purchases when prices or rates change later.

**How to apply:** This pattern already covers point packs, and was extended to trait and bundle purchases. Any new purchasable/priceable entity in this codebase should follow the same shape: `priceUsd` as the editable source of truth, `priceEth`/`priceWei` derived and reset on save, and `ethAmount`/`ethPriceAtPurchase` (or equivalent) captured server-side at the moment of purchase. The rate lookup lives in `artifacts/api-server/src/lib/ethPriceService.ts` (`getEthUsdRate()`, throws `EthPriceUnavailableError`).
