"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import clsx from "clsx";

/**
 * App shell: a side menu on desktop, a top bar on phones.
 *
 * Hidden entirely on the public pages. The landing page and sign-in are
 * full-bleed and carry their own navigation, and an organiser's menu
 * shown to someone who hasn't signed in yet is both wrong and
 * confusing.
 *
 * This renders the navigation AND wraps the page content, because a
 * fixed side menu needs the content column to be inset beside it. Pages
 * keep their own inner max-width.
 */
const BARE = ["/", "/signin"];

const NAV = [
  { href: "/competitions", label: "My competitions", icon: TrophyIcon },
  { href: "/join",         label: "Join a competition", icon: KeyIcon },
  { href: "/billing",      label: "Billing",         icon: CardIcon },
];

/* Admin-only. Drawn from the account rather than hard-coded, and simply
   absent for everyone else: a link that always 403s is worse than no
   link. */
const ADMIN_NAV = [
  { href: "/admin", label: "Review queue", icon: InboxIcon },
];

export default function Chrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let live = true;
    supabase().auth.getUser()
      .then(({ data }) => {
        if (live) setIsAdmin(Boolean(data.user?.app_metadata?.is_admin));
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  if (BARE.includes(path)) return <>{children}</>;

  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  const items = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  const links = (
    <nav className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
            isActive(href)
              ? "bg-volt/10 text-volt border border-volt/25"
              : "text-mt hover:text-white hover:bg-sur2 border border-transparent"
          )}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* ── desktop side menu ──────────────────────────────── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col
                        border-r border-bd bg-sur/60 backdrop-blur px-4 py-5 z-30">
        <Link href="/competitions" className="font-display font-black text-white text-lg px-3">
          Scout <span className="text-volt">Editor</span>
        </Link>

        <div className="mt-8 flex-1">{links}</div>

        <div className="border-t border-bd pt-4 px-3">
          <p className="font-mono text-[10px] text-mt2 tracking-[0.16em] uppercase">
            Powered by Tactica
          </p>
          <a href="https://scout.tactica.com.ng"
             className="text-mt text-xs hover:text-volt transition-colors">
            Open Scout
          </a>
        </div>
      </aside>

      {/* ── mobile top bar ─────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-40 border-b border-bd bg-sur">
        <div className="h-14 px-4 flex items-center justify-between">
          <Link href="/competitions" className="font-display font-black text-white text-lg">
            Scout <span className="text-volt">Editor</span>
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="text-mt hover:text-white p-2 -mr-2"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
        {open && <div className="px-4 pb-4 border-t border-bd pt-3">{links}</div>}
      </header>

      <main className="lg:pl-60">{children}</main>
    </div>
  );
}

/* Small inline icons. A whole icon package for four glyphs is weight
   the organiser pays for on mobile data and never sees the value of. */
function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2 21 2M18 5l3 3M15 8l3 3" />
    </svg>
  );
}
function InboxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M3 13h5l1.5 3h5L16 13h5" />
      <path d="M5 5h14l2 8v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4l2-8Z" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
