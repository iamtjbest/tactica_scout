"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSignedIn } from "@/lib/auth";

/**
 * Every editor page sits behind this. It is a convenience, NOT a
 * security boundary: the backend checks the bearer token and the
 * tournament's owner_id on every request, so a user who bypasses this
 * component still can't read or change anything that isn't theirs.
 */
export default function Guard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "in" | "out">("checking");

  useEffect(() => {
    isSignedIn().then((ok) => {
      setState(ok ? "in" : "out");
      if (!ok) router.replace("/signin");
    });
  }, [router]);

  if (state === "checking") return <p className="text-mt text-sm">Loading...</p>;
  if (state === "out") return null;
  return <>{children}</>;
}
