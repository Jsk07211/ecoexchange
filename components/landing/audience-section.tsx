import Link from "next/link"
import { ArrowRight, Building2, Microscope, GraduationCap, Check } from "lucide-react"

const audiences = [
  {
    icon: Building2,
    title: "Program Organizers",
    description:
      "Create standardized data collection programs. Define schemas, set quality rules, and receive clean, analysis-ready submissions from volunteers.",
    cta: "Create a Program",
    href: "/programs",
    features: [
      "Custom data schemas",
      "Automated quality checks",
      "Contributor management",
      "Real-time dashboards",
    ],
  },
  {
    icon: Microscope,
    title: "Citizen Scientists",
    description:
      "Find programs that match your interests and skills. Contribute observations through guided, mobile-friendly forms with instant feedback.",
    cta: "Start Contributing",
    href: "/programs",
    features: [
      "Guided data entry",
      "GPS auto-capture",
      "Photo attachments",
      "Contribution history",
    ],
  },
  {
    icon: GraduationCap,
    title: "Data Reusers",
    description:
      "Access structured, quality-scored datasets with full provenance. Download in standard formats for analysis, research, or policy decisions.",
    cta: "Browse Programs",
    href: "/programs",
    features: [
      "Quality-scored data",
      "Standard formats (CSV, JSON)",
      "Full metadata & provenance",
      "Open licenses",
    ],
  },
]

export function AudienceSection() {
  return (
    <section className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Built for Everyone
          </p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-foreground md:text-4xl text-balance">
            Whether you organize, contribute, or analyze
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            EcoExchange serves every role in the citizen-science ecosystem with
            purpose-built tools.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {audiences.map((audience) => (
            <div
              key={audience.title}
              className="group flex flex-col rounded-2xl border border-border bg-card p-8 transition-colors hover:border-primary/25"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8">
                <audience.icon className="h-6 w-6 text-primary" />
              </div>

              <h3 className="mt-6 font-serif text-xl font-semibold text-foreground">
                {audience.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {audience.description}
              </p>

              <ul className="mt-6 flex flex-col gap-2.5">
                {audience.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-sm text-foreground"
                  >
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={audience.href}
                className="mt-8 flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
              >
                {audience.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
