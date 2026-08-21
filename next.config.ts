import type { NextConfig } from "next"
import { withNextVideo } from "next-video/process"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.hicine.sbs" },
      { protocol: "https", hostname: "**.hicine.sbs" },
      { protocol: "https", hostname: "**.vcloud.fit" },
    ],
  },
}

export default withNextVideo(nextConfig)
