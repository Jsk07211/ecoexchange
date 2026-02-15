import { apiFetch } from "./client"
import type { DynamicTableRequest, DynamicTableResponse } from "../types"

export function createTable(req: DynamicTableRequest) {
  return apiFetch<DynamicTableResponse>("/api/tables", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: req.projectName,
      table_name: req.tableName,
      fields: req.fields,
    }),
  })
}

export interface ColumnSchema {
  name: string
  type: string
  nullable: boolean
}

export interface TableSchema {
  project: string
  table: string
  columns: ColumnSchema[]
}

export interface TableRows {
  project: string
  table: string
  total: number
  limit: number
  offset: number
  rows: Record<string, unknown>[]
}

export interface ProjectTables {
  project: string
  tables: string[]
}

export function getProjectTables(project: string) {
  return apiFetch<ProjectTables>(`/api/tables/${project}`)
}

export function getTableSchema(project: string, table: string) {
  return apiFetch<TableSchema>(`/api/tables/${project}/${table}/schema`)
}

export function getTableRows(
  project: string,
  table: string,
  limit = 100,
  offset = 0
) {
  return apiFetch<TableRows>(
    `/api/tables/${project}/${table}/rows?limit=${limit}&offset=${offset}`
  )
}

export function insertRow(project: string, table: string, data: Record<string, unknown>) {
  return apiFetch<{ status: string; row: Record<string, unknown> }>(
    `/api/tables/${project}/${table}/rows`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) }
  )
}

export function deleteRow(project: string, table: string, rowId: number) {
  return apiFetch<{ status: string; deleted_id: number }>(
    `/api/tables/${project}/${table}/rows/${rowId}`,
    { method: "DELETE" }
  )
}

export function insertRowsBatch(project: string, table: string, rows: Record<string, unknown>[]) {
  return apiFetch<{ status: string; count: number }>(
    `/api/tables/${project}/${table}/rows/batch`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) }
  )
}
