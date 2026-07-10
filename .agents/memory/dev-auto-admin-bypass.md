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
