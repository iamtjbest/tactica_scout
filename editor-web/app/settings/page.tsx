"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Guard from "@/components/Guard";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function Page() {
  return <Guard><Settings /></Guard>;
}

/**
 * Account-level settings.
 *
 * Billing lives here rather than in the main menu. It is something you
 * visit when a card expires or an invoice is due, not a place you work,
 * and a top-level slot is for things you open every day.
 */
function Settings() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase().auth.getUser()
      .then(({ data }) => setEmail(data.user?.email || ""))
      .catch(() => {});
  }, []);

  const out = async () => {
    try { await signOut(); } catch { /* sign out locally regardless */ }
    router.replace("/signin");
  };

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-white">Settings</h1>
        <p className="text-mt text-sm mt-1">Your account, billing and access.</p>
      </div>

      <div className="card">
        <p className="section-label mb-3">Account</p>
        <p className="text-mt text-xs uppercase tracking-wide">Signed in as</p>
        <p className="text-white mt-1">{email || "Loading..."}</p>
        <p className="text-mt2 text-xs mt-3">
          One account works across Scout and the editor. Your email and password
          are changed in Scout.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/billing" className="card block hover:border-volt/40 transition-colors">
          <p className="text-white font-semibold">Billing</p>
          <p className="text-mt text-sm mt-1">
            Your plan and generated-image quota. Hosting competitions is free.
          </p>
        </Link>

        <Link href="/join" className="card block hover:border-volt/40 transition-colors">
          <p className="text-white font-semibold">Join a competition</p>
          <p className="text-mt text-sm mt-1">
            Got an invite code from an organiser? Enter it here.
          </p>
        </Link>
      </div>

      <div className="card">
        <p className="section-label mb-3">Session</p>
        <button onClick={out}
                className="border border-bd2 text-white font-semibold text-sm px-5 py-2.5
                           rounded-xl hover:border-red2 hover:text-red2 transition-colors">
          Sign out
        </button>
      </div>
    </div>
  );
}
