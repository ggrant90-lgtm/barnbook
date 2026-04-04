const steps = [
  {
    num: "i.",
    title: "Add your horses",
    desc: "Snap a photo, enter the basics, done. Build each profile as you go — age, breed, owner, feed, quirks, every detail that matters.",
  },
  {
    num: "ii.",
    title: "Invite your team",
    desc: "Share profiles with the people who need them. Your trainer, your vet, the farrier, the new working student. Everyone stays current.",
  },
  {
    num: "iii.",
    title: "Log on the go",
    desc: "Standing in the shed row with muddy boots and a lead rope in one hand? Log rides, treatments, and shoeing in seconds. Right from your phone.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="py-[120px] max-[900px]:py-20 relative">
      <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
        <div className="text-center max-w-[680px] mx-auto mb-[72px]">
          <h2 className="font-serif font-light leading-[1.02] text-ink mb-5" style={{ fontSize: "clamp(40px, 5vw, 64px)", letterSpacing: "-0.03em" }}>
            Shed row or <em className="italic text-forest">tack room</em>,<br />wherever you work.
          </h2>
          <p className="text-lg text-ink-soft leading-relaxed">
            Three minutes to set up. Works on any phone. Your whole team sees the same
            single source of truth — no more group texts, lost notebooks, or &ldquo;wait, did
            anyone tell the farrier?&rdquo;
          </p>
        </div>

        <div className="grid grid-cols-3 gap-8 max-[900px]:grid-cols-1 max-[900px]:gap-5">
          {steps.map((step) => (
            <div
              key={step.num}
              className="bg-cream-warm border border-[var(--line)] rounded-[20px] px-8 py-10 relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(28,26,20,0.2)]"
              style={{ transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)" }}
            >
              <div className="font-serif italic font-light text-[72px] leading-none text-saddle mb-4 opacity-90">
                {step.num}
              </div>
              <h3 className="font-serif text-[26px] font-medium text-ink mb-3 leading-tight" style={{ letterSpacing: "-0.015em" }}>
                {step.title}
              </h3>
              <p className="text-ink-soft text-[15.5px] leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
