import { apiFetch } from "./client"
import type { Dataset } from "../types"

interface DatasetParams {
  category?: string
  search?: string
  sort_by?: string
  sort_dir?: string
}

export async function getDatasets(params?: DatasetParams): Promise<Dataset[]> {
  const clean: Record<string, string> = {}
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) clean[key] = value
    }
  }
  const query = Object.keys(clean).length ? new URLSearchParams(clean).toString() : ""
  const path = query ? `/api/datasets?${query}` : "/api/datasets"
  const data = await apiFetch<Record<string, unknown>[]>(path)
  return data.map(mapDataset)
}

export async function getDataset(id: string): Promise<Dataset> {
  const data = await apiFetch<Record<string, unknown>>(`/api/datasets/${id}`)
  return mapDataset(data)
}

function mapDataset(d: Record<string, unknown>): Dataset {
  return {
    id: d.id as string,
    title: d.title as string,
    program: d.program as string,
    organization: d.organization as string,
    category: d.category as string,
    records: d.records as number,
    format: d.format as string,
    license: d.license as string,
    lastUpdated: d.last_updated as string,
    qualityScore: d.quality_score as number,
    downloads: d.downloads as number,
    description: d.description as string,
    tags: d.tags as string[],
  }
}
