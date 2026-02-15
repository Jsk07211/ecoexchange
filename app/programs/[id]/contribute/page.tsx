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
  ImageIcon,
  X,
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
import { uploadFiles } from "@/lib/api/uploads"
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
  const [projectKey, setProjectKey] = useState(id)
  const [tableName, setTableName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Single entry state
  const [formData, setFormData] = useState<Record<string, string | boolean>>({})
  const [formImages, setFormImages] = useState<Record<string, { file: File; preview: string }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Batch state
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [batchImages, setBatchImages] = useState<File[]>([])
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

        // Get the sightings table for this project (skip image tables)
        try {
          const pk = prog.projectName || id
          setProjectKey(pk)
          const res = await getProjectTables(pk)
          const dataTable = res.tables.find((t) => t === "sightings") ?? res.tables.find((t) => !t.includes("image")) ?? res.tables[0]
          if (dataTable) setTableName(dataTable)
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
          if (field.type === "IMAGE") continue // handled below
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

        // Upload any image fields and add their URLs to the row
        const imageFields = program.contributionSpec.fields.filter((f) => f.type === "IMAGE")
        for (const field of imageFields) {
          const img = formImages[field.name]
          if (img) {
            const uploadRes = await uploadFiles([img.file], projectKey)
            const result = uploadRes.results[0]
            if (result?.url) {
              data[field.name] = result.url
            }
          }
        }

        await insertRow(projectKey, tableName, data)
        setSubmitSuccess(true)

        // Reset form
        const reset: Record<string, string | boolean> = {}
        for (const f of program.contributionSpec.fields) {
          if (f.type !== "IMAGE") reset[f.name] = f.type === "BOOLEAN" ? false : ""
        }
        setFormData(reset)
        // Revoke all image previews
        for (const img of Object.values(formImages)) {
          URL.revokeObjectURL(img.preview)
        }
        setFormImages({})
        setTimeout(() => setSubmitSuccess(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submission failed")
      } finally {
        setSubmitting(false)
      }
    },
    [program, tableName, formData, formImages, projectKey]
  )

  const imageExtensions = new Set(["jpg", "jpeg", "png", "webp"])
  const isImageFile = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
    return imageExtensions.has(ext) || f.type.startsWith("image/")
  }

  const handleBatchFiles = useCallback(
    (fileList: FileList) => {
      setCsvError(null)
      setBatchResult(null)

      const allFiles = Array.from(fileList)
      const csvFile = allFiles.find((f) => f.name.endsWith(".csv"))
      const images = allFiles.filter((f) => isImageFile(f))

      // Store images for later upload
      if (images.length > 0) {
        setBatchImages(images)
      }

      if (csvFile) {
        // CSV + possibly images mode
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result as string
          const rows = parseCsv(text)
          if (rows.length === 0) {
            setCsvError("CSV file is empty or has no data rows")
            return
          }

          if (program?.contributionSpec) {
            const imageFieldNames = new Set(
              program.contributionSpec.fields.filter((f) => f.type === "IMAGE").map((f) => f.name)
            )
            const nonImageFields = program.contributionSpec.fields.filter((f) => f.type !== "IMAGE")
            const actual = new Set(Object.keys(rows[0]))
            // Only require non-IMAGE columns; IMAGE columns in CSV are optional (contain filenames)
            const missing = nonImageFields.filter((f) => !actual.has(f.name)).map((f) => f.name)
            if (missing.length > 0) {
              setCsvError(`Missing columns: ${missing.join(", ")}`)
              return
            }

            // If CSV doesn't have an IMAGE column but images were selected,
            // auto-assign images to rows by order
            if (images.length > 0) {
              const csvHasImageCol = [...imageFieldNames].some((n) => actual.has(n))
              if (!csvHasImageCol && imageFieldNames.size > 0) {
                const imgFieldName = [...imageFieldNames][0]
                rows.forEach((row, i) => {
                  row[imgFieldName] = images[i]?.name ?? ""
                })
              }
            }
          }

          setCsvRows(rows)
        }
        reader.readAsText(csvFile)
      } else if (images.length > 0 && !csvFile) {
        // Images only — auto-generate rows from filenames
        const imageFields = program?.contributionSpec?.fields.filter((f) => f.type === "IMAGE") ?? []
        const stringFields = program?.contributionSpec?.fields.filter(
          (f) => f.type === "STRING" || f.type === "TEXT"
        ) ?? []

        const rows = images.map((img) => {
          const row: Record<string, string> = {}
          // Use filename (without extension) as the first string field value
          const stem = img.name.includes(".") ? img.name.split(".").slice(0, -1).join(".") : img.name
          const label = stem.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim()

          if (stringFields.length > 0) {
            row[stringFields[0].name] = label
          }
          // Set the image field to the filename (will be resolved on upload)
          if (imageFields.length > 0) {
            row[imageFields[0].name] = img.name
          }
          return row
        })
        setCsvRows(rows)
      }
    },
    [program]
  )

  const handleBatchSubmit = useCallback(async () => {
    if (!program?.contributionSpec || !tableName || csvRows.length === 0) return

    setBatchSubmitting(true)
    setBatchResult(null)
    setCsvError(null)
    try {
      const imageFields = program.contributionSpec.fields.filter((f) => f.type === "IMAGE")

      // Upload all batch images and build a filename → URL map
      const filenameToUrl: Record<string, string> = {}
      if (batchImages.length > 0) {
        const uploadRes = await uploadFiles(batchImages, projectKey)
        for (const result of uploadRes.results) {
          if (result.url) {
            filenameToUrl[result.filename] = result.url
          }
        }
      }

      const coerced = csvRows.map((row) => {
        const out: Record<string, unknown> = {}
        for (const field of program.contributionSpec!.fields) {
          if (row[field.name] === undefined) continue

          if (field.type === "IMAGE") {
            // Replace filename with uploaded URL
            const filename = row[field.name]
            out[field.name] = filenameToUrl[filename] ?? filename
          } else {
            out[field.name] = coerceValue(row[field.name], field.type)
          }
        }
        return out
      })

      const res = await insertRowsBatch(projectKey, tableName, coerced)
      setBatchResult(res.count)
      setCsvRows([])
      setBatchImages([])
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "Batch upload failed")
    } finally {
      setBatchSubmitting(false)
    }
  }, [program, tableName, csvRows, batchImages, projectKey])

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
  const hasImageFields = spec.fields.some((f) => f.type === "IMAGE")

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
                {field.type === "IMAGE" ? (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      {field.description ?? field.name}
                    </Label>
                    {formImages[field.name] ? (
                      <div className="relative inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={formImages[field.name].preview}
                          alt="Preview"
                          className="h-32 w-32 rounded-lg object-cover border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(formImages[field.name].preview)
                            setFormImages((prev) => {
                              const next = { ...prev }
                              delete next[field.name]
                              return next
                            })
                          }}
                          className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-border p-4 transition-colors hover:border-primary/40"
                        onClick={() => {
                          const input = document.createElement("input")
                          input.type = "file"
                          input.accept = "image/jpeg,image/png,image/webp"
                          input.onchange = () => {
                            const file = input.files?.[0]
                            if (file) {
                              setFormImages((prev) => ({
                                ...prev,
                                [field.name]: { file, preview: URL.createObjectURL(file) },
                              }))
                            }
                          }
                          input.click()
                        }}
                      >
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click to add a photo</span>
                      </div>
                    )}
                  </div>
                ) : (
                  fieldInput(field, formData[field.name] ?? "", (val) =>
                    setFormData((prev) => ({ ...prev, [field.name]: val }))
                  )
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
              if (e.dataTransfer.files.length > 0) handleBatchFiles(e.dataTransfer.files)
            }}
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.accept = hasImageFields ? ".csv,image/jpeg,image/png,image/webp" : ".csv"
              input.multiple = true
              input.onchange = () => {
                if (input.files && input.files.length > 0) handleBatchFiles(input.files)
              }
              input.click()
            }}
          >
            {hasImageFields ? (
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-7 w-7 text-muted-foreground" />
                <span className="text-muted-foreground">/</span>
                <ImageIcon className="h-7 w-7 text-muted-foreground" />
              </div>
            ) : (
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            )}
            <p className="text-sm font-medium text-foreground">
              {hasImageFields
                ? "Drop CSV + images, images only, or a CSV here"
                : "Drop a CSV file here or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasImageFields
                ? "CSV + images: match by filename. Images only: auto-fills name from filename."
                : `Expected headers: ${spec.fields.map((f) => f.name).join(", ")}`}
            </p>
          </div>

          {batchImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {batchImages.length} image{batchImages.length > 1 ? "s" : ""} selected
              </p>
              <div className="flex flex-wrap gap-2">
                {batchImages.map((img, i) => (
                  <div key={i} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(img)}
                      alt={img.name}
                      className="h-16 w-16 rounded-md object-cover border border-border"
                    />
                    <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 text-[10px] text-white rounded-b-md">
                      {img.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                      {Object.keys(csvRows[0]).map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvRows.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {Object.entries(row).map(([col, val]) => {
                          const isImg = spec.fields.find((f) => f.name === col)?.type === "IMAGE"
                          return (
                            <TableCell key={col}>
                              {isImg
                                ? <span className="flex items-center gap-1 text-xs"><ImageIcon className="h-3 w-3" />{val}</span>
                                : val}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                    {csvRows.length > 10 && (
                      <TableRow>
                        <TableCell
                          colSpan={Object.keys(csvRows[0]).length}
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
                    Uploading{batchImages.length > 0 ? ` (${batchImages.length} images + ${csvRows.length} rows)` : ""}...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {csvRows.length} rows{batchImages.length > 0 ? ` + ${batchImages.length} images` : ""}
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
