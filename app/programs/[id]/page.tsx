"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import {
  Loader2,
  MapPin,
  Users,
  Database,
  Calendar,
  AlertCircle,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DynamicTableViewer } from "@/components/tables/dynamic-table-viewer"
import { getProgram } from "@/lib/api/programs"
import { getProjectTables } from "@/lib/api/tables"
import type { Program } from "@/lib/types"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [program, setProgram] = useState<Program | null>(null)
  const [projectKey, setProjectKey] = useState(id)
  const [tables, setTables] = useState<string[]>([])
  const [activeTable, setActiveTable] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const prog = await getProgram(id)
        setProgram(prog)

        try {
          const pk = prog.projectName || id
          setProjectKey(pk)
          const projectKey = pk
          const res = await getProjectTables(projectKey)
          setTables(res.tables)
          if (res.tables.length > 0) setActiveTable(res.tables[0])
        } catch {
          // No tables yet — that's fine
          setTables([])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load program")
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
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-3 font-medium text-foreground">
          Could not load program
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error ?? "Program not found"}
        </p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/programs">Back to programs</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/programs"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; All programs
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs font-medium">
            {program.category}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              program.status === "active" && "border-primary/20 text-primary",
              program.status === "upcoming" && "border-accent/20 text-accent",
              program.status === "completed" &&
                "border-muted-foreground/20 text-muted-foreground"
            )}
          >
            {program.status.charAt(0).toUpperCase() + program.status.slice(1)}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">
              {program.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {program.organization}
            </p>
          </div>
          {program.contributionSpec && (
            <Button asChild>
              <Link href={`/programs/${id}/contribute`}>
                <Upload className="mr-2 h-4 w-4" />
                Contribute
              </Link>
            </Button>
          )}
        </div>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
          {program.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {program.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {program.location}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0" />
            {program.participants.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 shrink-0" />
            {program.dataPoints.toLocaleString()} records
          </span>
          {program.deadline && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {program.deadline}
            </span>
          )}
        </div>
      </div>

      {/* Tables */}
      {tables.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Database className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium text-foreground">
            No datasets available for this program
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Data will appear here once contributors start submitting.
          </p>
        </div>
      ) : (
        <div>
          {/* Tabs for multiple tables */}
          {tables.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
              {tables.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTable(t)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTable === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {activeTable && (
            <DynamicTableViewer project={projectKey} table={activeTable} />
          )}
        </div>
      )}
    </div>
  )
}
