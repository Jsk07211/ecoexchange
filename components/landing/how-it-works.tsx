import { Search, ClipboardCheck, Download } from "lucide-react"

const steps = [
  {
    icon: Search,
    number: "01",
    title: "Discover Programs",
    description:
      "Browse a curated catalog of citizen-science programs. Filter by topic, location, and skill level to find the right match.",
  },
  {
    icon: ClipboardCheck,
    number: "02",
    title: "Contribute Data",
    description:
      "Submit observations through guided forms with built-in validation. Real-time quality checks help you provide research-grade data.",
  },
  {
    icon: Download,
    number: "03",
    title: "Access Datasets",
    description:
      "Download structured, quality-scored datasets in standard formats. Every record includes provenance metadata for full traceability.",
  },
]

export function HowItWorks() {
  return (
    <section className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            How It Works
          </p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-foreground md:text-4xl text-balance">
            From observation to insight in three steps
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Whether you are a seasoned researcher or a curious volunteer, our
            guided workflow makes contributing easy and impactful.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.title}
              className="flex flex-col items-start bg-card p-8 lg:p-10"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <step.icon className="h-5 w-5" />
              </div>
              <span className="mt-5 font-serif text-sm font-bold text-primary">
                {step.number}
              </span>
              <h3 className="mt-1 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
