# VICINE

A streaming platform for movies, anime, and series — every story, one screen.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** shadcn/ui, Tailwind CSS 4, Framer Motion
- **Runtime:** Cloudflare Workers (via OpenNext)
- **Package Manager:** Bun
- **Testing:** Bun test
- **Video:** next-video + Video.js

## Getting Started

```bash
# install dependencies
bun install

# run dev server
bun run dev

# open http://localhost:3000
```

## Scripts

| Command             | Description                     |
| ------------------- | ------------------------------- |
| `bun run dev`       | Start dev server                |
| `bun run build`     | Production build                |
| `bun run start`     | Start production server         |
| `bun run lint`      | ESLint                          |
| `bun run typecheck` | TypeScript check                |
| `bun run format`    | Prettier format                 |
| `bun run test`      | Run tests                       |
| `bun run deploy`    | Build and deploy to Cloudflare  |
| `bun run preview`   | Build and preview on Cloudflare |

## Deployment

The app is deployed to Cloudflare Workers using OpenNext:

```bash
bun run deploy
```

This runs `opennextjs-cloudflare build` followed by `opennextjs-cloudflare deploy`.

The resolve worker (for URL resolution) deploys separately:

```bash
bun run deploy:resolve
```

### Required tool versions

**Bun 1.4.0** is required everywhere the lockfile is installed — local dev, CI, and the Cloudflare Workers build. `bun.lock` uses `lockfileVersion: 2`, which bun < 1.4 cannot parse (the build fails with `UnknownLockfileVersion: failed to parse lockfile: 'bun.lock'`).

- **Local:** asdf/mise users get this automatically from the checked-in `.tool-versions`. Otherwise: `bun upgrade` and confirm `bun --version` prints 1.4.x.
- **GitHub Actions:** `oven-sh/setup-bun` reads the `packageManager` field (`bun@1.4.0`) in `package.json` — no extra config needed.
- **Cloudflare Workers Builds:** the build image ships an older bun by default. Set these in *Settings → Build → Variables and secrets*:

  | Variable | Value |
  | --- | --- |
  | `BUN_VERSION` | `1.4.0` |

  If the default `bun install --frozen-lockfile` step still fails after pinning `BUN_VERSION`, also set `SKIP_DEPENDENCY_INSTALL=true` and prepend the install to the build command:

  ```
  bun install --frozen-lockfile && bun run build:worker && opennextjs-cloudflare deploy
  ```
