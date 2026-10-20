import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scout Editor — Run your competition",
  description:
    "Create a competition, register teams and players, generate fixtures and " +
    "update scores live. Published to Scout once approved. Powered by Tactica.",
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
