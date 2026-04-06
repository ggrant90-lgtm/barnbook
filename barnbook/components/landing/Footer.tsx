import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-ink py-15 pb-10" style={{ color: "rgba(245, 239, 228, 0.7)" }}>
      <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
        <div className="flex justify-between items-start flex-wrap gap-10 max-[900px]:flex-col">
          {/* Brand */}
          <div className="max-w-[320px]">
            <Link href="/" className="flex items-center gap-2.5 font-serif text-2xl tracking-tight text-cream no-underline mb-3.5" style={{ letterSpacing: "-0.02em", fontWeight: 400 }}>
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
            <p className="text-sm leading-relaxed">
              Every horse. Every detail. One book. Built for small barns and the people who run them.
            </p>
          </div>

          {/* Link columns */}
          <div className="flex gap-14 max-[900px]:gap-10 flex-wrap">
            <div>
              <h4 className="text-cream text-[13px] font-semibold uppercase tracking-[0.06em] mb-3.5">Product</h4>
              <a href="#how" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>How it works</a>
              <a href="#features" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>Features</a>
              <Link href="/auth/signup" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>Sign up</Link>
              <Link href="/auth/signin" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>Sign in</Link>
            </div>
            <div>
              <h4 className="text-cream text-[13px] font-semibold uppercase tracking-[0.06em] mb-3.5">Company</h4>
              <a href="#" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>About</a>
              <a href="#" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>Contact</a>
              <a href="#" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>Blog</a>
            </div>
            <div>
              <h4 className="text-cream text-[13px] font-semibold uppercase tracking-[0.06em] mb-3.5">Legal</h4>
              <Link href="/privacy" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>Privacy Policy</Link>
              <Link href="/terms" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>Terms of Service</Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 flex justify-between flex-wrap gap-3 text-[13px]" style={{ borderTop: "1px solid rgba(245, 239, 228, 0.1)", color: "rgba(245, 239, 228, 0.5)" }}>
          <div>&copy; 2026 BarnBook. All rights reserved.</div>
          <div>Prescott, Arizona</div>
        </div>
      </div>
    </footer>
  );
}
