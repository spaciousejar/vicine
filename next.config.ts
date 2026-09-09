import type { NextConfig } from "next"
import { withNextVideo } from "next-video/process"

// Research‑grade security headers. CSP is relaxed for script/style so Next's
// required inline bootstrap/font scripts keep working; everything else that
// should be restricted is.
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "manifest-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "media-src 'self' blob: https: http:",
      "font-src 'self' data: https:",
      "connect-src 'self' https: http:",
    ].join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), battery=(), interest-cohort=()",
  },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.hicine.sbs" },
      { protocol: "https", hostname: "**.hicine.sbs" },
      { protocol: "https", hostname: "**.vcloud.fit" },
    ],
  },
  async headers() {
    return [
      // Apply security headers everywhere except the image optimizer response
      // (that response already ships its own sandboxed CSP / disposal header).
      {
        source: "/((?!_next/image).*)",
        headers: SECURITY_HEADERS,
      },
    ]
  },
}

export default withNextVideo(nextConfig)
