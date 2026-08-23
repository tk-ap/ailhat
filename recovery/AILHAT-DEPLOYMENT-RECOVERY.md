# Ailhat Deployment Recovery

## Status

The original working Ailhat deployment is preserved at:

`https://ailhat-2lsg7ck7k-alvira2.vercel.app/`

Deployment:

`dpl_9dFTrsZBpd1FNgVx9ydLjJaFWyjJ`

The Git-connected production deployment was accidentally created from an incomplete repository and currently returns 404. Do **not** delete the working deployment until source recovery is complete.

## What was recovered

The working deployment was inspected directly and confirmed to contain the Ailhat application with these routes:

- `/` — landing page
- `/dashboard` — command center / Today
- `/brief` — Intelligence / prioritised signals
- `/login` — authentication route

The deployment is a Vite/TanStack Router/React build. The root entry references these compiled assets:

- `assets/index-DLDj9J5u.js`
- `assets/index-CN2fdGQM.js`
- `assets/login-DSdRRAUp.js`
- `assets/dashboard-Mh9fqY2b.js`
- `assets/scanSite-tMNNgcFz.js`
- `assets/useAuth-DOkPfkpf.js`
- `assets/AuthNav-CSZ1oBO5.js`
- `assets/brief-savJc-oI.js`
- `assets/app-Ctmni3gE.css`

The compiled entry explicitly contains the route graph and lazy-loaded chunks listed above. Source maps were not present, so the original TypeScript/React source cannot be reconstructed perfectly from the build artifact alone.

## Recovery strategy

Until the original source is restored by the cto.new agent, treat the working Vercel deployment as the canonical recovery artifact.

Run:

```bash
bash recovery/pull-working-deployment.sh
```

This downloads the known HTML route snapshots and compiled assets from the preserved working deployment into `recovery/deployed/`.

The result is a faithful deployed-artifact backup, not a claim that the original source tree has been recovered.

## Important

Do not point production back at an incomplete Git repository.

Do not delete `dpl_9dFTrsZBpd1FNgVx9ydLjJaFWyjJ`.

Once the original source is restored into this repository, reconnect Vercel to `tk-ap/ailhat`, verify `/`, `/dashboard`, `/brief`, and `/login`, and only then allow Git pushes to trigger production deployments.

## Known product implementation clues

The working build contains:

- Ailhat dark/cyan visual system
- `Today` and `Intelligence` navigation
- automatic site scanning
- scan-site chunk
- local portfolio/product state
- product signals/checklists
- Daily Brief route
- authentication hooks
- Ailhat landing page positioning

The recovery should preserve existing behavior before any new feature work begins.
