"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CalendarDays, Trophy, Users, Newspaper } from "lucide-react";

const NAV = [
  { href: "/",        label: "Matches", icon: CalendarDays },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/compare", label: "Compare", icon: Users },
  { href: "/news",    label: "News",    icon: Newspaper },
];

// Bottom tab bar, not a top navbar — matches the livescore-app convention
// (FotMob/Sofascore/Flashscore all put primary nav at the bottom on
// mobile widths). Works fine on desktop too since Pulse is a
// phone-first product.
export default function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-bd bg-sur/95 backdrop-blur">
      <div className="max-w-screen-md mx-auto grid grid-cols-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
                active ? "text-volt" : "text-mt hover:text-white"
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
