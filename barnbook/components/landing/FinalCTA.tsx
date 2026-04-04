import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="text-center py-[140px] pb-[160px] max-[900px]:py-20 relative">
      <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
        <h2 className="font-serif font-light leading-[1.02] text-ink mb-6" style={{ fontSize: "clamp(40px, 5vw, 64px)", letterSpacing: "-0.03em" }}>
          Get your barn <em className="italic text-forest">in the book.</em>
        </h2>
        <p className="text-lg text-ink-soft leading-relaxed max-w-[560px] mx-auto mb-11">
          Free to start. No credit card. Add your first horse in under three minutes.
        </p>
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-2 px-9 py-[18px] rounded-full font-sans font-medium text-[17px] no-underline bg-forest text-cream transition-all hover:bg-forest-deep hover:-translate-y-px"
          style={{ boxShadow: "none" }}
        >
          Sign up free
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10m0 0L8 3m5 5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <p className="mt-6 text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-forest underline">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
