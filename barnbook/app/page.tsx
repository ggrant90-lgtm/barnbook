import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import Marquee from "@/components/landing/Marquee";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Quote from "@/components/landing/Quote";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="landing-page">
      <div className="landing-content">
        <Nav />
        <Hero />
        <Marquee />
        <HowItWorks />
        <Features />
        <Quote />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
}
