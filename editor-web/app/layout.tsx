import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tactica Editor — Run your tournament",
  description:
    "Create a tournament, register teams and players, generate fixtures and " +
    "update scores live. Published to Scout once approved.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-bd bg-sur">
          <div className="max-w-screen-lg mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <Link href="/" className="font-display font-black text-white text-lg">
              Tactica <span className="text-volt">Editor</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-mt hover:text-white">Tournaments</Link>
              <Link href="/billing" className="text-mt hover:text-white">Billing</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-screen-lg mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
