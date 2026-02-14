"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, MapPin, Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getPrograms } from "@/lib/api/programs"
import type { Program } from "@/lib/types"

export function FeaturedPrograms() {
  const [featured, setFeatured] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPrograms({ status: "active" })
      .then((programs) => setFeatured(programs.slice(0, 3)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="border-y border-border bg-card py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Featured Programs
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-foreground md:text-4xl text-balance">
              Active programs seeking contributors
            </h2>
          </div>
          <Button variant="outline" asChild>
            <Link href="/programs">
              View all programs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="mt-12 flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="mt-12 rounded-2xl border border-border bg-background p-12 text-center">
            <p className="text-sm text-muted-foreground">Failed to load programs.</p>
          </div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((program) => (
              <Link
                key={program.id}
                href="/programs"
                className="group flex flex-col rounded-2xl border border-border bg-background p-6 transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-medium">
                    {program.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-primary/20 text-primary"
                  >
                    Active
                  </Badge>
                </div>

                <h3 className="mt-4 font-serif text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                  {program.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {program.organization}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                  {program.description}
                </p>

                <div className="mt-5 flex items-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {program.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {program.participants.toLocaleString()} contributors
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
