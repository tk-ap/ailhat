---
name: ailhat-vercel-deploy
description: Prevent and recover from the Ailhat production alias (https://ailhat.vercel.app) returning a 404 on all routes. Use whenever the site goes down after a PR merge, when a Vercel auto-deploy hijacks the production alias with an empty build, or before/after merging any PR to ensure the live site stays up.
---

# Ailhat Vercel Deploy — prevent the empty auto-deploy 404

## The problem

The Ailhat project on Vercel (scope `alvira2`, project `ailhat`) has a
GitHub→Vercel git integration. When it is connected, **every `gh pr merge` to
`main` fires its own "production" deploy**. That git-sourced deploy has **no
build command configured**, so it produces an *empty* `LAMBDAS` build (no app).
Because the auto-deploy lands *after* any real CLI deploy (it's newer), Vercel
points the production alias `ailhat.vercel.app` at the empty build → the whole
site 404s on every route (`/`, `/brief`, `/dashboard`, `/login`).

This is the recurring failure: each PR merge nukes the live site until a real
deploy is re-applied. **The fix is to prevent the auto-deploy, not to keep
recovering from it.**

## When to use this skill

- The site 404s after a PR merge.
- Before/after merging any PR to Ailhat.
- Any time you need to confirm the production alias is healthy.

## Prevention (permanent fix)

The durable answer is: **no git auto-deploys at all.** The CLI is the single
deploy path, so you (not GitHub) choose when the site updates, always through
the correct build. Never try to "fix" the git auto-deploy to build correctly —
it's fragile; removing it is strictly better.

### 1. Disconnect the GitHub→Vercel git integration

From `/home/team/shared/site`:

```bash
echo y | VERCEL_TOKEN="$VERCEL_TOKEN" bunx vercel@latest git disconnect
```

> The bare `bunx vercel@latest git disconnect` prompts "Are you sure you want to
> disconnect tk-ap/ailhat from your project?" and **defaults to "no"**, so it
> silently cancels. Always pipe `echo y` (or pass `--yes` if supported) to force
> confirmation, otherwise it does nothing.

Verify it is actually gone (not assumed):

```bash
VERCEL_TOKEN="$VERCEL_TOKEN" bunx vercel@latest git ls
```

It should show **no connected GitHub project/integration**. If `git ls` still
shows the repo, find and run the real removal mechanism (vercel CLI
git/disconnect or the Vercel API) until it is confirmed gone.

### 2. Make the CLI deploy the standard path

All deploys go through the proven sequence — **NOT** `go-live.sh` (no `--prod`,
can't assign the production alias) and **NOT** bare `vercel` (not on PATH):

```bash
bash build-vercel.sh
bunx vercel deploy --prebuilt --prod --yes --token "$VERCEL_TOKEN" --name ailhat --scope alvira2 -e DATABASE_URL="$DATABASE_URL"
```

### 3. Verify after every merge

After any `gh pr merge`, immediately confirm the alias is healthy:

```bash
for p in "" brief dashboard login; do
  printf "/%-9s -> " "$p"
  curl -s -o /dev/null -w "%{http_code}\n" "https://ailhat.vercel.app/$p"
done
```

Expected: `200` on every route. If any route 404s, a git auto-deploy landed —
disconnect it (step 1) and restore (step "Recovery") immediately.

## Detection

Check what the production alias currently points at:

```bash
curl -s "https://api.vercel.com/v4/aliases?projectId=prj_dqOUuTJPaegWYi3l4f9Kx8vxyWOe&limit=5" \
  -H "Authorization: Bearer $VERCEL_TOKEN"
```

- `ailhat.vercel.app -> dpl_...` where the deployment `source` is `git` and the
  type is `LAMBDAS` with no app ⇒ that's the empty hijack. See recent
  deployments to confirm:
  ```bash
  curl -s "https://api.vercel.com/v6/deployments?projectId=prj_dqOUuTJPaegWYi3l4f9Kx8vxyWOe&limit=5" \
    -H "Authorization: Bearer $VERCEL_TOKEN"
  ```

## Recovery (if the site is already down)

1. **Pull current code** so you restore what's actually merged:
   `git pull origin main` (local `main` can lag `origin/main`).
2. **Disconnect** the git integration (see Prevention step 1) and confirm with
   `git ls`.
3. **Restore with the proven prebuilt-prod deploy** (see Prevention step 2).
4. **Verify** every route returns 200 (see Prevention step 3).

## Key facts to remember

- Project id: `prj_dqOUuTJPaegWYi3l4f9Kx8vxyWOe`, scope `alvira2`.
- Working redeploy: `bash build-vercel.sh` then
  `bunx vercel deploy --prebuilt --prod --yes --token "$VERCEL_TOKEN" --name ailhat --scope alvira2 -e DATABASE_URL="$DATABASE_URL"`.
- Never rely on the git auto-deploy, `go-live.sh`, or bare `vercel`.
- `git disconnect` needs `echo y |` or it silently cancels.
- The production alias being healthy (200 on all routes) is the definition of
  done after any merge or deploy.
