import type { Metadata } from "next";
import { Gabarito, Martian_Mono, Onest } from "next/font/google";
import "./globals.css";
import { Wallpaper } from "@/components/Wallpaper";
import { StatusBar } from "@/components/StatusBar";
import { Footer } from "@/components/Footer";
import { Ground } from "@/components/Ground";
import { LauncherProvider } from "@/components/Launcher";
import { site } from "@/content/site";

const gabarito = Gabarito({ variable: "--font-gabarito", subsets: ["latin"] });
const onest = Onest({ variable: "--font-onest", subsets: ["latin"] });
const martian = Martian_Mono({ variable: "--font-martian", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(`https://${site.domain}`),
  title: {
    default: "TypePlay: type it, play it",
    template: "%s | TypePlay",
  },
  description:
    "Describe a game in one sentence. TypePlay builds it in a real game engine in minutes; you play it in the browser, change it by chatting, and ship it to the web, Android, iOS and Steam.",
  openGraph: {
    siteName: "TypePlay",
    type: "website",
    locale: "en_US",
  },
};

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
