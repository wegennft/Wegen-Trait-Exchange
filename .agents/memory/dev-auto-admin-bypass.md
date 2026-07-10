---
name: Dev-only auto-admin bypass
description: Pattern for a local-only auth shortcut that can never leak into production.
---

Any "skip login in dev" shortcut must require BOTH `NODE_ENV !== "production"`
AND an explicit opt-in env flag (not just one or the other). Resolve it at a
single `getEffectiveWallet(req)`-style layer that auth middleware calls
instead of reading the session directly, rather than sprinkling `if (bypass)`
branches through each route/middleware.

**Why:** A flag alone can be accidentally left set; an env-check alone still
fires in any non-prod-labeled deploy. Requiring both, and centralizing the
check, keeps the real SIWE/session verification code path completely
untouched — the bypass only changes what "effective wallet" resolves to.

**How to apply:** When adding a dev bypass for wallet/session-gated routes,
add the bypass check inside the shared "who is the current user" helper, and
verify explicitly (curl before/after toggling the flag) that turning the flag
off restores normal 401/403 behavior.

**Drift risk (hit 2026-07-10):** the middleware (`requireWalletOwnership`)
correctly used `getEffectiveWallet(req)`, but several route handlers in the
same file read `req.session.walletAddress!` directly to get the actual wallet
value to query with. Under bypass, that's `undefined` — the middleware lets
the request through, then the handler silently queries with `undefined` and
returns empty/zeroed results instead of erroring. Grep for
`req.session.walletAddress` in route files and make sure every read goes
through `getEffectiveWallet(req)`, not just the auth-check middleware.
