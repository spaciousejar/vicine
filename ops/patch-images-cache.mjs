// Fix for the "zero cache lifetime on images" Lighthouse finding.
//
// OpenNext's `/_next/image` handler only emits a Cache-Control header when the
// upstream image is marked `immutable` — our origin (storage.hicine.sbs)
// returns `public, max-age=2592000` instead, so every optimized image came
// back with no cache header (TTL 0) and was re-fetched + re-processed on every
// visit.
//
// The generated `.open-next/cloudflare/images.js` is unminified and stable, so
// we patch `createImageResponse` right after `opennextjs-cloudflare build` to
// always attach a sane cache lifetime (a longer immutable value still wins for
// static assets / upstream-immutable images). This works whether or not the
// Workers `IMAGES` binding is enabled.
//
// Must run AFTER `opennextjs-cloudflare build` and BEFORE deploy.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const target = join(root, ".open-next", "cloudflare", "images.js")

if (!existsSync(target)) {
  console.warn(
    "[patch-images-cache] .open-next/cloudflare/images.js not found — run `opennextjs-cloudflare build` first. Skipping."
  )
  process.exit(0)
}

const src = readFileSync(target, "utf8")

const NEEDLE = `  if (imageResponseFlags.immutable) {
    response.headers.set("Cache-Control", "public, max-age=315360000, immutable");
  }`

// Always cache optimized images; the immutable branch (when set) still upgrades
// the lifetime to one year.
const REPLACEMENT = `  response.headers.set(
    "Cache-Control",
    "public, max-age=604800, stale-while-revalidate=604800"
  );
  if (imageResponseFlags.immutable) {
    response.headers.set("Cache-Control", "public, max-age=315360000, immutable");
  }`

if (!src.includes(NEEDLE)) {
  console.warn(
    "[patch-images-cache] Could not find the expected createImageResponse block — the OpenNext template may have changed. Set a Cache-Control header upstream instead (public, max-age=..., immutable). Skipping."
  )
  process.exit(0)
}

writeFileSync(target, src.replace(NEEDLE, REPLACEMENT), "utf8")
console.log(
  "[patch-images-cache] image responses now carry a 7-day cache lifetime."
)
