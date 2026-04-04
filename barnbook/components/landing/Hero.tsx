import Link from "next/link";

export default function Hero() {
  return (
    <header style={{ padding: "80px 0 120px" }} className="relative max-[900px]:!py-14">
      <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
        <div
          className="max-[900px]:!grid-cols-1 max-[900px]:!gap-14"
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 1fr",
            gap: "80px",
            alignItems: "center",
          }}
        >
          {/* Copy side */}
          <div>
            <div className="reveal reveal-1 inline-flex items-center gap-[10px] text-[13px] font-medium uppercase text-saddle mb-7" style={{ letterSpacing: "0.12em" }}>
              <span style={{ width: 28, height: 1, background: "var(--saddle)", display: "inline-block" }} />
              For horse people &amp; the teams behind them
            </div>
            <h1 className="reveal reveal-2 font-serif font-light text-ink mb-8 max-[900px]:mb-6" style={{ fontSize: "clamp(48px, 6.2vw, 88px)", lineHeight: 0.98, letterSpacing: "-0.035em" }}>
              Every horse.<br />
              Every professional.<br />
              <em className="italic text-forest" style={{ fontWeight: 400, fontVariationSettings: '"SOFT" 50' }}>One book.</em>
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

          {/* Visual side — horse card with orbiting role pills */}
          <div
            className="reveal reveal-3 max-[900px]:!max-w-[420px] max-[900px]:!mx-auto max-[900px]:!ml-auto"
            style={{
              position: "relative",
              aspectRatio: "1 / 1.05",
              maxWidth: 540,
              width: "100%",
              marginLeft: "auto",
            }}
          >
            {/* Connection lines SVG */}
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 1,
              }}
              viewBox="0 0 500 525"
              preserveAspectRatio="none"
            >
              <path d="M 250 262 Q 120 160 60 70" stroke="var(--saddle)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" opacity="0.5" />
              <path d="M 250 262 Q 390 150 460 60" stroke="var(--saddle)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" opacity="0.5" />
              <path d="M 250 262 Q 110 360 40 480" stroke="var(--saddle)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" opacity="0.5" />
              <path d="M 250 262 Q 380 400 450 500" stroke="var(--saddle)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" opacity="0.5" />
            </svg>

            {/* Central horse card */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: "62%",
                background: "var(--cream-warm)",
                border: "1px solid var(--line-strong)",
                borderRadius: 18,
                padding: "22px 22px 20px",
                boxShadow: "0 1px 0 rgba(255, 255, 255, 0.6) inset, 0 24px 60px -20px rgba(28, 26, 20, 0.25), 0 8px 20px -10px rgba(28, 26, 20, 0.15)",
                zIndex: 10,
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #8b4a2b 0%, #5c2e18 100%)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M18 5c0 1-1 2-1 3s1 1 1 3-2 3-2 5 1 2 1 4H9c0-2 1-2 1-4S9 14 8 13s-3-1-3-3 2-3 4-3 2-2 4-2 2 1 3 1 2-1 2 0z" fill="#f5efe4" fillOpacity="0.9"/>
                    <circle cx="16" cy="8" r="0.8" fill="#1c1a14"/>
                  </svg>
                </div>
                <div>
                  <div className="font-serif font-medium text-ink leading-tight" style={{ fontSize: 20, letterSpacing: "-0.01em" }}>Magnolia</div>
                  <div className="text-ink-soft" style={{ fontSize: 12, marginTop: 2 }}>Warmblood mare · 12 yrs</div>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  paddingTop: 14,
                  borderTop: "1px dashed var(--line-strong)",
                }}
              >
                <div>
                  <div style={{ color: "var(--ink-soft)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9.5, marginBottom: 2 }}>Last ride</div>
                  <div className="font-serif font-medium text-ink" style={{ fontSize: 13 }}>Yesterday, 7:30am</div>
                </div>
                <div>
                  <div style={{ color: "var(--ink-soft)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9.5, marginBottom: 2 }}>Farrier</div>
                  <div className="font-serif font-medium text-ink" style={{ fontSize: 13 }}>Mar 28</div>
                </div>
                <div>
                  <div style={{ color: "var(--ink-soft)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9.5, marginBottom: 2 }}>Next vet</div>
                  <div className="font-serif font-medium text-ink" style={{ fontSize: 13 }}>Apr 14</div>
                </div>
                <div>
                  <div style={{ color: "var(--ink-soft)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 9.5, marginBottom: 2 }}>Feed</div>
                  <div className="font-serif font-medium text-ink" style={{ fontSize: 13 }}>3qt / AM + PM</div>
                </div>
              </div>
            </div>

            {/* Role pills — positioned with inline styles to preserve exact percentages */}
            <RolePill top="4%" left="2%" delay="0s" iconBg="#d4e4d8" iconColor="var(--forest)" label="Trainer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="m22 11-3 3-2-2"/>
              </svg>
            </RolePill>
            <RolePill top="8%" right="-2%" delay="1.5s" iconBg="#f5dcc0" iconColor="var(--saddle)" label="Vet">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v4M16 2v4"/>
                <rect x="3" y="6" width="18" height="15" rx="2"/>
                <path d="M12 11v6M9 14h6"/>
              </svg>
            </RolePill>
            <RolePill bottom="10%" left="-2%" delay="3s" iconBg="#eadba8" iconColor="#8a6515" label="Farrier">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M4.93 19.07l2.83-2.83M12 22v-4M19.07 19.07l-2.83-2.83M22 12h-4M19.07 4.93l-2.83 2.83"/>
              </svg>
            </RolePill>
            <RolePill bottom="4%" right="4%" delay="4.5s" iconBg="#e8d2cc" iconColor="var(--rust)" label="Groom">
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

function RolePill({
  top, bottom, left, right,
  delay, iconBg, iconColor, label, children,
}: {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  delay: string;
  iconBg: string;
  iconColor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        bottom,
        left,
        right,
        background: "var(--cream)",
        border: "1px solid var(--line-strong)",
        padding: "10px 16px 10px 12px",
        borderRadius: 100,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 13,
        fontWeight: 500,
        color: "var(--ink)",
        boxShadow: "0 8px 20px -12px rgba(28, 26, 20, 0.25)",
        zIndex: 5,
        animation: `landing-float 6s ease-in-out infinite`,
        animationDelay: delay,
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: iconBg,
          color: iconColor,
        }}
      >
        {children}
      </span>
      {label}
    </div>
  );
}
