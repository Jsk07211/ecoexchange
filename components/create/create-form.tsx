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
  ArrowUp,
  ArrowDown,
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
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { createTable } from "@/lib/api/tables"
import { saveFormConfig } from "@/lib/api/form-configs"
import { createProgram } from "@/lib/api/programs"
import { Textarea } from "@/components/ui/textarea"
import type {
  FieldType,
  FieldDefinition,
  DynamicTableResponse,
  FormFieldConfig,
} from "@/lib/types"

const categories = ["Biodiversity", "Water Quality", "Air Quality", "Climate"]

const steps = [
  { id: 1, title: "Define Table Schema", shortTitle: "Schema" },
  { id: 2, title: "Customize Upload Form", shortTitle: "Form" },
]

const fieldTypes: FieldType[] = ["STRING", "INT", "FLOAT", "BOOLEAN", "DATE", "TEXT"]

export function CreateForm() {
  const [currentStep, setCurrentStep] = useState(1)
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Step 1 state
  const [projectName, setProjectName] = useState("")
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

  // Step 2 state
  const [formFields, setFormFields] = useState<FormFieldConfig[]>([])

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

  const handleCreateTable = async () => {
    setLoading(true)
    setError("")
    try {
      const validFields = fields.filter((f) => f.name.trim())
      const title = projectName
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())

      const [res] = await Promise.all([
        createTable({
          projectName,
          tableName,
          fields: validFields,
        }),
        createProgram({
          title,
          organization,
          category,
          description,
          location,
          tags: validFields.map((f) => f.name),
          projectName,
          tableName,
        }),
      ])
      setTableResponse(res)

      // Initialize form field configs from the created fields
      setFormFields(
        validFields.map((f, i) => ({
          fieldName: f.name,
          label: f.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          fieldType: f.type,
          visible: true,
          required: false,
          order: i,
        }))
      )

      setCurrentStep(2)
    } catch {
      setError("Failed to create table. Check that names use only letters, digits, and underscores.")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveFormConfig = async () => {
    setLoading(true)
    setError("")
    try {
      await saveFormConfig({
        projectName,
        tableName,
        fields: formFields,
      })
      setCompleted(true)
    } catch {
      setError("Failed to save form configuration.")
    } finally {
      setLoading(false)
    }
  }

  const updateFormFieldLabel = (index: number, label: string) => {
    const updated = [...formFields]
    updated[index] = { ...updated[index], label }
    setFormFields(updated)
  }

  const updateFormFieldVisible = (index: number, visible: boolean) => {
    const updated = [...formFields]
    updated[index] = { ...updated[index], visible }
    setFormFields(updated)
  }

  const updateFormFieldRequired = (index: number, required: boolean) => {
    const updated = [...formFields]
    updated[index] = { ...updated[index], required }
    setFormFields(updated)
  }

  const moveField = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1
    if (target < 0 || target >= formFields.length) return
    const updated = [...formFields]
    const temp = updated[index]
    updated[index] = updated[target]
    updated[target] = temp
    // Update order values
    setFormFields(updated.map((f, i) => ({ ...f, order: i })))
  }

  const canContinue =
    projectName.trim() &&
    tableName.trim() &&
    fields.some((f) => f.name.trim())

  if (completed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center lg:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-6 font-serif text-2xl font-bold text-foreground">
          Project Created
        </h2>
        <p className="mt-3 text-muted-foreground">
          Your data table and upload form have been configured. Contributors can
          now submit data to your project.
        </p>
        <div className="mt-6 rounded-xl border border-border bg-card p-5 text-left text-sm">
          <p className="font-semibold text-foreground">Project Summary</p>
          <dl className="mt-4 flex flex-col gap-3">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Project</dt>
              <dd className="font-medium text-foreground">{projectName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Table</dt>
              <dd className="font-medium text-foreground">{tableName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Fields</dt>
              <dd className="font-medium text-foreground">
                {formFields.length} configured
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Visible Fields</dt>
              <dd className="font-medium text-primary">
                {formFields.filter((f) => f.visible).length} of{" "}
                {formFields.length}
              </dd>
            </div>
          </dl>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={() => {
              setCompleted(false)
              setCurrentStep(1)
              setProjectName("")
              setTableName("")
              setOrganization("")
              setCategory("Biodiversity")
              setDescription("")
              setLocation("")
              setFields([{ name: "", type: "STRING" }])
              setTableResponse(null)
              setFormFields([])
              setError("")
            }}
          >
            Create Another
          </Button>
          <Button variant="outline" asChild>
            <a href="/datasets">Browse Datasets</a>
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
            New Project
          </p>
          <h1 className="mt-3 font-serif text-3xl font-bold text-foreground md:text-4xl">
            Create a Project
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Define your data table schema then customize the upload form that
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
                Define Table Schema
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Set up the project name, table name, and the fields your data
                will contain.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project-name">
                  {"Project Name "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="project-name"
                  placeholder="e.g. wildlife_tracking"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Letters, digits, and underscores only
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
                  Letters, digits, and underscores only
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
                placeholder="Briefly describe the purpose of this project..."
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

        {/* Step 2: Customize Upload Form */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Customize Upload Form
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure how each field appears on the contributor upload form.
                Reorder, rename labels, and toggle visibility.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Field configuration */}
              <div className="space-y-2">
                <Label>Field Configuration</Label>
                <div className="space-y-2">
                  {formFields.map((field, index) => (
                    <div
                      key={field.fieldName}
                      className="rounded-lg border border-border bg-card p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">
                          {field.fieldName}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveField(index, "up")}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveField(index, "down")}
                            disabled={index === formFields.length - 1}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Input
                        placeholder="Label"
                        value={field.label}
                        onChange={(e) =>
                          updateFormFieldLabel(index, e.target.value)
                        }
                      />
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`visible-${index}`}
                            checked={field.visible}
                            onCheckedChange={(v) =>
                              updateFormFieldVisible(index, v)
                            }
                          />
                          <Label
                            htmlFor={`visible-${index}`}
                            className="text-xs"
                          >
                            Visible
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`required-${index}`}
                            checked={field.required}
                            onCheckedChange={(v) =>
                              updateFormFieldRequired(index, v)
                            }
                          />
                          <Label
                            htmlFor={`required-${index}`}
                            className="text-xs"
                          >
                            Required
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              <div className="space-y-2">
                <Label>Form Preview</Label>
                <div className="rounded-xl border border-border bg-card p-5">
                  <p className="text-sm font-semibold text-foreground">
                    {tableName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Upload Form
                  </p>
                  <div className="mt-4 space-y-4">
                    {formFields
                      .filter((f) => f.visible)
                      .sort((a, b) => a.order - b.order)
                      .map((field) => (
                        <div key={field.fieldName} className="space-y-1.5">
                          <Label className="text-xs">
                            {field.label}
                            {field.required && (
                              <span className="text-destructive"> *</span>
                            )}
                          </Label>
                          <div className="h-9 rounded-md border border-border bg-background" />
                        </div>
                      ))}
                    {formFields.filter((f) => f.visible).length === 0 && (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No visible fields. Toggle at least one field to visible.
                      </p>
                    )}
                  </div>
                </div>
              </div>
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
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSaveFormConfig} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Form Configuration
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
