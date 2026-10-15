"use client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const WINDOW = 3; // days shown on each side of the selected date

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

function dayLabel(iso: string): { top: string; bottom: string } {
  const todayISO = toISODate(new Date());
  const d = new Date(`${iso}T00:00:00Z`);
  if (iso === todayISO) return { top: "TODAY", bottom: "" };
  return {
    top: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
    bottom: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
  };
}

// Modeled on FotMob (a horizontal strip of nearby days you tap straight
// into, today highlighted) crossed with Flashscore (single date pill +
// arrows -- confirmed live on flashscore.com 2026-10-08: tapping that
// pill opens a plain scrollable list of nearby days, not a real
// calendar grid, which turns out to be a slow way to reach a date
// that's months or years off). Neither site's own date control is
// actually built for a jump that far, so instead of copying that gap
// we keep a calendar icon that opens the browser's native date picker
// (its own year/month dropdown built in) for "next month" / "Aug 2027"
// type jumps, and use the FotMob-style strip for the nearby-day
// browsing both sites are good at. Sofascore's own date control
// couldn't be checked the same way -- it sits behind a captcha wall
// for automated browsing -- so this is built from the two that were
// actually confirmed live, not assumed from memory.
export default function DateNav({
  date,
  onChange,
}: {
  date: string;
  onChange: (iso: string) => void;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const days = Array.from({ length: WINDOW * 2 + 1 }, (_, i) => shiftDate(date, i - WINDOW));

  function openPicker() {
    const el = pickerRef.current;
    if (!el) return;
    // showPicker() is the real native-calendar trigger (Chrome/Edge);
    // Safari/Firefox don't support it yet, so fall back to a plain
    // click, which still opens the native picker there.
    if (typeof (el as any).showPicker === "function") {
      (el as any).showPicker();
    } else {
      el.click();
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(shiftDate(date, -1))}
        aria-label="Previous day"
        className="p-2 rounded-lg text-mt hover:text-white hover:bg-sur2 transition-colors shrink-0"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex-1 flex items-center justify-between overflow-x-auto no-scrollbar gap-1">
        {days.map((iso) => {
          const active = iso === date;
          const { top, bottom } = dayLabel(iso);
          return (
            <button
              key={iso}
              onClick={() => onChange(iso)}
              className={
                "flex flex-col items-center justify-center shrink-0 px-2.5 py-1.5 rounded-lg min-w-[52px] transition-colors " +
                (active
                  ? "bg-volt/10 text-volt border border-volt/25"
                  : "text-mt hover:text-white hover:bg-sur2 border border-transparent")
              }
            >
              <span className="text-[10px] font-mono font-bold tracking-wide">{top}</span>
              {bottom && <span className="text-[11px] font-semibold">{bottom}</span>}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onChange(shiftDate(date, 1))}
        aria-label="Next day"
        className="p-2 rounded-lg text-mt hover:text-white hover:bg-sur2 transition-colors shrink-0"
      >
        <ChevronRight size={18} />
      </button>

      <div className="relative shrink-0">
        <button
          onClick={openPicker}
          aria-label="Pick a date"
          className="p-2 rounded-lg text-mt hover:text-white hover:bg-sur2 transition-colors"
        >
          <Calendar size={18} />
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
