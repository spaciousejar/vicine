import Script from "next/script"
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

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

export const metadata = {
  title: "VICINE — Watch movies, anime & series",
  description:
    "Stream movies, anime and series in 480p, 720p and 1080p on VICINE.",
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
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <Script id="media-guards" strategy="beforeInteractive">
          {MEDIA_GUARDS}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
