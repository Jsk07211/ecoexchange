import { apiFetch } from "./client"

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
