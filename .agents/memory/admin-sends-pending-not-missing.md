---
name: Admin sends are pending, not missing
description: Why "user didn't receive traits/points from admin" reports in this project are usually a claim/visibility gap, not a broken send path.
---

Admin-initiated trait airdrops insert directly into the recipient's locker (immediate delivery). Admin-initiated "We Smackz" (points) sends insert a pending transaction row that only credits the wallet's balance once the recipient manually claims it — the balance is not updated at send time.

**Why:** the two delivery mechanisms have different semantics (synchronous insert vs. claim-gated ledger entry), but from the admin's point of view both look like "I sent it." Without visibility into the pending state, "not received" reports look identical to a broken send.

**How to apply:** when investigating "users aren't receiving X" reports for admin-sent traits/points, first check whether the recipient has an unclaimed pending record before assuming the insert/delivery logic is broken. An admin-facing send log with a "confirmed received" vs. "pending claim" status column (added to Admin.tsx as the "Send Log" tab) resolves this ambiguity going forward.
