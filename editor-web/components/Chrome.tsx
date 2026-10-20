"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * App chrome, hidden on the public pages.
 *
 * The landing page and sign-in are full-bleed and carry their own
 * navigation, so the signed-in header ("My competitions / Billing")
 * would be both wrong and confusing there: it offers an organiser's
 * links to someone who hasn't signed in yet.
 */
const BARE = ["/", "/signin"];

export default function Chrome() {
  const path = usePathname();
  if (BARE.includes(path)) return null;

  return (
    <header className="border-b border-bd bg-sur">
      <div className="max-w-screen-lg mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/competitions" className="font-display font-black text-white text-lg">
          Scout <span className="text-volt">Editor</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/competitions" className="text-mt hover:text-white">My competitions</Link>
          <Link href="/billing" className="text-mt hover:text-white">Billing</Link>
        </nav>
      </div>
    </header>
  );
}
