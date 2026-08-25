import Script from "next/script"
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Footer } from "@/components/footer"
import { PageTransition } from "@/components/page-transition"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// React 19.3-experimental (bundled with Next 16 dev builds) measures Server
// Component spans via performance.measure and can throw uncaught
// TypeErrors when streaming marks arrive out of order ("cannot have a
// negative time stamp"). Swallow only that failure mode; real measurements
// still work. Runs before hydration so it wraps every later call.
//
// HTMLMediaElement.play() rejections (AbortError when the element is
// swapped during quality switches, NotSupportedError handled via the
// element's error event) surface as fatal dev overlays even though the
// player recovers — silence the promise rejections; real error handling
// listens to the media element itself.
const MEDIA_GUARDS = `
(function () {
  var origMeasure = performance.measure.bind(performance);
  performance.measure = function () {
    try {
      return origMeasure.apply(performance, arguments);
    } catch (e) {
      if (String(e).indexOf("negative time stamp") === -1) throw e;
    }
  };
  if (!HTMLMediaElement.prototype.__vicinePatched) {
    var origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      try {
        var p = origPlay.apply(this, arguments);
        if (p && typeof p.catch === "function") {
          p.catch(function () {});
        }
        return p;
      } catch (e) {
        return Promise.reject(e);
      }
    };
    HTMLMediaElement.prototype.__vicinePatched = true;
  }
})();
`

const SITE_URL = "https://vicine-eight.vercel.app"

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "VICINE — Watch movies, anime & series",
    template: "%s | VICINE",
  },
  description:
    "Stream movies, anime and series in 480p, 720p and 1080p on VICINE. Every story. One screen.",
  keywords: ["streaming", "movies", "anime", "series", "watch online", "480p", "720p", "1080p", "4K"],
  authors: [{ name: "VICINE" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "VICINE",
    title: "VICINE — Watch movies, anime & series",
    description:
      "Every story. One screen. — 480p to 4K streaming for movies, anime and series.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VICINE — Every story. One screen.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VICINE — Watch movies, anime & series",
    description:
      "Every story. One screen. — 480p to 4K streaming for movies, anime and series.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "icon", url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VICINE",
  },
}

// `viewport-fit=cover` lets the page paint under the notch/home indicator so
// fullscreen video is truly edge-to-edge; the safe-area utilities in
// globals.css keep actual content clear of those insets. maximumScale is
// deliberately unset — pinch-zoom stays available (WCAG 1.4.4).
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "oklch(1 0 0)" },
    { media: "(prefers-color-scheme: dark)", color: "oklch(0.145 0 0)" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable,
        spaceGrotesk.variable
      )}
    >
      <body>
        <Script id="media-guards" strategy="beforeInteractive">
          {MEDIA_GUARDS}
        </Script>
        <ThemeProvider>
          <PageTransition>{children}</PageTransition>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}
