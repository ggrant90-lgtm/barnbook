import Link from "next/link";

export default function Hero() {
  return (
    <header className="py-20 max-[900px]:py-14 relative">
      <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
        <div className="grid grid-cols-[1.05fr_1fr] gap-20 items-center max-[900px]:grid-cols-1 max-[900px]:gap-14">
          {/* Copy side */}
          <div>
            <div className="reveal reveal-1 inline-flex items-center gap-[10px] text-[13px] font-medium uppercase tracking-[0.12em] text-saddle mb-7 before:content-[''] before:w-7 before:h-px before:bg-saddle">
              For horse people &amp; the teams behind them
            </div>
            <h1 className="reveal reveal-2 font-serif font-light leading-[0.98] text-ink mb-8 max-[900px]:mb-6" style={{ fontSize: "clamp(48px, 6.2vw, 88px)", letterSpacing: "-0.035em" }}>
              Every horse.<br />
              Every professional.<br />
              <em className="italic font-normal text-forest" style={{ fontWeight: 400, fontVariationSettings: '"SOFT" 50' }}>One book.</em>
            </h1>
            <p className="reveal reveal-3 text-xl text-ink-soft max-w-[520px] mb-11 font-normal leading-relaxed max-[900px]:text-[17px] max-[900px]:mb-8">
              BarnBook puts your horse&apos;s full history at your team&apos;s fingertips.
              Trainers see the work. Vets see the records. Farriers see the schedule.
              You see it all — from the shed row, from your phone, from anywhere.
            </p>
            <div className="reveal reveal-4 flex gap-3.5 items-center flex-wrap max-[560px]:flex-col max-[560px]:items-stretch">
              <Link href="/auth/signup" className="inline-flex items-center gap-2 px-9 py-[18px] rounded-full font-sans font-medium text-[17px] no-underline bg-forest text-cream transition-all hover:bg-forest-deep hover:-translate-y-px max-[560px]:justify-center" style={{ boxShadow: "none" }}>
                Sign up free
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10m0 0L8 3m5 5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <a href="#how" className="inline-flex items-center gap-2 px-9 py-[18px] rounded-full font-sans font-medium text-[17px] no-underline bg-transparent text-ink border border-[var(--line-strong)] transition-all hover:bg-ink hover:text-cream hover:border-ink max-[560px]:justify-center">
                See how it works
              </a>
            </div>
            <div className="reveal reveal-5 mt-9 flex items-center gap-3.5 text-ink-soft text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-forest" style={{ boxShadow: "0 0 0 4px rgba(42, 64, 49, 0.12)", animation: "landing-pulse 2.4s ease-in-out infinite" }} />
              No credit card. From one horse to one hundred.
            </div>
          </div>

          {/* Visual side — horse card with orbiting role pills */}
          <div className="reveal reveal-3 relative max-w-[540px] ml-auto max-[900px]:max-w-[420px] max-[900px]:mx-auto" style={{ aspectRatio: "1 / 1.05" }}>
            {/* Connection lines SVG */}
            <svg className="absolute inset-0 pointer-events-none z-[1]" viewBox="0 0 500 525" preserveAspectRatio="none">
              <path d="M 250 262 Q 120 160 60 70" stroke="var(--saddle)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" opacity="0.5" />
              <path d="M 250 262 Q 390 150 460 60" stroke="var(--saddle)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" opacity="0.5" />
              <path d="M 250 262 Q 110 360 40 480" stroke="var(--saddle)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" opacity="0.5" />
              <path d="M 250 262 Q 380 400 450 500" stroke="var(--saddle)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" opacity="0.5" />
            </svg>

            {/* Central horse card */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[62%] bg-cream-warm border border-[var(--line-strong)] rounded-[18px] p-[22px] pb-5 z-10" style={{ boxShadow: "0 1px 0 rgba(255, 255, 255, 0.6) inset, 0 24px 60px -20px rgba(28, 26, 20, 0.25), 0 8px 20px -10px rgba(28, 26, 20, 0.15)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-[52px] h-[52px] rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #8b4a2b 0%, #5c2e18 100%)", boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M18 5c0 1-1 2-1 3s1 1 1 3-2 3-2 5 1 2 1 4H9c0-2 1-2 1-4S9 14 8 13s-3-1-3-3 2-3 4-3 2-2 4-2 2 1 3 1 2-1 2 0z" fill="#f5efe4" fillOpacity="0.9"/>
                    <circle cx="16" cy="8" r="0.8" fill="#1c1a14"/>
                  </svg>
                </div>
                <div>
                  <div className="font-serif text-xl font-medium text-ink leading-tight" style={{ letterSpacing: "-0.01em" }}>Magnolia</div>
                  <div className="text-xs text-ink-soft mt-0.5">Warmblood mare · 12 yrs</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-3.5 border-t border-dashed border-[var(--line-strong)]">
                <div>
                  <div className="text-ink-soft uppercase tracking-[0.06em] text-[9.5px] mb-0.5">Last ride</div>
                  <div className="font-serif font-medium text-ink text-[13px]">Yesterday, 7:30am</div>
                </div>
                <div>
                  <div className="text-ink-soft uppercase tracking-[0.06em] text-[9.5px] mb-0.5">Farrier</div>
                  <div className="font-serif font-medium text-ink text-[13px]">Mar 28</div>
                </div>
                <div>
                  <div className="text-ink-soft uppercase tracking-[0.06em] text-[9.5px] mb-0.5">Next vet</div>
                  <div className="font-serif font-medium text-ink text-[13px]">Apr 14</div>
                </div>
                <div>
                  <div className="text-ink-soft uppercase tracking-[0.06em] text-[9.5px] mb-0.5">Feed</div>
                  <div className="font-serif font-medium text-ink text-[13px]">3qt / AM + PM</div>
                </div>
              </div>
            </div>

            {/* Role pills */}
            <RolePill position="top-[4%] left-[2%]" delay="0s" iconBg="#d4e4d8" iconColor="var(--forest)" label="Trainer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="m22 11-3 3-2-2"/>
              </svg>
            </RolePill>
            <RolePill position="top-[8%] right-[-2%]" delay="1.5s" iconBg="#f5dcc0" iconColor="var(--saddle)" label="Vet">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v4M16 2v4"/>
                <rect x="3" y="6" width="18" height="15" rx="2"/>
                <path d="M12 11v6M9 14h6"/>
              </svg>
            </RolePill>
            <RolePill position="bottom-[10%] left-[-2%]" delay="3s" iconBg="#eadba8" iconColor="#8a6515" label="Farrier">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M4.93 19.07l2.83-2.83M12 22v-4M19.07 19.07l-2.83-2.83M22 12h-4M19.07 4.93l-2.83 2.83"/>
              </svg>
            </RolePill>
            <RolePill position="bottom-[4%] right-[4%]" delay="4.5s" iconBg="#e8d2cc" iconColor="var(--rust)" label="Groom">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </RolePill>
          </div>
        </div>
      </div>
    </header>
  );
}

function RolePill({ position, delay, iconBg, iconColor, label, children }: {
  position: string;
  delay: string;
  iconBg: string;
  iconColor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute ${position} bg-cream border border-[var(--line-strong)] py-2.5 px-4 pl-3 rounded-full flex items-center gap-2.5 text-[13px] font-medium text-ink z-5`}
      style={{
        boxShadow: "0 8px 20px -12px rgba(28, 26, 20, 0.25)",
        animation: `landing-float 6s ease-in-out infinite`,
        animationDelay: delay,
      }}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {children}
      </span>
      {label}
    </div>
  );
}
