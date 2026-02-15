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

interface ImagePreview {
  file: File
  localUrl: string
  serverUrl?: string
  species: string
  description: string
  qualityScore?: number
  qualityReason?: string
}

function labelFromFilename(filename: string): string {
  const stem = filename.includes(".") ? filename.split(".").slice(0, -1).join(".") : filename
  return stem
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

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

  // Image upload state: "select" → "validated" → "confirmed"
  type ImageStep = "select" | "validating" | "validated" | "confirming" | "confirmed"
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([])
  const [imageStep, setImageStep] = useState<ImageStep>("select")
  const [imageError, setImageError] = useState<string | null>(null)

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

  const handleImageSelect = useCallback((fileList: FileList) => {
    const accepted = Array.from(fileList).filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type)
    )
    if (accepted.length === 0) return
    setImageError(null)
    setImageUploadDone(false)
    const newPreviews: ImagePreview[] = accepted.map((file) => ({
      file,
      localUrl: URL.createObjectURL(file),
      species: labelFromFilename(file.name),
      description: "",
    }))
    setImagePreviews((prev) => [...prev, ...newPreviews])
  }, [])

  const updateImageLabel = useCallback((index: number, field: "species" | "description", value: string) => {
    setImagePreviews((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    )
  }, [])

  const removeImage = useCallback((index: number) => {
    setImagePreviews((prev) => {
      const removed = prev[index]
      URL.revokeObjectURL(removed.localUrl)
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const handleValidate = useCallback(async () => {
    if (imagePreviews.length === 0) return
    setImageStep("validating")
    setImageError(null)
    try {
      const files = imagePreviews.map((p) => p.file)
      const res = await uploadFiles(files, id)
      setImagePreviews((prev) =>
        prev.map((p, i) => ({
          ...p,
          serverUrl: res.results[i]?.url ?? undefined,
          qualityScore: res.results[i]?.quality.score,
          qualityReason: res.results[i]?.quality.reason,
          species: p.species || res.results[i]?.detectedLabel || "",
        }))
      )
      setImageStep("validated")
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Validation failed")
      setImageStep("select")
    }
  }, [imagePreviews, id])

  const handleConfirmUpload = useCallback(async () => {
    setImageStep("confirming")
    setImageError(null)
    try {
      for (const img of imagePreviews) {
        if (img.serverUrl) {
          const row: Record<string, unknown> = {
            image_url: img.serverUrl,
            quality_score: img.qualityScore ?? 100,
          }
          if (img.species) row.species = img.species
          if (img.description) row.description = img.description
          await insertRow(id, "bird_images", row)
        }
      }
      setImageStep("confirmed")
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Save failed")
      setImageStep("validated")
    }
  }, [imagePreviews, id])

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
  const acceptsImages = spec.accepted_files?.includes("image")

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
          {acceptsImages && (
            <TabsTrigger value="images">Images</TabsTrigger>
          )}
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

        {/* Images Tab */}
        {acceptsImages && (
          <TabsContent value="images" className="mt-6 space-y-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={imageStep === "select" ? "font-semibold text-foreground" : ""}>
                1. Select
              </span>
              <span>&rarr;</span>
              <span className={imageStep === "validating" || imageStep === "validated" ? "font-semibold text-foreground" : ""}>
                2. Validate
              </span>
              <span>&rarr;</span>
              <span className={imageStep === "confirming" || imageStep === "confirmed" ? "font-semibold text-foreground" : ""}>
                3. Confirm
              </span>
            </div>

            {/* Drop zone — visible during select step */}
            {(imageStep === "select") && (
              <div
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/40"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (e.dataTransfer.files.length > 0) {
                    handleImageSelect(e.dataTransfer.files)
                  }
                }}
                onClick={() => {
                  const input = document.createElement("input")
                  input.type = "file"
                  input.accept = "image/jpeg,image/png,image/webp"
                  input.multiple = true
                  input.onchange = () => {
                    if (input.files && input.files.length > 0) {
                      handleImageSelect(input.files)
                    }
                  }
                  input.click()
                }}
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Drop images here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Accepts JPG, PNG, and WebP
                </p>
              </div>
            )}

            {imageError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {imageError}
              </div>
            )}

            {imagePreviews.length > 0 && (
              <>
                {/* Image cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {imagePreviews.map((img, i) => (
                    <div
                      key={i}
                      className={`group relative overflow-hidden rounded-lg border ${
                        imageStep === "validated" && img.qualityScore !== undefined && img.qualityScore < 50
                          ? "border-destructive/40"
                          : "border-border"
                      }`}
                    >
                      <div className="relative aspect-video">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.serverUrl ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${img.serverUrl}` : img.localUrl}
                          alt={img.file.name}
                          className="h-full w-full object-cover"
                        />
                        {imageStep !== "confirmed" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeImage(i)
                            }}
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 p-3">
                        <Input
                          placeholder="Species name"
                          value={img.species}
                          onChange={(e) => updateImageLabel(i, "species", e.target.value)}
                          disabled={imageStep === "confirmed"}
                        />
                        <Input
                          placeholder="Description (optional)"
                          value={img.description}
                          onChange={(e) => updateImageLabel(i, "description", e.target.value)}
                          disabled={imageStep === "confirmed"}
                        />
                        {img.qualityScore !== undefined && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                              img.qualityScore >= 80
                                ? "bg-primary/10 text-primary"
                                : img.qualityScore >= 50
                                  ? "bg-yellow-500/10 text-yellow-600"
                                  : "bg-destructive/10 text-destructive"
                            }`}>
                              Quality: {img.qualityScore}%
                            </span>
                            <span className="text-muted-foreground">{img.qualityReason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action buttons per step */}
                <div className="flex items-center gap-3">
                  {imageStep === "select" && (
                    <Button onClick={handleValidate}>
                      <Upload className="mr-2 h-4 w-4" />
                      Validate {imagePreviews.length} image{imagePreviews.length !== 1 ? "s" : ""}
                    </Button>
                  )}

                  {imageStep === "validating" && (
                    <Button disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </Button>
                  )}

                  {imageStep === "validated" && (
                    <>
                      <Button onClick={handleConfirmUpload}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirm &amp; Save {imagePreviews.length} image{imagePreviews.length !== 1 ? "s" : ""}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setImageStep("select")
                        }}
                      >
                        Back
                      </Button>
                    </>
                  )}

                  {imageStep === "confirming" && (
                    <Button disabled>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </Button>
                  )}

                  {imageStep === "confirmed" && (
                    <div className="flex items-center gap-1.5 text-sm text-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      {imagePreviews.length} image{imagePreviews.length !== 1 ? "s" : ""} saved successfully
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
