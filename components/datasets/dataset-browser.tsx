"use client"

import { useState } from "react"
import {
  Search,
  Download,
  FileSpreadsheet,
  Shield,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  X,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { datasets, categories } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

type SortField = "lastUpdated" | "qualityScore" | "downloads" | "records"
type SortDir = "asc" | "desc"

export function DatasetBrowser() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sortField, setSortField] = useState<SortField>("lastUpdated")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const filtered = datasets
    .filter((ds) => {
      const matchesSearch =
        searchQuery === "" ||
        ds.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ds.organization.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ds.description.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory =
        selectedCategory === "All" || ds.category === selectedCategory

      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      const multiplier = sortDir === "desc" ? -1 : 1
      if (sortField === "lastUpdated") {
        return (
          multiplier *
          (new Date(a.lastUpdated).getTime() -
            new Date(b.lastUpdated).getTime())
        )
      }
      return multiplier * (a[sortField] - b[sortField])
    })

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const hasActiveFilters = selectedCategory !== "All" || searchQuery !== ""

  const SortButton = ({
    field,
    label,
  }: {
    field: SortField
    label: string
  }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
        sortField === field
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {sortField === field &&
        (sortDir === "desc" ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        ))}
    </button>
  )

  return (
    <div>
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Dataset Browser
          </p>
          <h1 className="mt-3 font-serif text-3xl font-bold text-foreground md:text-4xl text-balance">
            Download quality-checked datasets
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Access structured, quality-scored datasets with full provenance
            metadata. Every record has been validated against program standards.
          </p>

          {/* Search */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search datasets by name, organization, or topic..."
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

          {/* Filters & Sort */}
          <div
            className={cn(
              "mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
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

            <div className="flex items-center gap-1">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sort:
              </span>
              <SortButton field="lastUpdated" label="Recent" />
              <SortButton field="qualityScore" label="Quality" />
              <SortButton field="downloads" label="Popular" />
              <SortButton field="records" label="Size" />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} dataset{filtered.length !== 1 ? "s" : ""}{" "}
            available
          </p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("All")
              }}
            >
              <X className="mr-1.5 h-3 w-3" />
              Clear filters
            </Button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-lg font-semibold text-foreground">
              No datasets match your criteria
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try adjusting your search or category filter.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("All")
              }}
            >
              Clear all filters
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((ds) => (
              <div
                key={ds.id}
                className="rounded-2xl border border-border bg-card transition-all hover:border-primary/20"
              >
                {/* Main row */}
                <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-xs font-medium"
                      >
                        {ds.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {ds.format}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {ds.license}
                      </span>
                    </div>
                    <h3 className="mt-3 font-serif text-lg font-semibold text-foreground">
                      {ds.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ds.organization} &middot; {ds.program}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                      {ds.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {ds.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Quality + Actions */}
                  <div className="flex shrink-0 flex-col items-end gap-3 lg:min-w-[200px]">
                    <div className="w-full rounded-xl border border-border bg-background p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Quality Score
                        </span>
                        <span
                          className={cn(
                            "text-sm font-bold",
                            ds.qualityScore >= 90
                              ? "text-primary"
                              : ds.qualityScore >= 80
                              ? "text-accent"
                              : "text-muted-foreground"
                          )}
                        >
                          {ds.qualityScore}%
                        </span>
                      </div>
                      <Progress
                        value={ds.qualityScore}
                        className="mt-2 h-1.5"
                      />
                    </div>

                    <div className="flex w-full gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() =>
                          setExpandedId(
                            expandedId === ds.id ? null : ds.id
                          )
                        }
                      >
                        {expandedId === ds.id ? "Less Info" : "Details"}
                      </Button>
                      <Button size="sm" className="flex-1">
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap items-center gap-4 border-t border-border px-6 py-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {ds.records.toLocaleString()} records
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    {ds.downloads.toLocaleString()} downloads
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    {ds.qualityScore}% quality
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {"Updated "}
                    {new Date(ds.lastUpdated).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {/* Expanded details */}
                {expandedId === ds.id && (
                  <div className="border-t border-border px-6 py-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          Description
                        </h4>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {ds.description}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          Metadata
                        </h4>
                        <dl className="mt-2 flex flex-col gap-2.5 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Format</dt>
                            <dd className="font-medium text-foreground">
                              {ds.format}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">License</dt>
                            <dd className="font-medium text-foreground">
                              {ds.license}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Records</dt>
                            <dd className="font-medium text-foreground">
                              {ds.records.toLocaleString()}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">
                              Source Program
                            </dt>
                            <dd className="font-medium text-foreground">
                              {ds.program}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">
                              Organization
                            </dt>
                            <dd className="font-medium text-foreground">
                              {ds.organization}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-5 flex gap-2">
                          <Button size="sm" className="flex-1">
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            {"Download " + ds.format}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                          >
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            API Access
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
