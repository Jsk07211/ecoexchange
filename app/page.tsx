import { HeroSection } from "@/components/landing/hero-section"
import { HowItWorks } from "@/components/landing/how-it-works"
import { FeaturedPrograms } from "@/components/landing/featured-programs"
import { AudienceSection } from "@/components/landing/audience-section"
import { CtaSection } from "@/components/landing/cta-section"

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <HowItWorks />
      <FeaturedPrograms />
      <AudienceSection />
      <CtaSection />
    </>
  )
}
