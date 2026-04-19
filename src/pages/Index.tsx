import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Services from "@/components/landing/Services";
import HowItWorks from "@/components/landing/HowItWorks";
import Advantages from "@/components/landing/Advantages";
import Pricing from "@/components/landing/Pricing";
import Footer from "@/components/landing/Footer";
import FloatingChat from "@/components/landing/FloatingChat";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main>
      <Hero />
      <Services />
      <HowItWorks />
      <Advantages />
      <Pricing />
    </main>
    <Footer />
    <FloatingChat />
  </div>
);

export default Index;
