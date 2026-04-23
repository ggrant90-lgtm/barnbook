import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import Marquee from "@/components/landing/Marquee";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import HomesteadTeaser from "@/components/landing/HomesteadTeaser";
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
        <HomesteadTeaser />
        <Quote />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
}
