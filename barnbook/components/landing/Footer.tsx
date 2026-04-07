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
              <Link href="/pricing" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>Pricing</Link>
              <Link href="/auth/signup" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>Sign up</Link>
              <Link href="/auth/signin" className="block text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>Sign in</Link>
            </div>
            <div>
              <h4 className="text-cream text-[13px] font-semibold uppercase tracking-[0.06em] mb-3.5">Connect</h4>
              <a href="https://wa.me/19289103669" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm mb-2 no-underline transition-colors hover:text-cream" style={{ color: "rgba(245, 239, 228, 0.6)" }}>
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Chat with us
              </a>
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
