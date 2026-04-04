import Link from "next/link";

export default function Hero() {
  return (
    <header style={{ padding: "80px 0 120px" }} className="relative max-[900px]:!py-14">
      <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
        <div className="max-w-[680px]">
          <div className="reveal reveal-1 inline-flex items-center gap-[10px] text-[13px] font-medium uppercase text-saddle mb-7" style={{ letterSpacing: "0.12em" }}>
            <span style={{ width: 28, height: 1, background: "var(--saddle)", display: "inline-block" }} />
            For horse people &amp; the teams behind them
          </div>
          <h1 className="reveal reveal-2 font-serif font-light text-ink mb-8 max-[900px]:mb-6" style={{ fontSize: "clamp(48px, 6.2vw, 88px)", lineHeight: 0.98, letterSpacing: "-0.035em" }}>
            Every Horse.<br />
            Every Professional.<br />
            <em className="italic text-forest" style={{ fontWeight: 400, fontVariationSettings: '"SOFT" 50' }}>One Book.</em>
          </h1>
          <p className="reveal reveal-3 text-ink-soft mb-11 font-normal max-[900px]:!text-[17px] max-[900px]:!mb-8" style={{ fontSize: 20, lineHeight: 1.55, maxWidth: 520 }}>
            BarnBook puts your horse&apos;s full history at your team&apos;s fingertips.
            Trainers see the work. Vets see the records. Farriers see the schedule.
            You see it all — from the shed row, from your phone, from anywhere.
          </p>
          <div className="reveal reveal-4 flex gap-3.5 items-center flex-wrap max-[560px]:flex-col max-[560px]:items-stretch">
            <Link href="/auth/signup" className="inline-flex items-center gap-2 rounded-full font-sans font-medium no-underline bg-forest text-cream transition-all hover:bg-forest-deep hover:-translate-y-px max-[560px]:justify-center" style={{ padding: "18px 36px", fontSize: 17 }}>
              Sign up free
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10m0 0L8 3m5 5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <a href="#how" className="inline-flex items-center gap-2 rounded-full font-sans font-medium no-underline bg-transparent text-ink transition-all hover:bg-ink hover:text-cream hover:border-ink max-[560px]:justify-center" style={{ padding: "18px 36px", fontSize: 17, border: "1px solid var(--line-strong)" }}>
              See how it works
            </a>
          </div>
          <div className="reveal reveal-5 mt-9 flex items-center gap-3.5 text-ink-soft text-sm">
            <span
              className="rounded-full bg-forest shrink-0"
              style={{
                width: 6,
                height: 6,
                boxShadow: "0 0 0 4px rgba(42, 64, 49, 0.12)",
                animation: "landing-pulse 2.4s ease-in-out infinite",
              }}
            />
            No credit card required to get started.
          </div>
        </div>
      </div>
    </header>
  );
}
