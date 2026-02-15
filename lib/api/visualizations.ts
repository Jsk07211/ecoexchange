import { apiFetch } from "./client"
import type { Visualization, VisualizationConfig } from "../types"

function mapVisualization(row: Record<string, unknown>): Visualization {
  return {
    id: row.id as string,
    programId: row.program_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    config: row.config as VisualizationConfig,
    createdAt: row.created_at as string,
  }
}

export async function listVisualizations(programId: string): Promise<Visualization[]> {
  const data = await apiFetch<Record<string, unknown>[]>(
    `/api/programs/${programId}/visualizations`
  )
  return data.map(mapVisualization)
}

export async function getVisualization(
  programId: string,
  visualizationId: string
): Promise<Visualization> {
  const data = await apiFetch<Record<string, unknown>>(
    `/api/programs/${programId}/visualizations/${visualizationId}`
  )
  return mapVisualization(data)
}

export async function createVisualization(
  programId: string,
  payload: { name: string; description?: string; config: VisualizationConfig }
): Promise<Visualization> {
  const data = await apiFetch<Record<string, unknown>>(
    `/api/programs/${programId}/visualizations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        description: payload.description ?? "",
        config: payload.config,
      }),
    }
  )
  return mapVisualization(data)
}
