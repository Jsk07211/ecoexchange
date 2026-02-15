import Link from "next/link"
import { ArrowRight, Database, Users, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

const benefits = [
  {
    icon: Users,
    label: "Collaborate Openly",
    description: "Join programs and contribute observations alongside other citizen scientists worldwide",
  },
  {
    icon: Database,
    label: "Standardized Data",
    description: "Every submission follows a shared schema so datasets are clean, consistent, and ready to use",
  },
  {
    icon: Shield,
    label: "Quality You Can Trust",
    description: "Built-in validation and review help ensure research-grade data from every contributor",
  },
]

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle pattern background */}
      <div className="absolute inset-0 bg-card" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(158_40%_24%/0.07),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <span className="text-xs font-semibold tracking-wide text-primary">
              Open Science for Everyone
            </span>
          </div>

          <h1 className="mt-6 font-serif text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
            Discover, contribute, and share citizen-science data
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            A single place to find citizen-science programs and collect
            standardized, quality-checked sustainability data that organizations
            can confidently share and reuse.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="h-12 px-8 text-base" asChild>
              <Link href="/programs">
                Explore Programs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
              <Link href="/programs">Start Contributing</Link>
            </Button>
          </div>
        </div>

        {/* Benefits row */}
        <div className="mx-auto mt-20 grid max-w-4xl gap-6 sm:grid-cols-3">
          {benefits.map((item) => (
            <div
              key={item.label}
              className="group relative rounded-2xl border border-border bg-background p-6 text-center transition-colors hover:border-primary/25"
            >
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/8">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">
                {item.label}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
