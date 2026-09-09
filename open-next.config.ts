import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"

// R2-backed incremental cache (ISR). Without this the "dummy" cache is used
// and every request re-renders + re-fetches upstream data (see the 650ms+
// server-response-time in Lighthouse). With it, revalidated pages/fetches are
// served from `.open-next` R2 storage between regenerations.
//
// Requires the `NEXT_INC_CACHE_R2_BUCKET` R2 binding in wrangler.jsonc and an
// existing bucket (create with: npx wrangler r2 bucket create
// vicine-opennext-cache).
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
})
