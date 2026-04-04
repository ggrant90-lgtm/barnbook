import Link from "next/link";

export default function Nav() {
  return (
    <nav className="sticky top-0 z-100 border-b border-[var(--line)]" style={{ background: "rgba(245, 239, 228, 0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      <div className="flex items-center justify-between px-8 py-[18px] max-w-[1240px] mx-auto max-[900px]:px-[22px] max-[900px]:py-4">
        <Link href="/" className="flex items-center gap-[10px] font-serif font-medium text-2xl tracking-tight text-ink no-underline" style={{ letterSpacing: "-0.02em" }}>
          <span className="w-8 h-8 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 8 L6 26 L16 22 L26 26 L26 8 L16 12 Z" stroke="#1c1a14" strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
              <path d="M16 12 L16 22" stroke="#1c1a14" strokeWidth="1.8"/>
            </svg>
          </span>
          BarnBook
        </Link>
        <div className="flex items-center gap-9 max-[900px]:gap-[18px]">
          <a href="#how" className="text-ink-soft no-underline text-[15px] font-medium transition-colors hover:text-forest max-[900px]:hidden">How it works</a>
          <a href="#features" className="text-ink-soft no-underline text-[15px] font-medium transition-colors hover:text-forest max-[900px]:hidden">Features</a>
          <Link href="/auth/signin" className="text-ink-soft no-underline text-[15px] font-medium transition-colors hover:text-forest max-[560px]:hidden">Sign in</Link>
          <Link href="/auth/signup" className="inline-flex items-center gap-2 px-[22px] py-3 rounded-full font-sans font-medium text-[15px] no-underline bg-forest text-cream transition-all hover:bg-forest-deep hover:-translate-y-px" style={{ boxShadow: "none" }}>
            Sign up free
          </Link>
        </div>
      </div>
    </nav>
  );
}
