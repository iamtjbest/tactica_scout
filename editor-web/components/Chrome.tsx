"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { reviewQueue, getInbox } from "@/lib/api";

/**
 * App shell.
 *
 * Three modes:
 *   bare  the public pages, which carry their own navigation
 *   rail  inside a competition: a 56px icon strip
 *   full  everywhere else: the labelled sidebar
 *
 * The rail exists because a competition page already has its own 256px
 * menu. Two full sidebars side by side eat 500px before any content,
 * which is why the competition workspace previously had no app nav at
 * all. The rail keeps Dashboard, Inbox and Settings one click away from
 * anywhere without taking the room.
 */
const BARE = ["/", "/signin"];
const isRail = (path: string) => path.startsWith("/t/");

const NAV = [
  { href: "/dashboard",    label: "Dashboard",       icon: GridIcon },
  { href: "/competitions", label: "My competitions", icon: TrophyIcon },
  { href: "/inbox",        label: "Inbox",           icon: InboxIcon },
  { href: "/settings",     label: "Settings",        icon: CogIcon },
];

/* Admin-only, and simply absent for everyone else: a link that always
   403s is worse than no link. */
const ADMIN_NAV = [{ href: "/admin", label: "Review queue", icon: ShieldIcon }];

export default function Chrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unread, setUnread] = useState(0);

  // Admin is profiles.role on the backend, not anything the client can
  // read off the session, so the only honest check is to ask.
  useEffect(() => {
    let live = true;
    reviewQueue().then(() => { if (live) setIsAdmin(true); })
                 .catch(() => { if (live) setIsAdmin(false); });
    getInbox().then((d) => { if (live) setUnread(d.unread || 0); })
              .catch(() => {});
    return () => { live = false; };
  }, [path]);

  const signOut = async () => {
    try {
      const { signOut: out } = await import("@/lib/auth");
      await out();
    } catch {
      // Sign out locally regardless. A failed server call must not leave
      // someone stuck in a session they asked to end.
    }
    router.replace("/signin");
  };

  if (BARE.includes(path)) return <>{children}</>;

  const items = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;
  const active = (href: string) =>
    href === "/settings"
      // Billing lives under Settings, so Settings stays lit inside it
      // rather than nothing being selected.
      ? path === "/settings" || path.startsWith("/settings/") || path === "/billing"
      : path === href || path.startsWith(href + "/");

  const rail = isRail(path);

  const labelled = (
    <nav className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href} href={href} onClick={() => setOpen(false)}
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
            active(href)
              ? "bg-volt/10 text-volt border border-volt/25"
              : "text-mt hover:text-white hover:bg-sur2 border border-transparent"
          )}
        >
          <Icon />
          <span className="flex-1">{label}</span>
          {href === "/inbox" && unread > 0 && <Badge n={unread} />}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* ── icon rail, inside a competition ───────────────── */}
      {rail && (
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-14 flex-col items-center
                          border-r border-bd bg-sur/60 backdrop-blur py-4 z-40">
          <Link href="/dashboard" aria-label="Dashboard"
                className="w-9 h-9 rounded-lg bg-volt text-bg font-display font-black
                           text-sm flex items-center justify-center mb-6">
            S
          </Link>
          <div className="flex-1 flex flex-col gap-1">
            {items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href} href={href} title={label} aria-label={label}
                className={clsx(
                  "relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  active(href) ? "bg-volt/10 text-volt" : "text-mt hover:text-white hover:bg-sur2"
                )}
              >
                <Icon />
                {href === "/inbox" && unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red2" />
                )}
              </Link>
            ))}
          </div>
          <button onClick={signOut} title="Sign out" aria-label="Sign out"
                  className="w-10 h-10 rounded-lg flex items-center justify-center
                             text-mt hover:text-red2 hover:bg-sur2 transition-colors">
            <OutIcon />
          </button>
        </aside>
      )}

      {/* ── labelled sidebar, everywhere else ─────────────── */}
      {!rail && (
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col
                          border-r border-bd bg-sur/60 backdrop-blur px-4 py-5 z-30">
          <Link href="/dashboard" className="font-display font-black text-white text-lg px-3">
            Scout <span className="text-volt">Editor</span>
          </Link>

          <div className="mt-8 flex-1">{labelled}</div>

          <div className="border-t border-bd pt-4 px-3 space-y-3">
            <button onClick={signOut}
                    className="flex items-center gap-2 text-mt hover:text-red2
                               text-sm font-semibold transition-colors">
              <OutIcon />
              Sign out
            </button>
            <div>
              <p className="font-mono text-[10px] text-mt2 tracking-[0.16em] uppercase">
                Powered by Tactica
              </p>
              <a href="https://scout.tactica.com.ng"
                 className="text-mt text-xs hover:text-volt transition-colors">
                Open Scout
              </a>
            </div>
          </div>
        </aside>
      )}

      {/* ── mobile top bar ────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-40 border-b border-bd bg-sur">
        <div className="h-14 px-4 flex items-center justify-between">
          <Link href="/dashboard" className="font-display font-black text-white text-lg">
            Scout <span className="text-volt">Editor</span>
          </Link>
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
                  aria-label={open ? "Close menu" : "Open menu"}
                  className="text-mt hover:text-white p-2 -mr-2 relative">
            {open ? <CloseIcon /> : <MenuIcon />}
            {!open && unread > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red2" />
            )}
          </button>
        </div>
        {open && (
          <div className="px-4 pb-4 border-t border-bd pt-3 space-y-3">
            {labelled}
            <button onClick={signOut}
                    className="flex items-center gap-2 text-mt hover:text-red2
                               text-sm font-semibold px-3">
              <OutIcon />
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className={rail ? "lg:pl-14" : "lg:pl-60"}>{children}</main>
    </div>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red2 text-white
                     text-[10px] font-bold flex items-center justify-center">
      {n > 9 ? "9+" : n}
    </span>
  );
}

/* Inline icons. An icon package for seven glyphs is weight the organiser
   pays for on mobile data and never sees the value of. */
const ico = {
  width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  className: "shrink-0",
};
function GridIcon() {
  return <svg {...ico}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
}
function TrophyIcon() {
  return <svg {...ico}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>;
}
function InboxIcon() {
  return <svg {...ico}><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5 5h14l2 8v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4l2-8Z" /></svg>;
}
function CogIcon() {
  return <svg {...ico}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v2.2M12 19.3v2.2M4.2 7l1.9 1.1M17.9 15.9l1.9 1.1M4.2 17l1.9-1.1M17.9 8.1l1.9-1.1" /></svg>;
}
function ShieldIcon() {
  return <svg {...ico}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3Z" /><path d="M9 12l2 2 4-4" /></svg>;
}
function OutIcon() {
  return <svg {...ico}><path d="M15 17l5-5-5-5M20 12H9M11 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" /></svg>;
}
function MenuIcon() {
  return <svg {...ico} width="22" height="22"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
}
function CloseIcon() {
  return <svg {...ico} width="22" height="22"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}
