import type { Metadata } from "next";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scout by Tactica — Live Scores & Player Comparison",
  description:
    "Live football scores with Tactica's win probability numbers built in, plus " +
    "player comparison with season-filterable radar charts. Built by Cantera Football.",
  manifest: "/manifest.json",
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
