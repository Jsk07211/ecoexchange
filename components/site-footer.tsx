import Link from "next/link"
import { Leaf } from "lucide-react"

const footerLinks = [
  {
    title: "Platform",
    links: [
      { name: "Discover Programs", href: "/programs" },
      { name: "Submit Data", href: "/submit" },
    ],
  },
  {
    title: "For Organizations",
    links: [
      { name: "Create a Program", href: "/programs" },
      { name: "Data Standards", href: "/programs" },
      { name: "Quality Assurance", href: "/programs" },
    ],
  },
  {
    title: "Community",
    links: [
      { name: "Getting Started", href: "/" },
      { name: "Documentation", href: "/" },
      { name: "Contact Us", href: "/" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Leaf className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-serif text-lg font-bold text-foreground">
                EcoExchange
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A single place to discover citizen-science programs and collect
              standardized, quality-checked sustainability data.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-foreground">
                {group.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 md:flex-row">
          <p className="text-xs text-muted-foreground">
            2026 EcoExchange. Open data for a sustainable future.
          </p>
          <div className="flex gap-5">
            <Link
              href="/"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms
            </Link>
            <Link
              href="/"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Open Source
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
