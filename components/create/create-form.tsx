"use client"

import { useState } from "react"
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Plus,
  Trash2,
  Database,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { createTable } from "@/lib/api/tables"
import { createProgram } from "@/lib/api/programs"
import { Textarea } from "@/components/ui/textarea"
import type {
  FieldType,
  FieldDefinition,
  DynamicTableResponse,
} from "@/lib/types"

const categories = ["Biodiversity", "Water Quality", "Air Quality", "Climate"]

const steps = [
  { id: 1, title: "Define Data Schema", shortTitle: "Schema" },
  { id: 2, title: "Review Table", shortTitle: "Review" },
]

const fieldTypes: FieldType[] = ["STRING", "INT", "FLOAT", "BOOLEAN", "DATE", "TEXT", "IMAGE"]

export function CreateForm() {
  const [currentStep, setCurrentStep] = useState(1)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Step 1 state
  const [programName, setProgramName] = useState("")
  const [tableName, setTableName] = useState("")
  const [organization, setOrganization] = useState("")
  const [category, setCategory] = useState("Biodiversity")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [fields, setFields] = useState<FieldDefinition[]>([
    { name: "", type: "STRING" },
  ])
  const [tableResponse, setTableResponse] =
    useState<DynamicTableResponse | null>(null)


  const addField = () => {
    setFields([...fields, { name: "", type: "STRING" }])
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const updateFieldName = (index: number, name: string) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], name }
    setFields(updated)
  }

  const updateFieldType = (index: number, type: FieldType) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], type }
    setFields(updated)
  }

  // Sanitize a user-entered name into a valid SQL identifier
  const sanitize = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")

  const handleCreateTable = async () => {
    setLoading(true)
    setError("")
    try {
      const safeProject = sanitize(programName)
      const safeTable = sanitize(tableName)
      if (!safeProject || !safeTable) {
        setError("Program and table names are required.")
        setLoading(false)
        return
      }

      const validFields = fields.filter((f) => f.name.trim())
      const acceptImages = validFields.some((f) => f.type === "IMAGE")
      // Sanitize field names — IMAGE fields become TEXT (they store URLs)
      const sanitizedFields = validFields.map((f) => ({
        ...f,
        name: sanitize(f.name) || f.name.trim(),
      }))

      const title = programName
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase())

      // Create one table with all fields (IMAGE → TEXT in backend)
      const [res] = await Promise.all([
        createTable({
          projectName: safeProject,
          tableName: safeTable,
          fields: sanitizedFields,
        }),
        createProgram({
          title,
          organization,
          category,
          description,
          location,
          tags: sanitizedFields.filter((f) => f.type !== "IMAGE").map((f) => f.name),
          projectName: safeProject,
          tableName: safeTable,
          acceptedFiles: acceptImages ? ["image", "csv"] : ["csv"],
          fields: sanitizedFields,
        }),
      ])
      setTableResponse(res)

      setCurrentStep(2)
    } catch {
      setError("Failed to create table. Check that names use only letters, digits, and underscores.")
    } finally {
      setLoading(false)
    }
  }

  const canContinue =
    programName.trim() &&
    tableName.trim() &&
    fields.some((f) => f.name.trim())

  if (completed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center lg:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-6 font-serif text-2xl font-bold text-foreground">
          Program Created
        </h2>
        <p className="mt-3 text-muted-foreground">
          Your data table and upload form have been configured. Contributors can
          now submit data to your program.
        </p>
        <div className="mt-6 rounded-xl border border-border bg-card p-5 text-left text-sm">
          <p className="font-semibold text-foreground">Program Summary</p>
          <dl className="mt-4 flex flex-col gap-3">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Program</dt>
              <dd className="font-medium text-foreground">{programName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Table</dt>
              <dd className="font-medium text-foreground">{tableName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Columns</dt>
              <dd className="font-medium text-foreground">
                {fields.filter((f) => f.name.trim()).length} fields
              </dd>
            </div>
          </dl>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={() => {
              setCompleted(false)
              setCurrentStep(1)
              setProgramName("")
              setTableName("")
              setOrganization("")
              setCategory("Biodiversity")
              setDescription("")
              setLocation("")
              setFields([{ name: "", type: "STRING" }])
              setTableResponse(null)
              setError("")
            }}
          >
            Create Another
          </Button>
          <Button variant="outline" asChild>
            <a href="/programs">Browse Programs</a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 py-12 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            New Program
          </p>
          <h1 className="mt-3 font-serif text-3xl font-bold text-foreground md:text-4xl">
            Create a Program
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Define your data schema then customize the upload form that
            contributors will use to submit data.
          </p>

          {/* Step indicator */}
          <div className="mt-8 flex items-center">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => {
                    if (step.id < currentStep) setCurrentStep(step.id)
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : step.id < currentStep
                      ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/15"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step.id < currentStep ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                      {step.id}
                    </span>
                  )}
                  <span className="hidden sm:inline">{step.title}</span>
                  <span className="sm:hidden">{step.shortTitle}</span>
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "mx-1.5 h-px w-4 sm:w-8",
                      step.id < currentStep ? "bg-primary/30" : "bg-border"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form content */}
      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
        {/* Step 1: Define Table Schema */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Define Data Schema
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Set up the program name, table name, and the fields your data
                will contain.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="program-name">
                  {"Program Name "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="program-name"
                  placeholder="e.g. Wildlife Tracking"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Spaces are fine — names are auto-formatted
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-name">
                  {"Table Name "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="table-name"
                  placeholder="e.g. sightings"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Spaces are fine — names are auto-formatted
                </p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  placeholder="e.g. Wildlife Conservation Society"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g. Pacific Northwest, USA"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Briefly describe the purpose of this program..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Fields</Label>
                <Button variant="outline" size="sm" onClick={addField}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </div>

              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
                  >
                    <Input
                      placeholder="Field name (e.g. species)"
                      value={field.name}
                      onChange={(e) => updateFieldName(index, e.target.value)}
                      className="flex-1"
                    />
                    <Select
                      value={field.type}
                      onValueChange={(v) =>
                        updateFieldType(index, v as FieldType)
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeField(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {tableResponse && (
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm font-semibold text-foreground">
                  Table Created
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tableResponse.columns.map((col) => (
                    <Badge key={col} variant="secondary" className="text-xs">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        {/* Step 2: Table Preview */}
        {currentStep === 2 && tableResponse && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Table Created
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Here's what your table looks like. Contributors will see this when viewing data.
              </p>
            </div>

            {/* Table header bar (like DynamicTableViewer) */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <h3 className="font-serif text-xl font-semibold text-foreground">
                  {tableResponse.database}
                  <span className="text-muted-foreground"> / </span>
                  {tableResponse.table}
                </h3>
              </div>
              <Badge variant="secondary" className="ml-auto">0 rows</Badge>
              <Badge variant="outline">
                {fields.filter((f) => f.name.trim()).length + 2} columns
              </Badge>
            </div>

            {/* Schema chips */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs">
                <span className="font-medium text-foreground">id</span>
                <span className="text-muted-foreground">int</span>
              </div>
              {fields.filter((f) => f.name.trim()).map((f) => (
                <div key={f.name} className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs">
                  <span className="font-medium text-foreground">{sanitize(f.name) || f.name}</span>
                  <span className="text-muted-foreground">{f.type === "IMAGE" ? "image" : f.type.toLowerCase()}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs">
                <span className="font-medium text-foreground">created_at</span>
                <span className="text-muted-foreground">timestamp</span>
              </div>
            </div>

            {/* Empty table preview */}
            <div className="rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>id</TableHead>
                    {fields.filter((f) => f.name.trim()).map((f) => (
                      <TableHead key={f.name}>{sanitize(f.name) || f.name}</TableHead>
                    ))}
                    <TableHead>created_at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell
                      colSpan={fields.filter((f) => f.name.trim()).length + 2}
                      className="py-12 text-center text-muted-foreground"
                    >
                      No data yet.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
          <Button
            variant="outline"
            disabled={currentStep === 1}
            onClick={() => {
              setCurrentStep((s) => s - 1)
              setError("")
            }}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {currentStep === 1 ? (
            <Button
              onClick={handleCreateTable}
              disabled={!canContinue || loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Table
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setCompleted(true)}>
              Done
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
