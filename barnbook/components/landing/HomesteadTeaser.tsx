import Link from "next/link";

const stats = [
  "Every feature included",
  "No credit card required",
  "Keep what you build",
  "Grandfathered forever",
];

export default function HomesteadTeaser() {
  return (
    <section
      className="py-[120px] max-[900px]:py-20 relative"
      style={{ background: "var(--cream-dark)" }}
    >
      <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
        <div className="max-w-[680px] mx-auto text-center">
          <div
            className="inline-flex items-center gap-[10px] text-[13px] font-medium uppercase text-saddle mb-7"
            style={{ letterSpacing: "0.12em" }}
          >
            <span
              style={{
                width: 28,
                height: 1,
                background: "var(--saddle)",
                display: "inline-block",
              }}
            />
            Homestead Territory
            <span
              style={{
                width: 28,
                height: 1,
                background: "var(--saddle)",
                display: "inline-block",
              }}
            />
          </div>

          <h2
            className="font-serif text-ink mb-6"
            style={{
              fontSize: "clamp(36px, 5vw, 56px)",
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
              fontWeight: 400,
            }}
          >
            Free to build.{" "}
            <em className="italic text-forest">Yours to keep.</em>
          </h2>

          <p
            className="text-ink-soft mb-10 mx-auto font-normal"
            style={{ fontSize: 19, lineHeight: 1.6, maxWidth: 520 }}
          >
            BarnBook is in Homestead Territory. Everything we&apos;ve built is
            free to use. When paid plans arrive, whatever you&apos;ve built is
            grandfathered. Permanently.
          </p>

          <div className="flex gap-3.5 items-center justify-center flex-wrap max-[560px]:flex-col max-[560px]:items-stretch">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-full font-sans font-medium no-underline bg-forest text-cream transition-all hover:bg-forest-deep hover:-translate-y-px max-[560px]:justify-center"
              style={{ padding: "18px 36px", fontSize: 17 }}
            >
              Start building free
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8h10m0 0L8 3m5 5l-5 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full font-sans font-medium no-underline bg-transparent text-ink transition-all hover:bg-ink hover:text-cream hover:border-ink max-[560px]:justify-center"
              style={{
                padding: "18px 36px",
                fontSize: 17,
                border: "1px solid var(--line-strong)",
              }}
            >
              See pricing
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8h10m0 0L8 3m5 5l-5 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>

          {/* Mini stats */}
          <div className="mt-12 grid grid-cols-4 max-[700px]:grid-cols-2 gap-x-8 gap-y-4">
            {stats.map((s) => (
              <div
                key={s}
                className="flex items-center gap-2.5 text-ink-soft text-[14px]"
              >
                <svg
                  className="shrink-0"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M3 8l4 4 6-7"
                    stroke="var(--forest)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
