"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Database,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getTableSchema,
  getTableRows,
  type ColumnSchema,
} from "@/lib/api/tables"

const PAGE_SIZE = 25

/** Map Postgres data_type strings to short display labels. */
function typeLabel(pgType: string): string {
  const map: Record<string, string> = {
    integer: "int",
    "double precision": "float",
    "character varying": "string",
    text: "text",
    boolean: "bool",
    date: "date",
    "timestamp without time zone": "timestamp",
  }
  return map[pgType] ?? pgType
}

/** Render a cell value based on its column type. */
function CellValue({
  value,
  type,
}: {
  value: unknown
  type: string
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/50">null</span>
  }

  const label = typeLabel(type)

  if (label === "bool") {
    return (
      <Badge variant={value ? "default" : "secondary"} className="text-xs">
        {value ? "true" : "false"}
      </Badge>
    )
  }

  if (label === "int" || label === "float") {
    return <span className="font-mono tabular-nums">{String(value)}</span>
  }

  if (label === "date" || label === "timestamp") {
    return (
      <span className="text-muted-foreground">{String(value)}</span>
    )
  }

  // string / text / fallback
  const str = String(value)
  if (str.length > 80) {
    return <span title={str}>{str.slice(0, 77)}...</span>
  }
  return <span>{str}</span>
}

export interface DynamicTableViewerProps {
  project: string
  table: string
}

export function DynamicTableViewer({
  project,
  table,
}: DynamicTableViewerProps) {
  const [columns, setColumns] = useState<ColumnSchema[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(
    async (newOffset: number) => {
      setLoading(true)
      setError(null)
      try {
        const [schema, data] = await Promise.all([
          getTableSchema(project, table),
          getTableRows(project, table, PAGE_SIZE, newOffset),
        ])
        setColumns(schema.columns)
        setRows(data.rows)
        setTotal(data.total)
        setOffset(newOffset)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setLoading(false)
      }
    },
    [project, table]
  )

  useEffect(() => {
    fetchData(0)
  }, [fetchData])

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-3 font-medium text-foreground">
          Could not load table
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => fetchData(0)}
        >
          Retry
        </Button>
      </div>
    )
  }

  // Build a type lookup so CellValue knows each column's type
  const typeMap: Record<string, string> = {}
  for (const col of columns) {
    typeMap[col.name] = col.type
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-xl font-semibold text-foreground">
            {project}
            <span className="text-muted-foreground"> / </span>
            {table}
          </h2>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {total} row{total !== 1 ? "s" : ""}
        </Badge>
        <Badge variant="outline">
          {columns.length} column{columns.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Schema chips */}
      <div className="flex flex-wrap gap-2">
        {columns.map((col) => (
          <div
            key={col.name}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs"
          >
            <span className="font-medium text-foreground">{col.name}</span>
            <span className="text-muted-foreground">{typeLabel(col.type)}</span>
            {col.nullable && (
              <span className="text-muted-foreground/60">?</span>
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.name}>{col.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-muted-foreground"
                >
                  No data yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.name}>
                      <CellValue
                        value={row[col.name]}
                        type={col.type}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => fetchData(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => fetchData(offset + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
