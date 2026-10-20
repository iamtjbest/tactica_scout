"use client";

/**
 * editor.tactica.com.ng — the public front door.
 *
 * Not the dashboard. The dashboard moved to /competitions, because
 * someone arriving at this domain for the first time has no idea what
 * Scout Editor is, and a table of tournaments they don't own tells them
 * nothing.
 *
 * Every graphic on this page is drawn in SVG rather than photographed.
 * Two reasons, and the second one matters more: house rule is that
 * images come from Figma or are generated, never stock; and a drawn
 * pitch is a few kilobytes where a hero photo is a few megabytes, which
 * on Nigerian mobile data is the difference between a page that opens
 * and a page that doesn't. Slots are marked where Figma art drops in.
 */
import Link from "next/link";
import PitchField from "@/components/PitchField";
import ScoreCardArt from "@/components/ScoreCardArt";

const SCOUT = "https://scout.tactica.com.ng";
const TACTICA = "https://tactica.com.ng";
const CONTACT = "hello@tactica.com.ng";

/* What the thing actually does. Written as outcomes, because "fixture
   generation" is a feature and "you stop keeping the table in a
   notebook" is the reason anyone signs up. */
const DOES = [
  {
    n: "01",
    h: "Your draw, or ours",
    p: "Upload the fixture list you already have, or let the generator build it. Round robin, groups into knockout, or straight knockout. Byes handled, home and away balanced.",
  },
  {
    n: "02",
    h: "The table keeps itself",
    p: "Standings are worked out from results every time the page loads, never stored. Correct a scoreline at 9pm and the table is right at 9pm. Live matches stay out of it until they finish.",
  },
  {
    n: "03",
    h: "Three pitches, three people",
    p: "Invite your match commissioners with a code short enough to read out across a pitch. They log goals, cards and assists on their own match. Only you can touch teams, formats and the draw.",
  },
  {
    n: "04",
    h: "Crests, not placeholders",
    p: "Upload a badge once and it follows that club through every fixture list, every table, every match page, in the editor and in Scout.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg text-white overflow-x-hidden">
      {/* ── top bar ─────────────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between
                         max-w-screen-xl mx-auto px-5 sm:px-8 py-5">
        <span className="font-display font-black text-lg tracking-tight">
          Scout <span className="text-volt">Editor</span>
        </span>
        <nav className="flex items-center gap-2 sm:gap-5 text-[13px]">
          <a href="#what" className="hidden sm:inline text-mt hover:text-white transition-colors">
            What it does
          </a>
          <a href="#scout" className="hidden sm:inline text-mt hover:text-white transition-colors">
            Scout
          </a>
          <a href="#contact" className="text-mt hover:text-white transition-colors">
            Contact
          </a>
          <Link
            href="/signin"
            className="bg-volt text-bg font-bold px-4 py-2 rounded-xl
                       hover:bg-volt2 hover:shadow-volt transition-all duration-200"
          >
            Register free
          </Link>
        </nav>
      </header>

      {/* ── hero ────────────────────────────────────────────────── */}
      <section className="relative min-h-[82vh] flex items-center">
        <PitchField />

        <div className="relative z-10 max-w-screen-xl mx-auto px-5 sm:px-8 w-full
                        grid lg:grid-cols-12 gap-12 items-center pb-12 pt-4">
          {/* the claim */}
          <div className="lg:col-span-7">
            <p className="section-label mb-5 animate-[fadeUp_0.6s_ease-out_both]">
              For organisers, anywhere
            </p>

            <h1
              className="font-display font-black leading-[0.92] tracking-tight
                         text-[2.2rem] sm:text-5xl lg:text-7xl
                         animate-[fadeUp_0.6s_ease-out_0.08s_both]"
            >
              Run your
              <br />
              competition like
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">it matters.</span>
                {/* hand-drawn underline, because a flat highlight bar
                    reads like a template */}
                <svg
                  className="absolute -bottom-2 left-0 w-full h-4"
                  viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true"
                >
                  <path
                    d="M3 11 C70 4, 150 14, 297 6"
                    stroke="#CCFF00" strokeWidth="4" fill="none" strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="mt-7 text-mt text-[15px] sm:text-lg max-w-xl leading-relaxed
                          animate-[fadeUp_0.6s_ease-out_0.16s_both]">
              A university league, a school cup, a company five-a-side, a weekend
              tournament in your area. Enter it once, and it gets a real fixture
              list, a table that updates itself, and a page fans can follow in Scout.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3
                            animate-[fadeUp_0.6s_ease-out_0.24s_both]">
              <Link
                href="/signin"
                className="bg-volt text-bg font-bold text-[15px] px-7 py-3.5 rounded-xl
                           hover:bg-volt2 hover:shadow-volt transition-all duration-200"
              >
                Register for free
              </Link>
              <a
                href="#what"
                className="border border-bd2 text-white font-semibold text-[15px]
                           px-7 py-3.5 rounded-xl hover:border-volt hover:text-volt
                           transition-colors duration-200"
              >
                See how it works
              </a>
            </div>

            <p className="mt-5 font-mono text-[11px] text-mt2 tracking-wide
                          animate-[fadeUp_0.6s_ease-out_0.3s_both]">
              Free to organise. Reviewed before it publishes.
            </p>
          </div>

          {/* drawn match cards, stacked */}
          <div className="lg:col-span-5 relative h-[268px] sm:h-[290px]
                          animate-[fadeUp_0.7s_ease-out_0.32s_both]">
            {/* FIGMA SLOT — a branded hero graphic can replace this whole
                block. Until then these are original drawn cards, no real
                clubs and no invented real results. */}
            <ScoreCardArt
              home="Engineering" away="Social Sciences" hs={2} as={1}
              tilt={-3.5} className="absolute left-0 top-0 w-[74%] sm:w-[70%] z-10"
            />
            <ScoreCardArt
              home="Law" away="Medicine" hs={1} as={1} minute="67'"
              tilt={2.5} className="absolute right-0 top-[118px] w-[74%] sm:w-[70%] z-20"
            />
            <div className="absolute right-3 bottom-0 z-30 bg-volt text-bg
                            font-mono text-[10px] font-bold tracking-[0.18em]
                            uppercase px-3 py-1.5 rounded-lg shadow-volt">
              Table updated
            </div>
          </div>
        </div>
      </section>

      {/* ── what it does ────────────────────────────────────────── */}
      <section id="what" className="relative border-t border-bd scroll-mt-16">
        <div className="max-w-screen-xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <div className="max-w-2xl mb-14">
            <p className="section-label mb-4">What it does</p>
            <h2 className="font-display font-black text-3xl sm:text-5xl leading-[1.02] tracking-tight">
              The admin, taken off your hands.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-px bg-bd rounded-2xl overflow-hidden border border-bd">
            {DOES.map((d) => (
              <div
                key={d.n}
                className="bg-sur p-7 sm:p-9 group hover:bg-sur2 transition-colors duration-300"
              >
                <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-volt
                                 group-hover:text-volt2 transition-colors">
                  {d.n}
                </span>
                <h3 className="font-display font-black text-xl sm:text-2xl mt-4 mb-3 tracking-tight">
                  {d.h}
                </h3>
                <p className="text-mt text-[14.5px] leading-relaxed">{d.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scout ───────────────────────────────────────────────── */}
      <section id="scout" className="relative border-t border-bd scroll-mt-16 overflow-hidden">
        {/* a single centre circle, cropped, as the section's only texture */}
        <svg
          className="absolute -right-32 -top-32 w-[520px] h-[520px] opacity-[0.07]"
          viewBox="0 0 200 200" aria-hidden="true"
        >
          <circle cx="100" cy="100" r="96" stroke="#00E5FF" strokeWidth="1" fill="none" />
          <circle cx="100" cy="100" r="40" stroke="#00E5FF" strokeWidth="1" fill="none" />
          <line x1="100" y1="4" x2="100" y2="196" stroke="#00E5FF" strokeWidth="1" />
        </svg>

        <div className="relative max-w-screen-xl mx-auto px-5 sm:px-8 py-20 sm:py-28
                        grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <p className="font-mono text-[11px] font-bold tracking-[0.22em] uppercase
                          text-cyan mb-4">
              You will need Scout
            </p>
            <h2 className="font-display font-black text-3xl sm:text-5xl leading-[1.02] tracking-tight">
              The editor runs it.
              <br />
              Scout is where it&apos;s seen.
            </h2>
            <p className="mt-7 text-mt text-base leading-relaxed max-w-lg">
              Everything you enter here publishes into Scout, the app your players
              and their families already use for live scores. Your fixture list sits
              next to the Premier League one. Your table, your scorers, your match
              pages.
            </p>
            <p className="mt-4 text-mt text-base leading-relaxed max-w-lg">
              That is also the one dependency: you sign in to the editor with your
              Scout account, so get Scout first. Scout works perfectly well on its
              own if you only want to follow football.
            </p>
            <a
              href={SCOUT}
              className="inline-flex items-center gap-2 mt-8 border border-cyan/40 text-cyan
                         font-bold text-[15px] px-6 py-3.5 rounded-xl
                         hover:bg-cyan hover:text-bg transition-all duration-200"
            >
              Open Scout
              <span aria-hidden="true">→</span>
            </a>
            <p className="mt-3 font-mono text-[11px] text-mt2">scout.tactica.com.ng</p>
          </div>

          {/* phone, drawn */}
          <div className="relative mx-auto w-full max-w-[290px]">
            <div className="rounded-[2rem] border border-bd2 bg-bg2 p-3 shadow-2xl">
              <div className="rounded-[1.5rem] bg-bg border border-bd overflow-hidden">
                <div className="px-4 pt-5 pb-3 border-b border-bd">
                  <p className="font-mono text-[9px] tracking-[0.2em] text-volt uppercase">
                    Scout
                  </p>
                  <p className="font-display font-black text-sm mt-1">Today</p>
                </div>
                <div className="divide-y divide-bd">
                  {[
                    ["Engineering", "Social Sciences", "2", "1", "FT"],
                    ["Law", "Medicine", "1", "1", "67'"],
                    ["Arts", "Sciences", "0", "0", "15:30"],
                  ].map(([h, a, hs, as_, st], i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3">
                      <span className="font-mono text-[9px] text-mt w-9 shrink-0">{st}</span>
                      <div className="flex-1 min-w-0 text-[11px]">
                        <p className="truncate text-white">{h}</p>
                        <p className="truncate text-white">{a}</p>
                      </div>
                      <div className="font-display font-black text-[13px] text-right">
                        <p>{hs}</p>
                        <p>{as_}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-cyan text-bg text-center font-bold text-[11px] py-2.5">
                  Your competition, live
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── how to get on ───────────────────────────────────────── */}
      <section className="border-t border-bd">
        <div className="max-w-screen-xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
          <p className="section-label mb-4">Getting listed</p>
          <h2 className="font-display font-black text-3xl sm:text-4xl tracking-tight mb-12">
            Four steps, then review.
          </h2>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              ["Register", "Your Scout account signs you in here. No separate password."],
              ["Enter the details", "Name, country, level, dates, who to contact. Start date at least two weeks out."],
              ["Add proof", "A letter, a poster, the organising body's page. Anything showing it is real."],
              ["Submit", "We check it, then it publishes into Scout. You keep editing either way."],
            ].map(([h, p], i) => (
              <li key={h} className="relative pl-0">
                <span className="font-display font-black text-5xl text-bd2 leading-none block mb-3">
                  {i + 1}
                </span>
                <h3 className="font-display font-black text-lg mb-2">{h}</h3>
                <p className="text-mt text-[14px] leading-relaxed">{p}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── contact / CTA ───────────────────────────────────────── */}
      <section id="contact" className="border-t border-bd scroll-mt-16">
        <div className="max-w-screen-xl mx-auto px-5 sm:px-8 py-20 sm:py-28
                        grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display font-black text-3xl sm:text-5xl leading-[1.02] tracking-tight">
              Got a competition
              <br />
              starting soon?
            </h2>
            <p className="mt-6 text-mt leading-relaxed max-w-md">
              Register now and build it while you wait for your draw. Nothing
              publishes until you submit it and we have looked at it.
            </p>
            <Link
              href="/signin"
              className="inline-block mt-8 bg-volt text-bg font-bold text-[15px]
                         px-7 py-3.5 rounded-xl hover:bg-volt2 hover:shadow-volt
                         transition-all duration-200"
            >
              Register for free
            </Link>
          </div>

          <div className="card p-7 sm:p-9">
            <p className="section-label mb-4">Talk to us</p>
            <h3 className="font-display font-black text-xl mb-3">
              Questions, or something not working?
            </h3>
            <p className="text-mt text-[14.5px] leading-relaxed mb-6">
              Organising something unusual, a format we don&apos;t generate, a
              competition across several venues? Say so and we will tell you
              straight whether the editor handles it yet.
            </p>
            <a
              href={`mailto:${CONTACT}`}
              className="font-mono text-sm text-volt hover:text-volt2 transition-colors break-all"
            >
              {CONTACT}
            </a>
          </div>
        </div>
      </section>

      {/* ── footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-bd">
        <div className="max-w-screen-xl mx-auto px-5 sm:px-8 py-10
                        flex flex-col sm:flex-row items-start sm:items-center
                        justify-between gap-5">
          <p className="text-mt text-[13px] italic">
            Competitions deserve a proper record.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-mt">
            <a href={SCOUT} className="hover:text-white transition-colors">
              scout.tactica.com.ng
            </a>
            <a href={`mailto:${CONTACT}`} className="hover:text-white transition-colors">
              {CONTACT}
            </a>
            <a
              href={TACTICA}
              className="hover:text-volt transition-colors tracking-[0.14em] uppercase"
            >
              Powered by Tactica
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
