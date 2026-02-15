"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, Filter, GripVertical, Loader2, Plus, Save, Trash2, X } from "lucide-react"
import ReactGridLayout, { useContainerWidth, verticalCompactor } from "react-grid-layout"
import type { LayoutItem } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WidgetRenderer, applyGlobalFilters } from "@/components/visualizations/widget-renderer"
import { getProgram } from "@/lib/api/programs"
import { createVisualization } from "@/lib/api/visualizations"
import { getProjectTables, getTableRows, getTableSchema } from "@/lib/api/tables"
import type {
  Program,
  TileFilterOperator,
  VisualizationAggregateMethod,
  VisualizationChartType,
  VisualizationGlobalFilter,
  VisualizationMetric,
  VisualizationTileFilter,
  VisualizationWidget,
} from "@/lib/types"

type ColumnKind = "number" | "date" | "boolean" | "string"
interface ColumnMeta {
  name: string
  type: string
  kind: ColumnKind
}

const AGGREGATES: VisualizationAggregateMethod[] = [
  "raw",
  "count",
  "sum",
  "mean",
  "avg",
  "min",
  "max",
  "median",
  "mode",
  "distinct",
]

function getAggregatesForKind(kind: ColumnKind): VisualizationAggregateMethod[] {
  if (kind === "number") return ["count", "sum", "mean", "avg", "min", "max", "median", "mode", "distinct"]
  if (kind === "date") return ["count", "min", "max", "mode", "distinct"]
  return ["count", "mode", "distinct"]
}

function defaultAggregateForKind(kind: ColumnKind): VisualizationAggregateMethod {
  if (kind === "number") return "mean"
  return "distinct"
}

const CHART_TYPE_LABELS: Record<string, string> = {
  table: "Table",
  line: "Line Chart",
  bar: "Bar Chart",
  area: "Area Chart",
  scatter: "Scatter Plot",
  pie: "Pie Chart",
  histogram: "Histogram",
  violin: "Violin Plot",
  scatter_matrix: "Scatter Matrix",
  stat_card: "Stat Card (single value)",
  map: "Map (geographic)",
  note: "Note / Text",
  grouped_bar: "Grouped Bar Chart",
  stacked_bar: "Stacked Bar Chart",
  stacked_area: "Stacked Area Chart",
  heatmap: "Heatmap",
  box_plot: "Box Plot",
  bubble: "Bubble Chart",
  radar: "Radar Chart",
  sunburst: "Sunburst Chart",
}

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

function inferKind(type: string): ColumnKind {
  const t = type.toLowerCase()
  if (t.includes("int") || t.includes("double") || t.includes("float") || t.includes("numeric"))
    return "number"
  if (t.includes("date") || t.includes("time")) return "date"
  if (t.includes("bool")) return "boolean"
  return "string"
}

function suggestTypes(
  kinds: ColumnKind[],
  selectedVars: string[],
  cols: ColumnMeta[]
): VisualizationChartType[] {
  // Note is always available
  const baseTypes: VisualizationChartType[] = ["note", "stat_card", "table"]
  
  if (kinds.length === 0) return baseTypes
  
  // Check if we have lat/lng columns selected
  const hasLatLng = selectedVars.some((v) => {
    const lower = v.toLowerCase()
    return lower.includes("lat") || lower.includes("latitude")
  }) && selectedVars.some((v) => {
    const lower = v.toLowerCase()
    return lower.includes("lng") || lower.includes("lon") || lower.includes("longitude")
  })
  
  if (hasLatLng) return ["map", ...baseTypes]
  
  const hasDate = kinds.includes("date")
  const hasNumber = kinds.includes("number")
  const hasString = kinds.includes("string")
  const numericCount = kinds.filter((k) => k === "number").length
  
  if (hasDate && hasNumber) 
    return ["stat_card", "line", "area", "stacked_area", "bar", "grouped_bar", "stacked_bar", "histogram", "box_plot", "note", "table"]
  if (hasString && hasNumber) 
    return ["stat_card", "bar", "grouped_bar", "stacked_bar", "histogram", "violin", "pie", "box_plot", "sunburst", "radar", "note", "table"]
  if (hasNumber) {
    if (numericCount >= 3) {
      return ["stat_card", "heatmap", "bubble", "scatter", "scatter_matrix", "box_plot", "radar", "histogram", "violin", "line", "bar", "note", "table"]
    } else if (numericCount >= 2) {
      return ["stat_card", "histogram", "violin", "scatter", "bubble", "scatter_matrix", "box_plot", "line", "bar", "note", "table"]
    } else {
      return ["stat_card", "histogram", "violin", "box_plot", "bar", "note", "table"]
    }
  }
  return ["stat_card", "note", "table", "bar", "grouped_bar", "pie", "sunburst"]
}

function newMetric(field = ""): VisualizationMetric {
  return { field, aggregate: "sum", color: "#2563eb", legendLabel: "" }
}

const CATEGORICAL_OPS: { value: TileFilterOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "in", label: "is one of" },
  { value: "not_in", label: "is not one of" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
]
const QUANTITATIVE_OPS: { value: TileFilterOperator; label: string }[] = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
  { value: "between", label: "between" },
]
const DATE_OPS: { value: TileFilterOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "before", label: "before" },
  { value: "after", label: "after" },
  { value: "date_between", label: "between" },
]
const BOOLEAN_OPS: { value: TileFilterOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
]

function opsForKind(kind: ColumnKind) {
  if (kind === "number") return QUANTITATIVE_OPS
  if (kind === "date") return DATE_OPS
  if (kind === "boolean") return BOOLEAN_OPS
  return CATEGORICAL_OPS
}

function defaultOpForKind(kind: ColumnKind): TileFilterOperator {
  if (kind === "number") return "gte"
  if (kind === "date") return "after"
  if (kind === "boolean") return "eq"
  return "eq"
}

function isRangeOp(op: TileFilterOperator) {
  return op === "between" || op === "date_between"
}

function isMultiValueOp(op: TileFilterOperator) {
  return op === "in" || op === "not_in"
}

export default function VisualizeBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { width: containerWidth, containerRef, mounted: gridMounted } = useContainerWidth()

  const [program, setProgram] = useState<Program | null>(null)
  const [projectKey, setProjectKey] = useState(id)
  const [tables, setTables] = useState<string[]>([])
  const [schemas, setSchemas] = useState<Record<string, ColumnMeta[]>>({})
  const [rowsByTable, setRowsByTable] = useState<Record<string, Record<string, unknown>[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dashboardName, setDashboardName] = useState("")
  const [dashboardDescription, setDashboardDescription] = useState("")

  const [table, setTable] = useState("")
  const [selectedVariables, setSelectedVariables] = useState<string[]>([])
  const [xField, setXField] = useState("")
  const [latField, setLatField] = useState("")
  const [lngField, setLngField] = useState("")
  const [metrics, setMetrics] = useState<VisualizationMetric[]>([])
  const [chartType, setChartType] = useState<VisualizationChartType>("table")
  const [tileTitle, setTileTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")
  const [draggedVar, setDraggedVar] = useState<string | null>(null)
  const [groupByField, setGroupByField] = useState("")
  const [statCardAggregates, setStatCardAggregates] = useState<Record<string, VisualizationAggregateMethod>>({})
  const [tileFilters, setTileFilters] = useState<VisualizationTileFilter[]>([])
  const [widgets, setWidgets] = useState<VisualizationWidget[]>([])
  const [expandedTileFilter, setExpandedTileFilter] = useState<string | null>(null)

  const [globalFilters, setGlobalFilters] = useState<VisualizationGlobalFilter[]>([])
  const [globalFiltersOpen, setGlobalFiltersOpen] = useState(false)
  const [gridLayout, setGridLayout] = useState<LayoutItem[]>([])

  // Strip a LayoutItem to only the properties we control (avoids leaking
  // internal react-grid-layout fields that can trigger infinite re-renders).
  const cleanItem = useCallback(
    (l: LayoutItem): LayoutItem => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h, minW: 2, minH: 2 }),
    []
  )

  const handleLayoutChange = useCallback(
    (newLayout: readonly LayoutItem[]) => {
      setGridLayout((prev) => {
        const clean = newLayout.map(cleanItem)
        // Bail out when nothing actually changed – prevents infinite update loop
        if (
          prev.length === clean.length &&
          prev.every((p, idx) => {
            const c = clean[idx]
            return c && p.i === c.i && p.x === c.x && p.y === c.y && p.w === c.w && p.h === c.h
          })
        ) {
          return prev
        }
        return clean
      })
    },
    [cleanItem]
  )

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const prog = await getProgram(id)
        const pk = prog.projectName || id
        setProgram(prog)
        setProjectKey(pk)

        const tableRes = await getProjectTables(pk)
        setTables(tableRes.tables)
        if (tableRes.tables[0]) setTable(tableRes.tables[0])

        const nextSchemas: Record<string, ColumnMeta[]> = {}
        const nextRows: Record<string, Record<string, unknown>[]> = {}
        for (const t of tableRes.tables) {
          const schema = await getTableSchema(pk, t)
          nextSchemas[t] = schema.columns
            .filter((c) => c.name !== "id" && c.name !== "created_at")
            .map((c) => ({ name: c.name, type: c.type, kind: inferKind(c.type) }))
          const rows = await getTableRows(pk, t, 500, 0)
          nextRows[t] = rows.rows
        }
        setSchemas(nextSchemas)
        setRowsByTable(nextRows)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load visualization builder")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const cols = schemas[table] ?? []
  const selectedKinds = selectedVariables
    .map((v) => cols.find((c) => c.name === v)?.kind)
    .filter(Boolean) as ColumnKind[]
  const suggested = useMemo(() => suggestTypes(selectedKinds, selectedVariables, cols), [selectedKinds, selectedVariables, cols])

  useEffect(() => {
    if (!suggested.includes(chartType)) setChartType(suggested[0] ?? "table")
  }, [chartType, suggested])

  const filteredRows = (t: string) => applyGlobalFilters(rowsByTable[t] ?? [], t, globalFilters)

  const uniqueValues = useMemo(() => {
    const result: Record<string, string[]> = {}
    const rows = rowsByTable[table] ?? []
    for (const c of cols) {
      const set = new Set<string>()
      for (const r of rows) {
        const v = r[c.name]
        if (v !== null && v !== undefined && v !== "") set.add(String(v))
        if (set.size > 200) break
      }
      result[c.name] = Array.from(set).sort()
    }
    return result
  }, [rowsByTable, table, cols])

  const addVariable = (name: string) => {
    if (!name) return
    setSelectedVariables((prev) => {
      if (prev.includes(name)) return prev
      const newVars = [...prev, name]
      
      // Auto-detect lat/lng fields
      const lower = name.toLowerCase()
      if (lower.includes("lat") && !lower.includes("lon") && !lower.includes("lng")) {
        setLatField(name)
      } else if (lower.includes("lng") || lower.includes("lon") || (lower.includes("long") && lower.includes("itude"))) {
        setLngField(name)
      }
      
      return newVars
    })
    if (!xField) setXField(name)
  }

  const removeVariable = (name: string) => {
    setSelectedVariables((prev) => prev.filter((v) => v !== name))
    setMetrics((prev) => prev.filter((m) => m.field !== name))
    if (xField === name) setXField("")
    if (latField === name) setLatField("")
    if (lngField === name) setLngField("")
  }

  const addMetricFromVariable = (name: string) => {
    if (!name) return
    const kind = cols.find((c) => c.name === name)?.kind ?? "string"
    const defaultAgg = kind === "number" ? "sum" : "count"
    setMetrics((prev) =>
      prev.some((m) => m.field === name)
        ? prev
        : [...prev, { ...newMetric(name), aggregate: defaultAgg as VisualizationAggregateMethod }]
    )
  }

  const addWidget = () => {
    if (!table) return setError("Select a table.")
    const safeMetrics = metrics.filter((m) => m.field)
    const isStatCard = chartType === "stat_card"

    // For stat cards, build metrics from the stat card aggregate config
    const effectiveMetrics = isStatCard
      ? (safeMetrics.length > 0
          ? safeMetrics
          : selectedVariables.map((v) => {
              const kind = cols.find((c) => c.name === v)?.kind ?? "string"
              const agg = statCardAggregates[v] ?? defaultAggregateForKind(kind)
              return { field: v, aggregate: agg, color: "#2563eb", legendLabel: "" }
            }))
      : safeMetrics

    const activeFilters = tileFilters.filter((f) => f.field)
    const isGrouped = (chartType === "histogram" || chartType === "violin") && !!groupByField
    const isMap = chartType === "map"
    const isScatterMatrix = chartType === "scatter_matrix"
    const isHeatmap = chartType === "heatmap"
    const isRadar = chartType === "radar"
    const isNote = chartType === "note"
    const isBubble = chartType === "bubble"
    
    // For scatter matrix, heatmap, and radar, use all selected numeric variables
    const matrixFields = (isScatterMatrix || isHeatmap || isRadar)
      ? selectedVariables.filter((v) => cols.find((c) => c.name === v)?.kind === "number")
      : undefined
    
    // For bubble chart, use third metric as size field
    const sizeField = isBubble && safeMetrics.length >= 2 ? safeMetrics[1].field : undefined
    
    const widget: VisualizationWidget = {
      id: crypto.randomUUID(),
      title: tileTitle.trim() || (isStatCard
        ? effectiveMetrics.map((m) => `${m.aggregate}(${m.field})`).join(", ") || "Stat"
        : isGrouped
          ? `${xField || table} by ${groupByField}`
          : isMap
            ? `${table} Map`
            : isScatterMatrix
              ? `${table} Scatter Matrix`
              : isHeatmap
                ? `${table} Heatmap`
                : isRadar
                  ? `${table} Radar`
                  : isNote
                    ? "Note"
                    : `${table} ${chartType}`),
      table,
      chartType,
      xField: xField || undefined,
      groupField: isGrouped ? groupByField : undefined,
      latField: isMap ? latField : undefined,
      lngField: isMap ? lngField : undefined,
      matrixFields,
      sizeField,
      noteContent: isNote ? noteContent : undefined,
      metrics: effectiveMetrics,
      filters: activeFilters.length > 0 ? activeFilters : undefined,
      xAxisLabel: isStatCard ? undefined : (xField || undefined),
      yAxisLabel: isStatCard ? undefined : (isGrouped ? "count" : (safeMetrics[0]?.legendLabel?.trim() || safeMetrics[0]?.field || "Value")),
      showLegend: !isMap && !isScatterMatrix && !isNote && !isHeatmap,
      colorByCategory: isGrouped,
      layoutW: isStatCard ? 3 : isMap ? 12 : isScatterMatrix ? 8 : (isHeatmap || isRadar) ? 6 : isNote ? 4 : 6,
      layoutH: isStatCard ? 2 : isMap ? 6 : isScatterMatrix ? 6 : (isHeatmap || isRadar) ? 5 : isNote ? 3 : 4,
      layoutX: 0,
      layoutY: Infinity,
    }
    const layoutItem: LayoutItem = {
      i: widget.id,
      x: widget.layoutX ?? 0,
      y: widget.layoutY ?? Infinity,
      w: defaultLayoutW(widget),
      h: defaultLayoutH(widget),
      minW: 2,
      minH: 2,
    }
    setWidgets((prev) => [...prev, widget])
    setGridLayout((prev) => [...prev, layoutItem])
    setTileTitle("")
    setNoteContent("")
    setGroupByField("")
    setTileFilters([])
    setError(null)
  }

  const saveDashboard = async () => {
    if (!dashboardName.trim()) return setError("Dashboard name is required.")
    if (widgets.length === 0) return setError("Add at least one tile before saving.")
    setSaving(true)
    setError(null)
    try {
      // Merge current grid layout positions into widgets before persisting
      const widgetsWithLayout = widgets.map((w) => {
        const item = gridLayout.find((l) => l.i === w.id)
        return item
          ? { ...w, layoutX: item.x, layoutY: item.y, layoutW: item.w, layoutH: item.h }
          : w
      })
      const viz = await createVisualization(id, {
        name: dashboardName.trim(),
        description: dashboardDescription.trim(),
        config: { widgets: widgetsWithLayout, globalFilters },
      })
      router.push(`/programs/${id}/visualizations/${viz.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save dashboard")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 lg:px-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/programs/${id}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            &larr; Back to program
          </Link>
          <h1 className="mt-1 font-serif text-2xl font-bold text-foreground">
            Visualize {program?.title}
          </h1>
        </div>
        <Button onClick={saveDashboard} disabled={saving} className="shrink-0">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Dashboard
        </Button>
      </div>

      {/* ── Dashboard meta ── */}
      <div className="grid gap-3 md:grid-cols-2">
        <Input placeholder="Dashboard name" value={dashboardName} onChange={(e) => setDashboardName(e.target.value)} />
        <Input placeholder="Description (optional)" value={dashboardDescription} onChange={(e) => setDashboardDescription(e.target.value)} />
      </div>

      {/* ── Global Filters (collapsible) ── */}
      <div className="rounded-lg border border-border">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          onClick={() => setGlobalFiltersOpen((o) => !o)}
        >
          {globalFiltersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Global Filters
          {globalFilters.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {globalFilters.length}
            </span>
          )}
        </button>
        {globalFiltersOpen && (
          <div className="space-y-2 border-t border-border px-4 py-3">
            {globalFilters.map((f) => (
              <div key={f.id} className="grid items-center gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
                <Select value={f.table} onValueChange={(v) => setGlobalFilters((prev) => prev.map((x) => (x.id === f.id ? { ...x, table: v, field: "" } : x)))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Table" /></SelectTrigger>
                  <SelectContent>{tables.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={f.field || "__none__"} onValueChange={(v) => setGlobalFilters((prev) => prev.map((x) => (x.id === f.id ? { ...x, field: v === "__none__" ? "" : v } : x)))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Field" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(schemas[f.table] ?? []).map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={f.operator} onValueChange={(v) => setGlobalFilters((prev) => prev.map((x) => (x.id === f.id ? { ...x, operator: v as VisualizationGlobalFilter["operator"] } : x)))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="between">between</SelectItem>
                    <SelectItem value="eq">equals</SelectItem>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="gte">&ge;</SelectItem>
                    <SelectItem value="lte">&le;</SelectItem>
                  </SelectContent>
                </Select>
                {f.operator === "between" ? (
                  <>
                    <Input className="h-8 text-xs" type="date" value={f.startDate ?? ""} onChange={(e) => setGlobalFilters((prev) => prev.map((x) => (x.id === f.id ? { ...x, startDate: e.target.value } : x)))} />
                    <Input className="h-8 text-xs" type="date" value={f.endDate ?? ""} onChange={(e) => setGlobalFilters((prev) => prev.map((x) => (x.id === f.id ? { ...x, endDate: e.target.value } : x)))} />
                  </>
                ) : (
                  <Input className="h-8 text-xs md:col-span-2" value={f.value ?? ""} onChange={(e) => setGlobalFilters((prev) => prev.map((x) => (x.id === f.id ? { ...x, value: e.target.value } : x)))} placeholder="Value" />
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setGlobalFilters((prev) => prev.filter((x) => x.id !== f.id))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                setGlobalFilters((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), table: tables[0] ?? "", field: "", operator: "between", startDate: "", endDate: "" },
                ])
              }
            >
              <Plus className="mr-1 h-3 w-3" /> Add filter
            </Button>
          </div>
        )}
      </div>

      {/* ── Tile Builder ── */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">New Tile</h2>

        {/* Row 1: Table + Title + Chart type */}
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Data Source
            </Label>
            <Select value={table} onValueChange={setTable}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Choose table" /></SelectTrigger>
              <SelectContent>
                {tables.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Tile Title
            </Label>
            <Input className="h-9" placeholder="e.g. Average Temperature" value={tileTitle} onChange={(e) => setTileTitle(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Chart Type
            </Label>
            <Select value={chartType} onValueChange={(v) => setChartType(v as VisualizationChartType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {suggested.map((t) => <SelectItem key={t} value={t}>{CHART_TYPE_LABELS[t] || t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Note content OR Variable selection */}
        {chartType === "note" ? (
          <div>
            <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Note Content
            </Label>
            <textarea
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Add your note, context, or findings here..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Select Variables
            </Label>
            <div className="grid max-h-36 gap-1.5 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
            {cols.map((c) => {
              const checked = selectedVariables.includes(c.name)
              return (
                <label
                  key={c.name}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                    checked ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      if (v) addVariable(c.name)
                      else removeVariable(c.name)
                    }}
                  />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] opacity-60">{c.kind}</span>
                </label>
              )
            })}
          </div>
          </div>
        )}

        {/* Row 3: Axis mapping (skip for note tiles) */}
        {chartType !== "note" && (
        <div className="grid gap-3 lg:grid-cols-3">
          {/* Selected variable chips */}
          <div>
            <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Selected&nbsp;&nbsp;
              <span className="normal-case tracking-normal text-muted-foreground/70">(drag to assign)</span>
            </Label>
            <div className="flex min-h-[2.5rem] flex-wrap gap-1.5 rounded-md bg-muted/40 p-2">
              {selectedVariables.length === 0 && (
                <span className="text-xs text-muted-foreground">Check variables above</span>
              )}
              {selectedVariables.map((v) => (
                <span
                  key={v}
                  draggable
                  onDragStart={() => setDraggedVar(v)}
                  className="inline-flex cursor-grab items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium shadow-sm transition-shadow hover:shadow"
                >
                  {v}
                  <button className="ml-0.5 opacity-40 hover:opacity-100" onClick={() => removeVariable(v)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* X axis drop zone */}
          <div
            className="group"
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-primary/40") }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-primary/40") }}
            onDrop={(e) => {
              e.currentTarget.classList.remove("ring-2", "ring-primary/40")
              if (draggedVar) setXField(draggedVar)
              setDraggedVar(null)
            }}
          >
            <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              X Axis
            </Label>
            <div className="flex min-h-[2.5rem] items-center rounded-md border-2 border-dashed border-border bg-muted/20 px-3 py-1.5 transition-colors">
              {xField ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  {xField}
                  <button onClick={() => setXField("")} className="opacity-50 hover:opacity-100"><X className="h-3 w-3" /></button>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Drop variable here</span>
              )}
            </div>
          </div>

          {/* Y / series drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-primary/40") }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-primary/40") }}
            onDrop={(e) => {
              e.currentTarget.classList.remove("ring-2", "ring-primary/40")
              if (draggedVar) addMetricFromVariable(draggedVar)
              setDraggedVar(null)
            }}
          >
            <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Y / Series
            </Label>
            <div className="space-y-1.5 rounded-md border-2 border-dashed border-border bg-muted/20 px-3 py-1.5">
              {metrics.length === 0 ? (
                <span className="text-xs text-muted-foreground">Drop variable here (optional)</span>
              ) : (
                metrics.map((m, idx) => {
                  const mKind = cols.find((c) => c.name === m.field)?.kind ?? "string"
                  const mAggs = getAggregatesForKind(mKind)
                  return (
                    <div key={`${m.field}-${idx}`} className="flex items-center gap-2">
                      <span className="shrink-0 text-xs font-medium">{m.field}</span>
                      <Select value={m.aggregate} onValueChange={(v) => setMetrics((prev) => prev.map((x, i) => (i === idx ? { ...x, aggregate: v as VisualizationAggregateMethod } : x)))}>
                        <SelectTrigger className="h-7 w-20 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{mAggs.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                      </Select>
                      <input
                        type="color"
                        className="h-6 w-7 cursor-pointer rounded border border-border"
                        value={m.color || "#2563eb"}
                        onChange={(e) => setMetrics((prev) => prev.map((x, i) => (i === idx ? { ...x, color: e.target.value } : x)))}
                      />
                      <button className="ml-auto opacity-40 hover:opacity-100" onClick={() => setMetrics((prev) => prev.filter((_, i) => i !== idx))}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
        )}

        {/* Group By (for histogram / violin) */}
        {(chartType === "histogram" || chartType === "violin") && (
          <div className="grid gap-3 lg:grid-cols-3">
            <div>
              <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Group By&nbsp;&nbsp;
                <span className="normal-case tracking-normal text-muted-foreground/70">(optional – splits by category)</span>
              </Label>
              <Select value={groupByField || "__none__"} onValueChange={(v) => setGroupByField(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="No grouping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No grouping</SelectItem>
                  {cols
                    .filter((c) => c.kind === "string" || c.kind === "boolean")
                    .map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {groupByField && (
              <p className="flex items-end pb-2 text-xs text-muted-foreground">
                Each unique value of <strong className="mx-1">{groupByField}</strong> will be shown as a separate series.
              </p>
            )}
          </div>
        )}

        {/* Map lat/lng fields */}
        {chartType === "map" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Latitude Field
              </Label>
              <Select value={latField || "__none__"} onValueChange={(v) => setLatField(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select latitude" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {cols
                    .filter((c) => c.kind === "number")
                    .map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Longitude Field
              </Label>
              <Select value={lngField || "__none__"} onValueChange={(v) => setLngField(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select longitude" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {cols
                    .filter((c) => c.kind === "number")
                    .map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Scatter Matrix hint */}
        {chartType === "scatter_matrix" && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
              <strong className="font-medium text-foreground">Scatter Matrix:</strong> Select 2 or more numeric variables above.
              {selectedVariables.filter((v) => cols.find((c) => c.name === v)?.kind === "number").length < 2 && (
                <span className="ml-1 text-amber-600">
                  (need at least 2 numeric variables)
                </span>
              )}
            </p>
          </div>
        )}

        {/* Stat card aggregates */}
        {chartType === "stat_card" && selectedVariables.length > 0 && (
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Stat Card Aggregates
            </p>
            <div className="space-y-1.5">
              {selectedVariables.map((v) => {
                const kind = cols.find((c) => c.name === v)?.kind ?? "string"
                const available = getAggregatesForKind(kind)
                const current = statCardAggregates[v] ?? defaultAggregateForKind(kind)
                return (
                  <div key={v} className="flex items-center gap-3">
                    <span className="w-32 truncate text-sm">{v} <span className="text-[10px] text-muted-foreground">({kind})</span></span>
                    <Select value={current} onValueChange={(val) => setStatCardAggregates((prev) => ({ ...prev, [v]: val as VisualizationAggregateMethod }))}>
                      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{available.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                    </Select>
                    {kind !== "number" && (current === "sum" || current === "mean" || current === "avg" || current === "median") && (
                      <span className="text-[10px] text-amber-600">not applicable</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tile filters */}
        {tileFilters.length > 0 && (
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Tile Filters
            </p>
            <div className="space-y-2">
              {tileFilters.map((tf) => {
                const fieldMeta = cols.find((c) => c.name === tf.field)
                const kind: ColumnKind = fieldMeta?.kind ?? "string"
                const ops = opsForKind(kind)
                const uv = uniqueValues[tf.field] ?? []
                return (
                  <div key={tf.id} className="grid items-center gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
                    <Select
                      value={tf.field || "__none__"}
                      onValueChange={(v) =>
                        setTileFilters((prev) =>
                          prev.map((x) =>
                            x.id === tf.id
                              ? { ...x, field: v === "__none__" ? "" : v, operator: v === "__none__" ? "eq" : defaultOpForKind(cols.find((c) => c.name === v)?.kind ?? "string"), value: undefined, values: undefined, min: undefined, max: undefined }
                              : x
                          )
                        )
                      }
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Field" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select field</SelectItem>
                        {cols.map((c) => <SelectItem key={c.name} value={c.name}>{c.name} ({c.kind})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select
                      value={tf.operator}
                      onValueChange={(v) => setTileFilters((prev) => prev.map((x) => (x.id === tf.id ? { ...x, operator: v as TileFilterOperator, value: undefined, values: undefined, min: undefined, max: undefined } : x)))}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{ops.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <div>
                      {isMultiValueOp(tf.operator) ? (
                        <div className="flex max-h-20 flex-wrap gap-1 overflow-auto rounded-md bg-background p-1.5">
                          {uv.slice(0, 50).map((val) => {
                            const selected = (tf.values ?? []).includes(val)
                            return (
                              <label key={val} className={`flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors ${selected ? "bg-primary/10 font-medium" : "hover:bg-muted"}`}>
                                <Checkbox checked={selected} onCheckedChange={(checked) => setTileFilters((prev) => prev.map((x) => (x.id === tf.id ? { ...x, values: checked ? [...(x.values ?? []), val] : (x.values ?? []).filter((v) => v !== val) } : x)))} />
                                {val}
                              </label>
                            )
                          })}
                          {uv.length === 0 && <span className="text-xs text-muted-foreground">No values</span>}
                        </div>
                      ) : isRangeOp(tf.operator) ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Input className="h-8 text-xs" type={tf.operator === "date_between" ? "date" : "number"} placeholder="Min" value={tf.min ?? ""} onChange={(e) => setTileFilters((prev) => prev.map((x) => (x.id === tf.id ? { ...x, min: e.target.value } : x)))} />
                          <Input className="h-8 text-xs" type={tf.operator === "date_between" ? "date" : "number"} placeholder="Max" value={tf.max ?? ""} onChange={(e) => setTileFilters((prev) => prev.map((x) => (x.id === tf.id ? { ...x, max: e.target.value } : x)))} />
                        </div>
                      ) : kind === "boolean" ? (
                        <Select value={tf.value ?? ""} onValueChange={(v) => setTileFilters((prev) => prev.map((x) => (x.id === tf.id ? { ...x, value: v } : x)))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Value" /></SelectTrigger>
                          <SelectContent><SelectItem value="true">true</SelectItem><SelectItem value="false">false</SelectItem></SelectContent>
                        </Select>
                      ) : (
                        <Input className="h-8 text-xs" type={kind === "date" ? "date" : kind === "number" ? "number" : "text"} placeholder="Value" value={tf.value ?? ""} onChange={(e) => setTileFilters((prev) => prev.map((x) => (x.id === tf.id ? { ...x, value: e.target.value } : x)))} />
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTileFilters((prev) => prev.filter((x) => x.id !== tf.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => setTileFilters((prev) => [...prev, { id: crypto.randomUUID(), field: "", operator: "eq" }])}
          >
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            {tileFilters.length > 0 ? `Filters (${tileFilters.length})` : "Add Filter"}
          </Button>
          <Button onClick={addWidget} size="sm" className="h-9 px-5">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Tile
          </Button>
        </div>

        {/* Hints for specific chart types */}
        {chartType === "bubble" && (
          <p className="text-xs text-muted-foreground mt-2">
            💡 Bubble chart: Add X axis, 2 Y/Series metrics (1st for Y-axis, 2nd for bubble size)
          </p>
        )}
        {(chartType === "heatmap" || chartType === "radar") && (
          <p className="text-xs text-muted-foreground mt-2">
            💡 {chartType === "heatmap" ? "Heatmap" : "Radar"}: Select 2+ numeric variables
          </p>
        )}
        {chartType === "scatter_matrix" && (
          <p className="text-xs text-muted-foreground mt-2">
            💡 Scatter Matrix: Select 2+ numeric variables
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ── Dashboard Canvas ── */}
      {widgets.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">Add tiles above to start building your dashboard.</p>
        </div>
      ) : (
        <div ref={containerRef}>
          {gridMounted && (
          <ReactGridLayout
            className="layout"
            width={containerWidth}
            layout={gridLayout}
            gridConfig={{ cols: 12, rowHeight: 80, margin: [12, 12] }}
            dragConfig={{ enabled: true, handle: ".drag-handle" }}
            resizeConfig={{ enabled: true }}
            compactor={verticalCompactor}
            onLayoutChange={handleLayoutChange}
          >
            {widgets.filter((w) => gridLayout.some((l) => l.i === w.id)).map((w) => (
              <div key={w.id}>
                <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-1.5">
                    <div className="drag-handle flex cursor-grab items-center gap-1.5">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <span className="truncate text-xs font-medium text-foreground">{w.title}</span>
                    </div>
                    {(w.filters?.length ?? 0) > 0 && (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {w.filters!.length}f
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-0.5">
                      <label className="flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/60">
                        <Checkbox className="h-3 w-3" checked={w.showLegend !== false} onCheckedChange={(v) => setWidgets((prev) => prev.map((x) => (x.id === w.id ? { ...x, showLegend: Boolean(v) } : x)))} />
                        L
                      </label>
                      <label className="flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/60">
                        <Checkbox className="h-3 w-3" checked={Boolean(w.colorByCategory)} onCheckedChange={(v) => setWidgets((prev) => prev.map((x) => (x.id === w.id ? { ...x, colorByCategory: Boolean(v) } : x)))} />
                        C
                      </label>
                      <button
                        className={`rounded p-0.5 hover:bg-muted/60 ${expandedTileFilter === w.id ? "bg-muted" : ""}`}
                        title="Tile filters"
                        onClick={() => setExpandedTileFilter((prev) => (prev === w.id ? null : w.id))}
                      >
                        <Filter className={`h-3 w-3 ${(w.filters?.length ?? 0) > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
                      </button>
                      <button
                        className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => { setWidgets((prev) => prev.filter((x) => x.id !== w.id)); setGridLayout((prev) => prev.filter((l) => l.i !== w.id)) }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {expandedTileFilter === w.id && (
                    <div className="shrink-0 space-y-1 border-b border-border bg-muted/20 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tile Filters</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-[10px]"
                          onClick={() => {
                            const wCols = schemas[w.table] ?? []
                            setWidgets((prev) =>
                              prev.map((x) =>
                                x.id === w.id
                                  ? {
                                      ...x,
                                      filters: [
                                        ...(x.filters ?? []),
                                        {
                                          id: crypto.randomUUID(),
                                          field: wCols[0]?.name ?? "",
                                          operator: defaultOpForKind(wCols[0]?.kind ?? "string"),
                                        },
                                      ],
                                    }
                                  : x
                              )
                            )
                          }}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Add
                        </Button>
                      </div>
                      {(w.filters ?? []).map((tf) => {
                        const wCols = schemas[w.table] ?? []
                        const fMeta = wCols.find((c) => c.name === tf.field)
                        const fKind: ColumnKind = fMeta?.kind ?? "string"
                        const fOps = opsForKind(fKind)
                        const wRows = rowsByTable[w.table] ?? []
                        const fUv = tf.field
                          ? Array.from(new Set(wRows.map((r) => String(r[tf.field] ?? "")).filter(Boolean))).sort().slice(0, 50)
                          : []
                        return (
                          <div key={tf.id} className="grid items-center gap-1 md:grid-cols-[1fr_1fr_2fr_auto]">
                            <Select
                              value={tf.field || "__none__"}
                              onValueChange={(v) =>
                                setWidgets((prev) =>
                                  prev.map((x) =>
                                    x.id === w.id
                                      ? {
                                          ...x,
                                          filters: (x.filters ?? []).map((f) =>
                                            f.id === tf.id
                                              ? {
                                                  ...f,
                                                  field: v === "__none__" ? "" : v,
                                                  operator: defaultOpForKind(wCols.find((c) => c.name === v)?.kind ?? "string"),
                                                  value: undefined,
                                                  values: undefined,
                                                  min: undefined,
                                                  max: undefined,
                                                }
                                              : f
                                          ),
                                        }
                                      : x
                                  )
                                )
                              }
                            >
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Field" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Field</SelectItem>
                                {wCols.map((c) => (
                                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={tf.operator}
                              onValueChange={(v) =>
                                setWidgets((prev) =>
                                  prev.map((x) =>
                                    x.id === w.id
                                      ? {
                                          ...x,
                                          filters: (x.filters ?? []).map((f) =>
                                            f.id === tf.id
                                              ? { ...f, operator: v as TileFilterOperator, value: undefined, values: undefined, min: undefined, max: undefined }
                                              : f
                                          ),
                                        }
                                      : x
                                  )
                                )
                              }
                            >
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {fOps.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div>
                              {isMultiValueOp(tf.operator) ? (
                                <div className="flex max-h-16 flex-wrap gap-0.5 overflow-auto rounded border border-border p-1">
                                  {fUv.map((val) => {
                                    const sel = (tf.values ?? []).includes(val)
                                    return (
                                      <label key={val} className="flex cursor-pointer items-center gap-0.5 rounded border border-border px-1 py-0.5 text-[10px]">
                                        <Checkbox
                                          checked={sel}
                                          onCheckedChange={(checked) =>
                                            setWidgets((prev) =>
                                              prev.map((x) =>
                                                x.id === w.id
                                                  ? {
                                                      ...x,
                                                      filters: (x.filters ?? []).map((f) =>
                                                        f.id === tf.id
                                                          ? {
                                                              ...f,
                                                              values: checked
                                                                ? [...(f.values ?? []), val]
                                                                : (f.values ?? []).filter((v) => v !== val),
                                                            }
                                                          : f
                                                      ),
                                                    }
                                                  : x
                                              )
                                            )
                                          }
                                        />
                                        {val}
                                      </label>
                                    )
                                  })}
                                </div>
                              ) : isRangeOp(tf.operator) ? (
                                <div className="grid grid-cols-2 gap-1">
                                  <Input
                                    className="h-7 text-xs"
                                    type={tf.operator === "date_between" ? "date" : "number"}
                                    placeholder="Min"
                                    value={tf.min ?? ""}
                                    onChange={(e) =>
                                      setWidgets((prev) =>
                                        prev.map((x) =>
                                          x.id === w.id
                                            ? { ...x, filters: (x.filters ?? []).map((f) => (f.id === tf.id ? { ...f, min: e.target.value } : f)) }
                                            : x
                                        )
                                      )
                                    }
                                  />
                                  <Input
                                    className="h-7 text-xs"
                                    type={tf.operator === "date_between" ? "date" : "number"}
                                    placeholder="Max"
                                    value={tf.max ?? ""}
                                    onChange={(e) =>
                                      setWidgets((prev) =>
                                        prev.map((x) =>
                                          x.id === w.id
                                            ? { ...x, filters: (x.filters ?? []).map((f) => (f.id === tf.id ? { ...f, max: e.target.value } : f)) }
                                            : x
                                        )
                                      )
                                    }
                                  />
                                </div>
                              ) : fKind === "date" ? (
                                <Input
                                  className="h-7 text-xs"
                                  type="date"
                                  value={tf.value ?? ""}
                                  onChange={(e) =>
                                    setWidgets((prev) =>
                                      prev.map((x) =>
                                        x.id === w.id
                                          ? { ...x, filters: (x.filters ?? []).map((f) => (f.id === tf.id ? { ...f, value: e.target.value } : f)) }
                                          : x
                                      )
                                    )
                                  }
                                />
                              ) : fKind === "boolean" ? (
                                <Select
                                  value={tf.value ?? ""}
                                  onValueChange={(v) =>
                                    setWidgets((prev) =>
                                      prev.map((x) =>
                                        x.id === w.id
                                          ? { ...x, filters: (x.filters ?? []).map((f) => (f.id === tf.id ? { ...f, value: v } : f)) }
                                          : x
                                      )
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Value" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="true">true</SelectItem>
                                    <SelectItem value="false">false</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  className="h-7 text-xs"
                                  type={fKind === "number" ? "number" : "text"}
                                  placeholder="Value"
                                  value={tf.value ?? ""}
                                  onChange={(e) =>
                                    setWidgets((prev) =>
                                      prev.map((x) =>
                                        x.id === w.id
                                          ? { ...x, filters: (x.filters ?? []).map((f) => (f.id === tf.id ? { ...f, value: e.target.value } : f)) }
                                          : x
                                      )
                                    )
                                  }
                                />
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                setWidgets((prev) =>
                                  prev.map((x) =>
                                    x.id === w.id
                                      ? { ...x, filters: (x.filters ?? []).filter((f) => f.id !== tf.id) }
                                      : x
                                  )
                                )
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )
                      })}
                      {(w.filters ?? []).length === 0 && (
                        <p className="text-[10px] text-muted-foreground">No filters yet.</p>
                      )}
                    </div>
                  )}
                  <div className="min-h-0 flex-1 overflow-hidden p-3">
                    <WidgetRenderer
                      widget={w}
                      rows={filteredRows(w.table)}
                      editableLegend
                      onMetricColorChange={(metricIndex, color) =>
                        setWidgets((prev) =>
                          prev.map((x) =>
                            x.id === w.id
                              ? {
                                  ...x,
                                  metrics: x.metrics.map((m, i) =>
                                    i === metricIndex ? { ...m, color } : m
                                  ),
                                }
                              : x
                          )
                        )
                      }
                      onCategoryColorChange={(category, color) =>
                        setWidgets((prev) =>
                          prev.map((x) =>
                            x.id === w.id
                              ? {
                                  ...x,
                                  categoryColors: {
                                    ...(x.categoryColors ?? {}),
                                    [category]: color,
                                  },
                                }
                              : x
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </ReactGridLayout>
          )}
        </div>
      )}
    </div>
  )
}

