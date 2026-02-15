"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CheckCircle2,
  MapPin,
  Camera,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Info,
  Check,
  Loader2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { getPrograms } from "@/lib/api/programs"
import { submitObservation } from "@/lib/api/submissions"
import { getFormConfig } from "@/lib/api/form-configs"
import { submitRowToTable } from "@/lib/api/tables"
import type { Program, FormFieldConfig } from "@/lib/types"

const defaultSteps = [
  { id: 1, title: "Select Program", shortTitle: "Program" },
  { id: 2, title: "Observation Details", shortTitle: "Details" },
  { id: 3, title: "Location & Media", shortTitle: "Location" },
  { id: 4, title: "Review & Submit", shortTitle: "Review" },
]

const customSteps = [
  { id: 1, title: "Select Program", shortTitle: "Program" },
  { id: 2, title: "Fill in Data", shortTitle: "Data" },
  { id: 3, title: "Review & Submit", shortTitle: "Review" },
]

type ValidationResult = {
  field: string
  status: "pass" | "warn" | "fail"
  message: string
}

interface SubmissionFormProps {
  programId?: string
}

export function SubmissionForm({ programId }: SubmissionFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [selectedProgram, setSelectedProgram] = useState("")
  const [observationType, setObservationType] = useState("")
  const [speciesName, setSpeciesName] = useState("")
  const [count, setCount] = useState("")
  const [notes, setNotes] = useState("")
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [time, setTime] = useState(
    new Date().toTimeString().split(" ")[0].slice(0, 5)
  )
  const [habitat, setHabitat] = useState("")
  const [confidence, setConfidence] = useState("")

  const [activePrograms, setActivePrograms] = useState<Program[]>([])
  const [loadingPrograms, setLoadingPrograms] = useState(true)

  // Custom form state
  const [formConfig, setFormConfig] = useState<FormFieldConfig[] | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [customValues, setCustomValues] = useState<Record<string, string>>({})

  const hasCustomForm = formConfig !== null
  const steps = hasCustomForm ? customSteps : defaultSteps
  const reviewStep = hasCustomForm ? 3 : 4

  const hasTypeErrors = hasCustomForm && formConfig.some((f) => {
    const v = customValues[f.fieldName] || ""
    if (v === "") return false
    if (f.fieldType === "INT" && (isNaN(Number(v)) || !Number.isInteger(Number(v)))) return true
    if (f.fieldType === "FLOAT" && isNaN(Number(v))) return true
    return false
  })

  const loadFormConfig = useCallback(
    async (program: Program) => {
      if (!program.projectName || !program.tableName) {
        setFormConfig(null)
        return
      }
      setLoadingConfig(true)
      try {
        const config = await getFormConfig(program.projectName, program.tableName)
        const visibleFields = config.fields
          .filter((f) => f.visible)
          .sort((a, b) => a.order - b.order)
        setFormConfig(visibleFields)
        // Initialize values
        const initial: Record<string, string> = {}
        for (const f of visibleFields) {
          initial[f.fieldName] = ""
        }
        setCustomValues(initial)
      } catch {
        // No form config found — use default form
        setFormConfig(null)
      } finally {
        setLoadingConfig(false)
      }
    },
    []
  )

  useEffect(() => {
    getPrograms({ status: "active" })
      .then((programs) => {
        setActivePrograms(programs)
        // If programId was passed via URL, pre-select and advance
        if (programId) {
          const match = programs.find((p) => p.id === programId)
          if (match) {
            setSelectedProgram(match.id)
            loadFormConfig(match).then(() => {
              setCurrentStep(2)
            })
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPrograms(false))
  }, [programId, loadFormConfig])

  const handleProgramSelect = (id: string) => {
    setSelectedProgram(id)
    const program = activePrograms.find((p) => p.id === id)
    if (program) {
      loadFormConfig(program)
    }
  }

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude.toFixed(6))
          setLongitude(pos.coords.longitude.toFixed(6))
        },
        () => {
          setLatitude("40.7128")
          setLongitude("-74.0060")
        }
      )
    } else {
      setLatitude("40.7128")
      setLongitude("-74.0060")
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const program = activePrograms.find((p) => p.id === selectedProgram)
      if (hasCustomForm && program?.projectName && program?.tableName) {
        // Submit to the dynamic table
        await submitRowToTable(program.projectName, program.tableName, customValues)
      } else {
        // Default submission flow
        await submitObservation({
          selectedProgram,
          observationType: observationType || undefined,
          speciesName,
          count,
          notes: notes || undefined,
          latitude,
          longitude,
          date,
          time,
          habitat: habitat || undefined,
          confidence: confidence || undefined,
        })
      }
      setSubmitted(true)
    } catch {
      // stay on review step so user can retry
    } finally {
      setSubmitting(false)
    }
  }

  // Validation for default form
  const defaultValidationResults: ValidationResult[] = [
    {
      field: "Program",
      status: selectedProgram ? "pass" : "fail",
      message: selectedProgram ? "Program selected" : "No program selected",
    },
    {
      field: "Species / Subject",
      status: speciesName.length >= 3 ? "pass" : speciesName ? "warn" : "fail",
      message:
        speciesName.length >= 3
          ? "Valid entry"
          : speciesName
          ? "Name seems short; verify spelling"
          : "Required field",
    },
    {
      field: "Count",
      status:
        count && parseInt(count) > 0 && parseInt(count) < 10000
          ? "pass"
          : count
          ? "warn"
          : "fail",
      message:
        count && parseInt(count) > 0 && parseInt(count) < 10000
          ? "Within expected range"
          : count
          ? "Unusually high count; please verify"
          : "Required field",
    },
    {
      field: "Coordinates",
      status: latitude && longitude ? "pass" : "fail",
      message:
        latitude && longitude
          ? "Location captured"
          : "GPS coordinates required",
    },
    {
      field: "Date / Time",
      status: date && time ? "pass" : "warn",
      message: date && time ? "Timestamp recorded" : "Missing time data",
    },
  ]

  // Validation for custom form
  const customValidationResults: ValidationResult[] = formConfig
    ? [
        {
          field: "Program",
          status: selectedProgram ? "pass" : "fail",
          message: selectedProgram ? "Program selected" : "No program selected",
        },
        ...formConfig
          .filter((f) => f.required)
          .map((f) => ({
            field: f.label,
            status: (customValues[f.fieldName]?.trim()
              ? "pass"
              : "fail") as ValidationResult["status"],
            message: customValues[f.fieldName]?.trim()
              ? "Filled"
              : "Required field",
          })),
      ]
    : []

  const validationResults = hasCustomForm
    ? customValidationResults
    : defaultValidationResults
  const passCount = validationResults.filter((r) => r.status === "pass").length
  const hasFailures = validationResults.some((r) => r.status === "fail")

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center lg:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-6 font-serif text-2xl font-bold text-foreground">
          Data Submitted
        </h2>
        <p className="mt-3 text-muted-foreground">
          Your data has been received and will be quality-checked by the program
          team. You will be notified once verified and added to the dataset.
        </p>
        <div className="mt-6 rounded-xl border border-border bg-card p-5 text-left text-sm">
          <p className="font-semibold text-foreground">Submission Summary</p>
          <dl className="mt-4 flex flex-col gap-3">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Program</dt>
              <dd className="font-medium text-foreground">
                {activePrograms.find((p) => p.id === selectedProgram)?.title}
              </dd>
            </div>
            {hasCustomForm ? (
              formConfig?.slice(0, 3).map((f) => (
                <div key={f.fieldName} className="flex justify-between">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="font-medium text-foreground">
                    {customValues[f.fieldName] || "—"}
                  </dd>
                </div>
              ))
            ) : (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Species / Subject</dt>
                  <dd className="font-medium text-foreground">{speciesName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Count</dt>
                  <dd className="font-medium text-foreground">{count}</dd>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Quality Score</dt>
              <dd className="font-medium text-primary">
                {passCount}/{validationResults.length} checks passed
              </dd>
            </div>
          </dl>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={() => {
              setSubmitted(false)
              setCurrentStep(1)
              setSelectedProgram("")
              setSpeciesName("")
              setCount("")
              setNotes("")
              setLatitude("")
              setLongitude("")
              setObservationType("")
              setHabitat("")
              setConfidence("")
              setFormConfig(null)
              setCustomValues({})
            }}
          >
            Submit Another
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
            Contribute Data
          </p>
          <h1 className="mt-3 font-serif text-3xl font-bold text-foreground md:text-4xl">
            Submit an Observation
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Follow the guided steps below. Built-in validation checks help
            ensure your data meets program standards.
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
        {/* Step 1: Select Program */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Choose a program to contribute to
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select the citizen-science program your observation belongs to.
              </p>
            </div>

            {loadingPrograms ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {activePrograms.map((program) => (
                  <button
                    key={program.id}
                    onClick={() => handleProgramSelect(program.id)}
                    className={cn(
                      "flex flex-col rounded-xl border p-5 text-left transition-all",
                      selectedProgram === program.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {program.category}
                      </Badge>
                      {selectedProgram === program.id && (
                        <Check className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="mt-3 font-semibold text-foreground">
                      {program.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {program.organization}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {program.description}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {loadingConfig && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading form configuration...
              </div>
            )}
          </div>
        )}

        {/* Step 2: Custom form fields (when form config exists) */}
        {currentStep === 2 && hasCustomForm && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Fill in Data
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Complete the fields below for{" "}
                <span className="font-medium text-foreground">
                  {activePrograms.find((p) => p.id === selectedProgram)?.title}
                </span>
                .
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {formConfig.map((field) => {
                const val = customValues[field.fieldName] || ""
                const isNumeric = field.fieldType === "INT" || field.fieldType === "FLOAT"
                const isBool = field.fieldType === "BOOLEAN"
                const isDate = field.fieldType === "DATE"
                const isText = field.fieldType === "TEXT"
                const hasError =
                  val !== "" &&
                  ((field.fieldType === "INT" && (isNaN(Number(val)) || !Number.isInteger(Number(val)))) ||
                    (field.fieldType === "FLOAT" && isNaN(Number(val))))

                return (
                  <div
                    key={field.fieldName}
                    className={isText ? "sm:col-span-2 space-y-2" : "space-y-2"}
                  >
                    <Label htmlFor={`custom-${field.fieldName}`}>
                      {field.label}
                      {field.required && (
                        <span className="text-destructive"> *</span>
                      )}
                      <span className="ml-1.5 inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                        {field.fieldType === "INT"
                          ? "integer"
                          : field.fieldType === "FLOAT"
                          ? "decimal"
                          : field.fieldType === "BOOLEAN"
                          ? "yes / no"
                          : field.fieldType === "DATE"
                          ? "date"
                          : field.fieldType === "TEXT"
                          ? "long input"
                          : "short input"}
                      </span>
                    </Label>
                    {isBool ? (
                      <Select
                        value={val}
                        onValueChange={(v) =>
                          setCustomValues((prev) => ({
                            ...prev,
                            [field.fieldName]: v,
                          }))
                        }
                      >
                        <SelectTrigger id={`custom-${field.fieldName}`}>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : isText ? (
                      <Textarea
                        id={`custom-${field.fieldName}`}
                        placeholder={field.label}
                        value={val}
                        onChange={(e) =>
                          setCustomValues((prev) => ({
                            ...prev,
                            [field.fieldName]: e.target.value,
                          }))
                        }
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={`custom-${field.fieldName}`}
                        type={isDate ? "date" : isNumeric ? "number" : "text"}
                        step={field.fieldType === "FLOAT" ? "any" : undefined}
                        placeholder={field.label}
                        value={val}
                        onChange={(e) =>
                          setCustomValues((prev) => ({
                            ...prev,
                            [field.fieldName]: e.target.value,
                          }))
                        }
                        className={hasError ? "border-destructive" : ""}
                      />
                    )}
                    {hasError && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        {field.fieldType === "INT"
                          ? "Must be a whole number"
                          : "Must be a valid number"}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2: Observation Details (default form, no custom config) */}
        {currentStep === 2 && !hasCustomForm && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Observation Details
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Provide the specifics of what you observed.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="observation-type">Observation Type</Label>
                <Select
                  value={observationType}
                  onValueChange={setObservationType}
                >
                  <SelectTrigger id="observation-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visual">Visual Sighting</SelectItem>
                    <SelectItem value="audio">Audio Recording</SelectItem>
                    <SelectItem value="measurement">Measurement</SelectItem>
                    <SelectItem value="sample">Sample Collection</SelectItem>
                    <SelectItem value="survey">Survey / Transect</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="species">
                  {"Species / Subject Name "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="species"
                  placeholder="e.g. American Robin, pH Level, PM2.5"
                  value={speciesName}
                  onChange={(e) => setSpeciesName(e.target.value)}
                />
                {speciesName && speciesName.length < 3 && (
                  <p className="flex items-center gap-1 text-xs text-accent">
                    <AlertCircle className="h-3 w-3" />
                    Name seems short; check spelling
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">
                  {"Count / Value "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="count"
                  type="number"
                  placeholder="e.g. 3"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  min="0"
                />
                {count && parseInt(count) >= 10000 && (
                  <p className="flex items-center gap-1 text-xs text-accent">
                    <AlertCircle className="h-3 w-3" />
                    Unusually high; please double-check
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confidence">Confidence Level</Label>
                <Select value={confidence} onValueChange={setConfidence}>
                  <SelectTrigger id="confidence">
                    <SelectValue placeholder="How confident are you?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="certain">Certain</SelectItem>
                    <SelectItem value="probable">Probable</SelectItem>
                    <SelectItem value="possible">Possible</SelectItem>
                    <SelectItem value="uncertain">Uncertain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Describe conditions, behavior, or any other relevant details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        )}

        {/* Step 3: Location & Media (default form only) */}
        {currentStep === 3 && !hasCustomForm && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Location & Context
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add location data and environmental context.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  GPS Coordinates
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGetLocation}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Auto-detect
                </Button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lat">
                    {"Latitude "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lat"
                    placeholder="e.g. 40.7128"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">
                    {"Longitude "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lng"
                    placeholder="e.g. -74.0060"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </div>
              </div>
              {latitude && longitude && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {"Location captured: " + latitude + ", " + longitude}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">
                  {"Date "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">
                  {"Time "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="habitat">Habitat / Environment</Label>
              <Select value={habitat} onValueChange={setHabitat}>
                <SelectTrigger id="habitat">
                  <SelectValue placeholder="Describe the environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forest">Forest / Woodland</SelectItem>
                  <SelectItem value="wetland">Wetland / Marsh</SelectItem>
                  <SelectItem value="urban">Urban / Suburban</SelectItem>
                  <SelectItem value="grassland">
                    Grassland / Prairie
                  </SelectItem>
                  <SelectItem value="coastal">Coastal / Marine</SelectItem>
                  <SelectItem value="freshwater">
                    Freshwater / Stream
                  </SelectItem>
                  <SelectItem value="agricultural">Agricultural</SelectItem>
                  <SelectItem value="desert">Arid / Desert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <Camera className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Photo Attachment
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Drag and drop or click to upload photos of your observation.
                Supports JPG, PNG up to 10 MB.
              </p>
              <Button variant="outline" size="sm" className="mt-4">
                Choose File
              </Button>
            </div>
          </div>
        )}

        {/* Review step (works for both default and custom forms) */}
        {currentStep === reviewStep && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                Review & Quality Check
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Automated validation checks run on your data before submission.
              </p>
            </div>

            {/* Validation card */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  Quality Validation
                </h3>
                <Badge
                  variant={hasFailures ? "destructive" : "secondary"}
                  className={cn(!hasFailures && "bg-primary/10 text-primary")}
                >
                  {passCount}/{validationResults.length} passed
                </Badge>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {validationResults.map((result) => (
                  <div
                    key={result.field}
                    className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
                  >
                    {result.status === "pass" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    ) : result.status === "warn" ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {result.field}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {result.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {hasFailures && (
              <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Some fields need attention
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can still submit, but fixing the flagged items will
                    improve your data quality score.
                  </p>
                </div>
              </div>
            )}

            {/* Submission preview */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold text-foreground">
                Submission Preview
              </h3>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Program</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {activePrograms.find((p) => p.id === selectedProgram)
                      ?.title || "Not selected"}
                  </dd>
                </div>
                {hasCustomForm ? (
                  formConfig.map((f) => (
                    <div key={f.fieldName}>
                      <dt className="text-xs text-muted-foreground">
                        {f.label}
                      </dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {customValues[f.fieldName] || "Not entered"}
                      </dd>
                    </div>
                  ))
                ) : (
                  <>
                    <div>
                      <dt className="text-xs text-muted-foreground">Type</dt>
                      <dd className="mt-0.5 font-medium text-foreground capitalize">
                        {observationType || "Not specified"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Species / Subject
                      </dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {speciesName || "Not entered"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Count</dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {count || "Not entered"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Location
                      </dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {latitude && longitude
                          ? latitude + ", " + longitude
                          : "Not captured"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Date / Time
                      </dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {date} {time}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Habitat
                      </dt>
                      <dd className="mt-0.5 font-medium text-foreground capitalize">
                        {habitat || "Not specified"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Confidence
                      </dt>
                      <dd className="mt-0.5 font-medium text-foreground capitalize">
                        {confidence || "Not specified"}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
              {notes && !hasCustomForm && (
                <div className="mt-4 border-t border-border pt-3">
                  <dt className="text-xs text-muted-foreground">Notes</dt>
                  <dd className="mt-1 text-sm text-foreground">{notes}</dd>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
          <Button
            variant="outline"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((s) => s - 1)}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {currentStep < reviewStep ? (
            <Button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={
                (currentStep === 1 && (!selectedProgram || loadingConfig)) ||
                (currentStep === 2 && hasTypeErrors)
              }
            >
              {loadingConfig && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Observation
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
