---
name: Vault-linked bounty rewards
description: How bounty reward traits can optionally be linked to a real vault trait so redemption delivers an actual trait to the locker.
---

Bounty reward traits (`bountyTraitsTable`) can carry an optional `sourceTraitId` pointing at a row in `traitsTable`. When set:
- Admin create/edit auto-fills the reward's name/description/imageUrl from the linked trait.
- Redeeming the bounty reward inserts a real `lockerItemsTable` row for the linked trait, delivering an actual usable trait to the wallet instead of a purely cosmetic reward record.

**Why:** Admins wanted bounty rewards to feel real — earning points and redeeming should be able to grant an actual equippable trait from the vault, not just a badge-like reward entity disconnected from the trait system.

**How to apply:** When adding new reward/redemption-style features that should be able to grant "real" catalog items, prefer this optional-link pattern (nullable FK + auto-fill + redemption-time delivery) over duplicating item data into the reward table.
