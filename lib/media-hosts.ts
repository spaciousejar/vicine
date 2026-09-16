// Single source of truth for media hosts the proxy/stream/parse paths may
// resolve to and stream from. Any other host is rejected so the SSRF-facing
// endpoints cannot reach private networks. Add new CDNs here only.
export const MEDIA_HOSTS = [
  "vcloud.fit",
  "workers.dev",
  "googleusercontent.com",
  "r2.dev",
  "hicine.sbs",
] as const

// Hostnames contain dots, which are regex "any char" wildcards. Escape them so
// lookalikes (e.g. `evil.hicineXsbs`) can't slip past the allowlist — only the
// literal host or one of its subdomains may match.
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export const MEDIA_HOST_RE = new RegExp(
  `(^|\\.)(${MEDIA_HOSTS.map(escapeRegExp).join("|")})$`,
  "i"
)
