---
name: No shared trait card component
description: Store/BundlesPoints/Bounties/Sandbox pages each implement their own card markup inline instead of sharing a component.
---

Each of the four trait-store pages (Store.tsx, BundlesPoints.tsx, Bounties.tsx, Sandbox.tsx) hand-rolls its own display-item card markup — there is no shared `TraitCard`/`ItemCard` component.

**Why:** discovered while adding a gold-glow border treatment: a single shared CSS class (`.item-glow-gold`) could be reused, but it had to be manually wired into ~7 separate card instances across the four files since there's no common component to edit once.

**How to apply:** when asked for a visual/behavioral change to "all display items" or "all cards" in this app, expect to touch each page's card markup individually. A shared utility CSS class works well for consistent styling, but don't assume editing one component will propagate everywhere. Also watch for conditional classNames that gate a treatment behind state (e.g. affordability, selection) — those can silently hide a supposedly-universal treatment for large swaths of users (e.g. disconnected wallet).
