---
name: Admin sends are pending, not missing
description: Why "user didn't receive traits/points from admin" reports in this project are usually a claim/visibility gap, not a broken send path — but check these real bugs first.
---

Admin-initiated trait airdrops insert directly into the recipient's locker (immediate delivery). Admin-initiated "We Smackz" (points) sends insert a pending transaction row that only credits the wallet's balance once the recipient manually claims it — the balance is not updated at send time.

**Why:** the two delivery mechanisms have different semantics (synchronous insert vs. claim-gated ledger entry), but from the admin's point of view both look like "I sent it." Without visibility into the pending state, "not received" reports look identical to a broken send.

**How to apply:** when investigating "users aren't receiving X" reports for admin-sent traits/points, check for these real bugs (found and fixed 2026-07-10) before assuming it's just a visibility gap:
1. Any endpoint reading `db.execute(sql\`...\`)` (node-postgres) must destructure `.rows`, not the result directly — it is not iterable. A silent `TypeError: ... is not iterable` 500 here previously broke `/bounties/me` (rank + purchase-limit checks), hiding all pending points/history from users.
2. Wallet addresses must be lowercased at every write path (`awardPoints` helper), not just some. A mixed-case admin-entered wallet address silently fails to match the lowercased wallet used by all read queries — the send "succeeds" but the points/trait are permanently invisible to that user.
3. Any Drizzle `select()` for a shared Zod-validated response type (e.g. `Trait`) must include every required schema field. A locker endpoint selecting a partial column subset threw a `ZodError` 500 on every request for any wallet with items — users could never see their locker at all, making delivered items look "not received."

If none of the above reproduce, then it likely is the pending/claim visibility gap described above — the admin-facing "Send Log" tab in Admin.tsx resolves that ambiguity.
