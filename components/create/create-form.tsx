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

interface TableDef {
  name: string
  fields: FieldDefinition[]
}

export function CreateForm() {
  const [currentStep, setCurrentStep] = useState(1)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Step 1 state
  const [programName, setProgramName] = useState("")
  const [organization, setOrganization] = useState("")
  const [category, setCategory] = useState("Biodiversity")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [tables, setTables] = useState<TableDef[]>([
    { name: "", fields: [{ name: "", type: "STRING" }] },
  ])
  const [tableResponses, setTableResponses] = useState<DynamicTableResponse[]>([])

  const addTable = () => {
    setTables([...tables, { name: "", fields: [{ name: "", type: "STRING" }] }])
  }

  const removeTable = (tableIndex: number) => {
    setTables(tables.filter((_, i) => i !== tableIndex))
  }

  const updateTableName = (tableIndex: number, name: string) => {
    const updated = [...tables]
    updated[tableIndex] = { ...updated[tableIndex], name }
    setTables(updated)
  }

  const addField = (tableIndex: number) => {
    const updated = [...tables]
    updated[tableIndex] = {
      ...updated[tableIndex],
      fields: [...updated[tableIndex].fields, { name: "", type: "STRING" }],
    }
    setTables(updated)
  }

  const removeField = (tableIndex: number, fieldIndex: number) => {
    const updated = [...tables]
    updated[tableIndex] = {
      ...updated[tableIndex],
      fields: updated[tableIndex].fields.filter((_, i) => i !== fieldIndex),
    }
    setTables(updated)
  }

  const updateFieldName = (tableIndex: number, fieldIndex: number, name: string) => {
    const updated = [...tables]
    const fields = [...updated[tableIndex].fields]
    fields[fieldIndex] = { ...fields[fieldIndex], name }
    updated[tableIndex] = { ...updated[tableIndex], fields }
    setTables(updated)
  }

  const updateFieldType = (tableIndex: number, fieldIndex: number, type: FieldType) => {
    const updated = [...tables]
    const fields = [...updated[tableIndex].fields]
    fields[fieldIndex] = { ...fields[fieldIndex], type }
    updated[tableIndex] = { ...updated[tableIndex], fields }
    setTables(updated)
  }

  // Sanitize a user-entered name into a valid SQL identifier
  const sanitize = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")

  const handleCreateTable = async () => {
    setLoading(true)
    setError("")
    try {
      const safeProject = sanitize(programName)
      if (!safeProject) {
        setError("Program name is required.")
        setLoading(false)
        return
      }

      // Validate all tables have names and at least one field
      for (let i = 0; i < tables.length; i++) {
        const safeTable = sanitize(tables[i].name)
        if (!safeTable) {
          setError(`Table ${i + 1} needs a name.`)
          setLoading(false)
          return
        }
        if (!tables[i].fields.some((f) => f.name.trim())) {
          setError(`Table "${tables[i].name}" needs at least one field.`)
          setLoading(false)
          return
        }
      }

      // Collect all fields across all tables for the contribution spec
      const allFields: FieldDefinition[] = []
      const acceptImages = tables.some((t) =>
        t.fields.some((f) => f.type === "IMAGE")
      )

      // Create all tables
      const tablePromises = tables.map((t) => {
        const validFields = t.fields.filter((f) => f.name.trim())
        const sanitizedFields = validFields.map((f) => ({
          ...f,
          name: sanitize(f.name) || f.name.trim(),
        }))
        allFields.push(...sanitizedFields)
        return createTable({
          projectName: safeProject,
          tableName: sanitize(t.name),
          fields: sanitizedFields,
        })
      })

      const title = programName
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase())

      const primaryTable = sanitize(tables[0].name)

      const [responses] = await Promise.all([
        Promise.all(tablePromises),
        createProgram({
          title,
          organization,
          category,
          description,
          location,
          tags: allFields.filter((f) => f.type !== "IMAGE").map((f) => f.name),
          projectName: safeProject,
          tableName: primaryTable,
          acceptedFiles: acceptImages ? ["image", "csv"] : ["csv"],
          fields: allFields,
        }),
      ])
      setTableResponses(responses)

      setCurrentStep(2)
    } catch {
      setError("Failed to create tables. Check that names use only letters, digits, and underscores.")
    } finally {
      setLoading(false)
    }
  }

  const canContinue =
    programName.trim() &&
    tables.every((t) => t.name.trim()) &&
    tables.every((t) => t.fields.some((f) => f.name.trim()))

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
            {tables.map((t, i) => (
              <div key={i} className="flex justify-between">
                <dt className="text-muted-foreground">
                  {tables.length > 1 ? `Table ${i + 1}` : "Table"}
                </dt>
                <dd className="font-medium text-foreground">
                  {t.name} ({t.fields.filter((f) => f.name.trim()).length} fields)
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={() => {
              setCompleted(false)
              setCurrentStep(1)
              setProgramName("")
              setOrganization("")
              setCategory("Biodiversity")
              setDescription("")
              setLocation("")
              setTables([{ name: "", fields: [{ name: "", type: "STRING" }] }])
              setTableResponses([])
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

            {/* Tables */}
            {tables.map((table, tIdx) => (
              <div
                key={tIdx}
                className="space-y-3 rounded-xl border border-border bg-card/50 p-4"
              >
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4 text-primary shrink-0" />
                  <Input
                    placeholder="Table name (e.g. sightings)"
                    value={table.name}
                    onChange={(e) => updateTableName(tIdx, e.target.value)}
                    className="flex-1"
                  />
                  {tables.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTable(tIdx)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2 pl-7">
                  {table.fields.map((field, fIdx) => (
                    <div
                      key={fIdx}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
                    >
                      <Input
                        placeholder="Field name (e.g. species)"
                        value={field.name}
                        onChange={(e) => updateFieldName(tIdx, fIdx, e.target.value)}
                        className="flex-1"
                      />
                      <Select
                        value={field.type}
                        onValueChange={(v) =>
                          updateFieldType(tIdx, fIdx, v as FieldType)
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
                        onClick={() => removeField(tIdx, fIdx)}
                        disabled={table.fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addField(tIdx)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Field
                  </Button>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addTable} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Another Table
            </Button>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        {/* Step 2: Table Preview */}
        {currentStep === 2 && tableResponses.length > 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                {tableResponses.length > 1 ? "Tables Created" : "Table Created"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Here{`'`}s what your {tableResponses.length > 1 ? "tables look" : "table looks"} like. Contributors will see this when viewing data.
              </p>
            </div>

            {tableResponses.map((resp, rIdx) => {
              const tableDef = tables[rIdx]
              const validFields = tableDef?.fields.filter((f) => f.name.trim()) ?? []
              return (
                <div key={rIdx} className="space-y-4">
                  {/* Table header bar */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-primary" />
                      <h3 className="font-serif text-xl font-semibold text-foreground">
                        {resp.database}
                        <span className="text-muted-foreground"> / </span>
                        {resp.table}
                      </h3>
                    </div>
                    <Badge variant="secondary" className="ml-auto">0 rows</Badge>
                    <Badge variant="outline">
                      {validFields.length + 2} columns
                    </Badge>
                  </div>

                  {/* Schema chips */}
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs">
                      <span className="font-medium text-foreground">id</span>
                      <span className="text-muted-foreground">int</span>
                    </div>
                    {validFields.map((f) => (
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
                          {validFields.map((f) => (
                            <TableHead key={f.name}>{sanitize(f.name) || f.name}</TableHead>
                          ))}
                          <TableHead>created_at</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell
                            colSpan={validFields.length + 2}
                            className="py-12 text-center text-muted-foreground"
                          >
                            No data yet.
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {rIdx < tableResponses.length - 1 && (
                    <div className="border-b border-border" />
                  )}
                </div>
              )
            })}

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
