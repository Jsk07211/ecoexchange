import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CtaSection() {
  return (
    <section className="bg-primary">
      <div className="mx-auto max-w-7xl px-4 py-20 text-center lg:px-8 lg:py-24">
        <h2 className="font-serif text-3xl font-bold text-primary-foreground md:text-4xl text-balance">
          Ready to make an impact?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-primary-foreground/75">
          Join thousands of citizen scientists collecting quality data for a
          more sustainable future. Every observation counts.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            variant="secondary"
            className="h-12 px-8 text-base"
            asChild
          >
            <Link href="/programs">
              Start Contributing
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 border-primary-foreground/20 px-8 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            asChild
          >
            <Link href="/programs">Browse Programs</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
