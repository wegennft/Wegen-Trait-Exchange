---
name: Express router.use() middleware must be path-scoped when mounted at app root
description: Unscoped router.use(middleware) inside a sub-router mounted without a path prefix intercepts ALL requests reaching the app, not just that router's own routes.
---

When a sub-router is mounted via `app.use(subRouter)` (no path prefix) or `router.use(subRouter)`, every incoming request is passed into that sub-router looking for a matching layer. If the sub-router's *first* layer is `router.use(someMiddleware)` with **no path argument**, that middleware matches unconditionally and runs for every request that reaches it — even ones that will never match any route actually defined in that sub-router. If the middleware short-circuits (e.g. returns 401), it blocks all later-mounted routers/routes from ever being reached.

**Why:** discovered while adding admin-auth middleware to an Express route file. `router.use(requireAdmin)` (unscoped) at the top of an admin routes file, mounted at the app root, caused unrelated public endpoints (`/api/health`, `/api/legends`, etc.) mounted after it to return 401 too, because the admin router's blanket auth middleware ran before Express ever got to check whether the request path matched an admin route.

**How to apply:** when adding auth/guard middleware to one router among several mounted at the same root level, always scope it to the specific path prefix that router owns: `router.use("/admin", requireAdmin)` instead of `router.use(requireAdmin)`. Verify by curling a few unrelated, non-admin endpoints after the change to confirm they still return 200/normal codes, not 401/403.
