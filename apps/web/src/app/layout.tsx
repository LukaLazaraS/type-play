import type { Metadata, Viewport } from "next";
import { Gabarito, Martian_Mono, Onest } from "next/font/google";
import "./globals.css";
import { Wallpaper } from "@/components/Wallpaper";
import { StatusBar } from "@/components/StatusBar";
import { Footer } from "@/components/Footer";
import { Ground } from "@/components/Ground";
import { LauncherProvider } from "@/components/Launcher";
import { description } from "@/content/seo";
import { site } from "@/content/site";

const gabarito = Gabarito({ variable: "--font-gabarito", subsets: ["latin"] });
const onest = Onest({ variable: "--font-onest", subsets: ["latin"] });
// Keep all three preloaded. The figures face looks optional for the first paint, but the browser
// fetches it at the first layout anyway (figures are all over the page); without the preload it
// starts later, after the CSS, and Lighthouse's mobile FCP went from 0.78 s to 1.07 s (2026-10-17).
const martian = Martian_Mono({ variable: "--font-martian", subsets: ["latin"] });

// Each page adds its own title, description and canonical address. The share image, favicon and
// app icons are files in this folder (opengraph-image.png, icon.svg, ...): scripts/brand.mjs.
export const metadata: Metadata = {
  metadataBase: new URL(`https://${site.domain}`),
  applicationName: site.name,
  title: {
    default: "TypePlay: type it, play it",
    template: "%s | TypePlay",
  },
  description,
  openGraph: {
    siteName: site.name,
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
};

// The browser's own bars take the night-sky colour on phones. `resizes-content`: on Android the
// keyboard shrinks the layout viewport (as iOS does), so a box pinned to the bottom of a 100dvh
// screen (the game page's composer) rises above the keyboard instead of hiding under it.
export const viewport: Viewport = { themeColor: "#170d33", interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${gabarito.variable} ${onest.variable} ${martian.variable}`}>
      {/* Browser extensions (Grammarly and others) add attributes to <body> before React runs;
          ignore attribute differences on this one element so they don't raise hydration errors. */}
      <body suppressHydrationWarning>
        <Wallpaper />
        <LauncherProvider>
          <StatusBar />
          {children}
          <div className="ground-band">
            <Ground sun={false} edge="flat" />
            <Footer />
          </div>
        </LauncherProvider>
      </body>
    </html>
  );
}
