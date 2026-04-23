export default function Quote() {
  return (
    <section className="py-[140px] max-[900px]:py-20 text-center">
      <div className="max-w-[1240px] mx-auto px-8 max-[900px]:px-[22px]">
        <blockquote
          className="font-quote italic font-normal text-ink max-w-[900px] mx-auto mb-8 relative"
          style={{
            fontSize: "clamp(32px, 4.2vw, 52px)",
            lineHeight: 1.15,
            letterSpacing: "-0.015em",
          }}
        >
          <span
            className="absolute font-serif not-italic leading-none text-saddle opacity-30 max-[900px]:left-0 max-[900px]:top-[-60px] max-[900px]:text-[100px]"
            style={{ fontSize: 140, left: -60, top: -40 }}
            aria-hidden="true"
          >
            &ldquo;
          </span>
          The whole barn stopped running on group texts and sticky notes.
          Now everyone just opens the book.
        </blockquote>
        <p className="text-sm text-ink-soft uppercase tracking-[0.08em] font-medium">
          — <strong className="text-ink font-semibold">For the barn that deserves it.</strong> Built with barn managers.
        </p>
      </div>
    </section>
  );
}
