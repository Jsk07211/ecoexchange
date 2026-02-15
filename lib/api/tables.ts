import { apiFetch } from "./client"
import type { DynamicTableRequest, DynamicTableResponse } from "../types"

export async function createTable(data: DynamicTableRequest): Promise<DynamicTableResponse> {
  const body = {
    project_name: data.projectName,
    table_name: data.tableName,
    fields: data.fields.map((f) => ({ name: f.name, type: f.type })),
  }
  return apiFetch<DynamicTableResponse>("/api/tables", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export async function submitRowToTable(
  projectName: string,
  tableName: string,
  data: Record<string, string>
): Promise<{ status: string; id: number; total_records: number }> {
  return apiFetch(`/api/tables/${projectName}/${tableName}/rows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}
