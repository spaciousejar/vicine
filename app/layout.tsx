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
const MEASURE_GUARD = `
(function () {
  var orig = performance.measure.bind(performance);
  performance.measure = function () {
    try {
      return orig.apply(performance, arguments);
    } catch (e) {
      if (String(e).indexOf("negative time stamp") === -1) throw e;
    }
  };
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
        <Script id="perf-measure-guard" strategy="beforeInteractive">
          {MEASURE_GUARD}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
