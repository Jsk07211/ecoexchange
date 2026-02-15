"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  CheckCircle2,
  Upload,
  X,
  Search,
  Check,
  Loader2,
  FileText,
  Image as ImageIcon,
  Video,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { getPrograms } from "@/lib/api/programs"
import { uploadFiles } from "@/lib/api/uploads"
import type { UploadResponse } from "@/lib/api/uploads"
import type { Program } from "@/lib/types"

type FileCategory = "image" | "text" | "video"

interface CategorizedFile {
  file: File
  category: FileCategory
}

function categorizeFile(file: File): FileCategory {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  // PDF, CSV, plain text, etc.
  return "text"
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ACCEPT =
  "image/*,video/*,.csv,.pdf,.txt,application/pdf,text/csv,text/plain"

export function SubmissionForm() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loadingPrograms, setLoadingPrograms] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProgram, setSelectedProgram] = useState<string>("")

  const [files, setFiles] = useState<CategorizedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null)

  useEffect(() => {
    getPrograms({ status: "active" })
      .then(setPrograms)
      .catch(() => {})
      .finally(() => setLoadingPrograms(false))
  }, [])

  const filteredPrograms = programs.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.organization.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const newFiles = Array.from(incoming).map((file) => ({
      file,
      category: categorizeFile(file),
    }))
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  const handleSubmit = async () => {
    if (!selectedProgram || files.length === 0) return
    setSubmitting(true)
    try {
      const result = await uploadFiles(
        files.map((f) => f.file),
        selectedProgram
      )
      setUploadResult(result)
    } catch {
      // keep current state so user can retry
    } finally {
      setSubmitting(false)
    }
  }

  const imageFiles = files.filter((f) => f.category === "image")
  const textFiles = files.filter((f) => f.category === "text")
  const videoFiles = files.filter((f) => f.category === "video")

  const handleReset = () => {
    setSelectedProgram("")
    setFiles([])
    setUploadResult(null)
    setSearchQuery("")
  }

  // Success state
  if (uploadResult) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center lg:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-6 font-serif text-2xl font-bold text-foreground">
          Upload Complete
        </h2>
        <p className="mt-3 text-muted-foreground">
          Your files have been processed. See the results below.
        </p>
        <div className="mt-6 rounded-xl border border-border bg-card p-5 text-left text-sm">
          <p className="font-semibold text-foreground">Upload Summary</p>
          <dl className="mt-4 flex flex-col gap-3">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Program</dt>
              <dd className="font-medium text-foreground">
                {programs.find((p) => p.id === selectedProgram)?.title}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total Files</dt>
              <dd className="font-medium text-foreground">
                {uploadResult.totalFiles}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Accepted</dt>
              <dd className="font-medium text-primary">
                {uploadResult.accepted}
              </dd>
            </div>
            {uploadResult.rejected > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rejected</dt>
                <dd className="font-medium text-destructive">
                  {uploadResult.rejected}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={handleReset}>Upload More</Button>
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
        <div className="mx-auto max-w-5xl px-4 py-12 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Contribute Data
          </p>
          <h1 className="mt-3 font-serif text-3xl font-bold text-foreground md:text-4xl">
            Upload Files
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Select a program, then upload your images, documents, or video files
            for processing.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Program selector */}
          <div className="space-y-4">
            <h2 className="font-serif text-xl font-semibold text-foreground">
              1. Select a Program
            </h2>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search programs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loadingPrograms ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto pr-1">
                {filteredPrograms.map((program) => (
                  <button
                    key={program.id}
                    onClick={() => setSelectedProgram(program.id)}
                    className={cn(
                      "flex flex-col rounded-xl border p-4 text-left transition-all",
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
                    <p className="mt-2 font-semibold text-foreground">
                      {program.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {program.organization}
                    </p>
                  </button>
                ))}
                {filteredPrograms.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No programs match your search.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: File upload zone */}
          <div className="space-y-4">
            <h2 className="font-serif text-xl font-semibold text-foreground">
              2. Upload Files
            </h2>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              )}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Drag & drop files here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Images, documents (CSV, PDF, TXT), and video files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files)
                  e.target.value = ""
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Files
              </Button>
            </div>

            {/* File tabs */}
            {files.length > 0 && (
              <Tabs defaultValue="images" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="images" className="flex-1">
                    <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                    Images ({imageFiles.length})
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex-1">
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Documents ({textFiles.length})
                  </TabsTrigger>
                  <TabsTrigger value="video" className="flex-1">
                    <Video className="mr-1.5 h-3.5 w-3.5" />
                    Video ({videoFiles.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="images">
                  <FileList
                    items={imageFiles}
                    allFiles={files}
                    onRemove={removeFile}
                  />
                </TabsContent>
                <TabsContent value="documents">
                  <FileList
                    items={textFiles}
                    allFiles={files}
                    onRemove={removeFile}
                  />
                </TabsContent>
                <TabsContent value="video">
                  <FileList
                    items={videoFiles}
                    allFiles={files}
                    onRemove={removeFile}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>

        {/* Submit bar */}
        <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            {selectedProgram
              ? `${files.length} file${files.length !== 1 ? "s" : ""} selected`
              : "Select a program to continue"}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={!selectedProgram || files.length === 0 || submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Upload
          </Button>
        </div>
      </div>
    </div>
  )
}

function FileList({
  items,
  allFiles,
  onRemove,
}: {
  items: CategorizedFile[]
  allFiles: CategorizedFile[]
  onRemove: (index: number) => void
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No files in this category.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const globalIndex = allFiles.indexOf(item)
        return (
          <div
            key={`${item.file.name}-${globalIndex}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
          >
            <CategoryIcon category={item.category} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {item.file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(item.file.size)}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {item.category}
            </Badge>
            <button
              onClick={() => onRemove(globalIndex)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function CategoryIcon({ category }: { category: FileCategory }) {
  switch (category) {
    case "image":
      return <ImageIcon className="h-5 w-5 shrink-0 text-blue-500" />
    case "video":
      return <Video className="h-5 w-5 shrink-0 text-purple-500" />
    case "text":
      return <FileText className="h-5 w-5 shrink-0 text-amber-500" />
  }
}
