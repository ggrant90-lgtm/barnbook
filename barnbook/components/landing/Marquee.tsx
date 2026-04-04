const features = [
  "Horse profiles",
  "Exercise logs",
  "Health records",
  "Farrier schedule",
  "Photo identification",
  "Team sharing",
];

export default function Marquee() {
  return (
    <div className="py-7 bg-forest text-cream overflow-hidden border-t border-b border-forest-deep">
      <div
        className="flex gap-14 whitespace-nowrap font-serif text-[22px] italic font-light"
        style={{ animation: "landing-scroll 40s linear infinite" }}
      >
        {/* Duplicated intentionally for seamless loop */}
        {[...features, ...features].map((feature, i) => (
          <span key={i} className="flex items-center gap-14 after:content-['✦'] after:text-ochre after:not-italic">
            {feature}
          </span>
        ))}
      </div>
    </div>
  );
}
