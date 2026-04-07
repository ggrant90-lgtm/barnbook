import Link from "next/link";
import Image from "next/image";

export default function Nav() {
  return (
    <nav className="sticky top-0 z-100 border-b border-[var(--line)]" style={{ background: "rgba(245, 239, 228, 0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      <div className="flex items-center justify-between px-8 py-[14px] max-w-[1240px] mx-auto max-[900px]:px-[22px] max-[900px]:py-3">
        <Link href="/" className="flex items-center gap-2.5 font-serif text-2xl tracking-tight text-ink no-underline" style={{ letterSpacing: "-0.02em", fontWeight: 400 }}>
          <Image
            src="/logo.png"
            alt="BarnBook"
            width={40}
            height={40}
            className="rounded-lg"
            style={{ objectFit: "contain" }}
          />
          BarnBook
        </Link>
        <div className="flex items-center gap-9 max-[900px]:gap-[18px]">
          <a href="#how" className="text-ink-soft no-underline text-[15px] font-medium transition-colors hover:text-forest max-[900px]:hidden">How it works</a>
          <a href="#features" className="text-ink-soft no-underline text-[15px] font-medium transition-colors hover:text-forest max-[900px]:hidden">Features</a>
          <Link href="/pricing" className="text-ink-soft no-underline text-[15px] font-medium transition-colors hover:text-forest max-[900px]:hidden">Pricing</Link>
          <Link href="/auth/signin" className="text-ink-soft no-underline text-[15px] font-medium transition-colors hover:text-forest">Sign in</Link>
          <Link href="/auth/signup" className="inline-flex items-center gap-2 px-[22px] py-3 rounded-full font-sans font-medium text-[15px] no-underline bg-forest text-cream transition-all hover:bg-forest-deep hover:-translate-y-px" style={{ boxShadow: "none" }}>
            Sign up free
          </Link>
        </div>
      </div>
    </nav>
  );
}
