const features = [
  {
    title: "Horse profiles",
    desc: "Every horse in one place. Photos, papers, lineage, owner contacts, feeding instructions, and the stuff only you know.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
      </svg>
    ),
  },
  {
    title: "Health records",
    desc: "Vaccinations, coggins, lameness notes, soundness history — timestamped, searchable, and shareable with your vet in one tap.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    title: "Farrier logs",
    desc: "Last trim, next appointment, shoeing notes, hoof photos over time. Your farrier will thank you.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M2 12h20"/>
      </svg>
    ),
  },
  {
    title: "Exercise tracking",
    desc: "Hack, school, lunge, turnout — log the work in seconds. Spot patterns, manage fitness, prove the training plan is working.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
  },
  {
    title: "Photo ID",
    desc: "Can't remember which bay is which? Snap a photo, BarnBook finds the horse. Especially handy for new staff and working students.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M16 8a5 5 0 0 0-8 6M8 16a5 5 0 0 0 8-6"/>
      </svg>
    ),
  },
  {
    title: "Team sharing",
    desc: "Invite your trainer, vet, farrier, grooms. Set what each person can see. Everyone gets the context they need, nothing they don't.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="py-[120px] max-[900px]:py-20 bg-forest text-cream relative overflow-hidden"
      style={{
        margin: "0 -100vw",
        paddingLeft: "100vw",
        paddingRight: "100vw",
      }}
    >
      {/* Radial gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 15% 20%, rgba(201, 147, 42, 0.06) 0%, transparent 40%), radial-gradient(circle at 85% 80%, rgba(139, 74, 43, 0.08) 0%, transparent 40%)",
        }}
      />

      <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px] relative">
        <div className="text-center max-w-[680px] mx-auto mb-[72px]">
          <h2 className="font-serif font-light leading-[1.02] text-cream mb-5" style={{ fontSize: "clamp(40px, 5vw, 64px)", letterSpacing: "-0.03em" }}>
            Every horse. <em className="italic text-ochre">Every detail.</em>
          </h2>
          <p className="text-lg leading-relaxed" style={{ color: "rgba(245, 239, 228, 0.75)" }}>
            One book for everything that happens at your barn. No more scattered spreadsheets,
            dog-eared binders, or forgotten texts.
          </p>
        </div>

        <div className="grid grid-cols-3 max-[900px]:grid-cols-1 gap-px rounded-3xl overflow-hidden" style={{ background: "rgba(245, 239, 228, 0.12)", border: "1px solid rgba(245, 239, 228, 0.12)" }}>
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-forest p-10 max-[900px]:p-8 transition-colors duration-300 hover:bg-forest-deep"
            >
              <div className="w-11 h-11 rounded-[10px] flex items-center justify-center text-ochre mb-[22px]" style={{ background: "rgba(201, 147, 42, 0.15)" }}>
                {feature.icon}
              </div>
              <h3 className="font-serif text-[22px] font-medium text-cream mb-2.5" style={{ letterSpacing: "-0.01em" }}>
                {feature.title}
              </h3>
              <p className="text-[14.5px] leading-relaxed" style={{ color: "rgba(245, 239, 228, 0.72)" }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
