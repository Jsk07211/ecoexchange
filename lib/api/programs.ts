import { apiFetch } from "./client"
import type { Program, ProgramCreate } from "../types"

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
    contributionSpec: p.contribution_spec as Program["contributionSpec"],
    projectName: p.project_name as string | undefined,
    tableName: p.table_name as string | undefined,
    cnnFilter: p.cnn_filter as string | undefined,
    tableCnn: p.table_cnn as Record<string, string> | undefined,
  }
}

export async function deleteProgram(id: string): Promise<void> {
  await apiFetch(`/api/programs/${id}`, { method: "DELETE" })
}

export async function createProgram(data: ProgramCreate): Promise<Program> {
  const res = await apiFetch<Record<string, unknown>>("/api/programs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: data.title,
      organization: data.organization ?? "",
      category: data.category ?? "Biodiversity",
      description: data.description ?? "",
      location: data.location ?? "",
      tags: data.tags ?? [],
      project_name: data.projectName,
      table_name: data.tableName,
      accepted_files: data.acceptedFiles ?? [],
      fields: data.fields ?? [],
      cnn_filter: data.cnnFilter ?? null,
      table_cnn: data.tableCnn ?? null,
    }),
  })
  return mapProgram(res)
}
