"use client"

import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts"

import type {
  VisualizationAggregateMethod,
  VisualizationGlobalFilter,
  VisualizationMetric,
  VisualizationTileFilter,
  VisualizationWidget,
} from "@/lib/types"

interface Props {
  widget: VisualizationWidget
  rows: Record<string, unknown>[]
  editableLegend?: boolean
  onMetricColorChange?: (metricIndex: number, color: string) => void
  onCategoryColorChange?: (category: string, color: string) => void
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeAggregate(method: VisualizationAggregateMethod): Exclude<
  VisualizationAggregateMethod,
  "avg" | "raw"
> {
  return method === "avg" ? "mean" : method
}

function aggregate(values: number[], method: VisualizationAggregateMethod): number {
  if (values.length === 0) return 0
  const m = normalizeAggregate(method)
  if (m === "count") return values.length
  if (m === "sum") return values.reduce((a, b) => a + b, 0)
  if (m === "min") return Math.min(...values)
  if (m === "max") return Math.max(...values)
  if (m === "mean") return values.reduce((a, b) => a + b, 0) / values.length
  if (m === "median") {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }
  const counts = new Map<number, number>()
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1))
  let winner = values[0]
  let winnerCount = 0
  for (const [value, count] of counts.entries()) {
    if (count > winnerCount) {
      winner = value
      winnerCount = count
    }
  }
  return winner
}

function applyFilter(row: Record<string, unknown>, f: VisualizationGlobalFilter): boolean {
  const raw = row[f.field]
  if (raw === undefined || raw === null) return false
  const text = String(raw)
  if (f.operator === "contains") return text.toLowerCase().includes((f.value ?? "").toLowerCase())
  if (f.operator === "eq") return text === (f.value ?? "")
  if (f.operator === "between") {
    const t = Date.parse(text)
    if (Number.isNaN(t)) return true
    if (f.startDate && t < Date.parse(f.startDate)) return false
    if (f.endDate && t > Date.parse(f.endDate)) return false
    return true
  }
  const asNum = Number(text)
  const cmp = Number(f.value ?? "")
  if (Number.isNaN(asNum) || Number.isNaN(cmp)) return true
  if (f.operator === "gte") return asNum >= cmp
  if (f.operator === "lte") return asNum <= cmp
  return true
}

export function applyGlobalFilters(
  rows: Record<string, unknown>[],
  table: string,
  filters?: VisualizationGlobalFilter[]
) {
  const scoped = (filters ?? []).filter((f) => f.table === table && f.field)
  if (scoped.length === 0) return rows
  return rows.filter((r) => scoped.every((f) => applyFilter(r, f)))
}

function applyTileFilter(row: Record<string, unknown>, f: VisualizationTileFilter): boolean {
  const raw = row[f.field]
  if (raw === undefined || raw === null) return false
  const text = String(raw)

  switch (f.operator) {
    case "eq":
      return text === (f.value ?? "")
    case "neq":
      return text !== (f.value ?? "")
    case "contains":
      return text.toLowerCase().includes((f.value ?? "").toLowerCase())
    case "not_contains":
      return !text.toLowerCase().includes((f.value ?? "").toLowerCase())
    case "in":
      return (f.values ?? []).includes(text)
    case "not_in":
      return !(f.values ?? []).includes(text)
    case "gt": {
      const n = Number(text)
      const c = Number(f.value ?? "")
      return Number.isFinite(n) && Number.isFinite(c) && n > c
    }
    case "lt": {
      const n = Number(text)
      const c = Number(f.value ?? "")
      return Number.isFinite(n) && Number.isFinite(c) && n < c
    }
    case "gte": {
      const n = Number(text)
      const c = Number(f.value ?? "")
      return Number.isFinite(n) && Number.isFinite(c) && n >= c
    }
    case "lte": {
      const n = Number(text)
      const c = Number(f.value ?? "")
      return Number.isFinite(n) && Number.isFinite(c) && n <= c
    }
    case "between": {
      const n = Number(text)
      const lo = Number(f.min ?? "")
      const hi = Number(f.max ?? "")
      if (!Number.isFinite(n)) return false
      if (Number.isFinite(lo) && n < lo) return false
      if (Number.isFinite(hi) && n > hi) return false
      return true
    }
    case "before": {
      const d = Date.parse(text)
      const c = Date.parse(f.value ?? "")
      return !Number.isNaN(d) && !Number.isNaN(c) && d < c
    }
    case "after": {
      const d = Date.parse(text)
      const c = Date.parse(f.value ?? "")
      return !Number.isNaN(d) && !Number.isNaN(c) && d > c
    }
    case "date_between": {
      const d = Date.parse(text)
      if (Number.isNaN(d)) return false
      if (f.min) {
        const lo = Date.parse(f.min)
        if (!Number.isNaN(lo) && d < lo) return false
      }
      if (f.max) {
        const hi = Date.parse(f.max)
        if (!Number.isNaN(hi) && d > hi) return false
      }
      return true
    }
    default:
      return true
  }
}

export function applyTileFilters(
  rows: Record<string, unknown>[],
  filters?: VisualizationTileFilter[]
) {
  const active = (filters ?? []).filter((f) => f.field)
  if (active.length === 0) return rows
  return rows.filter((r) => active.every((f) => applyTileFilter(r, f)))
}

function tileHeight() {
  return "h-full"
}

function defaultColor(i: number) {
  const palette = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626", "#0891b2"]
  return palette[i % palette.length]
}

const CATEGORY_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#0f766e",
]

function categoryColor(widget: VisualizationWidget, category: string, idx: number) {
  return (
    widget.categoryColors?.[category] ||
    CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length]
  )
}

function aggregateGeneral(values: unknown[], method: VisualizationAggregateMethod): string {
  const defined = values.filter((v) => v !== null && v !== undefined && v !== "")
  if (defined.length === 0) return "—"
  const m = normalizeAggregate(method)
  if (m === "count") return String(defined.length)
  if (m === "distinct") {
    const unique = [...new Set(defined.map((v) => String(v)))]
    return unique.slice(0, 30).join(", ") + (unique.length > 30 ? ` (+${unique.length - 30} more)` : "")
  }
  if (m === "mode") {
    const counts = new Map<string, number>()
    defined.forEach((v) => {
      const key = String(v)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    let winner = String(defined[0])
    let best = 0
    for (const [val, cnt] of counts.entries()) {
      if (cnt > best) {
        winner = val
        best = cnt
      }
    }
    return winner
  }
  const nums = defined.map((v) => Number(v)).filter((n) => Number.isFinite(n))
  if (nums.length === 0) return "—"
  return String(aggregate(nums, method))
}

function formatStatValue(val: string): string {
  const n = Number(val)
  if (!Number.isFinite(n)) return val
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function histogram(values: number[], bins = 12) {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const step = max === min ? 1 : (max - min) / bins
  const counts = new Array(bins).fill(0)
  values.forEach((v) => {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / step)))
    counts[idx] += 1
  })
  return counts.map((count, i) => ({
    x: `${(min + i * step).toFixed(2)}-${(min + (i + 1) * step).toFixed(2)}`,
    y: count,
    center: min + (i + 0.5) * step,
  }))
}

function renderLegend(
  metrics: VisualizationMetric[],
  editableLegend?: boolean,
  onMetricColorChange?: (metricIndex: number, color: string) => void
) {
  if (metrics.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {metrics.map((m, idx) => (
        <div key={`${m.field}-${idx}`} className="flex items-center gap-2 text-xs text-muted-foreground">
          {editableLegend ? (
            <input
              type="color"
              value={m.color || defaultColor(idx)}
              onChange={(e) => onMetricColorChange?.(idx, e.target.value)}
              className="h-5 w-6 rounded border border-border"
              title="Change series color"
            />
          ) : (
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: m.color || defaultColor(idx) }}
            />
          )}
          <span>{m.legendLabel?.trim() || `${m.aggregate}(${m.field})`}</span>
        </div>
      ))}
    </div>
  )
}

function renderCategoryLegend(
  categories: string[],
  widget: VisualizationWidget,
  editableLegend?: boolean,
  onCategoryColorChange?: (category: string, color: string) => void
) {
  if (!widget.colorByCategory || categories.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {categories.map((cat, idx) => (
        <div key={cat} className="flex items-center gap-2 text-xs text-muted-foreground">
          {editableLegend ? (
            <input
              type="color"
              value={categoryColor(widget, cat, idx)}
              onChange={(e) => onCategoryColorChange?.(cat, e.target.value)}
              className="h-5 w-6 rounded border border-border"
              title={`Color for ${cat}`}
            />
          ) : (
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: categoryColor(widget, cat, idx) }}
            />
          )}
          <span>{cat}</span>
        </div>
      ))}
    </div>
  )
}

function SimpleScatterMatrix({
  rows,
  fields,
}: {
  rows: Record<string, unknown>[]
  fields: string[]
}) {
  const numericFields = fields.filter((f) =>
    rows.some((r) => Number.isFinite(Number(r[f])))
  )
  if (numericFields.length < 2) {
    return <p className="text-sm text-muted-foreground">Choose at least 2 numeric variables.</p>
  }

  const limited = numericFields.slice(0, 4)
  const valuesByField = Object.fromEntries(
    limited.map((f) => [f, rows.map((r) => Number(r[f])).filter((n) => Number.isFinite(n))])
  ) as Record<string, number[]>
  const ranges = Object.fromEntries(
    limited.map((f) => {
      const vals = valuesByField[f]
      return [f, { min: Math.min(...vals), max: Math.max(...vals) }]
    })
  ) as Record<string, { min: number; max: number }>

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${limited.length}, minmax(0, 1fr))` }}>
      {limited.flatMap((yf) =>
        limited.map((xf) => (
          <div key={`${xf}-${yf}`} className="rounded border border-border bg-background p-1">
            <p className="mb-1 text-[10px] text-muted-foreground">
              {xf} vs {yf}
            </p>
            <svg viewBox="0 0 120 100" className="h-24 w-full">
              {rows.slice(0, 250).map((r, i) => {
                const xv = Number(r[xf])
                const yv = Number(r[yf])
                if (!Number.isFinite(xv) || !Number.isFinite(yv)) return null
                const xr = ranges[xf]
                const yr = ranges[yf]
                const x = xr.max === xr.min ? 60 : ((xv - xr.min) / (xr.max - xr.min)) * 110 + 5
                const y = yr.max === yr.min ? 50 : 95 - ((yv - yr.min) / (yr.max - yr.min)) * 90
                return <circle key={i} cx={x} cy={y} r="1.5" fill="#2563eb" opacity="0.7" />
              })}
            </svg>
          </div>
        ))
      )}
    </div>
  )
}

export function WidgetRenderer({
  widget,
  rows: rawRows,
  editableLegend,
  onMetricColorChange,
  onCategoryColorChange,
}: Props) {
  const rows = applyTileFilters(rawRows, widget.filters)
  const metrics = widget.metrics ?? []

  if (widget.chartType === "note") {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="prose prose-sm max-w-none text-muted-foreground">
          {widget.noteContent ? (
            <p className="whitespace-pre-wrap">{widget.noteContent}</p>
          ) : (
            <p className="italic opacity-60">No note content</p>
          )}
        </div>
      </div>
    )
  }

  if (widget.chartType === "table") {
    const cols = Object.keys(rows[0] ?? {})
    return (
      <div className="max-h-80 overflow-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 30).map((r, i) => (
              <tr key={i} className="border-t border-border">
                {cols.map((c) => <td key={c} className="px-3 py-2 text-muted-foreground">{String(r[c] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (widget.chartType === "scatter_matrix") {
    // Accept either matrixFields OR xField+metrics OR just selected variables
    let fieldsToPlot: string[] = []
    
    if (widget.matrixFields && widget.matrixFields.length > 0) {
      fieldsToPlot = widget.matrixFields
    } else if (widget.xField && metrics.length > 0) {
      // Use X field + all metric fields
      fieldsToPlot = [widget.xField, ...metrics.map((m) => m.field).filter((f) => f !== "__count__")]
    } else if (widget.xField) {
      fieldsToPlot = [widget.xField]
    }
    
    return <SimpleScatterMatrix rows={rows} fields={fieldsToPlot} />
  }

  if (widget.chartType === "map") {
    const latField = widget.latField
    const lngField = widget.lngField
    if (!latField || !lngField) {
      return <p className="text-sm text-muted-foreground">Select latitude and longitude fields.</p>
    }
    const points = rows
      .map((r) => {
        const lat = Number(r[latField])
        const lng = Number(r[lngField])
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return { lat, lng, data: r }
      })
      .filter((p): p is { lat: number; lng: number; data: Record<string, unknown> } => p !== null)
    
    if (points.length === 0) {
      return <p className="text-sm text-muted-foreground">No valid coordinates found.</p>
    }

    return <MapRenderer points={points} widget={widget} />
  }

  if (widget.chartType === "stat_card") {
    const cardMetrics: VisualizationMetric[] =
      metrics.length > 0
        ? metrics
        : widget.xField
          ? [{ field: widget.xField, aggregate: "count", color: "#2563eb", legendLabel: "" }]
          : []
    if (cardMetrics.length === 0) {
      return <p className="text-sm text-muted-foreground">Select at least one variable.</p>
    }
    return (
      <div className="flex flex-wrap items-center justify-center gap-8 py-4">
        {cardMetrics.map((m, idx) => {
          const vals = rows.map((r) => r[m.field])
          const result = aggregateGeneral(vals, m.aggregate)
          const label = m.legendLabel?.trim() || `${m.aggregate}(${m.field})`
          const isDistinct = m.aggregate === "distinct"
          const isTextResult = isDistinct || !Number.isFinite(Number(result))
          return (
            <div key={`${m.field}-${idx}`} className={isDistinct ? "w-full text-center" : "text-center"}>
              {isDistinct ? (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {result.split(", ").map((val, i) => (
                    <span
                      key={i}
                      className="rounded-md border border-border bg-muted px-2 py-0.5 text-sm"
                    >
                      {val}
                    </span>
                  ))}
                </div>
              ) : isTextResult ? (
                <p
                  className="text-2xl font-semibold tracking-tight"
                  style={{ color: m.color || defaultColor(idx) }}
                >
                  {result}
                </p>
              ) : (
                <p
                  className="text-4xl font-bold tracking-tight"
                  style={{ color: m.color || defaultColor(idx) }}
                >
                  {formatStatValue(result)}
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          )
        })}
      </div>
    )
  }

  if (!widget.xField) {
    return <p className="text-sm text-muted-foreground">Select an X field.</p>
  }

  const series =
    metrics.length > 0
      ? metrics
      : [{ field: "__count__", aggregate: "count" as const, color: "#2563eb", legendLabel: "Count" }]

  const grouped = new Map<string, Record<string, unknown>[]>()
  rows.forEach((r) => {
    const key = String(r[widget.xField!] ?? "")
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(r)
  })

  const unsortedChartData = Array.from(grouped.entries()).map(([x, groupRows]) => {
    const point: Record<string, unknown> = { x }
    series.forEach((m) => {
      const key = `${m.aggregate}:${m.field}`
      const values =
        m.field === "__count__"
          ? groupRows.map(() => 1)
          : groupRows.map((r) => toNumber(r[m.field])).filter((n) => Number.isFinite(n))
      point[key] =
        m.aggregate === "raw"
          ? toNumber(groupRows[0]?.[m.field])
          : aggregate(values, m.aggregate)
    })
    return point
  })

  // Sort bar chart data: for categorical x, sort by the first metric descending
  // For numeric x, sort by x value ascending
  const firstMetricKey = `${series[0].aggregate}:${series[0].field}`
  const chartData =
    widget.chartType === "bar"
      ? [...unsortedChartData].sort((a, b) => {
          const av = toNumber(b[firstMetricKey])
          const bv = toNumber(a[firstMetricKey])
          return (Number.isFinite(av) ? av : 0) - (Number.isFinite(bv) ? bv : 0)
        })
      : unsortedChartData

  if (widget.chartType === "histogram") {
    const baseField = widget.xField
    const gf = widget.groupField

    // ── Grouped histogram ──
    if (gf) {
      const groups = new Map<string, number[]>()
      rows.forEach((r) => {
        const g = String(r[gf] ?? "")
        const v = toNumber(r[baseField ?? ""])
        if (!Number.isFinite(v) || !g) return
        if (!groups.has(g)) groups.set(g, [])
        groups.get(g)!.push(v)
      })
      const allNums = rows.map((r) => toNumber(r[baseField ?? ""])).filter((n) => Number.isFinite(n))
      if (allNums.length === 0) {
        return <p className="text-sm text-muted-foreground">Histogram requires a numeric X variable.</p>
      }
      const binCount = 12
      const lo = Math.min(...allNums)
      const hi = Math.max(...allNums)
      const step = hi === lo ? 1 : (hi - lo) / binCount
      const groupNames = Array.from(groups.keys()).sort().slice(0, 12)

      const data = Array.from({ length: binCount }, (_, i) => {
        const label = `${(lo + i * step).toFixed(1)}–${(lo + (i + 1) * step).toFixed(1)}`
        const point: Record<string, unknown> = { x: label }
        for (const gName of groupNames) {
          const gVals = groups.get(gName) ?? []
          point[gName] = gVals.filter((v) => {
            const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - lo) / step)))
            return idx === i
          }).length
        }
        return point
      })

      const manyBins = binCount > 8
      return (
        <>
          <div className={tileHeight()}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: manyBins ? 20 : 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                  angle={-35}
                  textAnchor="end"
                  height={50}
                  interval={0}
                  label={widget.xAxisLabel ? { value: widget.xAxisLabel, position: "insideBottom", offset: -8 } : undefined}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  label={widget.yAxisLabel ? { value: widget.yAxisLabel, angle: -90, position: "insideLeft" } : undefined}
                />
                <Tooltip />
                <Legend />
                {groupNames.map((g, i) => (
                  <Bar
                    key={g}
                    dataKey={g}
                    name={g}
                    fill={categoryColor(widget, g, i)}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {renderCategoryLegend(groupNames, widget, editableLegend, onCategoryColorChange)}
        </>
      )
    }

    // ── Single histogram (no grouping) ──
    const nums = rows.map((r) => toNumber(r[baseField ?? ""])).filter((n) => Number.isFinite(n))
    if (nums.length === 0) {
      return <p className="text-sm text-muted-foreground">Histogram requires a numeric X variable.</p>
    }
    const bins = histogram(nums, 12)
    return (
      <div className={tileHeight()}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" tick={{ fontSize: 9, fill: "#6b7280" }} angle={-35} textAnchor="end" height={50} interval={0} label={widget.xAxisLabel ? { value: widget.xAxisLabel, position: "insideBottom", offset: -8 } : undefined} />
            <YAxis label={widget.yAxisLabel ? { value: widget.yAxisLabel, angle: -90, position: "insideLeft" } : undefined} />
            <Tooltip />
            <Bar dataKey="y" fill={series[0]?.color || "#2563eb"} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.chartType === "violin") {
    const baseField = widget.xField
    const gf = widget.groupField

    // ── Grouped violin (side-by-side symmetric shapes) ──
    if (gf) {
      const groups = new Map<string, number[]>()
      rows.forEach((r) => {
        const g = String(r[gf] ?? "").trim()
        const v = toNumber(r[baseField ?? ""])
        if (!Number.isFinite(v)) return
        if (!g) return
        if (!groups.has(g)) groups.set(g, [])
        groups.get(g)!.push(v)
      })
      
      const groupNames = Array.from(groups.keys()).sort().slice(0, 12)
      if (groupNames.length === 0) {
        return <p className="text-sm text-muted-foreground">No groups found. Select a valid categorical field for "Group By".</p>
      }

      const allNums: number[] = []
      for (const gVals of groups.values()) {
        allNums.push(...gVals)
      }
      if (allNums.length === 0) {
        return <p className="text-sm text-muted-foreground">No numeric data found in the X field.</p>
      }

      const binCount = 18
      const lo = Math.min(...allNums)
      const hi = Math.max(...allNums)
      const step = hi === lo ? 1 : (hi - lo) / binCount

      // For each group, build density distribution
      const densityByGroup = new Map<string, number[]>()
      for (const gName of groupNames) {
        const gVals = groups.get(gName) ?? []
        const densities: number[] = []
        for (let i = 0; i < binCount; i++) {
          const count = gVals.filter((v) => {
            const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - lo) / step)))
            return idx === i
          }).length
          densities.push(gVals.length > 0 ? count / gVals.length : 0)
        }
        densityByGroup.set(gName, densities)
      }

      // Build chart data with each group having its Y position
      // and separate up/down data for the violin shape
      const violinData: Array<Record<string, unknown>> = []
      for (let i = 0; i < binCount; i++) {
        const center = lo + (i + 0.5) * step
        const point: Record<string, unknown> = { x: +center.toFixed(2) }
        
        for (let gIdx = 0; gIdx < groupNames.length; gIdx++) {
          const gName = groupNames[gIdx]
          const densities = densityByGroup.get(gName) ?? []
          const density = densities[i] ?? 0
          const width = density * 0.35 // scale to reasonable width
          
          // Store both up and down for mirrored violin
          point[`${gName}_up`] = gIdx + width
          point[`${gName}_down`] = gIdx - width
        }
        violinData.push(point)
      }

      return (
        <>
          <div className={tileHeight()}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={violinData} margin={{ top: 10, right: 15, left: 60, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  type="number"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  label={widget.xAxisLabel ? { value: widget.xAxisLabel, position: "insideBottom", offset: -4 } : undefined}
                />
                <YAxis
                  type="number"
                  domain={[-0.4, groupNames.length - 0.6]}
                  ticks={groupNames.map((_, i) => i)}
                  tickFormatter={(val) => groupNames[val] || ""}
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  width={55}
                />
                <Tooltip content={() => null} />
                {groupNames.map((g, i) => {
                  const color = categoryColor(widget, g, i)
                  return (
                    <Line
                      key={`${g}_up`}
                      dataKey={`${g}_up`}
                      stroke={color}
                      fill="none"
                      strokeWidth={3}
                      type="monotone"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
                    />
                  )
                })}
                {groupNames.map((g, i) => {
                  const color = categoryColor(widget, g, i)
                  return (
                    <Line
                      key={`${g}_down`}
                      dataKey={`${g}_down`}
                      stroke={color}
                      fill="none"
                      strokeWidth={3}
                      type="monotone"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {renderCategoryLegend(groupNames, widget, editableLegend, onCategoryColorChange)}
        </>
      )
    }

    // ── Single violin (no grouping) ──
    const nums = rows.map((r) => toNumber(r[baseField ?? ""])).filter((n) => Number.isFinite(n))
    if (nums.length === 0) {
      return <p className="text-sm text-muted-foreground">Violin requires a numeric X variable.</p>
    }
    const rawBins = histogram(nums, 14)
    const step = rawBins.length > 1 ? (rawBins[rawBins.length - 1].center - rawBins[0].center) / (rawBins.length - 1) : 1
    const bins = [
      { x: rawBins[0].center - step, up: 0, down: 0 },
      ...rawBins.map((b) => ({ x: b.center, up: b.y, down: -b.y })),
      { x: rawBins[rawBins.length - 1].center + step, up: 0, down: 0 },
    ]
    return (
      <div className={tileHeight()}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={bins}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" type="number" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
            <Tooltip />
            <Area type="basis" dataKey="up" stroke={series[0]?.color || "#2563eb"} fill={series[0]?.color || "#2563eb"} fillOpacity={0.35} isAnimationActive={false} />
            <Area type="basis" dataKey="down" stroke={series[0]?.color || "#2563eb"} fill={series[0]?.color || "#2563eb"} fillOpacity={0.35} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (widget.chartType === "pie") {
    const s = series[0]
    const key = `${s.aggregate}:${s.field}`
    const pieData = chartData.map((d) => ({ name: String(d.x), value: toNumber(d[key]) }))
    const categories = pieData.map((d) => d.name)
    return (
      <>
        <div className={tileHeight()}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} fill={s.color || "#2563eb"}>
                {widget.colorByCategory &&
                  pieData.map((d, i) => (
                    <Cell key={`pie-${d.name}-${i}`} fill={categoryColor(widget, d.name, i)} />
                  ))}
              </Pie>
              <Tooltip />
              {widget.showLegend !== false && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        </div>
        {widget.colorByCategory
          ? renderCategoryLegend(categories, widget, editableLegend, onCategoryColorChange)
          : renderLegend(series, editableLegend, onMetricColorChange)}
      </>
    )
  }

  if (widget.chartType === "scatter") {
    const yField = series[0]?.field
    if (!yField) return <p className="text-sm text-muted-foreground">Select Y variable.</p>
    const points = rows
      .map((r) => ({ x: toNumber(r[widget.xField!]), y: toNumber(r[yField]) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    return (
      <>
        <div className={tileHeight()}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="x" 
                label={{ value: widget.xAxisLabel || widget.xField || "X", position: "insideBottom", offset: -5, style: { fontSize: 12, fill: "#888" } }}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                label={{ value: widget.yAxisLabel || yField, angle: -90, position: "insideLeft", style: { fontSize: 12, fill: "#888", textAnchor: "middle" } }}
              />
              <Tooltip />
              <Scatter data={points} fill={series[0]?.color || "#2563eb"} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {renderLegend(series, editableLegend, onMetricColorChange)}
      </>
    )
  }

  // Bubble Chart
  if (widget.chartType === "bubble") {
    const yField = series[0]?.field
    const sizeField = widget.sizeField || series[1]?.field
    if (!yField) return <p className="text-sm text-muted-foreground">Select Y variable.</p>
    if (!sizeField) return <p className="text-sm text-muted-foreground">Select size variable (3rd metric).</p>
    if (!widget.xField) return <p className="text-sm text-muted-foreground">Select X variable.</p>
    
    const points = rows
      .map((r) => ({
        x: toNumber(r[widget.xField!]),
        y: toNumber(r[yField]),
        z: toNumber(r[sizeField]),
      }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))
    
    // Normalize z values to reasonable bubble sizes (50-400)
    const zValues = points.map((p) => p.z)
    const minZ = Math.min(...zValues)
    const maxZ = Math.max(...zValues)
    const zRange = maxZ - minZ || 1
    
    const bubbleData = points.map((p) => ({
      x: p.x,
      y: p.y,
      z: 50 + ((p.z - minZ) / zRange) * 350, // Scale to 50-400 range
    }))
    
    return (
      <>
        <div className={tileHeight()}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="x" 
                label={{ value: widget.xAxisLabel || widget.xField || "X", position: "insideBottom", offset: -5, style: { fontSize: 12, fill: "#888" } }}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                label={{ value: widget.yAxisLabel || yField, angle: -90, position: "insideLeft", style: { fontSize: 12, fill: "#888", textAnchor: "middle" } }}
              />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Scatter 
                data={bubbleData} 
                fill={series[0]?.color || "#2563eb"}
                fillOpacity={0.6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Bubble size: {sizeField}
        </div>
      </>
    )
  }

  // Box Plot (simplified using violin data structure)
  if (widget.chartType === "box_plot") {
    if (!widget.xField) return <p className="text-sm text-muted-foreground">Select a variable.</p>
    const numericValues = rows
      .map((r) => toNumber(r[widget.xField!]))
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => a - b)
    
    if (numericValues.length === 0) {
      return <p className="text-sm text-muted-foreground">No numeric data</p>
    }

    const q1 = numericValues[Math.floor(numericValues.length * 0.25)]
    const median = numericValues[Math.floor(numericValues.length * 0.5)]
    const q3 = numericValues[Math.floor(numericValues.length * 0.75)]
    const min = numericValues[0]
    const max = numericValues[numericValues.length - 1]

    const boxData = [
      { name: "Min", value: min },
      { name: "Q1", value: q1 },
      { name: "Median", value: median },
      { name: "Q3", value: q3 },
      { name: "Max", value: max },
    ]

    return (
      <div className={tileHeight()}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={boxData} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" />
            <Tooltip />
            <Bar dataKey="value" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Heatmap (correlation matrix or data grid)
  if (widget.chartType === "heatmap") {
    const numericFields = widget.matrixFields || []
    if (numericFields.length < 2) {
      return <p className="text-sm text-muted-foreground">Select at least 2 numeric variables for heatmap</p>
    }

    // Compute correlation matrix
    const correlationData = numericFields.map((field1, i) => {
      const vals1 = rows.map((r) => toNumber(r[field1])).filter((v) => Number.isFinite(v))
      const mean1 = vals1.reduce((a, b) => a + b, 0) / vals1.length
      
      const row: Record<string, unknown> = { field: field1 }
      numericFields.forEach((field2, j) => {
        const vals2 = rows.map((r) => toNumber(r[field2])).filter((v) => Number.isFinite(v))
        const mean2 = vals2.reduce((a, b) => a + b, 0) / vals2.length
        
        // Simple correlation coefficient
        let correlation = 0
        if (vals1.length === vals2.length && vals1.length > 0) {
          const numerator = vals1.reduce((sum, v1, k) => sum + (v1 - mean1) * (vals2[k] - mean2), 0)
          const denom1 = Math.sqrt(vals1.reduce((sum, v1) => sum + (v1 - mean1) ** 2, 0))
          const denom2 = Math.sqrt(vals2.reduce((sum, v2) => sum + (v2 - mean2) ** 2, 0))
          correlation = denom1 && denom2 ? numerator / (denom1 * denom2) : 0
        }
        row[field2] = correlation.toFixed(2)
      })
      return row
    })

    return (
      <div className={tileHeight()}>
        <div className="overflow-auto h-full">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="border border-border p-1 bg-muted font-medium"></th>
                {numericFields.map((f) => (
                  <th key={f} className="border border-border p-1 bg-muted font-medium">{f}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlationData.map((row, i) => (
                <tr key={i}>
                  <td className="border border-border p-1 bg-muted font-medium">{row.field as string}</td>
                  {numericFields.map((f) => {
                    const val = parseFloat(row[f] as string)
                    const intensity = Math.abs(val)
                    const color = val >= 0 
                      ? `rgba(37, 99, 235, ${intensity})` 
                      : `rgba(239, 68, 68, ${intensity})`
                    return (
                      <td
                        key={f}
                        className="border border-border p-1 text-center"
                        style={{ backgroundColor: color, color: intensity > 0.5 ? "white" : "inherit" }}
                      >
                        {row[f]}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Radar Chart
  if (widget.chartType === "radar") {
    const numericFields = widget.matrixFields || []
    if (numericFields.length < 3) {
      return <p className="text-sm text-muted-foreground">Select at least 3 numeric variables for radar chart</p>
    }

    // Aggregate data by category field if provided, otherwise use overall averages
    const categoryField = widget.categoryField || widget.groupField
    let radarData: Array<Record<string, unknown>> = []

    if (categoryField && rows.length > 0) {
      const categories = Array.from(new Set(rows.map((r) => String(r[categoryField]))))
      radarData = numericFields.map((field) => {
        const point: Record<string, unknown> = { variable: field }
        categories.forEach((cat) => {
          const catRows = rows.filter((r) => String(r[categoryField]) === cat)
          const values = catRows.map((r) => toNumber(r[field])).filter((v) => Number.isFinite(v))
          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
          point[cat] = avg
        })
        return point
      })
    } else {
      radarData = numericFields.map((field) => {
        const values = rows.map((r) => toNumber(r[field])).filter((v) => Number.isFinite(v))
        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
        return { variable: field, value: avg }
      })
    }

    return (
      <div className={tileHeight()}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="variable" />
            <PolarRadiusAxis />
            <Tooltip />
            {categoryField ? (
              Array.from(new Set(rows.map((r) => String(r[categoryField])))).map((cat, i) => (
                <Radar
                  key={cat}
                  name={cat}
                  dataKey={cat}
                  stroke={defaultColor(i)}
                  fill={defaultColor(i)}
                  fillOpacity={0.3}
                />
              ))
            ) : (
              <Radar dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.5} />
            )}
            {widget.showLegend !== false && <Legend />}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Sunburst Chart (using Treemap as approximation)
  if (widget.chartType === "sunburst") {
    const categoryField = widget.categoryField || widget.xField
    const valueField = series[0]?.field
    
    if (!categoryField) {
      return <p className="text-sm text-muted-foreground">Select a category field</p>
    }

    const grouped = rows.reduce((acc: Record<string, number>, row) => {
      const cat = String(row[categoryField] || "Unknown")
      const val = valueField ? toNumber(row[valueField]) : 1
      acc[cat] = (acc[cat] || 0) + (Number.isFinite(val) ? val : 1)
      return acc
    }, {})

    const treeData = Object.entries(grouped).map(([name, value]) => ({
      name,
      value,
    }))

    return (
      <div className={tileHeight()}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={treeData}
            dataKey="value"
            stroke="#fff"
            fill="#2563eb"
          >
            <Tooltip />
          </Treemap>
        </ResponsiveContainer>
      </div>
    )
  }

  const rechartsSeries = series.map((m, i) => ({
    key: `${m.aggregate}:${m.field}`,
    label: m.legendLabel?.trim() || `${m.aggregate}(${m.field})`,
    color: m.color || defaultColor(i),
  }))

  // Determine if X values are categorical (non-numeric strings)
  const isCategoricalX = chartData.length > 0 && chartData.some((d) => Number.isNaN(Number(d.x)))
  const hasLongLabels = chartData.some((d) => String(d.x).length > 8)
  const hasManyCategories = chartData.length > 12

  // Truncate tick labels for readability
  const formatTick = (value: string) => {
    const s = String(value)
    return s.length > 14 ? s.slice(0, 12) + "..." : s
  }

  const commonYAxis = (
    <YAxis
      stroke="#6b7280"
      tick={{ fill: "#6b7280", fontSize: 11 }}
      axisLine={{ stroke: "#6b7280" }}
      tickLine={{ stroke: "#6b7280" }}
      label={widget.yAxisLabel ? { value: widget.yAxisLabel, angle: -90, position: "insideLeft" } : undefined}
      width={50}
    />
  )

  const commonExtras = (
    <>
      <Tooltip />
      {widget.showLegend !== false && <Legend />}
    </>
  )

  // Continuous X axis (for line / area)
  const continuousXAxis = (
    <XAxis
      dataKey="x"
      stroke="#6b7280"
      tick={{ fill: "#6b7280", fontSize: 11 }}
      axisLine={{ stroke: "#6b7280" }}
      tickLine={{ stroke: "#6b7280" }}
      label={widget.xAxisLabel ? { value: widget.xAxisLabel, position: "insideBottom", offset: -2 } : undefined}
    />
  )

  // Category X axis (for bar / pie)
  const categoryXAxis = (
    <XAxis
      dataKey="x"
      type="category"
      stroke="#6b7280"
      tickFormatter={formatTick}
      tick={{ fill: "#6b7280", fontSize: hasManyCategories ? 9 : 11 }}
      axisLine={{ stroke: "#6b7280" }}
      tickLine={{ stroke: "#6b7280" }}
      interval={hasManyCategories ? "preserveStartEnd" : 0}
      angle={hasLongLabels || hasManyCategories ? -35 : 0}
      textAnchor={hasLongLabels || hasManyCategories ? "end" : "middle"}
      height={hasLongLabels || hasManyCategories ? 60 : 30}
      label={widget.xAxisLabel ? { value: widget.xAxisLabel, position: "insideBottom", offset: hasLongLabels ? -8 : -2 } : undefined}
    />
  )

  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" />
      {isCategoricalX ? categoryXAxis : continuousXAxis}
      {commonYAxis}
      {commonExtras}
    </>
  )

  if (widget.chartType === "line") {
    return (
      <>
        <div className={tileHeight()}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              {common}
              {rechartsSeries.map((s) => (
                <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} type="monotone" />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {renderLegend(series, editableLegend, onMetricColorChange)}
      </>
    )
  }

  if (widget.chartType === "area") {
    return (
      <>
        <div className={tileHeight()}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              {common}
              {rechartsSeries.map((s) => (
                <Area key={s.key} dataKey={s.key} name={s.label} stroke={s.color} fill={s.color} fillOpacity={0.25} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {renderLegend(series, editableLegend, onMetricColorChange)}
      </>
    )
  }

  // For bar charts, limit to top N categories if too many
  const barData = chartData.length > 40 ? chartData.slice(0, 40) : chartData
  const barMaxWidth = barData.length <= 5 ? 60 : barData.length <= 15 ? 40 : 20
  const barMargin = {
    top: 5,
    right: 10,
    left: 5,
    bottom: hasLongLabels || hasManyCategories ? 20 : 5,
  }

  // Grouped Bar Chart
  if (widget.chartType === "grouped_bar") {
    return (
      <>
        <div className={tileHeight()}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={barMargin} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" />
              {isCategoricalX ? categoryXAxis : continuousXAxis}
              {commonYAxis}
              {commonExtras}
              {rechartsSeries.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} maxBarSize={barMaxWidth} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {renderLegend(series, editableLegend, onMetricColorChange)}
      </>
    )
  }

  // Stacked Bar Chart
  if (widget.chartType === "stacked_bar") {
    return (
      <>
        <div className={tileHeight()}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={barMargin}>
              <CartesianGrid strokeDasharray="3 3" />
              {isCategoricalX ? categoryXAxis : continuousXAxis}
              {commonYAxis}
              {commonExtras}
              {rechartsSeries.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId="stack" radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {renderLegend(series, editableLegend, onMetricColorChange)}
      </>
    )
  }

  // Stacked Area Chart
  if (widget.chartType === "stacked_area") {
    return (
      <>
        <div className={tileHeight()}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              {common}
              {rechartsSeries.map((s) => (
                <Area key={s.key} dataKey={s.key} name={s.label} stroke={s.color} fill={s.color} stackId="stack" fillOpacity={0.6} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {renderLegend(series, editableLegend, onMetricColorChange)}
      </>
    )
  }

  return (
    <>
      <div className={tileHeight()}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={barMargin} barCategoryGap="15%">
            <CartesianGrid strokeDasharray="3 3" />
            {categoryXAxis}
            {commonYAxis}
            {commonExtras}
            {rechartsSeries.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} maxBarSize={barMaxWidth} radius={[2, 2, 0, 0]}>
                {widget.colorByCategory &&
                  rechartsSeries.length === 1 &&
                  barData.map((row, i) => (
                    <Cell key={`cell-${i}`} fill={categoryColor(widget, String(row.x), i)} />
                  ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {chartData.length > 40 && (
        <p className="mt-1 text-center text-[10px] text-muted-foreground">Showing top 40 of {chartData.length} categories</p>
      )}
      {widget.colorByCategory && rechartsSeries.length === 1
        ? renderCategoryLegend(
            barData.map((d) => String(d.x)),
            widget,
            editableLegend,
            onCategoryColorChange
          )
        : renderLegend(series, editableLegend, onMetricColorChange)}
    </>
  )
}

// Map renderer component (uses dynamic import to avoid SSR issues with Leaflet)
function MapRenderer({
  points,
  widget,
}: {
  points: Array<{ lat: number; lng: number; data: Record<string, unknown> }>
  widget: VisualizationWidget
}) {
  const [MapComponent, setMapComponent] = useState<any>(null)

  useEffect(() => {
    // Dynamically import react-leaflet only on client side
    import("react-leaflet").then((mod) => {
      setMapComponent(() => mod)
    })
  }, [])

  if (!MapComponent) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading map...</div>
  }

  const { MapContainer, TileLayer, CircleMarker, Popup } = MapComponent

  // Calculate center and bounds
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length

  return (
    <div className="h-full w-full">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={10}
        style={{ height: "100%", width: "100%", borderRadius: "8px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.slice(0, 1000).map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={6}
            fillColor="#2563eb"
            fillOpacity={0.6}
            color="#fff"
            weight={1}
          >
            <Popup>
              <div className="text-xs">
                {Object.entries(p.data)
                  .slice(0, 5)
                  .map(([k, v]) => (
                    <div key={k}>
                      <strong>{k}:</strong> {String(v)}
                    </div>
                  ))}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
