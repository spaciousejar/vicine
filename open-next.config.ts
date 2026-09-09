import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache"

// KV-backed incremental cache (ISR). Without a real cache the "dummy" cache
// is used and every request re-renders + re-fetches upstream data (see the
// 650ms+ server-response-time in Lighthouse). With it, revalidated pages are
// served from KV between regenerations.
//
// Requires the `NEXT_INC_CACHE_KV` binding in wrangler.jsonc (see that file;
// created with `wrangler kv namespace create`).
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
})
