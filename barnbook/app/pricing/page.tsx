import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing — BarnBook",
  description:
    "Build whatever you want, free. Keep what you build, forever. BarnBook is in Homestead Territory.",
};

/* ───────── data ───────── */

const pillars = [
  {
    title: "Keys, not roles",
    desc: "Two permission levels cover every scenario. A Barn Key runs the barn. A Stall Key connects a horse to a person. No spreadsheet of roles to manage.",
  },
  {
    title: "Build, don't subscribe",
    desc: "Your barn starts with a foundation. You add stalls, wings, and features as you need them. You only pay for what you build.",
  },
  {
    title: "Proprietary tags",
    desc: "BarnBook-made NFC tags link a horse to their profile with a tap. Rugged, reusable, and built for barn reality.",
  },
  {
    title: "Commissioned work",
    desc: "Need a custom feature? A branded portal? A specific integration? We build it for you. Your barn, your rules.",
  },
];

const barnKeyBullets = [
  "Full barn management access",
  "Add and remove stalls",
  "Invite team members",
  "View all horses and records",
  "Manage billing and settings",
];

const stallKeyBullets = [
  "Linked to one horse",
  "Given to owners, vets, farriers",
  "Access only what you grant",
  "Revoke anytime with one tap",
  "No account setup required",
];

const tiers = [
  {
    name: "Small Barn",
    stalls: 10,
    price: "$29",
    period: "/mo",
    planKey: "tier_small_barn",
    highlight: false,
  },
  {
    name: "Medium Barn",
    stalls: 20,
    price: "$49",
    period: "/mo",
    planKey: "tier_medium_barn",
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Large Barn",
    stalls: 40,
    price: "$79",
    period: "/mo",
    planKey: "tier_large_barn",
    highlight: false,
  },
  {
    name: "Estate Barn",
    stalls: 80,
    price: "$129",
    period: "/mo",
    planKey: "tier_estate_barn",
    highlight: false,
  },
];

const exampleConfigs = [
  { label: "Small lesson barn", config: "10-stall foundation", monthly: "$29" },
  { label: "Mid-size boarding barn", config: "20-stall foundation", monthly: "$49" },
  { label: "Large training facility", config: "40-stall foundation", monthly: "$79" },
  { label: "Multi-barn estate", config: "80-stall foundation + add-ons", monthly: "$129+" },
];

const addOns = [
  {
    name: "Physical Tag Packs",
    desc: "BarnBook NFC tags for your horses. Tap to pull up any profile instantly.",
    price: "$39.99 - $89.99",
    planKey: "addon_physical_tags",
  },
  {
    name: "SMS Reminder Bundles",
    desc: "Automated text reminders for farrier visits, vaccinations, and appointments.",
    price: "$9.99/mo",
    planKey: "addon_sms_reminders",
  },
  {
    name: "Custom Branded Portal",
    desc: "Your barn's own branded login page and dashboard. Your logo, your colors.",
    price: "$29/mo",
    planKey: "addon_branded_portal",
  },
  {
    name: "Data Migration Service",
    desc: "We move your existing records, spreadsheets, and files into BarnBook for you.",
    price: "$149 - $299",
    planKey: "addon_data_migration",
  },
  {
    name: "Public Barn Page",
    desc: "A public-facing page for your barn with contact info, services, and availability.",
    price: "Free / $14.99/mo",
    planKey: "addon_public_page",
  },
  {
    name: "Provider Directory Listing",
    desc: "Get listed in the BarnBook provider directory so barn owners can find you.",
    price: "$19.99/mo",
    planKey: "addon_provider_listing",
  },
];

const commissionedTiers = [
  {
    name: "Light",
    price: "$300 - $500",
    monthly: "+ $10 - 20/mo",
    desc: "Small tweaks, custom fields, simple integrations. Perfect for one-off needs.",
    planKey: "commissioned_light",
    highlight: false,
  },
  {
    name: "Specialty",
    price: "$1,500 - $5,000",
    monthly: "+ $30 - 75/mo",
    desc: "Custom workflows, branded portals, multi-barn setups. Built to your exact spec.",
    planKey: "commissioned_specialty",
    highlight: true,
    badge: "Most requested",
  },
  {
    name: "Enterprise",
    price: "$10,000 - $25,000+",
    monthly: "+ $150 - 500/mo",
    desc: "Full platform builds, white-label solutions, and enterprise integrations.",
    planKey: "commissioned_enterprise",
    highlight: false,
  },
];

const tagVision = [
  {
    title: "Built for barn reality",
    desc: "Dust, mud, hose water, hooves. Our tags survive what phones and paper can't.",
  },
  {
    title: "Your tags, your ecosystem",
    desc: "Each tag links directly to a BarnBook profile. No third-party apps. No subscriptions for the hardware.",
  },
  {
    title: "Reusable and reassignable",
    desc: "Horse sold? Reassign the tag in seconds. No waste, no reordering.",
  },
  {
    title: "Biometric backup",
    desc: "Photo ID lets anyone identify a horse even without a tag. Two layers of identification, always.",
  },
];

const roadmap = [
  {
    phase: "Foundation",
    desc: "Horse profiles, health records, farrier logs, exercise tracking, team sharing, and photo ID. The complete barn book.",
  },
  {
    phase: "Provider network",
    desc: "Vets, farriers, trainers, and specialists connect to the barns they serve. One profile, every barn.",
  },
  {
    phase: "Regional growth",
    desc: "Local provider directories, barn-to-barn referrals, and community features that make your region stronger.",
  },
  {
    phase: "Premium operations",
    desc: "Invoicing, scheduling, inventory, and the operational tools that turn a barn book into a barn business.",
  },
];

/* ───────── page ───────── */

export default function PricingPage() {
  return (
    <div className="landing-page">
      <div className="landing-content">
        <Nav />

        {/* A — Hero */}
        <header style={{ padding: "80px 0 100px" }} className="relative max-[900px]:!py-14">
          <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
            <div className="max-w-[720px] mx-auto text-center">
              <div className="reveal reveal-1 inline-flex items-center gap-[10px] text-[13px] font-medium uppercase text-saddle mb-7" style={{ letterSpacing: "0.12em" }}>
                <span style={{ width: 28, height: 1, background: "var(--saddle)", display: "inline-block" }} />
                We&apos;re in Homestead Territory
                <span style={{ width: 28, height: 1, background: "var(--saddle)", display: "inline-block" }} />
              </div>
              <h1 className="reveal reveal-2 font-serif text-ink mb-8" style={{ fontSize: "clamp(32px, 5vw, 64px)", lineHeight: 1.08, letterSpacing: "-0.025em", fontWeight: 400 }}>
                Build whatever you want.{" "}
                It&apos;s all free.{" "}
                <em className="italic text-forest">Keep what you build, forever.</em>
              </h1>
              <p className="reveal reveal-3 text-ink-soft mb-10 mx-auto font-normal" style={{ fontSize: 19, lineHeight: 1.6, maxWidth: 560 }}>
                BarnBook is in Homestead Territory. Everything we&apos;ve built so far is free to use, free to explore, and free to build on. When paid plans arrive, whatever you&apos;ve built is grandfathered. Permanently.
              </p>
              <div className="reveal reveal-4 flex gap-3.5 items-center justify-center flex-wrap max-[560px]:flex-col max-[560px]:items-stretch">
                <Link href="/auth/signup" className="inline-flex items-center gap-2 rounded-full font-sans font-medium no-underline bg-forest text-cream transition-all hover:bg-forest-deep hover:-translate-y-px max-[560px]:justify-center" style={{ padding: "18px 36px", fontSize: 17 }}>
                  Start building free
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L8 3m5 5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </Link>
                <a href="#pricing" className="inline-flex items-center gap-2 rounded-full font-sans font-medium no-underline bg-transparent text-ink transition-all hover:bg-ink hover:text-cream hover:border-ink max-[560px]:justify-center" style={{ padding: "18px 36px", fontSize: 17, border: "1px solid var(--line-strong)" }}>
                  See what&apos;s coming
                </a>
              </div>
              <div className="reveal reveal-5 mt-8 flex items-center justify-center gap-3 text-ink-soft text-sm">
                <span className="rounded-full bg-forest shrink-0" style={{ width: 6, height: 6, boxShadow: "0 0 0 4px rgba(42, 64, 49, 0.12)", animation: "landing-pulse 2.4s ease-in-out infinite" }} />
                No credit card, no trial period, no catch.
              </div>
            </div>
          </div>
        </header>

        {/* B — Promise Card */}
        <section className="pb-24 max-[900px]:pb-16">
          <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
            <div className="max-w-[760px] mx-auto rounded-2xl p-10 max-[900px]:p-7" style={{ background: "var(--cream-warm)", border: "2px solid #c9a84c", boxShadow: "0 2px 24px rgba(201, 168, 76, 0.10)" }}>
              <h2 className="font-serif text-ink mb-4" style={{ fontSize: "clamp(24px, 3vw, 32px)", letterSpacing: "-0.02em", fontWeight: 400 }}>
                The Homestead Promise
              </h2>
              <p className="text-ink-soft leading-relaxed mb-4" style={{ fontSize: 16 }}>
                Whatever you build during Homestead Territory is yours to keep — free, forever. When we introduce paid plans, your existing barns, horses, records, and team connections are grandfathered at no cost. We won&apos;t pull the rug.
              </p>
              <p className="text-ink-soft leading-relaxed" style={{ fontSize: 15 }}>
                We&apos;ll give at least <strong className="text-ink font-semibold">90 days notice</strong> before any pricing takes effect. You&apos;ll see it coming, and you&apos;ll have time to decide what&apos;s next.
              </p>
            </div>
          </div>
        </section>

        {/* C — Four Pillars */}
        <section className="pb-28 max-[900px]:pb-20">
          <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <h2 className="font-serif text-ink mb-4" style={{ fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-0.025em", fontWeight: 400 }}>
                What BarnBook is becoming
              </h2>
            </div>
            <div className="grid grid-cols-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1 gap-6">
              {pillars.map((p) => (
                <div key={p.title} className="rounded-2xl p-8 max-[900px]:p-6" style={{ background: "var(--cream-warm)", border: "1px solid var(--line)" }}>
                  <h3 className="font-serif text-ink text-[20px] mb-3" style={{ letterSpacing: "-0.01em" }}>{p.title}</h3>
                  <p className="text-ink-soft text-[14.5px] leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* D — Keys Explanation */}
        <section className="pb-28 max-[900px]:pb-20">
          <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <h2 className="font-serif text-ink mb-4" style={{ fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-0.025em", fontWeight: 400 }}>
                Two keys. That&apos;s the whole system.
              </h2>
            </div>
            <div className="grid grid-cols-2 max-[700px]:grid-cols-1 gap-8 max-w-[880px] mx-auto">
              {/* Barn Key */}
              <div className="rounded-2xl p-8" style={{ background: "var(--forest)", color: "var(--cream)" }}>
                <div className="w-11 h-11 rounded-[10px] flex items-center justify-center mb-5" style={{ background: "rgba(201, 168, 76, 0.18)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                </div>
                <h3 className="font-serif text-[22px] mb-4" style={{ color: "var(--cream)" }}>Barn Key</h3>
                <ul className="space-y-2.5">
                  {barnKeyBullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed" style={{ color: "rgba(245, 239, 228, 0.8)" }}>
                      <svg className="mt-1 shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="#c9a84c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Stall Key */}
              <div className="rounded-2xl p-8" style={{ background: "var(--cream-warm)", border: "1px solid var(--line)" }}>
                <div className="w-11 h-11 rounded-[10px] flex items-center justify-center mb-5" style={{ background: "rgba(42, 64, 49, 0.10)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                </div>
                <h3 className="font-serif text-ink text-[22px] mb-4">Stall Key</h3>
                <ul className="space-y-2.5">
                  {stallKeyBullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-ink-soft">
                      <svg className="mt-1 shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="var(--forest)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* E — Build-A-Barn Pricing */}
        <section id="pricing" className="py-28 max-[900px]:py-20 bg-forest text-cream relative overflow-hidden" style={{ margin: "0 -100vw", paddingLeft: "100vw", paddingRight: "100vw" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 15% 20%, rgba(201, 147, 42, 0.06) 0%, transparent 40%), radial-gradient(circle at 85% 80%, rgba(139, 74, 43, 0.08) 0%, transparent 40%)" }} />
          <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px] relative">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <div className="inline-flex items-center gap-[10px] text-[13px] font-medium uppercase mb-5" style={{ letterSpacing: "0.12em", color: "#c9a84c" }}>
                <span style={{ width: 28, height: 1, background: "#c9a84c", display: "inline-block" }} />
                Build-A-Barn
                <span style={{ width: 28, height: 1, background: "#c9a84c", display: "inline-block" }} />
              </div>
              <h2 className="font-serif text-cream mb-4" style={{ fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-0.025em", fontWeight: 400 }}>
                Pick your foundation
              </h2>
              <p className="text-lg leading-relaxed" style={{ color: "rgba(245, 239, 228, 0.7)" }}>
                Every plan includes every feature. The only difference is stall count. Stack foundations to build bigger.
              </p>
            </div>

            <div className="grid grid-cols-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1 gap-5">
              {tiers.map((t) => (
                <div key={t.planKey} className="rounded-2xl p-7 relative flex flex-col" style={{ background: t.highlight ? "rgba(201, 168, 76, 0.12)" : "rgba(245, 239, 228, 0.06)", border: t.highlight ? "2px solid #c9a84c" : "1px solid rgba(245, 239, 228, 0.12)" }}>
                  {t.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase px-3 py-1 rounded-full" style={{ background: "#c9a84c", color: "var(--ink)", letterSpacing: "0.06em" }}>{t.badge}</span>
                  )}
                  <h3 className="font-serif text-[20px] text-cream mb-1">{t.name}</h3>
                  <p className="text-sm mb-5" style={{ color: "rgba(245, 239, 228, 0.6)" }}>{t.stalls} stalls</p>
                  <div className="mb-6">
                    <span className="text-[36px] font-serif text-cream" style={{ letterSpacing: "-0.02em" }}>{t.price}</span>
                    <span className="text-sm" style={{ color: "rgba(245, 239, 228, 0.6)" }}>{t.period}</span>
                  </div>
                  <PricingClient planKey={t.planKey} planName={t.name} label="Get on the list" variant="tier" />
                </div>
              ))}
            </div>

            {/* Stacking note */}
            <p className="text-center text-sm mt-8 mb-10" style={{ color: "rgba(245, 239, 228, 0.6)" }}>
              Foundations stack. Need 30 stalls? Combine a 20 and a 10. Need 60? A 40 and a 20.
            </p>

            {/* Example configurations table */}
            <div className="max-w-[700px] mx-auto rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(245, 239, 228, 0.12)" }}>
              <div className="px-6 py-4" style={{ background: "rgba(245, 239, 228, 0.06)", borderBottom: "1px solid rgba(245, 239, 228, 0.08)" }}>
                <h4 className="font-serif text-cream text-[17px]">Example configurations</h4>
              </div>
              <div>
                {exampleConfigs.map((c, i) => (
                  <div key={c.label} className="flex items-center justify-between px-6 py-3.5 text-sm" style={{ borderBottom: i < exampleConfigs.length - 1 ? "1px solid rgba(245, 239, 228, 0.06)" : undefined }}>
                    <div>
                      <span className="text-cream">{c.label}</span>
                      <span className="mx-2" style={{ color: "rgba(245, 239, 228, 0.3)" }}>/</span>
                      <span style={{ color: "rgba(245, 239, 228, 0.55)" }}>{c.config}</span>
                    </div>
                    <span className="font-medium" style={{ color: "#c9a84c" }}>{c.monthly}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* F — Add-Ons */}
        <section className="py-28 max-[900px]:py-20">
          <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <h2 className="font-serif text-ink mb-4" style={{ fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-0.025em", fontWeight: 400 }}>
                Add-ons
              </h2>
              <p className="text-ink-soft text-lg leading-relaxed">
                Extra tools and services you can bolt on when you need them.
              </p>
            </div>
            <div className="grid grid-cols-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1 gap-5">
              {addOns.map((a) => (
                <div key={a.planKey} className="rounded-2xl p-7 flex flex-col" style={{ background: "var(--cream-warm)", border: "1px solid var(--line)" }}>
                  <h3 className="font-serif text-ink text-[19px] mb-2" style={{ letterSpacing: "-0.01em" }}>{a.name}</h3>
                  <p className="text-ink-soft text-[14px] leading-relaxed mb-4 flex-1">{a.desc}</p>
                  <p className="font-semibold text-ink text-[15px] mb-5">{a.price}</p>
                  <PricingClient planKey={a.planKey} planName={a.name} label="Get on the list" variant="addon" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* G — Commissioned Work */}
        <section className="pb-28 max-[900px]:pb-20">
          <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
            <div className="text-center max-w-[640px] mx-auto mb-14">
              <div className="inline-flex items-center gap-[10px] text-[13px] font-medium uppercase text-saddle mb-5" style={{ letterSpacing: "0.12em" }}>
                <span style={{ width: 28, height: 1, background: "var(--saddle)", display: "inline-block" }} />
                Commissioned Work
                <span style={{ width: 28, height: 1, background: "var(--saddle)", display: "inline-block" }} />
              </div>
              <h2 className="font-serif text-ink mb-4" style={{ fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-0.025em", fontWeight: 400 }}>
                We build it for you
              </h2>
              <p className="text-ink-soft text-lg leading-relaxed">
                Need something custom? Tell us what you need and we&apos;ll scope it, build it, and maintain it.
              </p>
            </div>
            <div className="grid grid-cols-3 max-[900px]:grid-cols-1 gap-6 max-w-[1000px] mx-auto">
              {commissionedTiers.map((c) => (
                <div key={c.planKey} className="rounded-2xl p-8 relative flex flex-col" style={{ background: c.highlight ? "var(--forest)" : "var(--cream-warm)", border: c.highlight ? "2px solid #c9a84c" : "1px solid var(--line)" }}>
                  {c.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase px-3 py-1 rounded-full" style={{ background: "#c9a84c", color: "var(--ink)", letterSpacing: "0.06em" }}>{c.badge}</span>
                  )}
                  <h3 className={`font-serif text-[22px] mb-2 ${c.highlight ? "text-cream" : "text-ink"}`}>{c.name}</h3>
                  <div className="mb-1">
                    <span className={`text-[28px] font-serif ${c.highlight ? "text-cream" : "text-ink"}`} style={{ letterSpacing: "-0.02em" }}>{c.price}</span>
                  </div>
                  <p className="text-sm mb-5" style={{ color: c.highlight ? "rgba(245, 239, 228, 0.6)" : "var(--ink-soft)" }}>{c.monthly}</p>
                  <p className={`text-[14.5px] leading-relaxed mb-6 flex-1 ${c.highlight ? "" : "text-ink-soft"}`} style={c.highlight ? { color: "rgba(245, 239, 228, 0.75)" } : undefined}>{c.desc}</p>
                  <PricingClient planKey={c.planKey} planName={c.name} label="Tell us what you need" variant={c.highlight ? "commissioned-highlight" : "commissioned"} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* H — Tag Vision */}
        <section className="pb-28 max-[900px]:pb-20">
          <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <h2 className="font-serif text-ink mb-4" style={{ fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-0.025em", fontWeight: 400 }}>
                Why BarnBook makes its own tags
              </h2>
            </div>
            <div className="grid grid-cols-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1 gap-6">
              {tagVision.map((t) => (
                <div key={t.title} className="rounded-2xl p-8 max-[900px]:p-6" style={{ background: "var(--cream-warm)", border: "1px solid var(--line)" }}>
                  <h3 className="font-serif text-ink text-[20px] mb-3" style={{ letterSpacing: "-0.01em" }}>{t.title}</h3>
                  <p className="text-ink-soft text-[14.5px] leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* I — What's Coming Next */}
        <section className="pb-28 max-[900px]:pb-20">
          <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
            <div className="text-center max-w-[600px] mx-auto mb-14">
              <h2 className="font-serif text-ink mb-4" style={{ fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-0.025em", fontWeight: 400 }}>
                What&apos;s coming next
              </h2>
            </div>
            <div className="max-w-[640px] mx-auto relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[19px] top-4 bottom-4 w-px max-[560px]:hidden" style={{ background: "var(--line-strong)" }} />
              <div className="space-y-8">
                {roadmap.map((r, i) => (
                  <div key={r.phase} className="flex gap-6 max-[560px]:flex-col max-[560px]:gap-3">
                    <div className="shrink-0 relative">
                      <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[13px] font-semibold" style={{ background: i === 0 ? "var(--forest)" : "var(--cream-warm)", color: i === 0 ? "var(--cream)" : "var(--ink-soft)", border: i === 0 ? undefined : "1px solid var(--line)" }}>
                        {i + 1}
                      </div>
                    </div>
                    <div className="pt-1.5">
                      <h3 className="font-serif text-ink text-[20px] mb-2">{r.phase}</h3>
                      <p className="text-ink-soft text-[14.5px] leading-relaxed">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* J — Final CTA */}
        <section className="pb-28 max-[900px]:pb-20">
          <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
            <div className="max-w-[600px] mx-auto text-center">
              <h2 className="font-serif text-ink mb-6" style={{ fontSize: "clamp(32px, 5vw, 56px)", lineHeight: 1.08, letterSpacing: "-0.025em", fontWeight: 400 }}>
                Stake your claim today.
              </h2>
              <p className="text-ink-soft mb-10 leading-relaxed" style={{ fontSize: 18 }}>
                Join during Homestead Territory and everything you build is yours to keep — free, forever.
              </p>
              <Link href="/auth/signup" className="inline-flex items-center gap-2 rounded-full font-sans font-medium no-underline bg-forest text-cream transition-all hover:bg-forest-deep hover:-translate-y-px" style={{ padding: "20px 44px", fontSize: 18 }}>
                Start building free
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L8 3m5 5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <p className="mt-8 text-ink-soft text-sm">
                At least 90 days notice before any pricing takes effect.
              </p>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
