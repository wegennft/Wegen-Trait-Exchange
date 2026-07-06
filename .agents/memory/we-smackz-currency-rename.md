---
name: We Smackz currency rename
description: Points currency was renamed to "We Smackz" across user-facing UI; admin panel intentionally excluded from the rename.
---

The in-app points currency is branded "We Smackz" in full form (headers, titles, marketing copy) and "Smackz" as a short inline suffix (e.g. "1,500 Smackz" instead of "1,500 pts").

**Why:** The user explicitly wanted the customer-facing currency name changed, but scoped it to customer-facing pages only — the admin panel is internal-only and wasn't part of the ask, so it still uses "Points"/"pts" terminology.

**How to apply:** When touching Bounties, BundlesPoints/Packs, or Store balance displays, use "We Smackz" for titles and "Smackz" inline. Do not extend the rename into Admin.tsx unless explicitly requested — keep that page's original "Points" language for internal consistency with its own scope. A reusable `SmackzCoin` component (`components/SmackzCoin.tsx`) renders a small spinning gold coin badge (CSS `rotateY` animation) and should be used anywhere a Smackz balance is displayed.
