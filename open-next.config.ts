import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import type { OpenNextConfig } from "@opennextjs/cloudflare"
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache"

// KV-backed incremental cache (ISR). Without a real cache the "dummy" cache
// is used and every request re-renders + re-fetches upstream data (see the
// 650ms+ server-response-time in Lighthouse). With it, revalidated pages are
// served from KV between regenerations.
//
// Requires the `NEXT_INC_CACHE_KV` binding in wrangler.jsonc (see that file;
// created with `wrangler kv namespace create`).
const config: OpenNextConfig = {
  ...defineCloudflareConfig({
    incrementalCache: kvIncrementalCache,
  }),
  // Workers Builds runs `bun run build`, which is our OpenNext worker build
  // (`bun run build:worker`). OpenNext itself builds the Next.js app by running
  // the package's `build` script — so with the default it would recurse:
  //   bun run build -> opennextjs-cloudflare build -> bun run build -> ...
  // Build the Next.js app directly instead; OpenNext still sets the standalone
  // output env vars around this command.
  buildCommand: "bun run build:next",
}

export default config
