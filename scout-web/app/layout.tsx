import type { Metadata } from "next";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import "./globals.css";

const TITLE = "Scout by Tactica — Live Scores & Player Comparison";
const DESCRIPTION =
  "Live football scores with Tactica's win probability and attack/defence " +
  "ratings built into every match, locked in before kickoff. Plus lineups, " +
  "head to head, stats and player comparison. Built by Cantera Football.";

export const metadata: Metadata = {
  // metadataBase lets every relative URL below (and any openGraph image on
  // a child page) resolve to the real domain. Without it, Next falls back
  // to localhost in development and strips the image in production.
  metadataBase: new URL("https://scout.tacticaengine.com"),
  title: {
    default: TITLE,
    // Child pages set their own title and it lands inside this.
    template: "%s — Scout by Tactica",
  },
  description: DESCRIPTION,
  applicationName: "Scout by Tactica",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="pb-20">
        <TopBar />
        <main className="max-w-screen-md mx-auto px-4 pt-4">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}