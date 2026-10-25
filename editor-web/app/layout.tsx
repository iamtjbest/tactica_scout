import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import "./globals.css";

const TITLE = "Scout Editor — Run your competition";
const DESCRIPTION =
  "Create a competition, register teams and players, generate fixtures and " +
  "update scores live. Published to Scout once approved. Powered by Tactica.";

export const metadata: Metadata = {
  // Resolves the relative URLs below against the real domain. Without it
  // Next falls back to localhost in dev and drops the image in production.
  metadataBase: new URL("https://scouteditor.tacticaengine.com"),
  title: {
    default: TITLE,
    template: "%s — Scout Editor",
  },
  description: DESCRIPTION,
  applicationName: "Scout Editor",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Scout Editor",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Scout Editor — run your own competition",
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
      <body>
        {/* Chrome decides between the public (bare) pages and the
            signed-in shell, and wraps the content either way. */}
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}