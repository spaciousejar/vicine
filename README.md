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
