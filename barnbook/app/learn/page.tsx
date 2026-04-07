import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import LearnClient from "./LearnClient";
import { videos } from "./videos";

export const metadata: Metadata = {
  title: "Learn — BarnBook",
  description:
    "Training videos and demos to help you get the most out of BarnBook.",
};

export default function LearnPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--cream, #f5efe4)" }}
    >
      <Nav />

      {/* Header */}
      <section className="mx-auto max-w-[1240px] px-8 pt-20 pb-12 text-center max-[900px]:px-[22px] max-[900px]:pt-14 max-[900px]:pb-8">
        <h1
          className="font-serif text-5xl font-semibold text-[var(--ink)] max-[900px]:text-3xl"
          style={{ letterSpacing: "-0.03em", lineHeight: 1.1 }}
        >
          Learn BarnBook
        </h1>
        <p className="mx-auto mt-5 max-w-[520px] text-lg leading-relaxed text-[var(--ink-soft)] max-[900px]:text-base">
          Watch quick tutorials and demos to get the most out of your barn.
        </p>
      </section>

      {/* Video Grid */}
      <section className="mx-auto max-w-[1240px] px-8 pb-24 max-[900px]:px-[22px] max-[900px]:pb-16">
        <LearnClient videos={videos} />
      </section>

      <Footer />
    </div>
  );
}
