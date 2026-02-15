"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Loader2, Download, Filter, X, Plus } from "lucide-react"
import ReactGridLayout, { useContainerWidth, verticalCompactor } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WidgetRenderer, applyGlobalFilters } from "@/components/visualizations/widget-renderer"
import { getProgram } from "@/lib/api/programs"
import { getVisualization } from "@/lib/api/visualizations"
import { getTableRows, getTableSchema, type ColumnSchema } from "@/lib/api/tables"
import type { Program, Visualization, VisualizationWidget, VisualizationGlobalFilter } from "@/lib/types"

function defaultLayoutW(w: VisualizationWidget): number {
  if (w.layoutW) return w.layoutW
  if (w.chartType === "stat_card") return 3
  if (w.tileWidth === 1) return 4
  if (w.tileWidth === 3) return 12
  return 6
}

function defaultLayoutH(w: VisualizationWidget): number {
  if (w.layoutH) return w.layoutH
  if (w.chartType === "stat_card") return 2
  if (w.tileHeight === "sm") return 3
  if (w.tileHeight === "lg") return 6
  return 4
}

function normalizeVisualization(v: Visualization): Visualization {
  const legacy = v.config as Visualization["config"] & {
    globalFilter?: { table?: string; dateField?: string; startDate?: string; endDate?: string }
    widgets: Array<
      Visualization["config"]["widgets"][number] & {
        yField?: string
      }
    >
  }
  const widgets = legacy.widgets.map((w) => {
    if (!w.metrics || w.metrics.length === 0) {
      return {
        ...w,
        metrics: w.yField
          ? [{ field: w.yField, aggregate: "sum" as const, color: "#2563eb", legendLabel: "" }]
          : [],
      }
    }
    return w
  })
  const globalFilters =
    legacy.globalFilters ??
    (legacy.globalFilter?.table && legacy.globalFilter?.dateField
      ? [
          {
            id: "legacy-filter",
            table: legacy.globalFilter.table,
            field: legacy.globalFilter.dateField,
            operator: "between" as const,
            startDate: legacy.globalFilter.startDate,
            endDate: legacy.globalFilter.endDate,
          },
        ]
      : [])
  return { ...v, config: { widgets, globalFilters } }
}

export default function VisualizationViewPage() {
  const { id, vizId } = useParams<{ id: string; vizId: string }>()
  const { width: containerWidth, containerRef, mounted: gridMounted } = useContainerWidth()
  const dashboardRef = useRef<HTMLDivElement>(null)
  const [program, setProgram] = useState<Program | null>(null)
  const [viz, setViz] = useState<Visualization | null>(null)
  const [rowsByTable, setRowsByTable] = useState<Record<string, Record<string, unknown>[]>>({})
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schemas, setSchemas] = useState<Record<string, { name: string; type: string }[]>>({})
  const [activeFilters, setActiveFilters] = useState<Array<{
    field: string
    operator: "eq" | "contains" | "gte" | "lte" | "between"
    value?: string
    startValue?: string
    endValue?: string
  }>>([])
  const [newFilterField, setNewFilterField] = useState("")
  const [newFilterOperator, setNewFilterOperator] = useState<"eq" | "contains" | "gte" | "lte" | "between">("eq")
  const [newFilterValue, setNewFilterValue] = useState("")
  const [newFilterStartValue, setNewFilterStartValue] = useState("")
  const [newFilterEndValue, setNewFilterEndValue] = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [p, v] = await Promise.all([getProgram(id), getVisualization(id, vizId)])
        setProgram(p)
        setViz(normalizeVisualization(v))

        const tables = Array.from(new Set(v.config.widgets.map((w) => w.table)))
        const pk = p.projectName || id
        
        // Fetch schemas for all tables
        const schemaEntries = await Promise.all(
          tables.map(async (t) => {
            const schema = await getTableSchema(pk, t)
            return [t, schema.columns] as const
          })
        )
        setSchemas(Object.fromEntries(schemaEntries))
        
        const rowsEntries = await Promise.all(
          tables.map(async (t) => {
            const res = await getTableRows(pk, t, 500, 0)
            return [t, res.rows] as const
          })
        )
        setRowsByTable(Object.fromEntries(rowsEntries))
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load visualization")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, vizId])

  const rowsFor = (table: string) => {
    let rows = rowsByTable[table] ?? []
    
    // Apply active filters
    activeFilters.forEach((filter: VisualizationGlobalFilter) => {
      rows = rows.filter((row: Record<string, unknown>) => {
        const fieldValue = row[filter.field]
        if (fieldValue === null || fieldValue === undefined) return false
        
        const strValue = String(fieldValue).toLowerCase()
        
        switch (filter.operator) {
          case "eq":
            return strValue === (filter.value || "").toLowerCase()
          case "contains":
            return strValue.includes((filter.value || "").toLowerCase())
          case "gte": {
            const numValue = Number(fieldValue)
            const filterNum = Number(filter.value)
            if (isNaN(numValue) || isNaN(filterNum)) {
              // Try date comparison
              const dateValue = new Date(fieldValue as string)
              const filterDate = new Date(filter.value || "")
              return dateValue >= filterDate
            }
            return numValue >= filterNum
          }
          case "lte": {
            const numValue = Number(fieldValue)
            const filterNum = Number(filter.value)
            if (isNaN(numValue) || isNaN(filterNum)) {
              // Try date comparison
              const dateValue = new Date(fieldValue as string)
              const filterDate = new Date(filter.value || "")
              return dateValue <= filterDate
            }
            return numValue <= filterNum
          }
          case "between": {
            if (filter.startValue && filter.endValue) {
              const numValue = Number(fieldValue)
              const startNum = Number(filter.startValue)
              const endNum = Number(filter.endValue)
              if (!isNaN(numValue) && !isNaN(startNum) && !isNaN(endNum)) {
                return numValue >= startNum && numValue <= endNum
              }
              // Try date comparison
              const dateValue = new Date(fieldValue as string)
              const startDate = new Date(filter.startValue)
              const endDate = new Date(filter.endValue)
              endDate.setHours(23, 59, 59, 999)
              return dateValue >= startDate && dateValue <= endDate
            }
            return true
          }
          default:
            return true
        }
      })
    })
    
    return applyGlobalFilters(rows, table, viz?.config.globalFilters)
  }

  const downloadPDF = async () => {
    if (!dashboardRef.current || !viz || !program) return
    
    setDownloading(true)
    try {
      // Dynamically import libraries to avoid SSR issues
      const html2canvas = (await import("html2canvas")).default
      const { jsPDF } = await import("jspdf")

      // Capture the dashboard as canvas
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      })

      // Calculate PDF dimensions (A4 landscape)
      const imgWidth = 297 // A4 width in mm (landscape)
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Create PDF
      const pdf = new jsPDF({
        orientation: imgHeight > imgWidth ? "portrait" : "landscape",
        unit: "mm",
        format: "a4",
      })

      // Add title page info
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      
      // Add image to PDF
      const imgData = canvas.toDataURL("image/png")
      
      if (imgHeight <= pageHeight) {
        // Single page
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)
      } else {
        // Multiple pages
        let heightLeft = imgHeight
        let position = 0
        
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
        
        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight
        }
      }

      // Download
      const filename = `${viz.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${new Date().toISOString().split("T")[0]}.pdf`
      pdf.save(filename)
    } catch (err) {
      console.error("PDF generation failed:", err)
      setError(err instanceof Error ? err.message : "Failed to generate PDF")
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!viz || !program || error) {
    return <p className="mx-auto max-w-4xl py-10 text-sm text-destructive">{error ?? "Visualization not found"}</p>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Link href={`/programs/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Back to program
          </Link>
          <h1 className="mt-2 font-serif text-3xl font-bold text-foreground">{viz.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{viz.description || "Saved dashboard"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Program: {program.title} • Saved {new Date(viz.createdAt).toLocaleString()}
          </p>
        </div>
        <Button
          onClick={downloadPDF}
          disabled={downloading}
          variant="outline"
          size="sm"
          className="shrink-0"
        >
          {downloading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </>
          )}
        </Button>
      </div>

      {/* Flexible Filters */}
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filters</span>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {activeFilters.map((filter: VisualizationGlobalFilter, idx: number) => (
              <div
                key={idx}
                className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs"
              >
                <span className="font-medium">{filter.field}</span>
                <span className="text-muted-foreground">
                  {filter.operator === "eq"
                    ? "="
                    : filter.operator === "contains"
                      ? "contains"
                      : filter.operator === "gte"
                        ? "≥"
                        : filter.operator === "lte"
                          ? "≤"
                          : "between"}
                </span>
                <span>
                  {filter.operator === "between"
                    ? `${filter.startValue} - ${filter.endValue}`
                    : filter.value}
                </span>
                <button
                  onClick={() => setActiveFilters(activeFilters.filter((_: VisualizationGlobalFilter, i: number) => i !== idx))}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <Button
              onClick={() => setActiveFilters([])}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
            >
              Clear All
            </Button>
          </div>
        )}

        {/* Add New Filter */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[150px]">
            <Label className="text-xs text-muted-foreground">Field</Label>
            <Select value={newFilterField} onValueChange={setNewFilterField}>
              <SelectTrigger className="h-9 mt-1">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(schemas).flatMap(([table, cols]: [string, unknown]) =>
                  (cols as ColumnSchema[]).map((col: ColumnSchema) => (
                    <SelectItem key={`${table}.${col.name}`} value={col.name}>
                      {col.name} ({col.type})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[120px]">
            <Label className="text-xs text-muted-foreground">Operator</Label>
            <Select
              value={newFilterOperator}
              onValueChange={(v: any) => setNewFilterOperator(v)}
            >
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eq">Equals</SelectItem>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="gte">Greater than or equal</SelectItem>
                <SelectItem value="lte">Less than or equal</SelectItem>
                <SelectItem value="between">Between</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {newFilterOperator === "between" ? (
            <>
              <div className="flex-1 min-w-[120px]">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="text"
                  value={newFilterStartValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFilterStartValue(e.target.value)}
                  className="h-9 mt-1"
                  placeholder="Start value"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input
                  type="text"
                  value={newFilterEndValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFilterEndValue(e.target.value)}
                  className="h-9 mt-1"
                  placeholder="End value"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 min-w-[150px]">
              <Label className="text-xs text-muted-foreground">Value</Label>
              <Input
                type="text"
                value={newFilterValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFilterValue(e.target.value)}
                className="h-9 mt-1"
                placeholder="Filter value"
              />
            </div>
          )}

          <Button
            onClick={() => {
              if (!newFilterField) return
              if (newFilterOperator === "between") {
                if (!newFilterStartValue || !newFilterEndValue) return
                setActiveFilters([
                  ...activeFilters,
                  {
                    field: newFilterField,
                    operator: "between",
                    startValue: newFilterStartValue,
                    endValue: newFilterEndValue,
                  },
                ])
                setNewFilterStartValue("")
                setNewFilterEndValue("")
              } else {
                if (!newFilterValue) return
                setActiveFilters([
                  ...activeFilters,
                  {
                    field: newFilterField,
                    operator: newFilterOperator,
                    value: newFilterValue,
                  },
                ])
                setNewFilterValue("")
              }
              setNewFilterField("")
            }}
            size="sm"
            className="h-9"
            disabled={
              !newFilterField ||
              (newFilterOperator === "between"
                ? !newFilterStartValue || !newFilterEndValue
                : !newFilterValue)
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Filter
          </Button>
        </div>
      </div>

      <div className="mt-6" ref={dashboardRef}>
        {gridMounted && (
        <div ref={containerRef}>
        <ReactGridLayout
          className="layout"
          width={containerWidth}
          layout={viz.config.widgets.map((w: VisualizationWidget) => ({
            i: w.id,
            x: w.layoutX ?? 0,
            y: w.layoutY ?? Infinity,
            w: defaultLayoutW(w),
            h: defaultLayoutH(w),
          }))}
          gridConfig={{ cols: 12, rowHeight: 80, margin: [16, 16] }}
          dragConfig={{ enabled: false }}
          resizeConfig={{ enabled: false }}
          compactor={verticalCompactor}
        >
          {viz.config.widgets.map((w: VisualizationWidget) => (
            <div key={w.id}>
              <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex shrink-0 items-center gap-2">
                  <h3 className="font-medium text-foreground">{w.title}</h3>
                  {(w.filters?.length ?? 0) > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {w.filters!.length} filter{w.filters!.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <WidgetRenderer widget={w} rows={rowsFor(w.table)} />
                </div>
              </div>
            </div>
          ))}
        </ReactGridLayout>
        </div>
        )}
      </div>
    </div>
  )
}
