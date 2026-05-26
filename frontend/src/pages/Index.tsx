import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Services from "@/components/landing/Services";
import HowItWorks from "@/components/landing/HowItWorks";
import Advantages from "@/components/landing/Advantages";
import Pricing from "@/components/landing/Pricing";
import Footer from "@/components/landing/Footer";

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
  </div>
);

export default Index;
