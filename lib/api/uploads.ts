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

export interface CnnResult {
  label: string
  confidence: number
  matches: boolean
  expectedCategory: string
  message: string
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
  cnn: CnnResult | null
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
  programId: string,
  tableName?: string
): Promise<UploadResponse> {
  const formData = new FormData()
  for (const file of files) {
    formData.append("files", file)
  }
  formData.append("program_id", programId)
  if (tableName) formData.append("table_name", tableName)

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
      cnn: r.cnn ? {
        label: (r.cnn as Record<string, unknown>).label as string,
        confidence: (r.cnn as Record<string, unknown>).confidence as number,
        matches: (r.cnn as Record<string, unknown>).matches as boolean,
        expectedCategory: (r.cnn as Record<string, unknown>).expected_category as string,
        message: (r.cnn as Record<string, unknown>).message as string,
      } : null,
    })),
  }
}

export interface ScanUrlResult {
  url: string
  quality: QualityScanResult
  cnn: CnnResult | null
  error: string | null
}

export interface ScanUrlResponse {
  results: Record<string, ScanUrlResult>
}

function parseScanUrlResult(r: Record<string, unknown>): ScanUrlResult {
  const q = r.quality as Record<string, unknown>
  const c = r.cnn as Record<string, unknown> | null
  return {
    url: r.url as string,
    quality: {
      score: q.score as number,
      passed: q.passed as boolean,
      reason: q.reason as string,
      warnings: (q.warnings as QualityWarning[]) ?? [],
    },
    cnn: c ? {
      label: c.label as string,
      confidence: c.confidence as number,
      matches: c.matches as boolean,
      expectedCategory: c.expected_category as string,
      message: c.message as string,
    } : null,
    error: (r.error as string) ?? null,
  }
}

export async function scanImageUrls(
  urls: string[],
  programId: string,
  tableName?: string
): Promise<ScanUrlResponse> {
  const res = await fetch(`${API_BASE}/api/uploads/scan-urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      urls,
      program_id: programId,
      table_name: tableName ?? null,
    }),
  })
  if (!res.ok) throw new Error(`Scan failed: ${res.status}`)

  const data = await res.json()
  const results: Record<string, ScanUrlResult> = {}
  for (const [url, r] of Object.entries(data.results)) {
    results[url] = parseScanUrlResult(r as Record<string, unknown>)
  }
  return { results }
}
