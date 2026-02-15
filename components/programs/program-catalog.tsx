"use client"

import { useState, useEffect } from "react"
import { Search, MapPin, Users, Database, Calendar, Filter, X, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getPrograms } from "@/lib/api/programs"
import type { Program } from "@/lib/types"
import { cn } from "@/lib/utils"
import Link from "next/link"

const categories = ["All", "Biodiversity", "Water Quality", "Air Quality", "Climate"]
const statuses = ["All", "Active", "Upcoming", "Completed"]

export function ProgramCatalog() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [showFilters, setShowFilters] = useState(false)
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params: Record<string, string> = {}
    if (selectedCategory !== "All") params.category = selectedCategory
    if (selectedStatus !== "All") params.status = selectedStatus.toLowerCase()
    if (searchQuery) params.search = searchQuery

    getPrograms(params)
      .then(setPrograms)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedCategory, selectedStatus, searchQuery])

  const hasActiveFilters = selectedCategory !== "All" || selectedStatus !== "All" || searchQuery !== ""

  return (
    <div>
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Program Catalog
          </p>
          <h1 className="mt-3 font-serif text-3xl font-bold text-foreground md:text-4xl text-balance">
            Discover citizen-science programs
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Browse active programs seeking contributors. Find the right match
            based on your interests, location, and expertise.
          </p>

          {/* Search bar */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search programs by name, organization, or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              className="sm:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Filters */}
          <div
            className={cn(
              "mt-4 flex flex-col gap-4 sm:flex-row sm:items-center",
              !showFilters && "hidden sm:flex"
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Category:
              </span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status:
              </span>
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    selectedStatus === status
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading..." : `${programs.length} program${programs.length !== 1 ? "s" : ""} found`}
          </p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("All")
                setSelectedStatus("All")
              }}
            >
              <X className="mr-1.5 h-3 w-3" />
              Clear filters
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-lg font-semibold text-foreground">
              Failed to load programs
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
        ) : programs.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-lg font-semibold text-foreground">
              No programs match your filters
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try adjusting your search query or filter criteria.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("All")
                setSelectedStatus("All")
              }}
            >
              Clear all filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {programs.map((program) => (
              <Link
                key={program.id}
                href={`/programs/${program.id}`}
                className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/25 hover:shadow-sm"
              >
                {/* Tags row */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-medium">
                    {program.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      program.status === "active" &&
                        "border-primary/20 text-primary",
                      program.status === "upcoming" &&
                        "border-accent/20 text-accent",
                      program.status === "completed" &&
                        "border-muted-foreground/20 text-muted-foreground"
                    )}
                  >
                    {program.status.charAt(0).toUpperCase() +
                      program.status.slice(1)}
                  </Badge>
                </div>

                {/* Content */}
                <h3 className="mt-4 font-serif text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                  {program.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {program.organization}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {program.description}
                </p>

                {/* Tags */}
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

                {/* Metadata */}
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs text-muted-foreground sm:grid-cols-4">
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

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" className="w-full" asChild>
                    <span>View Program</span>
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
