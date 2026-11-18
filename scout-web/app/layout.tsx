import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import AppInstallBanner from "@/components/AppInstallBanner";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import "./globals.css";

const TITLE = "Scout by Tactica — Live Scores & Player Comparison";
const DESCRIPTION =
  "Live football scores with Tactica's win probability and attack/defence " +
  "ratings built into every match, locked in before kickoff. Plus lineups, " +
  "head to head, stats and player comparison. Built by Cantera Football.";

export const metadata: Metadata = {
  metadataBase: new URL("https://scout.tacticaengine.com"),
  title: {
    default: TITLE,
    template: "%s — Scout by Tactica",
  },
  description: DESCRIPTION,
  applicationName: "Scout by Tactica",
  icons: { icon: "/favicon.svg" },
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Scout by Tactica",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Scout by Tactica — live scores with the numbers built in",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@TacticaEngine",
    creator: "@iamtjbest",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="pb-20">
        <TopBar />
        <main className="max-w-screen-md mx-auto px-4 pt-4">{children}</main>
        <AppInstallBanner />
        <BottomNav />
        <Analytics />
      </body>
    </html>
  );
}