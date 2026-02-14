import { apiFetch } from "./client"
import type { Program } from "../types"

interface ProgramParams {
  category?: string
  status?: string
  search?: string
}

function toSnakeCase(obj: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value) result[key] = value
  }
  return result
}

export async function getPrograms(params?: ProgramParams): Promise<Program[]> {
  const query = params ? new URLSearchParams(toSnakeCase(params)).toString() : ""
  const path = query ? `/api/programs?${query}` : "/api/programs"
  const data = await apiFetch<Record<string, unknown>[]>(path)
  return data.map(mapProgram)
}

export async function getProgram(id: string): Promise<Program> {
  const data = await apiFetch<Record<string, unknown>>(`/api/programs/${id}`)
  return mapProgram(data)
}

function mapProgram(p: Record<string, unknown>): Program {
  return {
    id: p.id as string,
    title: p.title as string,
    organization: p.organization as string,
    category: p.category as string,
    description: p.description as string,
    location: p.location as string,
    participants: p.participants as number,
    dataPoints: p.data_points as number,
    status: p.status as Program["status"],
    tags: p.tags as string[],
    deadline: p.deadline as string | undefined,
  }
}
