import clsx from "clsx";
import type { TournamentStatus } from "@/lib/api";

/** One place deciding how a status looks, so "approved" is never green
 *  on one screen and grey on another. */
const TONE: Record<TournamentStatus, string> = {
  draft:       "bg-white/5 text-mt border-bd",
  pending:     "bg-amber/10 text-amber border-amber/30",
  approved:    "bg-grn/10 text-grn border-grn/30",
  rejected:    "bg-red2/10 text-red2 border-red2/30",
  unpublished: "bg-white/5 text-mt2 border-bd",
};

const LABEL: Record<TournamentStatus, string> = {
  draft: "Draft",
  pending: "In review",
  approved: "Live on Scout",
  rejected: "Changes needed",
  unpublished: "Unpublished",
};

export default function StatusPill({ status }: { status: TournamentStatus }) {
  return (
    <span className={clsx(
      "inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold",
      TONE[status]
    )}>
      {LABEL[status]}
    </span>
  );
}
