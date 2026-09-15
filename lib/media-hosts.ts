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

export const MEDIA_HOST_RE = new RegExp(
  `(^|\\.)(${MEDIA_HOSTS.join("|")})$`,
  "i"
)
