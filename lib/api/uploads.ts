const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface QualityWarning {
  check: string
  message: string
}

export interface QualityScanResult {
  score: number
  passed: boolean
  reason: string
  warnings: QualityWarning[]
}

export interface UploadFilterResult {
  filename: string
  fileType: "image" | "text" | "video" | "unknown"
  size: number
  accepted: boolean
  reason: string | null
  url: string | null
  detectedLabel: string | null
  quality: QualityScanResult
  aiTags: string[]
  aiConfidence: number | null
}

export interface UploadResponse {
  totalFiles: number
  accepted: number
  rejected: number
  programId: string
  results: UploadFilterResult[]
}

export async function uploadFiles(
  files: File[],
  programId: string
): Promise<UploadResponse> {
  const formData = new FormData()
  for (const file of files) {
    formData.append("files", file)
  }
  formData.append("program_id", programId)

  const res = await fetch(`${API_BASE}/api/uploads`, {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)

  const data = await res.json()
  return {
    totalFiles: data.total_files,
    accepted: data.accepted,
    rejected: data.rejected,
    programId: data.program_id,
    results: data.results.map((r: Record<string, unknown>) => ({
      filename: r.filename,
      fileType: r.file_type,
      size: r.size,
      accepted: r.accepted,
      reason: r.reason,
      url: r.url,
      detectedLabel: r.detected_label,
      quality: {
        score: (r.quality as Record<string, unknown>).score as number,
        passed: (r.quality as Record<string, unknown>).passed as boolean,
        reason: (r.quality as Record<string, unknown>).reason as string,
        warnings: ((r.quality as Record<string, unknown>).warnings as QualityWarning[]) ?? [],
      },
      aiTags: r.ai_tags,
      aiConfidence: r.ai_confidence,
    })),
  }
}
