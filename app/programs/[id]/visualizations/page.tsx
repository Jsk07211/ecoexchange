"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getProgram } from "@/lib/api/programs"
import { listVisualizations } from "@/lib/api/visualizations"
import type { Program, Visualization } from "@/lib/types"

export default function ProgramVisualizationsPage() {
  const { id } = useParams<{ id: string }>()
  const [program, setProgram] = useState<Program | null>(null)
  const [visualizations, setVisualizations] = useState<Visualization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [prog, viz] = await Promise.all([getProgram(id), listVisualizations(id)])
        setProgram(prog)
        setVisualizations(viz)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load visualizations")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !program) {
    return <p className="mx-auto max-w-4xl py-10 text-sm text-destructive">{error ?? "Program not found"}</p>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <Link href={`/programs/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to program
      </Link>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Saved Visualizations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Program: {program.title}</p>
        </div>
        <Button asChild>
          <Link href={`/programs/${id}/visualize`}>Create New Visualization</Link>
        </Button>
      </div>

      {visualizations.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No saved visualizations yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {visualizations.map((v) => (
            <Link
              key={v.id}
              href={`/programs/${id}/visualizations/${v.id}`}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <h3 className="font-medium text-foreground">{v.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{v.description || "Saved dashboard"}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(v.createdAt).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
