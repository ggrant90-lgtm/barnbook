const steps = [
  {
    num: "1.",
    title: "Build your barn",
    desc: "Create your free account and set up your barn in minutes. Add your logo, contact info, and details about what you do. Make it yours — your barn, your brand, your way.",
  },
  {
    num: "2.",
    title: "Add your horses",
    desc: "Create profiles for every horse in your care. Upload photos, log feed schedules, track upcoming vet and farrier appointments, and keep detailed records all in one place.",
  },
  {
    num: "3.",
    title: "Share with your team",
    desc: "Invite trainers, vets, farriers, and grooms with a single access key. Control exactly what each person can see and do — and revoke access anytime with one tap.",
  },
  {
    num: "4.",
    title: "Use it on the go",
    desc: "Standing in the barn aisle? Log feed, exercise, medications, and chores right from your phone. Everything syncs instantly so your whole team stays on the same page.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="py-[120px] max-[900px]:py-20 relative">
      <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
        <div className="text-center max-w-[680px] mx-auto mb-[72px]">
          <h2 className="font-serif leading-[1.02] text-ink mb-5" style={{ fontSize: "clamp(40px, 5vw, 64px)", letterSpacing: "-0.03em", fontWeight: 400 }}>
            Shed row or <em className="italic text-forest">tack room</em>,<br />wherever you work.
          </h2>
          <p className="text-lg text-ink-soft leading-relaxed">
            Four steps to a barn that runs smoother. Works on any phone. Your whole team sees
            the same single source of truth — no more group texts, lost notebooks, or &ldquo;wait, did
            anyone tell the farrier?&rdquo;
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 max-[900px]:grid-cols-1 max-[900px]:gap-5">
          {steps.map((step) => (
            <div
              key={step.num}
              className="bg-cream-warm border border-[var(--line)] rounded-[20px] px-8 py-10 relative transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(28,26,20,0.2)]"
              style={{ transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)" }}
            >
              <div className="font-serif text-[56px] leading-none text-saddle mb-4 opacity-90" style={{ fontWeight: 400 }}>
                {step.num}
              </div>
              <h3 className="font-serif text-[24px] text-ink mb-3 leading-tight" style={{ letterSpacing: "-0.015em", fontWeight: 400 }}>
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
