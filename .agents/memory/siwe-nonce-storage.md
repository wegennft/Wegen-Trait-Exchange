---
name: SIWE nonce storage
description: Wallet sign-in nonces must be durable, not in-memory, or restarts/scaling break in-flight sign-ins.
---

SIWE (Sign-In with Ethereum) nonces are persisted in Postgres (`auth_nonces` table in `@workspace/db`), keyed by wallet address, with a 5-minute TTL enforced by comparing `expiresAt` to `Date.now()`.

**Why:** an in-memory `Map` for nonces loses all in-flight challenges on every server restart and breaks entirely once there is more than one server instance, since the issuing and verifying requests can land on different processes.

**How to apply:** any nonce/challenge/OTP-style value that must survive between two separate HTTP requests (issue → verify) needs a shared durable store (DB table, Redis, etc.), never a process-local `Map` or variable — even for "just a demo" flows, since restarts happen in normal dev/deploy cycles too.
