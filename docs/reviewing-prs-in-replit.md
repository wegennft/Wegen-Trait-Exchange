# Reviewing a Pull Request in Replit

Step-by-step guide for testing a teammate's branch in Replit before merging to `main`.

**Repo:** [wegennft/Wegen-Trait-Exchange](https://github.com/wegennft/Wegen-Trait-Exchange)

---

## Quick summary

1. Open the Replit project
2. Switch to the PR branch (e.g. `feature/local-dev-setup`)
3. Click **Run** and click around the app
4. If it looks good, **merge on GitHub** (not in Replit)
5. Switch Replit back to `main` and pull

Testing a branch in Replit does **not** change production. `main` stays the same until you merge the PR on GitHub.

---

## Part 1 — Open the PR on GitHub

1. Go to the repo on GitHub: https://github.com/wegennft/Wegen-Trait-Exchange
2. Click **Pull requests**
3. Open the PR you want to review (e.g. PR #1)
4. Note the **branch name** shown on the PR — you'll need it in Replit (e.g. `feature/local-dev-setup`)

---

## Part 2 — Open the Replit project

1. Sign in to [Replit](https://replit.com)
2. Open the **Wegen Trait Exchange** project (the one connected to this GitHub repo)

---

## Part 3 — Switch to the PR branch

Use **Option A** or **Option B**.

### Option A — Replit Version Control panel

1. In the left sidebar, click **Version Control** (git/branch icon)
2. Confirm the project is linked to `wegennft/Wegen-Trait-Exchange`
3. Click **Fetch** or **Pull** to get the latest branches from GitHub
4. Find the branch from the PR (e.g. `feature/local-dev-setup`)
5. Click the branch → **Checkout** or **Switch to branch**

You should now see that branch name at the top of the Version Control panel (not `main`).

### Option B — Shell (if the UI is unclear)

1. Open the **Shell** tab at the bottom of Replit
2. Run:

```bash
git fetch origin
git checkout feature/local-dev-setup
git pull origin feature/local-dev-setup
```

Replace `feature/local-dev-setup` with the actual branch name from the PR.

3. If packages look out of date, run:

```bash
pnpm install
```

---

## Part 4 — Run the app

1. Click the green **Run** button
2. Wait for the frontend and API to start
3. Use the **Webview** preview, or click **Open in new tab**

Replit secrets (database, session key, etc.) should already be configured — no `.env` file needed on Replit.

---

## Part 5 — Test checklist

Click through the app and confirm nothing is broken:

- [ ] **Store** loads at `/`
- [ ] **Traits** display (if the database has data)
- [ ] **Locker** loads at `/locker`
- [ ] **My Wegens** loads at `/nfts`
- [ ] **Admin** loads at `/admin`
- [ ] **API health check** — visit `/api/healthz` on your Replit URL  
      Expected: `{"status":"ok"}`

Leave a comment on the GitHub PR if something looks wrong.

---

## Part 6 — Merge the PR (on GitHub)

When you're happy with the branch:

1. Open the PR on GitHub
2. Click **Merge pull request**
3. Click **Confirm merge**

Do **not** merge by editing files directly in Replit. Always merge through the GitHub PR so the change is tracked.

---

## Part 7 — Switch Replit back to `main`

After merging, update Replit to the official version:

```bash
git checkout main
git pull origin main
```

Then click **Run** again. Replit is now on `main` with the merged changes.

---

## Troubleshooting

| Problem | What to do |
|---|---|
| Branch doesn't show up | Run `git fetch origin` in Shell, then try again |
| App won't start after switching branches | Run `pnpm install`, then click **Run** again |
| Want to go back to `main` without merging | `git checkout main && git pull origin main` |
| Worried about breaking prod | Branch testing in Replit preview is safe — `main` is unchanged until you merge the PR |

---

## Workflow for future PRs

This same process works for any PR:

1. Open the PR on GitHub → note the branch name
2. In Replit: fetch → checkout that branch
3. Run and test
4. Merge on GitHub if approved
5. `git checkout main && git pull origin main` in Replit
