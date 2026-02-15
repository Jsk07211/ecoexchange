"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Loader2,
  AlertCircle,
  Upload,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getProgram } from "@/lib/api/programs"
import { getProjectTables } from "@/lib/api/tables"
import { insertRow, insertRowsBatch } from "@/lib/api/tables"
import type { Program, ContributionField } from "@/lib/types"

function fieldInput(
  field: ContributionField,
  value: string | boolean,
  onChange: (val: string | boolean) => void
) {
  if (field.type === "BOOLEAN") {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={field.name}
          checked={value as boolean}
          onCheckedChange={(c) => onChange(!!c)}
        />
        <Label htmlFor={field.name} className="text-sm">
          {field.description ?? field.name}
        </Label>
      </div>
    )
  }

  const inputType =
    field.type === "INT" || field.type === "FLOAT"
      ? "number"
      : field.type === "DATE"
        ? "date"
        : "text"

  const step = field.type === "FLOAT" ? "any" : undefined

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.name} className="text-sm font-medium">
        {field.description ?? field.name}
        {field.required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={field.name}
        type={inputType}
        step={step}
        required={field.required}
        placeholder={field.name}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ""
    })
    return row
  })
}

function coerceValue(value: string, type: ContributionField["type"]): unknown {
  if (type === "INT") return parseInt(value, 10)
  if (type === "FLOAT") return parseFloat(value)
  if (type === "BOOLEAN") return value.toLowerCase() === "true" || value === "1"
  return value
}

export default function ContributePage() {
  const { id } = useParams<{ id: string }>()

  const [program, setProgram] = useState<Program | null>(null)
  const [tableName, setTableName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Single entry state
  const [formData, setFormData] = useState<Record<string, string | boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Batch state
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchResult, setBatchResult] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const prog = await getProgram(id)
        setProgram(prog)

        // Initialize form data from spec fields
        if (prog.contributionSpec) {
          const initial: Record<string, string | boolean> = {}
          for (const f of prog.contributionSpec.fields) {
            initial[f.name] = f.type === "BOOLEAN" ? false : ""
          }
          setFormData(initial)
        }

        // Get the first table for this project
        try {
          const res = await getProjectTables(id)
          if (res.tables.length > 0) setTableName(res.tables[0])
        } catch {
          // No tables yet
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load program")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleSingleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!program?.contributionSpec || !tableName) return

      setSubmitting(true)
      setSubmitSuccess(false)
      try {
        const data: Record<string, unknown> = {}
        for (const field of program.contributionSpec.fields) {
          const raw = formData[field.name]
          if (field.type === "BOOLEAN") {
            data[field.name] = !!raw
          } else if (field.type === "INT") {
            data[field.name] = parseInt(raw as string, 10)
          } else if (field.type === "FLOAT") {
            data[field.name] = parseFloat(raw as string)
          } else {
            data[field.name] = raw
          }
        }

        await insertRow(id, tableName, data)
        setSubmitSuccess(true)

        // Reset form
        const reset: Record<string, string | boolean> = {}
        for (const f of program.contributionSpec.fields) {
          reset[f.name] = f.type === "BOOLEAN" ? false : ""
        }
        setFormData(reset)
        setTimeout(() => setSubmitSuccess(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submission failed")
      } finally {
        setSubmitting(false)
      }
    },
    [program, tableName, formData, id]
  )

  const handleCsvFile = useCallback(
    (file: File) => {
      setCsvError(null)
      setBatchResult(null)
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const rows = parseCsv(text)
        if (rows.length === 0) {
          setCsvError("CSV file is empty or has no data rows")
          return
        }

        // Validate headers against spec fields
        if (program?.contributionSpec) {
          const expected = new Set(program.contributionSpec.fields.map((f) => f.name))
          const actual = new Set(Object.keys(rows[0]))
          const missing = [...expected].filter((h) => !actual.has(h))
          if (missing.length > 0) {
            setCsvError(`Missing required columns: ${missing.join(", ")}`)
            return
          }
        }

        setCsvRows(rows)
      }
      reader.readAsText(file)
    },
    [program]
  )

  const handleBatchSubmit = useCallback(async () => {
    if (!program?.contributionSpec || !tableName || csvRows.length === 0) return

    setBatchSubmitting(true)
    setBatchResult(null)
    try {
      const coerced = csvRows.map((row) => {
        const out: Record<string, unknown> = {}
        for (const field of program.contributionSpec!.fields) {
          if (row[field.name] !== undefined) {
            out[field.name] = coerceValue(row[field.name], field.type)
          }
        }
        return out
      })

      const res = await insertRowsBatch(id, tableName, coerced)
      setBatchResult(res.count)
      setCsvRows([])
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "Batch upload failed")
    } finally {
      setBatchSubmitting(false)
    }
  }, [program, tableName, csvRows, id])

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
        <p className="mt-3 font-medium text-foreground">Could not load program</p>
        <p className="mt-1 text-sm text-muted-foreground">{error ?? "Not found"}</p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/programs">Back to programs</Link>
        </Button>
      </div>
    )
  }

  if (!program.contributionSpec) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-medium text-foreground">
          Contributions not configured
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          This program has not defined a contribution schema yet.
        </p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href={`/programs/${id}`}>Back to program</Link>
        </Button>
      </div>
    )
  }

  const spec = program.contributionSpec

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <Link
        href={`/programs/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; {program.title}
      </Link>

      <h1 className="mt-4 font-serif text-2xl font-bold text-foreground">
        Contribute to {program.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Submit observations to the {tableName ?? "project"} dataset.
      </p>

      <Tabs defaultValue="single" className="mt-8">
        <TabsList>
          <TabsTrigger value="single">Single Entry</TabsTrigger>
          <TabsTrigger value="batch">Batch Upload</TabsTrigger>
        </TabsList>

        {/* Single Entry Tab */}
        <TabsContent value="single" className="mt-6">
          <form onSubmit={handleSingleSubmit} className="space-y-4">
            {spec.fields.map((field) => (
              <div key={field.name}>
                {fieldInput(field, formData[field.name] ?? "", (val) =>
                  setFormData((prev) => ({ ...prev, [field.name]: val }))
                )}
              </div>
            ))}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={submitting || !tableName}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Submit
                  </>
                )}
              </Button>

              {submitSuccess && (
                <span className="flex items-center gap-1.5 text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  Row inserted successfully
                </span>
              )}
            </div>
          </form>
        </TabsContent>

        {/* Batch Upload Tab */}
        <TabsContent value="batch" className="mt-6 space-y-4">
          <div
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/40"
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const file = e.dataTransfer.files[0]
              if (file) handleCsvFile(file)
            }}
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.accept = ".csv"
              input.onchange = () => {
                const file = input.files?.[0]
                if (file) handleCsvFile(file)
              }
              input.click()
            }}
          >
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Drop a CSV file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Expected headers: {spec.fields.map((f) => f.name).join(", ")}
            </p>
          </div>

          {csvError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {csvError}
            </div>
          )}

          {csvRows.length > 0 && (
            <>
              <p className="text-sm font-medium text-foreground">
                Preview ({csvRows.length} rows)
              </p>
              <div className="max-h-64 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {spec.fields.map((f) => (
                        <TableHead key={f.name}>{f.name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvRows.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {spec.fields.map((f) => (
                          <TableCell key={f.name}>{row[f.name]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {csvRows.length > 10 && (
                      <TableRow>
                        <TableCell
                          colSpan={spec.fields.length}
                          className="text-center text-xs text-muted-foreground"
                        >
                          ... and {csvRows.length - 10} more rows
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <Button
                onClick={handleBatchSubmit}
                disabled={batchSubmitting}
              >
                {batchSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {csvRows.length} rows
                  </>
                )}
              </Button>
            </>
          )}

          {batchResult !== null && (
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              Successfully inserted {batchResult} rows
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
